// supabase/functions/sg-generate-series/index.ts
// Generates a weekly Study series and writes it to the DB:
// - Creates study_series (generated reflects whether AI actually ran)
// - Creates weekly study_entries (position 1..N)
// - Creates study_questions per entry with ai_answer filled; also sets `content`
// CORS enabled + safe fallback to mock if OpenAI fails.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type Visibility = "group" | "leader" | "private";

// ---- Env ----
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---- CORS ----
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your origin(s) if desired
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Utils ----
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function trimOrNull(s?: string | null) {
  const t = (s ?? "").trim();
  return t.length ? t : null;
}
function buildEntryContent(w: any): string {
  const parts: string[] = [];
  if (w?.overview) parts.push(w.overview);
  if (Array.isArray(w?.sections)) {
    for (const s of w.sections) {
      const title = s?.title ? `\n\n### ${s.title}\n` : "\n\n";
      const body = s?.content ?? "";
      parts.push(title + body);
    }
  }
  return parts.join("\n").trim();
}

// ---- OpenAI plan generation ----
type GenInput = { title: string; notes?: string; weeks: number };

async function generatePlanWithOpenAI(input: GenInput) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

  const sys = [
    "You are a Christian small-group study author.",
    "Design a weekly Bible study series that is biblical, pastoral, and practical.",
    "Audience: men in a fellowship group; tone: warm, encouraging, honest.",
    "Return ONLY JSON that matches the schema below. No prose outside JSON.",
  ].join(" ");

  const schema = {
    series_summary: "string (1–2 paragraphs)",
    weeks: [
      {
        title: "string",
        focus_ref: "string (Book Chapter:Verse(s))",
        overview: "string",
        sections: [{ title: "string", content: "string" }],
        questions: [{ prompt: "string", ai_answer: "string" }],
      },
    ],
  };

  const user = [
    `Title: ${input.title}`,
    input.notes ? `Notes: ${input.notes}` : null,
    `Weeks: ${input.weeks}`,
    "",
    "JSON schema to follow strictly:",
    JSON.stringify(schema, null, 2),
    "",
    "Constraints:",
    "- Include 1–3 key Scripture references per week; put the main one in 'focus_ref'.",
    "- Provide 2–4 'sections' that deepen understanding.",
    "- Provide 3–5 'questions'; each must include an 'ai_answer'.",
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`OpenAI error ${resp.status}: ${text}`);
  }

  let content: any;
  try {
    const data = JSON.parse(text);
    content = data?.choices?.[0]?.message?.content;
  } catch {
    throw new Error(`OpenAI parse error: ${text.slice(0, 400)}`);
  }
  if (!content) throw new Error("OpenAI returned no content");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Model did not return valid JSON: ${content.slice(0, 400)}`);
  }

  // normalize
  parsed.series_summary ||= "";
  parsed.weeks ||= [];
  for (const wk of parsed.weeks) {
    wk.title ||= "";
    wk.focus_ref ||= "";
    wk.overview ||= "";
    wk.sections ||= [];
    wk.questions ||= [];
  }
  // trim weeks
  if (Array.isArray(parsed.weeks) && parsed.weeks.length > input.weeks) {
    parsed.weeks = parsed.weeks.slice(0, input.weeks);
  }
  return parsed;
}

// ---- Mock plan (for dry-run / fallback) ----
function mockPlan(input: GenInput) {
  const weeks = clamp(input.weeks, 1, 12);
  const out = {
    series_summary:
      "A short, mock study generated in dry-run mode so you can test DB + UI without OpenAI.",
    weeks: [] as any[],
  };
  for (let i = 1; i <= weeks; i++) {
    out.weeks.push({
      title: `Week ${i}: ${input.title}`,
      focus_ref: "Romans 8:1-4",
      overview:
        "Overview placeholder for testing. Replace with real generation later.",
      sections: [
        { title: "Context", content: "Historical + literary context here." },
        { title: "Theme", content: "Main idea / heart of God here." },
      ],
      questions: [
        { prompt: "What does this reveal about God?", ai_answer: "He is gracious and near." },
        { prompt: "How might we live this out?", ai_answer: "Walk in the Spirit, not in condemnation." },
      ],
    });
  }
  return out;
}

// ---- HTTP Handler ----
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const body = await req.json();
    const group_id = String(body.group_id || "").trim();
    const title = String(body.title || "").trim();
    const notes = (body.notes ? String(body.notes) : "").trim();
    const weeksRaw = Number.isFinite(body.weeks) ? Number(body.weeks) : undefined;
    const weeks = clamp(weeksRaw ?? 6, 1, 12);
    const visibility: Visibility = (body.visibility as Visibility) ?? "group";
    const dryRun = Boolean(body.dry_run);

    if (!group_id || !title) {
      return json({ error: "group_id and title are required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userInfo, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userInfo?.user?.id) {
      return json({ error: "Not authenticated" }, 401);
    }
    const uid = userInfo.user.id;

    // Build plan (OpenAI or mock, with safe fallback)
    const input: GenInput = { title, notes, weeks };
    let plan: any;
    let usedAI = false;
    let warnMsg: string | undefined;

    if (dryRun || !OPENAI_API_KEY) {
      plan = mockPlan(input);
    } else {
      try {
        plan = await generatePlanWithOpenAI(input);
        usedAI = true;
      } catch (err: any) {
        warnMsg = `AI generation failed: ${String(err?.message ?? err)}`;
        console.error("OpenAI failure, falling back to mock:", warnMsg);
        plan = mockPlan(input);
        usedAI = false;
      }
    }

    // Insert series
    const { data: seriesRow, error: sErr } = await supabase
      .from("study_series")
      .insert({
        group_id,
        title,
        description: plan.series_summary ?? null,
        visibility,
        generated: usedAI, // true only if AI succeeded
        generator_model: usedAI ? OPENAI_MODEL : "mock",
        generator_meta: {
          seed_title: title,
          notes: notes || null,
          weeks_requested: weeks,
          schema_version: "v1",
          dry_run: dryRun || !OPENAI_API_KEY,
          used_ai: usedAI,
          ai_warning: warnMsg || null,
        },
        created_by: uid,
      })
      .select("id")
      .single();

    if (sErr) return json({ error: sErr.message }, 400);
    const series_id = seriesRow.id as string;

    // Insert entries + questions
    let position = 1;
    for (const wk of plan.weeks || []) {
      const { data: entryRow, error: eErr } = await supabase
        .from("study_entries")
        .insert({
          series_id,
          title: trimOrNull(wk.title),
          content: buildEntryContent(wk),
          focus_ref: trimOrNull(wk.focus_ref),
          position,
          created_by: uid,
        })
        .select("id")
        .single();
      if (eErr) return json({ error: eErr.message, series_id }, 400);

      const entry_id = entryRow.id as string;

      let qpos = 1;
      for (const q of wk.questions || []) {
        const ai = trimOrNull(q.ai_answer);
        const { error: qErr } = await supabase.from("study_questions").insert({
          entry_id,
          prompt: trimOrNull(q.prompt),
          content: ai ?? "",      // satisfy NOT NULL on content
          position: qpos,
          ai_answer: ai,
          created_by: uid,
          author_id: uid,         // your schema requires NOT NULL author_id
        });
        if (qErr) return json({ error: qErr.message, series_id }, 400);
        qpos++;
      }
      position++;
    }

    return json({ series_id, used_ai: usedAI, warning: warnMsg ?? null }, 200);
  } catch (e: any) {
    console.error("sg-generate-series error:", e?.stack ?? e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
