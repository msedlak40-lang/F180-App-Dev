import React from "react";
import { supabase } from "../../lib/supabaseClient";
import { listGroupVerses, type GroupVerse } from "../../services/verses";
import {
  listMyBookmarksForVerses,
  bookmarkVerse,
  unbookmarkVerse,
} from "../../services/engagement";
import { buildVerseHref } from "../../services/library";
import F180AddToCollection from "../../components/f180/F180AddToCollection";
import { useF180Toast } from "../../components/f180/F180ToastProvider";
import VerseCard from "../../components/VerseCard";

/** Helpers */
function pick(obj: any, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return fallback;
}
function bool(obj: any, keys: string[]): boolean | undefined {
  for (const k of keys) {
    if (obj && k in obj) return !!obj[k];
  }
  return undefined;
}
type FilterKey = "all" | "mine" | "withJournal" | "starred";

/** Compact list of verses for the F180 preview (zero impact on live tabs). */
export default function VersesListF180({ groupId }: { groupId: string }) {
  const { show } = useF180Toast();
  const [uid, setUid] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<GroupVerse[]>([]);
  const [stars, setStars] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // filters/search/toggles
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());   // "More context"
  const [soapOpen, setSoapOpen] = React.useState<Set<string>>(new Set());  // inline SOAP

  // per-row inline panels toggled by the Collections dropdown
  const [addCollOpen, setAddCollOpen] = React.useState<Record<string, boolean>>({});
  const [newCollOpen, setNewCollOpen] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await listGroupVerses(groupId);
      setRows(r);
      const ids = r.map((x: any) => x.id ?? x.verse_id);
      const starredIds = await listMyBookmarksForVerses(ids);
      setStars(new Set(starredIds));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load verses");
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId]);

  const toggleStar = async (id: string, reference: string) => {
    const isStarred = stars.has(id);
    try {
      if (isStarred) {
        await unbookmarkVerse(id);
        const n = new Set(stars); n.delete(id); setStars(n);
        show(`Removed star: ${reference}`, "info");
      } else {
        await bookmarkVerse(id);
        const n = new Set(stars); n.add(id); setStars(n);
        show(`Starred: ${reference}`, "success");
      }
    } catch (e: any) {
      show(e?.message ?? "Bookmark toggle failed", "error");
    }
  };

  const copy = async (txt: string, label: string) => {
    try { await navigator.clipboard.writeText(txt); show(`Copied ${label}`, "success"); }
    catch { show("Couldn’t copy", "error"); }
  };

  // Derived list (filters + search)
  const filtered = React.useMemo(() => {
    let list = rows.slice();

    list = list.filter((v: any) => {
      if (filter === "all") return true;
      if (filter === "starred") return stars.has(v.id);
      if (filter === "mine") {
        if (!uid) return false;
        const owner = v.created_by ?? v.user_id ?? v.owner_id ?? v.author_id ?? v.added_by;
        return owner ? owner === uid : false;
      }
      if (filter === "withJournal") {
        const has =
          bool(v, ["has_journal", "has_soap"]) ||
          (v.soap_count ?? 0) > 0 ||
          (v.journal_entries_count ?? 0) > 0 ||
          !!v.journal_entry_id;
        return !!has;
      }
      return true;
    });

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((v: any) => {
        const ref = pick(v, ["reference", "ref"]);
        const text = pick(v, ["verse_text", "text"]).toLowerCase();
        return ref.toLowerCase().includes(q) || text.includes(q);
      });
    }
    return list;
  }, [rows, stars, filter, query, uid]);

  // Sticky header
  const Header = (
    <div className="sticky top-14 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur px-3 py-2 rounded-t-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Group Verses</h2>
          <span className="text-xs rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5 text-[hsl(var(--muted-foreground))]">
            {filtered.length} shown
          </span>
          {loading && <span className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</span>}
          {err && <span className="text-xs text-[hsl(var(--primary))]">{err}</span>}
        </div>
        <div><button onClick={load} className="text-sm underline">Refresh</button></div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip label="Mine" active={filter === "mine"} onClick={() => setFilter("mine")} disabled={!uid} title={!uid ? "Sign in to use 'Mine'" : undefined} />
        <FilterChip label="With Journal" active={filter === "withJournal"} onClick={() => setFilter("withJournal")} />
        <FilterChip label="Starred" active={filter === "starred"} onClick={() => setFilter("starred")} />
        <div className="ml-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search verse or paraphrase…"
            className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 text-sm outline-none min-w-[220px]"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-0">
      {/* theme for context */}
      <style>{`
        .f180-ctx {
          --vc-bg: hsl(var(--card));
          --vc-fg: hsl(var(--foreground));
          --vc-border: hsl(var(--border));
          --vc-chip: hsla(0,0%,100%,0.06);
          --vc-accent: hsla(16,100%,56%,0.18);
          --vc-scripture: hsla(0,0%,100%,0.06);
        }
        .f180-ctx, .f180-ctx * { color: var(--vc-fg); }
        .f180-ctx :is(.bg-white,.bg-gray-50,.bg-gray-100,.bg-slate-50,.bg-neutral-50,.bg-zinc-50) { background-color: var(--vc-bg) !important; }
        .f180-ctx :is(.border-gray-200,.border-slate-200,.border-neutral-200,.border-zinc-200,.border) { border-color: var(--vc-border) !important; }
        .f180-ctx mark, .f180-ctx .highlight, .f180-ctx [data-highlight="true"] { background-color: var(--vc-accent) !important; border-radius:.375rem; padding:0 .25rem; }
        .f180-ctx .tag, .f180-ctx .badge, .f180-ctx [data-role="tag"], .f180-ctx [data-tag], .f180-ctx [class*="rounded-full"][class*="px-2"] { background-color: var(--vc-chip) !important; border-color: var(--vc-border) !important; }
      `}</style>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-transparent">
        {Header}

        {loading && <div className="p-3 text-sm opacity-70">Loading…</div>}
        {err && <div className="p-3 text-sm" style={{ color: "hsla(0,75%,60%,1)" }}>{err}</div>}
        {!loading && !err && filtered.length === 0 && (
          <div className="p-4 text-sm opacity-80">No verses match your filters. Try clearing them or add a verse from the sidebar.</div>
        )}

        <ul className="p-2 space-y-2">
          {filtered.map((v: any) => {
            const id: string = v.id ?? v.verse_id;
            const reference = pick(v, ["reference", "ref"], "Verse");
            const text = pick(v, ["verse_text", "text"], "—");
            const isStarred = stars.has(id);
            const isContext = expanded.has(id);
            const isSoap = soapOpen.has(id);

            const enriched =
              bool(v, ["enriched", "is_enriched"]) ??
              !!(v.enriched_at || v.enrichment || (v.meta && (v.meta.author || v.meta.context)));

            return (
              <li key={id} data-verse-id={id} className="rounded-xl border border-[hsl(var(--border))] bg-transparent p-3">
                {/* Top: reference + right-side controls (Star • Copy • Collections ▾) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold">{reference}</div>
                  <div className="flex items-center gap-2">
                    {/* Star */}
                    <button
                      className="text-xs rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5"
                      title={isStarred ? "Unstar" : "Star this verse"}
                      onClick={() => toggleStar(id, reference)}
                      aria-pressed={isStarred}
                    >
                      {isStarred ? "★ Starred" : "☆ Star"}
                    </button>

                    {/* Copy (main copies both, menu offers ref/verse) */}
                    <CopyMenu
                      onCopyAll={() => copy(`${reference} — ${text}`, "reference + verse")}
                      onCopyRef={() => copy(reference, "reference")}
                      onCopyVerse={() => copy(text, "verse")}
                    />

                    {/* Collections dropdown (menu like Copy) */}
                    <CollectionsMenu
                      onAdd={() =>
                        setAddCollOpen((s) => ({ ...s, [id]: true }))
                      }
                      onNew={() =>
                        setNewCollOpen((s) => ({ ...s, [id]: true }))
                      }
                    />
                  </div>
                </div>

                {/* Inline panels opened via Collections menu */}
                {(addCollOpen[id] || newCollOpen[id]) && (
                  <div className="mt-2 flex flex-col gap-2">
                    {addCollOpen[id] && (
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
                        <div className="mb-1 text-xs opacity-70">Add to collection</div>
                        <F180AddToCollection verseId={id} />
                        <div className="mt-1">
                          <button
                            className="text-xs underline opacity-80"
                            onClick={() =>
                              setAddCollOpen((s) => ({ ...s, [id]: false }))
                            }
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                    {newCollOpen[id] && (
                      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2">
                        <div className="mb-1 text-xs opacity-70">New collection</div>
                        <NewCollectionInline
                          onCreated={(name) => {
                            setNewCollOpen((s) => ({ ...s, [id]: false }));
                            show(`Collection “${name}” created`, "success");
                          }}
                          onCancel={() =>
                            setNewCollOpen((s) => ({ ...s, [id]: false }))
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Snippet (hidden when SOAP or context is open) */}
                {!isSoap && !isContext && (
                  <div className="mt-1 text-sm text-foreground/90">
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[color:hsla(0,0%,100%,0.05)] px-2 py-1 line-clamp-2">
                      {text}
                    </div>
                  </div>
                )}

                {/* Bottom action row – ONLY Journal (SOAP) + More context (+ optional enriched chip) */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
                    onClick={() => {
                      const next = new Set(soapOpen);
                      next.has(id) ? next.delete(id) : next.add(id);
                      setSoapOpen(next);
                    }}
                  >
                    {isSoap ? "Hide SOAP" : "Journal (SOAP)"}
                  </button>

                  {/* Only show a chip when it IS enriched; no 'Enriching…' */}
                  {enriched && (
                    <span className="text-xs rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-0.5">
                      Enriched ✓
                    </span>
                  )}

                  <button
                    className="text-sm underline"
                    onClick={() => {
                      const next = new Set(expanded);
                      next.has(id) ? next.delete(id) : next.add(id);
                      setExpanded(next);
                    }}
                  >
                    {isContext ? "Hide context" : "More context"}
                  </button>
                </div>

                {/* Inline SOAP editor */}
                {isSoap && (
                  <InlineSoap
                    reference={reference}
                    text={text}
                    onSaved={() => show("Saved (preview)", "success")}
                  />
                )}

                {/* More context panel – ALL details expanded, SOAP & duplicate actions removed */}
                {isContext && (
                  <div className="mt-3 f180-ctx">
                    <ContextOnlyVerseCard v={v} groupId={groupId} onRefresh={load} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Context view: VerseCard with duplicate controls removed, SOAP removed, ALL details forced open, Heart-of-God highlighted */
function ContextOnlyVerseCard(props: { v: any; groupId: string; onRefresh: () => void }) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Click "Show details" triggers so deeper sections mount
    const clickByText = (rx: RegExp) => {
      const els = Array.from(root.querySelectorAll<HTMLElement>("button, a, summary"));
      els.forEach((el) => {
        const t = (el.textContent || "").trim();
        if (rx.test(t)) el.click();
      });
    };
    clickByText(/show\s*details/i);
    setTimeout(() => clickByText(/show\s*details/i), 120);

    // Remove SOAP blocks
    const soapRegex = /(soap|journal)/i;
    Array.from(root.querySelectorAll<HTMLElement>("*")).forEach((el) => {
      if (soapRegex.test(el.textContent || "")) {
        const section = el.closest("section, article, details, .rounded, .rounded-md, .rounded-lg, .flex");
        if (section) (section as HTMLElement).style.display = "none";
      }
    });

    // Hide Scripture row (we render elsewhere)
    Array.from(root.querySelectorAll<HTMLElement>("*")).forEach((el) => {
      if (/^\s*scripture\s*$/i.test(el.textContent || "")) {
        const row = el.closest(".flex");
        if (row) (row as HTMLElement).style.display = "none";
      }
    });

    // Hide duplicate action controls & "Show details"
    const dupTexts = /add to collection|copy ref|copy verse|bookmark|star|show details/i;
    Array.from(root.querySelectorAll<HTMLElement>("button, a")).forEach((btn) => {
      const t = (btn.textContent || "") + " " + (btn.getAttribute("title") || "");
      if (dupTexts.test(t)) (btn as HTMLElement).style.display = "none";
    });

    // Force-open details
    root.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => { d.open = true; });

    // Force-open any aria-controlled collapses
    root.querySelectorAll<HTMLElement>('[aria-expanded="false"]').forEach((el) => {
      el.setAttribute("aria-expanded", "true");
      const id = el.getAttribute("aria-controls");
      if (id) {
        const esc = (window as any).CSS && (window as any).CSS.escape ? (window as any).CSS.escape : (s: string) => s.replace(/([ #;.?%&,@+*~':"!^$[\]()=>|\/\\])/g, "\\$1");
        const panel = root.querySelector<HTMLElement>("#" + esc(id));
        if (panel) { panel.style.display = ""; panel.removeAttribute("hidden"); }
      }
    });

    // Unhide elements mentioning "details"
    Array.from(root.querySelectorAll<HTMLElement>('[hidden], .hidden, [data-section*="details" i], [id*="details" i], [class*="details" i]'))
      .forEach((el) => { (el as HTMLElement).hidden = false; el.classList.remove("hidden"); });

    // Heart of God highlight
    Array.from(root.querySelectorAll<HTMLElement>("*")).forEach((el) => {
      if (/heart\s*of\s*god/i.test(el.textContent || "")) {
        const target =
          (el.closest("h1, h2, h3, h4, .font-semibold, .font-bold, .text-lg, .text-xl, .rounded, .rounded-md, .rounded-lg") as HTMLElement) ||
          el;
        target.style.backgroundColor = "hsla(16,100%,56%,0.18)";
        target.style.borderRadius = "0.5rem";
        target.style.padding = "0.125rem 0.375rem";
      }
    });
  }, [props.v?.id, props.v?.verse_text]);

  return (
    <div ref={ref} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <VerseCard
        v={props.v}
        groupId={props.groupId}
        starred={false}
        myTags={[]}
        onStarChange={() => {}}
        onTagsChange={() => {}}
        onRefresh={props.onRefresh}
      />
    </div>
  );
}

/** Inline SOAP editor (preview-safe) */
function InlineSoap({
  reference,
  text,
  onSaved,
}: {
  reference: string;
  text: string;
  onSaved: () => void;
}) {
  const [obs, setObs] = React.useState("");
  const [app, setApp] = React.useState("");
  const [pr, setPr] = React.useState("");

  return (
    <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="text-sm font-medium mb-2">SOAP Journal</div>

      {/* Scripture */}
      <div className="mb-2">
        <div className="text-xs opacity-70 mb-1">Scripture</div>
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[color:hsla(0,0%,100%,0.06)] px-3 py-2 text-sm whitespace-pre-wrap">
          <div className="font-semibold mb-1">{reference}</div>
          {text}
        </div>
      </div>

      <label className="block text-xs opacity-70 mb-1">Observation (I Believe)</label>
      <textarea
        value={obs} onChange={(e) => setObs(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none mb-2"
        placeholder="What do you believe the text is saying?"
      />

      <label className="block text-xs opacity-70 mb-1">Application (I will…)</label>
      <textarea
        value={app} onChange={(e) => setApp(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none mb-2"
        placeholder="How will you live this out this week?"
      />

      <label className="block text-xs opacity-70 mb-1">Prayer</label>
      <textarea
        value={pr} onChange={(e) => setPr(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm outline-none"
        placeholder="Talk to God about this."
      />

      <div className="mt-3">
        <button
          className="rounded-xl bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
          onClick={() => onSaved()}
        >
          Save (preview)
        </button>
      </div>
    </div>
  );
}

/** Copy dropdown */
function CopyMenu({
  onCopyAll,
  onCopyRef,
  onCopyVerse,
}: {
  onCopyAll: () => void;
  onCopyRef: () => void;
  onCopyVerse: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.(".f180-menu-copy")) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  return (
    <div className="relative f180-menu-copy">
      <div className="flex overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <button onClick={onCopyAll} className="px-2 py-0.5 text-xs">Copy</button>
        <button onClick={() => setOpen((v) => !v)} className="px-2 py-0.5 text-xs border-l border-[hsl(var(--border))]">▾</button>
      </div>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg">
          <button onClick={() => { onCopyRef(); setOpen(false); }} className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-[hsla(0,0%,100%,0.06)]">
            Copy reference only
          </button>
          <button onClick={() => { onCopyVerse(); setOpen(false); }} className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-[hsla(0,0%,100%,0.06)]">
            Copy verse only
          </button>
        </div>
      )}
    </div>
  );
}

/** Collections dropdown (like Copy) */
function CollectionsMenu({
  onAdd,
  onNew,
}: {
  onAdd: () => void;
  onNew: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.(".f180-menu-collections")) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);
  return (
    <div className="relative f180-menu-collections">
      <div className="flex overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <button onClick={() => setOpen((v) => !v)} className="px-2 py-0.5 text-xs">Collections</button>
        <button onClick={() => setOpen((v) => !v)} className="px-2 py-0.5 text-xs border-l border-[hsl(var(--border))]">▾</button>
      </div>
      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg">
          <button onClick={() => { onAdd(); setOpen(false); }} className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-[hsla(0,0%,100%,0.06)]">
            Add to collection…
          </button>
          <button onClick={() => { onNew(); setOpen(false); }} className="w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-[hsla(0,0%,100%,0.06)]">
            New collection…
          </button>
        </div>
      )}
    </div>
  );
}

/** Inline “New collection…” creator (preview-safe) */
function NewCollectionInline({
  onCreated,
  onCancel,
}: {
  onCreated: (name: string) => void;
  onCancel?: () => void;
}) {
  const { show } = useF180Toast();
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("collections").insert({ name: trimmed });
      if (error) throw error;
      setName("");
      onCreated(trimmed);
    } catch (e: any) {
      show(e?.message ?? "Failed to create collection", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Collection name"
        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1 text-sm outline-none"
      />
      <button
        onClick={create}
        disabled={!name.trim() || busy}
        className="rounded-xl bg-[hsl(var(--primary))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
      >
        Create
      </button>
      {onCancel && (
        <button onClick={onCancel} className="text-xs underline opacity-80">
          Cancel
        </button>
      )}
    </div>
  );
}

/* ---------- Tiny UI helper ---------- */
function FilterChip({
  label,
  active = false,
  onClick,
  disabled,
  title,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-transparent"
          : "bg-[hsl(var(--card))] text-foreground/90 border-[hsl(var(--border))]"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {label}
    </button>
  );
}
