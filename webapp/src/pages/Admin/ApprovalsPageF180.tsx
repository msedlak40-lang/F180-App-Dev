import React from "react";
import { adminListPendingGroups, type PendingGroup } from "../../services/admin";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

type ViewMode = "cards" | "table";

type Row = PendingGroup & {
  id?: string;
  group_id?: string;
  name?: string;
  owner_name?: string;
  owner_email?: string;
  location?: string;
  day?: string;
  time?: string;
  tz?: string;
  created_at?: string;
  notes?: string;
};

export default function ApprovalsPageF180() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<ViewMode>("cards");

  // Demo mode state
  const [isDemo, setIsDemo] = React.useState(false);
  const [demoRows, setDemoRows] = React.useState<Row[]>([]);

  // Drawer state
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = React.useMemo(
    () =>
      (isDemo ? demoRows : rows).find(
        (r: any) => r?.id === openId || r?.group_id === openId
      ) as Row | undefined,
    [openId, rows, demoRows, isDemo]
  );

  React.useEffect(() => {
    // enable demo via hash query: /#/admin/approvals-f180?demo=1
    try {
      const hash =
        typeof window !== "undefined" && window.location && typeof window.location.hash === "string"
          ? window.location.hash
          : "";
      const qIndex = hash.indexOf("?");
      const qs = qIndex >= 0 ? hash.slice(qIndex + 1) : "";
      const p = new URLSearchParams(qs);
      const demo = p.get("demo");
      if (demo === "1" || demo === "true") enableDemo();
    } catch { /* ignore */ }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = (await adminListPendingGroups()) as Row[] | null;
      setRows(list ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }

  function makeDemoRows(): Row[] {
    const now = Date.now();
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const tzs = ["CT", "ET", "MT", "PT"];
    const cities = ["Kansas City, MO", "Austin, TX", "Nashville, TN", "Omaha, NE", "Tampa, FL", "Phoenix, AZ"];

    const owners = [
      ["James Carter", "jcarter@example.com"],
      ["Michael Reed", "mreed@example.com"],
      ["Daniel Ortiz", "dortiz@example.com"],
      ["Aaron Brooks", "abrooks@example.com"],
      ["Nathan Cole", "ncole@example.com"],
      ["Paul Bennett", "pbennett@example.com"],
    ];

    const names = [
      "Fireside North — Men’s Group",
      "Iron Sharpens Iron (West)",
      "Tuesday Dawn Fire",
      "Recovery & Renewal",
      "Courage Under Fire",
      "Walking in Freedom",
    ];

    return Array.from({ length: 8 }).map((_, i) => {
      const [ownerName, ownerEmail] = owners[i % owners.length];
      const name = names[i % names.length];
      const day = days[i % days.length];
      const tz = tzs[i % tzs.length];
      const location = cities[i % cities.length];
      const time = ["6:30 AM", "7:00 AM", "7:30 PM", "8:00 PM"][i % 4];
      return {
        id: `demo-${i + 1}`,
        name,
        owner_name: ownerName,
        owner_email: ownerEmail,
        location,
        day,
        time,
        tz,
        created_at: new Date(now - i * 86400000).toISOString(),
        notes:
          i % 2 === 0
            ? "Requesting approval for a new weekly fire. Focus on accountability & prayer."
            : undefined,
      };
    });
  }

  function enableDemo() {
    setIsDemo(true);
    setDemoRows(makeDemoRows());
  }
  function disableDemo() {
    setIsDemo(false);
    setDemoRows([]);
  }

  function idOf(g: Row) {
    return g?.id ?? (g as any)?.group_id ?? "";
  }
  function whenOf(g: Row) {
    return [g?.day, g?.time, g?.tz].filter(Boolean).join(" • ");
  }
  function copy(text?: string) {
    if (!text) return;
    try { navigator.clipboard?.writeText(text); } catch {}
  }

  // Close drawer on Escape
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenId(null);
    }
    if (openId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const source = isDemo ? demoRows : rows;

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return source;
    return source.filter((g: any) => {
      const hay = [
        g?.name, g?.location, g?.day, g?.time, g?.tz,
        g?.owner_name, g?.owner_email, g?.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [source, q]);

  const pendingCount = filtered.length;

  return (
    <div className="f180 space-y-5">
      {/* Header */}
      <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold tracking-tight text-[hsl(var(--card-foreground))]">
            Group Approvals — Preview
          </div>
          <span className="ml-1 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-4 text-white/80">
            {pendingCount} pending
          </span>
          {isDemo && (
            <span className="ml-1 inline-flex items-center rounded-full bg-indigo-400/10 px-2 py-0.5 text-[11px] leading-4 text-indigo-300 border border-indigo-300/20">
              Demo
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div
            className="inline-flex rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-0.5"
            role="tablist"
            aria-label="View mode"
          >
            <button
              role="tab"
              aria-selected={view === "cards"}
              onClick={() => setView("cards")}
              className={`h-8 px-3 text-sm rounded-md ${
                view === "cards"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Cards
            </button>
            <button
              role="tab"
              aria-selected={view === "table"}
              onClick={() => setView("table")}
              className={`h-8 px-3 text-sm rounded-md ${
                view === "table"
                  ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]"
                  : "text-[hsl(var(--muted-foreground))]"
              }`}
            >
              Table
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by group, owner, location…"
            className="h-9 w-72 max-w-[80vw] rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--popover))] px-3 text-sm text-[hsl(var(--popover-foreground))] placeholder:text-white/50"
          />
          <button
            className="h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>

          {/* Demo mode toggle */}
          {isDemo ? (
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-red-500/20 px-3 text-sm text-red-200 hover:bg-red-500/30"
              onClick={disableDemo}
            >
              Clear demo
            </button>
          ) : (
            <button
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-indigo-500/20 px-3 text-sm text-indigo-200 hover:bg-indigo-500/30"
              onClick={enableDemo}
            >
              Load demo data
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-[var(--radius)] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        view === "table" ? (
          <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] overflow-hidden">
            <div className="bg-[hsl(var(--card))]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3 border-b border-[hsl(var(--border))] animate-pulse"
                >
                  <div className="h-3 w-40 bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-white/10 rounded" />
                  <div className="h-3 w-24 bg-white/10 rounded" />
                  <div className="h-3 w-56 bg-white/10 rounded" />
                  <div className="h-3 w-24 bg-white/10 rounded ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li
                key={i}
                className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 animate-pulse space-y-3"
              >
                <div className="h-4 w-2/3 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/10 rounded" />
                <div className="h-3 w-3/4 bg-white/10 rounded" />
                <div className="h-20 w-full bg-white/5 rounded" />
              </li>
            ))}
          </ul>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center text-sm text-white/70 space-y-3">
          <div>No pending group requests{q ? " match your search" : ""}.</div>
          {!isDemo && (
            <button
              className="inline-flex h-9 items-center rounded-lg border border-[hsl(var(--border))] bg-indigo-500/20 px-3 text-sm text-indigo-200 hover:bg-indigo-500/30"
              onClick={enableDemo}
            >
              Load demo data
            </button>
          )}
        </div>
      ) : view === "table" ? (
        /* ---------- Table View ---------- */
        <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm text-[hsl(var(--card-foreground))]">
              <thead className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Group</th>
                  <th className="text-left font-medium px-4 py-2">Owner</th>
                  <th className="text-left font-medium px-4 py-2">Location</th>
                  <th className="text-left font-medium px-4 py-2">Day / Time (TZ)</th>
                  <th className="text-left font-medium px-4 py-2">Requested</th>
                  <th className="text-right font-medium px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-[hsl(var(--card))]">
                {filtered.map((g: Row) => {
                  const when = whenOf(g);
                  return (
                    <tr key={idOf(g)} className="border-b border-[hsl(var(--border))]">
                      <td className="px-4 py-2">
                        <div className="font-medium truncate max-w-[260px]">
                          {g?.name ?? "Untitled group"}
                        </div>
                        {g?.notes && (
                          <div className="text-[11px] text-white/60 truncate max-w-[420px]">
                            {g.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[240px]">
                          {g?.owner_name || g?.owner_email
                            ? `${g?.owner_name ?? ""}${
                                g?.owner_name && g?.owner_email ? " — " : ""
                              }${g?.owner_email ?? ""}`
                            : "Requester unknown"}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[160px]">{g?.location ?? "—"}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[240px]">{when || "—"}</div>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-white/60">
                        {g?.created_at ? new Date(g.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                          onClick={() => setOpenId(idOf(g))}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ---------- Cards View ---------- */
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g: Row) => {
            const id = idOf(g);
            const header = g?.name ?? "Untitled group";
            const owner =
              g?.owner_name || g?.owner_email
                ? `${g?.owner_name ?? ""}${
                    g?.owner_name && g?.owner_email ? " — " : ""
                  }${g?.owner_email ?? ""}`
                : "Requester unknown";
            const when = whenOf(g);

            return (
              <li
                key={id}
                className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 md:p-5 flex flex-col gap-3 text-[hsl(var(--card-foreground))]"
              >
                {/* Title line */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-[15px] font-semibold">{header}</div>
                      <span className="inline-flex items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] leading-4 text-amber-300 border border-amber-300/20">
                        Pending
                      </span>
                    </div>
                    <div className="text-[11px] text-white/60 truncate">{owner}</div>
                  </div>
                  {g?.created_at && (
                    <div className="text-[11px] text-white/50 shrink-0">
                      {new Date(g.created_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Meta pills */}
                <div className="flex flex-wrap gap-1.5">
                  {g?.location && <Pill>{g.location}</Pill>}
                  {when && <Pill>{when}</Pill>}
                </div>

                {/* Optional request notes */}
                {g?.notes && (
                  <div className="text-xs whitespace-pre-wrap border border-[hsl(var(--border))] rounded-lg p-2 bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))]">
                    {g.notes}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end">
                  <button
                    className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-xs text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    onClick={() => setOpenId(id)}
                  >
                    Details
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------- Details Drawer ---------- */}
      {openId && (
        <div className="fixed inset-0 z-40" aria-labelledby="drawer-title" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpenId(null)} />
          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-full sm:w-[460px] bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-2xl p-5 flex flex-col gap-4 text-[hsl(var(--card-foreground))]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div id="drawer-title" className="text-base font-semibold truncate">
                  {open?.name ?? "Untitled group"}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] leading-4 text-amber-300 border border-amber-300/20">
                    Pending
                  </span>
                  {open?.location && <Pill>{open.location}</Pill>}
                  {open && whenOf(open) && <Pill>{whenOf(open)}</Pill>}
                </div>
              </div>
              <button
                className="h-8 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-3 text-xs"
                onClick={() => setOpenId(null)}
              >
                Close
              </button>
            </div>

            {/* Owner */}
            <section className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Owner</div>
              <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-3">
                <div className="text-sm font-medium">
                  {open?.owner_name || open?.owner_email ? (
                    <>
                      {open?.owner_name ?? ""}
                      {open?.owner_name && open?.owner_email ? " — " : ""}
                      {open?.owner_email ?? ""}
                    </>
                  ) : (
                    "Unknown"
                  )}
                </div>
                {open?.owner_email && (
                  <div className="mt-2 flex items-center gap-2">
                    <a href={`mailto:${open.owner_email}`} className="text-[11px] underline text-[hsl(var(--popover-foreground))]">
                      Send email
                    </a>
                    <button
                      className="text-[11px] underline text-[hsl(var(--popover-foreground))]"
                      onClick={() => copy(open.owner_email)}
                    >
                      Copy email
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Request meta */}
            <section className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Request</div>
              <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-white/80">Submitted</div>
                  <div className="text-white/70">
                    {open?.created_at ? new Date(open.created_at).toLocaleString() : "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* Notes */}
            {open?.notes && (
              <section className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/60">Notes</div>
                <div className="rounded-[var(--radius)] border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-3 text-sm whitespace-pre-wrap">
                  {open.notes}
                </div>
              </section>
            )}

            <div className="mt-auto text-[11px] text-white/50">
              Read-only preview{isDemo ? " with demo data" : ""}. Live approval workflow unchanged.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
