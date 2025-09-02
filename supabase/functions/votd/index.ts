// supabase/functions/votd/index.ts
// Verse of the Day — deterministic per day (+user/group) with simple paraphrase.
// No DB required. Uses OpenAI if OPENAI_API_KEY is set; otherwise a safe fallback.
//
// Deploy: supabase functions deploy votd
// Invoke from web: supabase.functions.invoke('votd', { body: { group_id } })

// Deno / HTTP
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Optional: OpenAI (native fetch)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// A small, public-domain verse pool (KJV) with lightweight metadata.
// You can expand/replace this later or read from a table.
type Verse = {
  ref: string;
  text: string;
  testament: "OT" | "NT";
  tags: string[];
};
const POOL: Verse[] = [
  {
    ref: "Romans 5:8",
    text:
      "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
    testament: "NT",
    tags: ["Love", "Grace", "Identity"],
  },
  {
    ref: "John 3:16",
    text:
      "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    testament: "NT",
    tags: ["Gospel", "Love", "Salvation"],
  },
  {
    ref: "Psalm 23:1",
    text: "The LORD is my shepherd; I shall not want.",
    testament: "OT",
    tags: ["Trust", "Provision", "Comfort"],
  },
  {
    ref: "Proverbs 3:5-6",
    text:
      "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.",
    testament: "OT",
    tags: ["Wisdom", "Guidance", "Trust"],
  },
  {
    ref: "Isaiah 41:10",
    text:
      "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee...",
    testament: "OT",
    tags: ["Courage", "Presence", "Strength"],
  },
  {
    ref: "Philippians 4:6-7",
    text:
      "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God...",
    testament: "NT",
    tags: ["Prayer", "Peace", "Anxiety"],
  },
  {
    ref: "1 Corinthians 10:13",
    text:
      "There hath no temptation taken you but such as is common to man: but God is faithful...",
    testament: "NT",
    tags: ["Temptation", "Faithfulness", "Escape"],
  },
  {
    ref: "Matthew 11:28",
    text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    testament: "NT",
    tags: ["Rest", "Invitation", "Grace"],
  },
  {
    ref: "Joshua 1:9",
    text:
      "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
    testament: "OT",
    tags: ["Courage", "Obedience", "Presence"],
  },
  {
    ref: "Micah 6:8",
    text:
      "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
    testament: "OT",
    tags: ["Justice", "Mercy", "Humility"],
  },
];

// Simple deterministic picker: date + (group/user) → index
function pickIndex(seed: string, len: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % len;
}

async function paraphrase(text: string, ref: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const prompt =
      `In 1–2 short sentences (max 40 words), explain ${ref} in simple, 5th-grade English. ` +
      `Do not quote the verse; only paraphrase clearly and gently. Keep it pastoral and encouraging.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a gentle Christian guide who writes for a 5th-grade reading level." },
          { role: "user", content: `${ref}: ${text}\n\n${prompt}` },
        ],
        temperature: 0.4,
        max_tokens: 120,
      }),
    });
    const json = await res.json();
    const msg = json?.choices?.[0]?.message?.content?.trim();
    if (!msg) return null;
    return msg;
  } catch {
    return null;
  }
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  try {
    const { group_id = null } = (await req.json().catch(() => ({}))) as {
      group_id?: string | null;
    };

    // derive a stable seed per calendar day
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const dayKey = `${yyyy}-${mm}-${dd}`;

    const seed = `${dayKey}:${group_id ?? "global"}`;
    const idx = pickIndex(seed, POOL.length);
    const v = POOL[idx];

    const plain =
      (await paraphrase(v.text, v.ref)) ??
      // fallback if no OPENAI_API_KEY
      (() => {
        // ultra-simple fallback for first-run without OpenAI
        if (v.ref === "Romans 5:8") return "God loved us first. Even when we were doing wrong, Jesus chose to die for us.";
        if (v.ref === "John 3:16") return "God loves everyone. He sent Jesus so anyone who trusts Him can have life with God forever.";
        return "God is with you today. Trust Him, and take one small step with courage.";
      })();

    const body = {
      date: dayKey,
      seed,
      verse: {
        ref: v.ref,
        text: v.text,
        testament: v.testament,
        tags: v.tags,
      },
      plain_words: plain,
    };

    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 500,
    });
  }
});
