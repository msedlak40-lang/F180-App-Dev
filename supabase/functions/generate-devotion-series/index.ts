// supabase/functions/generate-devotion-series/index.ts
// Deno Edge Function: generate a multi-day devotional series as JSON
// Requires secret: OPENAI_API_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type Scripture = { reference: string; text: string };
type Draft = { title: string; body_md: string; scriptures?: Scripture[] };

function cors(inHeaders?: Headers) {
  const origin = inHeaders?.get("origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function json(obj: unknown, status = 200, inHeaders?: Headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...cors(inHeaders) },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req.headers) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, req.headers);

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Missing OPENAI_API_KEY" }, 500, req.headers);

    const body = await req.json().catch(() => ({}));
    const theme: string = String(body?.theme ?? "").trim();
    const days: number = Math.max(1, Math.min(30, Number(body?.days ?? 5)));
    const notes: string = String(body?.notes ?? "").trim();
    const tone: string = String(body?.tone ?? "warm, pastoral, practical").trim();

    if (!theme) return json({ error: "Field `theme` is required" }, 400, req.headers);

    const sys =
      "You are a Christian devotional writer who is biblical, encouraging, and practical.";
    const usr = [
      `Generate ${days} daily devotionals based on this theme: "${theme}".`,
      "Rules per entry:",
      "- Length ~300–450 words.",
      "- Include 1–3 Scripture references AND include the verse text.",
      "- Use a warm, pastoral tone with practical application.",
      "- Output Markdown in a field named `body_md` (paragraphs, bold, italics allowed).",
      "",
      "Return STRICT JSON ONLY with this shape:",
      `{
  "items": [
    {
      "title": "string (<= 180 chars)",
      "body_md": "markdown content",
      "scriptures": [{"reference":"Book 1:1-2", "text":"verse text"}]
    }
  ]
}`,
      notes ? `\nAdditional user notes (optional):\n${notes}` : "",
      `\nTone hint: ${tone}`,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" }, // ask for strict JSON
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return json({ error: `OpenAI error ${r.status}: ${txt}` }, 502, req.headers);
    }

    const data = await r.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;

    let parsed: any;
    try {
      parsed = content ? JSON.parse(content) : null;
    } catch {
      // fall back: try to pull the last JSON-looking block
      const m = content?.match(/\{[\s\S]*\}$/);
      parsed = m ? JSON.parse(m[0]) : null;
    }

    const itemsIn = Array.isArray(parsed?.items) ? parsed.items : [];
    const items: Draft[] = itemsIn
      .slice(0, days)
      .map((it: any) => ({
        title: String(it?.title ?? "").slice(0, 180),
        body_md: String(it?.body_md ?? "").slice(0, 20000),
        scriptures: Array.isArray(it?.scriptures)
          ? it.scriptures
              .filter((s: any) => s && s.reference && s.text)
              .slice(0, 5)
              .map((s: any) => ({
                reference: String(s.reference),
                text: String(s.text),
              }))
          : [],
      }))
      .filter((d: Draft) => d.title && d.body_md);

    if (!items.length) return json({ error: "Model returned no usable items" }, 502, req.headers);

    return json({ items }, 200, req.headers);
  } catch (e: any) {
    return json({ error: e?.message ?? "Server error" }, 500, req.headers);
  }
});
