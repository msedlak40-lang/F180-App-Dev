// supabase/functions/generate-devotion/index.ts
// Generates a devotional from a title, with optional notes to weave in.
// Returns JSON: { title, body_md, scriptures: [{reference,text}, ...] }

type Payload = {
  mode: 'title' | 'assist';
  title: string;
  notes?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYS_PROMPT = `You are a Christian devotional writer who is biblical, encouraging, and practical.`;

function buildUserPrompt(p: Payload) {
  const base = [
    `Write a detailed Christian devotional on the theme: "${p.title}".`,
    'Include 1–3 Scripture references and include the verse text.',
    'Warm, pastoral tone; focus on daily life application.',
    'Length: ~300–450 words.',
  ];
  if (p.mode === 'assist' && p.notes && p.notes.trim()) {
    base.unshift(`Weave in these notes (bullet points/ideas): ${p.notes.trim()}`);
  }
  // Ask for strict JSON so we can parse it safely.
  base.push(
    'Output STRICT JSON only with this shape: ' +
      '{ "title": string, "body_md": string, "scriptures": [{ "reference": string, "text": string }] } ' +
      '(No markdown fences, no commentary—JSON only).',
  );
  return base.join('\n');
}

function extractJson(s: string) {
  // If the model ever wraps in fences, strip them and parse best-effort.
  const trimmed = s.trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  // Try direct parse first
  try { return JSON.parse(trimmed); } catch {}
  // Fallback: take the first {...} block
  const m = trimmed.match(/\{[\s\S]*\}$/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error('Failed to parse AI JSON');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as Payload;
    if (!payload?.title || !payload.mode) {
      return new Response(JSON.stringify({ error: 'mode and title are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = buildUserPrompt(payload);

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYS_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: `OpenAI error ${resp.status}: ${txt}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const json = extractJson(content);

    // Basic shape guard
    const out = {
      title: String(json?.title ?? payload.title),
      body_md: String(json?.body_md ?? ''),
      scriptures: Array.isArray(json?.scriptures) ? json.scriptures.map((x: any) => ({
        reference: String(x?.reference ?? ''),
        text: String(x?.text ?? ''),
      })) : [],
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
