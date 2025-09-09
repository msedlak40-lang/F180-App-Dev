import React from "react";
import { supabase } from "../../lib/supabaseClient";

type GroupRequest = {
  id: string;
  org_id: string | null;
  created_by: string | null;
  name: string | null;
  email: string | null;
  location: string | null; // short label
  status: string | null;
  payload: any | null;
  created_at: string;
};

type InvokeResult =
  | { ok: true; via: "invoke" | "anon-fetch"; status?: number; data?: any }
  | {
      ok: false;
      via: "invoke" | "anon-fetch";
      status?: number;
      message: string;
      raw?: any;
    };

const DEBUG_WITH_ANON =
  (import.meta as any).env?.VITE_DEBUG_EMAIL_WITH_ANON === "1";

const FN_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL?.replace(/\/+$/, "") +
  "/functions/v1/send-approval-email";

const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

/** Safely read a key from the JSON payload */
function fromPayload(req: GroupRequest, key: string): string | null {
  try {
    return (req.payload && (req.payload[key] as string)) || null;
  } catch {
    return null;
  }
}

export default function ApprovalsPageF180() {
  const [rows, setRows] = React.useState<GroupRequest[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionBusy, setActionBusy] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  // Per-row last email result
  const [emailResult, setEmailResult] = React.useState<
    Record<string, InvokeResult | undefined>
  >({});

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let q = supabase.from("group_requests").select("*").order("created_at", { ascending: false });
        if (!showAll) q = q.eq("status", "pending");
        const { data, error } = await q;
        if (error) throw error;
        if (mounted) setRows(data as GroupRequest[]);
      } catch (e: any) {
        console.error("Load group_requests failed:", e);
        if (mounted) {
          setRows([]);
          setLoadError(e?.message ?? String(e));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showAll]);

  function isActionBusy(id: string, suffix: string) {
    return actionBusy === `${id}:${suffix}`;
  }

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      let q = supabase.from("group_requests").select("*").order("created_at", { ascending: false });
      if (!showAll) q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      setRows(data as GroupRequest[]);
    } catch (e: any) {
      console.error("Refresh group_requests failed:", e);
      setRows([]);
      setLoadError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  function buildEmailBody(req: GroupRequest, groupId: string | null) {
    return {
      to_email:
        req.email ||
        fromPayload(req, "email") ||
        fromPayload(req, "owner_email") ||
        "",
      name: req.name || fromPayload(req, "name") || "New Group",
      group_id: groupId,
    };
  }

  async function invokeEmail(req: GroupRequest, groupId: string | null) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-approval-email",
        { body: buildEmailBody(req, groupId) }
      );
      if (error) {
        const result: InvokeResult = {
          ok: false,
          via: "invoke",
          message: error.message ?? "Unknown error from supabase.functions",
          raw: error,
        };
        setEmailResult((m) => ({ ...m, [req.id]: result }));
        return result;
      }
      const result: InvokeResult = { ok: true, via: "invoke", data };
      setEmailResult((m) => ({ ...m, [req.id]: result }));
      return result;
    } catch (e: any) {
      const result: InvokeResult = {
        ok: false,
        via: "invoke",
        message: e?.message ?? "Exception during supabase.functions.invoke",
        raw: e,
      };
      setEmailResult((m) => ({ ...m, [req.id]: result }));
      return result;
    }
  }

  async function anonFetchEmail(req: GroupRequest, groupId: string | null) {
    if (!FN_URL || !ANON_KEY) {
      const result: InvokeResult = {
        ok: false,
        via: "anon-fetch",
        message:
          "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for anon fetch.",
      };
      setEmailResult((m) => ({ ...m, [req.id]: result }));
      return result;
    }
    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildEmailBody(req, groupId)),
      });
      const text = await resp.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      const result: InvokeResult = resp.ok
        ? { ok: true, via: "anon-fetch", status: resp.status, data: parsed }
        : { ok: false, via: "anon-fetch", status: resp.status, message: typeof parsed === "string" ? parsed : JSON.stringify(parsed) };
      setEmailResult((m) => ({ ...m, [req.id]: result }));
      return result;
    } catch (e: any) {
      const result: InvokeResult = {
        ok: false,
        via: "anon-fetch",
        message: e?.message ?? "Exception during anon fetch",
        raw: e,
      };
      setEmailResult((m) => ({ ...m, [req.id]: result }));
      return result;
    }
  }

  async function approve(req: GroupRequest) {
    try {
      setActionBusy(`${req.id}:approved`);
      const { data, error } = await supabase.rpc("approve_group_request", { p_id: req.id });
      if (error) {
        console.error("RPC approve_group_request error:", error);
        alert(`Failed to approve: ${error.message ?? "RPC error"}`);
        setActionBusy(null);
        return;
      }
      const newGroupId =
        (data && (data as any).group_id) ||
        (Array.isArray(data) && (data[0] as any)?.group_id) ||
        null;

      const first = await invokeEmail(req, newGroupId);
      if (!first.ok && DEBUG_WITH_ANON) {
        await anonFetchEmail(req, newGroupId);
      }
      await refresh();
    } finally {
      setActionBusy(null);
    }
  }

  async function decline(req: GroupRequest) {
    try {
      setActionBusy(`${req.id}:declined`);
      const { error } = await supabase.rpc("set_group_request_status", {
        p_id: req.id,
        p_status: "declined",
      });
      if (error) {
        console.error("RPC set_group_request_status error:", error);
        alert(`Failed to decline: ${error.message ?? "RPC error"}`);
      } else {
        await refresh();
      }
    } finally {
      setActionBusy(null);
    }
  }

  async function sendTestEmail(req: GroupRequest) {
    setActionBusy(`${req.id}:test`);
    try {
      const first = await invokeEmail(req, null);
      if (!first.ok && DEBUG_WITH_ANON) {
        await anonFetchEmail(req, null);
      }
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Group Approvals</h1>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show all statuses
          </label>
        </div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {DEBUG_WITH_ANON ? (
            <span className="rounded bg-yellow-500/10 px-2 py-1">
              Debug: anon-key fallback ENABLED
            </span>
          ) : (
            <span className="rounded bg-[hsl(var(--muted))/0.4] px-2 py-1">
              Debug: anon-key fallback disabled
            </span>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <strong>Query error:</strong> {loadError}
        </div>
      )}

      {loading ? (
        <div className="text-sm opacity-70">Loading requests…</div>
      ) : !rows?.length ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          No {showAll ? "requests" : "pending requests"}.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const ownerEmail =
              r.email ||
              fromPayload(r, "email") ||
              fromPayload(r, "owner_email");
            const meetingLocation =
              fromPayload(r, "meeting_location") ||
              fromPayload(r, "metting_location") || // typo guard
              r.location ||
              "—";

            const last = emailResult[r.id];
            const lastBadge = last ? (
              last.ok ? (
                <span className="rounded-full border px-2 py-0.5 text-[11px]">
                  Email OK via {last.via}
                  {last.status ? ` (${last.status})` : ""}
                </span>
              ) : (
                <span className="rounded-full border px-2 py-0.5 text-[11px]">
                  Email FAIL via {last.via}
                  {last.status ? ` (${last.status})` : ""}: {last.message}
                </span>
              )
            ) : null;

            return (
              <div
                key={r.id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-medium">
                        {r.name || fromPayload(r, "name") || "Unnamed group"}
                      </div>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        #{r.id.slice(0, 8)}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-[11px]">
                        status: {r.status ?? "null"}
                      </span>
                      {lastBadge}
                    </div>
                    <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      Owner: {ownerEmail || "—"} • Location: {meetingLocation}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Created: {new Date(r.created_at).toLocaleString()}
                    </div>
                    {r.payload && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs opacity-70">
                          View payload
                        </summary>
                        <pre className="mt-1 max-h-48 overflow-auto rounded bg-black/30 p-2 text-[11px]">
                          {JSON.stringify(r.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))]"
                      onClick={() => sendTestEmail(r)}
                      disabled={isActionBusy(r.id, "test")}
                      title="Trigger the email function without approving"
                    >
                      {isActionBusy(r.id, "test") ? "Sending…" : "Send test email"}
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-[hsl(var(--accent))]"
                      onClick={() => approve(r)}
                      disabled={isActionBusy(r.id, "approved")}
                    >
                      {isActionBusy(r.id, "approved") ? "Approving…" : "Approve"}
                    </button>
                    <button
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-[hsl(var(--destructive))]/10"
                      onClick={() => decline(r)}
                      disabled={isActionBusy(r.id, "declined")}
                    >
                      {isActionBusy(r.id, "declined") ? "Declining…" : "Decline"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
