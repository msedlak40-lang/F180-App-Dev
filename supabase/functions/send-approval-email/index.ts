// supabase/functions/send-approval-email/index.ts
// POST { to_email, name?, group_id? } -> sends via Resend
// Robust CORS: echoes allowed Origin + requested headers

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.3.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_OVERRIDE = Deno.env.get("EMAIL_OVERRIDE") || null;
const APP_URL = Deno.env.get("APP_URL") ?? "https://your-site.netlify.app";

// ALLOWED_ORIGINS can be a comma-separated list, e.g. "https://foo.app,https://bar.app"
// Use "*" to allow any (fine for testing).
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function pickOrigin(req: Request): string {
  const reqOrigin = req.headers.get("origin") || "";
  const allowAll = ALLOWED_ORIGINS.includes("*");
  if (allowAll) return "*";
  // exact match only (recommended)
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  // fallback to first allowed (still won't satisfy browser if it doesn't match)
  return ALLOWED_ORIGINS[0] || "*";
}

function corsHeaders(req: Request): HeadersInit {
  const acrh =
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": pickOrigin(req),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": acrh,
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
      m
    ]!
    )
  );
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    if (!RESEND_API_KEY) {
      return json(req, { error: "Missing RESEND_API_KEY" }, 500);
    }
    const resend = new Resend(RESEND_API_KEY);

    const body = await req.json().catch(() => ({}));
    const to_email: string = typeof body?.to_email === "string" ? body.to_email : "";
    const name: string = typeof body?.name === "string" ? body.name : "New Group";
    const group_id: string | null =
      typeof body?.group_id === "string" ? body.group_id : null;

    if (!to_email && !EMAIL_OVERRIDE) {
      return json(req, { error: "missing to_email" }, 400);
    }

    const loginLink = `${APP_URL}/#/login`;
    const groupLink = group_id ? `${APP_URL}/#/group/${group_id}` : `${APP_URL}/#/groups`;

    const safeName = escapeHtml(name);
    const subject = `Your group "${safeName}" has been approved`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#0b1221">
        <h2 style="margin:0 0 12px">Your Fireside group is approved</h2>
        <p style="margin:0 0 16px">"${safeName}" is ready. You can sign in and manage your group now.</p>
        <ol style="margin:0 0 16px; padding-left: 18px">
          <li>Sign in: <a href="${loginLink}">${loginLink}</a></li>
          <li>${group_id ? `Open your group: <a href="${groupLink}">${groupLink}</a>` : `Open your groups: <a href="${groupLink}">${groupLink}</a>`}</li>
        </ol>
        <p style="margin:24px 0 0; color:#6b7280; font-size:12px">If you didn’t request this, you can ignore this email.</p>
      </div>
    `;

    await resend.emails.send({
      from: "Fireside <onboarding@resend.dev>",
      to: [EMAIL_OVERRIDE || to_email],
      subject,
      html,
    });

    return json(req, { ok: true });
  } catch (e: any) {
    return json(req, { error: e?.message ?? String(e) }, 500);
  }
});
