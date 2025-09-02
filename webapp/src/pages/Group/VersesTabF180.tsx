import React from "react";
import { supabase } from "../../lib/supabaseClient";
import { createGroupVerse } from "../../services/verses";
import VersesListF180 from "./VersesListF180";
import { useF180Toast } from "../../components/f180/F180ToastProvider";

export default function VersesTabF180({ groupId }: { groupId: string }) {
  const [refreshTick, setRefreshTick] = React.useState(0);

  return (
    <div className="mx-auto max-w-6xl px-0 lg:px-2">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* MAIN: Compact list for preview */}
        <div className="min-w-0">
          <VersesListF180 key={refreshTick} groupId={groupId} />
        </div>

        {/* SIDEBAR: Quick Add (sticky) */}
        <aside className="lg:pl-2">
          <div className="lg:sticky lg:top-20 space-y-4">
            <QuickAddCard
              groupId={groupId}
              onAdded={() => setRefreshTick((t) => t + 1)}
              afterCreate={async (newId) => {
                try {
                  await requestEnrich(newId);
                } catch {}
                setTimeout(() => setRefreshTick((t) => t + 1), 600);
              }}
            />
            <NudgeCard />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Sidebar: Quick Add (no notes) ---------- */
function QuickAddCard({
  groupId,
  onAdded,
  afterCreate,
}: {
  groupId: string;
  onAdded: () => void;
  afterCreate?: (newId: string) => void | Promise<void>;
}) {
  const { show } = useF180Toast();
  const [ref, setRef] = React.useState("");
  const [version, setVersion] = React.useState("ESV");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const reference = ref.trim();
    if (!reference || busy) return;

    setBusy(true);
    try {
      const newId = await createGroupVerse(groupId, reference, version || undefined);
      show(`Added ${reference}`, "success");
      setRef("");
      onAdded();
      if (afterCreate) await afterCreate(newId);
    } catch (err: any) {
      show(err?.message ?? "Failed to add verse", "error");
    } finally {
      setBusy(false);
    }
  }

  // Prefill from Home's "Add to Verses" (queued in sessionStorage)
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem("f180.verses.toAdd");
      if (!raw) return;
      const data = JSON.parse(raw) as {
        group_id: string;
        reference: string;
        text?: string;
        testament?: "OT" | "NT";
        ts?: number;
      };
      // Only prefill if it matches this group
      if (data?.group_id && data.group_id !== groupId) return;

      // Clear the queue so refresh doesn't reapply
      sessionStorage.removeItem("f180.verses.toAdd");

      // Prefill and focus the quick-add box
      const reference = (data?.reference || "").replace(/\s+/g, " ").trim();
      if (!reference) return;

      setRef(reference);
      // Focus after state applies
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(reference.length, reference.length);
          } catch {}
        }
      }, 0);
    } catch {
      /* ignore */
    }
  }, [groupId]);

  // Remember last version & autofocus on first mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("f180:last-version");
      if (saved) setVersion(saved);
    } catch {}
    inputRef.current?.focus();
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem("f180:last-version", version);
    } catch {}
  }, [version]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold tracking-tight">Quick Add a Verse</div>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">
        Type a reference (e.g., <span className="text-foreground">John 3:16</span>). We’ll fetch the text,
        then auto-enrich it so you can Journal (SOAP) or explore more context.
      </p>
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          id="f180-quick-add-input"
          ref={inputRef}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="e.g., Romans 5:8"
          className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none"
        />
        <div className="flex items-center gap-2">
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm outline-none"
            title="Bible version (optional)"
          >
            {["ESV", "NIV", "NKJV", "NLT", "KJV"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy || !ref.trim()}
            className="whitespace-nowrap rounded-xl bg-[hsl(var(--primary))] px-3 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-60"
            aria-busy={busy}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Enrichment request helper (adjust function name if needed) ---------- */
async function requestEnrich(verseId: string) {
  // Prefer Supabase Edge Function if available
  try {
    // Example: a function named "enrich-verse" that accepts { verse_id }
    // Change the name/body if your deployment uses a different endpoint.
    // @ts-ignore
    if (supabase.functions?.invoke) {
      await supabase.functions.invoke("enrich-verse", { body: { verse_id: verseId } });
      return;
    }
  } catch {}
  // Fallback to app route (optional)
  try {
    await fetch("/api/enrich-verse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verse_id: verseId }),
    });
  } catch {}
}

/* ---------- Sidebar: Encouraging nudge ---------- */
function NudgeCard() {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-sm">
      <div className="text-sm font-semibold tracking-tight">This Week’s Nudge</div>
      <p className="mt-1 text-sm">
        Pick <span className="font-medium">one</span> verse to live out. Enrich it, write a one-line SOAP, and share with your group.
      </p>
      <ul className="mt-2 list-disc ml-5 text-xs text-[hsl(var(--muted-foreground))] space-y-1">
        <li>Keep it small. One step beats ten intentions.</li>
        <li>“I will…” — be specific for 7 days.</li>
      </ul>
    </div>
  );
}
