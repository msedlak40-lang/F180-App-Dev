// Deno edge function: enrich-verse
// POST { "verse_id": "<uuid>" }
// Requires Authorization: Bearer <user_jwt>
// Env provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY
// Extra secrets you set: SERVICE_ROLE_KEY, OPENAI_API_KEY, RAPIDAPI_KEY (optional), OPENAI_MODEL (optional),
// optional BIBLE_API_BASE

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type UUID = string;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY") ?? "";
const BIBLE_API_BASE =
  Deno.env.get("BIBLE_API_BASE") ?? "https://ajith-holy-bible.p.rapidapi.com";

const OT_BOOKS = new Set([
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon",
  "Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah",
  "Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"
]);
const NT_BOOKS = new Set([
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians",
  "Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation"
]);

type GroupVerse = {
  id: UUID;
  group_id: UUID;
  reference: string;
  version: string | null;
  verse_text: string | null;
  testament: "old" | "new" | null;
  status: "pending" | "enriching" | "enriched" | "error";
};

type Enrichment = {
  author_name: string;
  author_role: string;
  setting_context: string;
  simplified_5th: string;
  hebrew_keywords?: string[];
  greek_keywords?: string[];
  book_context_summary: string;
  classification: string;
  tags: string[];
  heart_snapshot: string;        // “God is ___ here”
  emotional_climate: string[];   // e.g., ["rebellion","lament","awe"]
  then_now_bridge: string;       // 1–2 lines connecting to today
  cross_references: string[];    // e.g., ["Isaiah 53:5","1 Peter 2:24"]
};

const BIBLE_TRANSLATION_MAP: Record<string, string> = {
  // bible-api.com supports at least: 'kjv' and 'web'
  ESV: "web",
  NIV: "web",
  NLT: "web",
  NKJV: "kjv",
  KJV: "kjv",
};

// ------------- HTTP helpers -------------
function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function uniqStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s.trim());
    }
  }
  return out;
}

// ------------- DB helpers -------------
async function setStatus(
  sb: ReturnType<typeof createClient>,
  verse_id: UUID,
  status: "pending" | "enriching" | "enriched" | "error",
  error_message?: string
) {
  const patch: Record<string, unknown> = { status };
  if (status === "error") patch.error_message = truncate(error_message ?? "Unknown error", 400);
  await sb.from("group_verses").update(patch).eq("id", verse_id);
}

function normalizeBook(book: string) {
  return book
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function determineTestament(book: string): "old" | "new" {
  const norm = normalizeBook(book);
  if (OT_BOOKS.has(norm)) return "old";
  if (NT_BOOKS.has(norm)) return "new";
  return "new";
}

function parseReference(ref: string): { book: string; chapter: number; verseStr: string } {
  // Examples: "John 3:16", "1 John 3:18", "Romans 8:28-29"
  const match = ref.trim().match(/^([\dI]{0,3}\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):([\d\-–,]+)$/);
  if (!match) throw new Error(`Unrecognized reference format: ${ref}`);
  const book = normalizeBook(match[1]);
  const chapter = Number(match[2]);
  const verseStr = match[3];
  return { book, chapter, verseStr };
}

// ------------- External calls -------------
async function fetchBibleText(
  book: string,
  chapter: number,
  verseStr: string,
  versionHint?: string
): Promise<string | null> {
  const firstVerse = String(verseStr).split(/[,\-–]/)[0].trim();

  // 1) Ajith (RapidAPI)
  try {
    const urlAjith = `${BIBLE_API_BASE}/GetVerse?Book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(
      String(chapter)
    )}&Verse=${encodeURIComponent(firstVerse)}`;

    const headers: HeadersInit = RAPIDAPI_KEY
      ? { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": "ajith-holy-bible.p.rapidapi.com" }
      : {};

    const res = await fetch(urlAjith, { headers });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      const candidates = [
        j?.Output, j?.output, j?.text, j?.verse, j?.Verse, j?.message, typeof j === "string" ? j : null,
      ].filter((x) => typeof x === "string") as string[];
      if (candidates[0]?.trim()) return candidates[0].trim();
    }
  } catch (_) {
    // fall through
  }

  // 2) bible-api.com (no key) with translation hint
  try {
    const ref = `${book} ${chapter}:${firstVerse}`;
    const translation =
      versionHint && BIBLE_TRANSLATION_MAP[versionHint.toUpperCase()]
        ? BIBLE_TRANSLATION_MAP[versionHint.toUpperCase()]
        : "web";
    const res2 = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${translation}`);
    if (res2.ok) {
      const j2 = await res2.json();
      if (typeof j2?.text === "string" && j2.text.trim()) return j2.text.trim();
    }
  } catch (_) {}

  return null;
}

async function generateEnrichment(input: {
  reference: string;
  verse_text: string;
  bookTestament: "old" | "new";
}): Promise<Enrichment> {
  const sys = [
    "You are a biblical study assistant for a men's fellowship app.",
    "Output STRICT JSON only. No markdown. No commentary.",
    "When highlighting key words, use ENGLISH transliterations with a short gloss in parentheses, e.g., 'hesed (steadfast love)'.",
  ].join(" ");

  const user = {
    task: "enrich_verse",
    reference: input.reference,
    testament: input.bookTestament,
    verse_text: input.verse_text,
    requirements: {
      author_name: "string",
      author_role: "string",
      setting_context: "string",
      simplified_5th: "string",
      book_context_summary: "string",
      classification: "string",
      tags: "array of 3-7 concise topical tags",
      hebrew_keywords: input.bookTestament === "old" ? "array of 2-6 transliterations + gloss" : "omit",
      greek_keywords: input.bookTestament === "new" ? "array of 2-6 transliterations + gloss" : "omit",
      heart_snapshot: "string: one-sentence 'God is ___ here' statement",
      emotional_climate: "array of 2-6 emotions or moral climates, e.g., rebellion, lament, awe, gratitude, fear, hope, repentance",
      then_now_bridge: "string: 1–2 short lines connecting ancient context to life today",
      cross_references: "array of 2-4 verse references as strings, e.g., 'Isaiah 53:5'",
    },
    notes: [
      "Prefer conservative, widely-accepted biblical scholarship.",
      "Do NOT include Hebrew/Greek script; use transliterations with English gloss.",
    ],
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${txt}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI did not return valid JSON");
  }

  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean) : [];
  const base: Enrichment = {
    author_name: String(parsed.author_name ?? ""),
    author_role: String(parsed.author_role ?? ""),
    setting_context: String(parsed.setting_context ?? ""),
    simplified_5th: String(parsed.simplified_5th ?? ""),
    book_context_summary: String(parsed.book_context_summary ?? ""),
    classification: String(parsed.classification ?? ""),
    tags,
    heart_snapshot: String(parsed.heart_snapshot ?? ""),
    emotional_climate: (Array.isArray(parsed.emotional_climate) ? parsed.emotional_climate : [])
    .map((x: unknown) => String(x)).filter(Boolean).slice(0, 8),
    then_now_bridge: String(parsed.then_now_bridge ?? ""),
    cross_references: (Array.isArray(parsed.cross_references) ? parsed.cross_references : [])
    .map((x: unknown) => String(x)).filter(Boolean).slice(0, 6),
  };

  if (input.bookTestament === "old") {
    base.hebrew_keywords = (Array.isArray(parsed.hebrew_keywords) ? parsed.hebrew_keywords : [])
      .map((x: unknown) => String(x)).filter(Boolean).slice(0, 8);
  } else {
    base.greek_keywords = (Array.isArray(parsed.greek_keywords) ? parsed.greek_keywords : [])
      .map((x: unknown) => String(x)).filter(Boolean).slice(0, 8);
  }

  return base;
}

// ------------- HTTP handler -------------
serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

  try {
    if (req.method !== "POST") return cors(json({ error: "Method not allowed" }, 405));

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return cors(json({ error: "Missing Authorization Bearer token" }, 401));

    const body = await req.json().catch(() => ({}));
    const verse_id: UUID | undefined = body?.verse_id;
    if (!verse_id) return cors(json({ error: "Missing verse_id" }, 400));

    // user-scoped client (to read caller user) and service client (for writes)
    const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // caller user
    const { data: userRes, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userRes?.user) return cors(json({ error: "Unauthorized" }, 401));
    const callerId: UUID = userRes.user.id;

    // verse row
    const { data: verse, error: vErr } = await sb
      .from("group_verses")
      .select("id, group_id, reference, version, verse_text, testament, status")
      .eq("id", verse_id)
      .single();
    if (vErr || !verse) return cors(json({ error: "Verse not found" }, 404));

    // permission: group member OR org admin
    const { data: isMember, error: mErr } = await sb.rpc("fn_is_group_member", {
      p_group_id: verse.group_id,
      p_user_id: callerId,
    });
    if (mErr) throw mErr;

    const { data: orgIdRes, error: orgErr } = await sb.rpc("fn_group_org", {
      p_group_id: verse.group_id,
    });
    if (orgErr) throw orgErr;
    const org_id: UUID = orgIdRes;

    const { data: isAdmin, error: aErr } = await sb.rpc("fn_is_org_admin", {
      p_org_id: org_id,
      p_user_id: callerId,
    });
    if (aErr) throw aErr;

    if (!isMember && !isAdmin) return cors(json({ error: "Forbidden: not a group member or admin" }, 403));

    // fetch missing verse text/testament
    let verse_text = verse.verse_text as string | null;
    let testament = verse.testament as "old" | "new" | null;

    if (!verse_text || !testament) {
      const { book, chapter, verseStr } = parseReference(verse.reference);
      verse_text = await fetchBibleText(book, chapter, verseStr, verse.version || undefined);
      if (!verse_text) {
        await setStatus(sb, verse.id, "error", "Bible API: unable to resolve verse_text");
        return cors(json({ error: "Bible API lookup failed" }, 502));
      }
      testament = determineTestament(book);

      await sb.from("group_verses").update({ verse_text, testament }).eq("id", verse.id);
    }

    // mark enriching
    await setStatus(sb, verse.id, "enriching");

    // OpenAI enrichment
    const enrichment = await generateEnrichment({
      reference: verse.reference,
      verse_text,
      bookTestament: (testament ?? "new"),
    });

    const updatePayload: Record<string, unknown> = {
      author_name: enrichment.author_name,
      author_role: enrichment.author_role,
      setting_context: enrichment.setting_context,
      simplified_5th: enrichment.simplified_5th,
      book_context_summary: enrichment.book_context_summary,
      classification: enrichment.classification,
      tags: uniqStrings(enrichment.tags),
      heart_snapshot: enrichment.heart_snapshot,
      emotional_climate: uniqStrings(enrichment.emotional_climate),
      then_now_bridge: enrichment.then_now_bridge,
      cross_references: uniqStrings(enrichment.cross_references),
      enriched_at: new Date().toISOString(),
      enriched_by: callerId,
      status: "enriched",
      error_message: null,
    };

    if (testament === "old") {
      updatePayload.hebrew_keywords = (enrichment.hebrew_keywords ?? []).slice(0, 8);
      updatePayload.greek_keywords = null;
    } else {
      updatePayload.greek_keywords = (enrichment.greek_keywords ?? []).slice(0, 8);
      updatePayload.hebrew_keywords = null;
    }

    await sb.from("group_verses").update(updatePayload).eq("id", verse.id);

    return cors(json({ ok: true, verse_id: verse.id, status: "enriched" }));
  } catch (err) {
    // best-effort: set error status if we have an id in the request
    try {
      const maybeBody = await req.clone().json().catch(() => ({}));
      if (maybeBody?.verse_id) {
        const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
        await setStatus(sb, maybeBody.verse_id, "error", String(err));
      }
    } catch (_) {}
    return cors(json({ error: String(err) }, 500));
  }
});
