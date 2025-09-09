// supabase/functions/send-approval-email/index.ts
// Minimal: no DB calls. Expects { to_email, name?, group_id? } in the body.
// Sends via Resend using a dev-safe From address.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.3.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://moonlit-cobbler-75fa9b.netlify.app";

serve(async (req) => {
  try {
    const { to_email, name, group_id } = await req.json();

    if (!to_email || typeof to_email !== "string") {
      return new Response(JSON.stringify({ error: "missing to_email" }), { status: 400 });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: true, skipped: "RESEND_API_KEY not set" }), { status: 200 });
    }

    const resend = new Resend(RESEND_API_KEY);

    const loginLink = `${APP_URL}/#/login`;
    const groupLink = group_id
      ? `${APP_URL}/#/group/${group_id}/members-f180`
      : `${APP_URL}/#/groups`;

    const subject = `Your Fireside group request was approved`;
    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;">
        <h2 style="margin:0 0 12px;">Great news — you're approved 🎉</h2>
        <p style="margin:0 0 12px;">Your request for <strong>${escapeHtml(name ?? "a Fireside group")}</strong> has been approved.</p>
        <ol style="margin:0 0 16px; padding-left: 20px;">
          <li>Sign in: <a href="${loginLink}">${loginLink}</a></li>
          <li>Open your group: <a href="${groupLink}">${groupLink}</a></li>
        </ol>
        <p style="margin:24px 0 0; color:#6b7280; font-size:12px;">If you didn’t make this request, you can ignore this email.</p>
      </div>
    `;

    await resend.emails.send({
      from: "Fireside <onboarding@resend.dev>", // dev-safe sender
      to: [to_email],
      subject,
      html,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500 });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]!)
  );
}
