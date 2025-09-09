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

  // Per-row last email result (so you can see status/message inline)
  const [emailResult, setEmailResult] = React.useState<
    Record<string, InvokeResult | undefined>
  >({});

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("group_requests")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (mounted) setRows(data as GroupRequest[]);
      } catch (e) {
        console.error("Load pending requests failed:", e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function isActionBusy(id: string, suffix: string) {
    return actionBusy === `${id}:${suffix}`;
  }

  async function refresh() {
    const { data, error } = await supabase
      .from("group_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Refresh failed:", error);
      return;
    }
    setRows(data as GroupRequest[]);
  }

  function buildEmailBody(req: GroupRequest, groupId: string | null) {
    return {
      to_email:
        req.email ||
        fromPayload(req, "email") ||
        fromPayload(req, "owner_email") ||
        "",
      name: req.name || fromPayload(req, "name") || "New Group",
      group_id: groupId, // may be null; function should handle
    };
  }

  async function invokeEmail(req: GroupRequest, groupId: string | null) {
    // First try normal browser invoke (user JWT)
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-approval-email",
        {
          body: buildEmailBody(req, groupId),
        }
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
      const result: InvokeResult = {
        ok: true,
        via: "invoke",
        data,
      };
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
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      const result: InvokeResult = resp.ok
        ? { ok: true, via: "anon-fetch", status: resp.status, data: parsed }
        : {
            ok: false,
            via: "anon-fetch",
            status: resp.status,
            message: typeof parsed === "string" ? parsed : JSON.stringify(parsed),
          };
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

      // 1) Create the group + mark approved (your RPC does mapping & status)
      const { data, error } = await supabase.rpc("approve_group_request", {
        p_id: req.id,
      });
      if (error) {
        console.error("RPC approve_group_request error:", error);
        alert(`Failed to approve: ${error.message ?? "RPC error"}`);
        setActionBusy(null);
        return;
      }

      // Try to extract the new group id if your RPC returns it
      const newGroupId =
        (data && (data as any).group_id) ||
        (Array.isArray(data) && (data[0] as any)?.group_id) ||
        null;

      // 2) Trigger email via browser invoke
      const first = await invokeEmail(req, newGroupId);

      // 3) Optional fallback (PowerShell-mirror using anon key)
      if (!first.ok && DEBUG_WITH_ANON) {
        await anonFetchEmail(req, newGroupId);
      }

      // 4) Refresh list
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
        <h1 className="text-xl font-semibold">Group Approvals</h1>
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

      {loading ? (
        <div className="text-sm opacity-70">Loading pending requests…</div>
      ) : !rows?.length ? (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 text-sm text-[hsl(var(--muted-foreground))]">
          No pending requests.
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
                      {lastBadge}
                    </div>
                    <div className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                      Owner: {ownerEmail || "—"} • Location: {meetingLocation}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Created: {new Date(r.created_at).toLocaleString()}
                    </div>
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

                {last && (
                  <div className="mt-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 p-3">
                    <div className="text-xs">
                      <div>
                        <strong>Last email attempt:</strong>{" "}
                        {last.ok ? "Success" : "Failure"} via <code>{last.via}</code>
                        {last.status ? ` (HTTP ${last.status})` : ""}
                      </div>
                      {!last.ok && last.message && (
                        <div className="mt-1">Message: {last.message}</div>
                      )}
                      {DEBUG_WITH_ANON && !last.ok && (
                        <div className="mt-2">
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={() => anonFetchEmail(r, null)}
                          >
                            Retry with anon-key (PowerShell mirror)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
