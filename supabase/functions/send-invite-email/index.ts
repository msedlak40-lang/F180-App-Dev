// supabase/functions/send-invite-email/index.ts
// Uses EXISTING columns on public.group_invitations:
//   id, group_id, email, role (default 'member'), status (default 'pending'),
//   invite_token (text, NOT NULL, UNIQUE), expires_at (default now()+7d),
//   invited_by, accepted_by, created_at
//
// POST body:
//   { group_id: string, email: string }   OR   { invitation_id: string }
//
// Behavior:
//   - Only group 'leader' or 'owner' may call
//   - Creates or refreshes a pending invitation
//   - Generates a one-time invite_token and (re)sets expires_at to now()+7d
//   - Sends an email with link:  ${APP_URL}/#/accept-invite?token=<token>
//
// CORS: controlled by ALLOWED_ORIGINS secret (comma-separated list or "*")

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.3.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? "https://your-site.netlify.app";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function pickOrigin(req: Request): string {
  const reqOrigin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes("*")) return "*";
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
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
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]!)
  );
}

function b64url(bytes: Uint8Array) {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  try {
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
    if (!RESEND_API_KEY) return json(req, { error: "Missing RESEND_API_KEY" }, 500);

    // Supabase client that honors the caller's JWT (RLS applies as the user)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    // Who is calling?
    const { data: me } = await supabase.auth.getUser();
    const user = me?.user;
    if (!user) return json(req, { error: "Unauthorized" }, 401);

    // Parse body
    const body = await req.json().catch(() => ({}));
    const invitation_id: string | null =
      typeof body?.invitation_id === "string" ? body.invitation_id : null;
    const group_id: string | null = typeof body?.group_id === "string" ? body.group_id : null;
    const email: string | null =
      typeof body?.email === "string" ? body.email.trim() : null;

    // Resolve target group/email
    let targetGroupId = group_id;
    let targetEmail = email;

    if (invitation_id) {
      const { data: inv, error: invErr } = await supabase
        .from("group_invitations")
        .select("id, group_id, email, status")
        .eq("id", invitation_id)
        .single();
      if (invErr || !inv) return json(req, { error: "Invitation not found" }, 404);
      if (inv.status && inv.status !== "pending") {
        return json(req, { error: `Invitation is ${inv.status}` }, 400);
      }
      targetGroupId = inv.group_id;
      targetEmail = inv.email;
    }

    if (!targetGroupId || !targetEmail) {
      return json(req, { error: "Provide group_id+email or invitation_id" }, 400);
    }

    // Caller must be leader or owner of the group
    {
      const { data: m, error: mErr } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", targetGroupId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (mErr) return json(req, { error: "Membership check failed" }, 403);
      const role = m?.role ?? null;
      if (!role || !["leader", "owner"].includes(role)) {
        return json(req, { error: "Forbidden: requires leader/owner" }, 403);
      }
    }

    // Fetch group name (for email)
    const { data: g } = await supabase
      .from("groups")
      .select("name")
      .eq("id", targetGroupId)
      .single();
    const groupName = g?.name ?? "Your group";

    // Create or refresh a pending invitation
    // NOTE: invite_token is NOT NULL and UNIQUE; we regenerate on each send
    const token = newToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    // Try to find existing pending invitation for this email
    const { data: existing } = await supabase
      .from("group_invitations")
      .select("id")
      .eq("group_id", targetGroupId)
      .eq("email", targetEmail)
      .eq("status", "pending")
      .maybeSingle();

    let inviteId = existing?.id ?? invitation_id ?? null;

    if (inviteId) {
      const { error: updErr } = await supabase
        .from("group_invitations")
        .update({
          invite_token: token,
          expires_at: expiresAt,
          invited_by: user.id,
        })
        .eq("id", inviteId);
      if (updErr) {
        // Handle possible UNIQUE violation on invite_token by retrying once
        if (String(updErr?.code) === "23505") {
          const retryToken = newToken();
          const { error: retryErr } = await supabase
            .from("group_invitations")
            .update({
              invite_token: retryToken,
              expires_at: expiresAt,
              invited_by: user.id,
            })
            .eq("id", inviteId);
          if (retryErr) return json(req, { error: "Failed to update invitation" }, 500);
        } else {
          return json(req, { error: "Failed to update invitation" }, 500);
        }
      }
    } else {
      // Insert new pending invite (role/status defaults apply; we still set status for clarity)
      const { data: ins, error: insErr } = await supabase
        .from("group_invitations")
        .insert({
          group_id: targetGroupId,
          email: targetEmail,
          invite_token: token,
          expires_at: expiresAt, // could rely on default; explicit is fine
          invited_by: user.id,
          status: "pending",
          // role omitted → defaults to 'member'
        })
        .select("id")
        .single();
      if (insErr || !ins) return json(req, { error: "Failed to create invitation" }, 500);
      inviteId = ins.id as string;
    }

    // Build accept link + send email
    const acceptLink = `${APP_URL}/#/accept-invite?token=${token}`;
    const resend = new Resend(RESEND_API_KEY);

    const safeGroup = escapeHtml(groupName);
    const subject = `You're invited to join "${safeGroup}" on Fireside`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#0b1221">
        <h2 style="margin:0 0 12px">Join "${safeGroup}"</h2>
        <p style="margin:0 0 16px">You’ve been invited to this Fireside group.</p>
        <p style="margin:0 0 16px"><a href="${acceptLink}">Accept your invite</a></p>
        <p style="margin:16px 0 0; color:#6b7280; font-size:12px">This link expires on ${new Date(expiresAt).toUTCString()}.</p>
      </div>
    `;

    await resend.emails.send({
      from: "Fireside <onboarding@resend.dev>",
      to: [targetEmail],
      subject,
      html,
    });

    return json(req, {
      ok: true,
      invitation_id: inviteId,
      email: targetEmail,
      group_id: targetGroupId,
      expires_at: expiresAt,
    });
  } catch (e: any) {
    return json(req, { error: e?.message ?? String(e) }, 500);
  }
});
