import React from 'react';
import StatusBadge from './StatusBadge';
import EnrichButton from './EnrichButton';
import SoapPanel from './SoapPanel';
import BookmarkStar from './BookmarkStar';
import AddToCollection from './AddToCollection';
import PersonalTags from './PersonalTags';
import type { GroupVerse } from '../services/verses';

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex gap-2">
      <div className="w-44 shrink-0 text-sm font-medium opacity-70">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function VerseCard({
  v,
  groupId,
  starred,
  myTags,
  onStarChange,
  onTagsChange,
  onRefresh,
}: {
  v: GroupVerse;
  groupId: string;
  starred: boolean;
  myTags: string[];
  onStarChange: (verseId: string, next: boolean) => void;
  onTagsChange: (verseId: string, next: string[]) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [showRefs, setShowRefs] = React.useState(false);
  const keywords = v.testament === 'old' ? v.hebrew_keywords : v.greek_keywords;

  return (
    <div className="rounded-2xl border p-4 shadow-sm bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">{v.reference}</div>
            <BookmarkStar verseId={v.id} starred={starred} onChange={(next) => onStarChange(v.id, next)} />
          </div>
          <div className="text-sm opacity-70 flex items-center gap-2">
            <span>{v.version ?? '—'}</span>
            <StatusBadge status={v.status} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="text-sm underline" onClick={() => setOpen(s => !s)} aria-expanded={open}>
            {open ? 'Hide details' : 'Show details'}
          </button>
          <EnrichButton verseId={v.id} status={v.status} onDone={onRefresh} />
          <AddToCollection verseId={v.id} />
        </div>
      </div>

      {/* Heart of God snapshot */}
      {!!v.heart_snapshot && (
        <div className="mt-3 rounded-lg border-l-4 pl-3 py-2 bg-amber-50 border-amber-300 text-sm">
          <span className="font-medium">Heart of God: </span>{v.heart_snapshot}
        </div>
      )}

      {/* Verse callout with version badge */}
      {v.verse_text && (
        <div className="mt-3 rounded-xl bg-gray-50 border p-3">
          <div className="text-xs opacity-70 mb-1 flex items-center gap-2">
            <span className="font-medium">Verse</span>
            {v.version && (
              <span className="inline-block rounded-full border px-2 py-0.5 text-[11px]">
                {v.version}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{v.verse_text}</p>
        </div>
      )}

      {/* Then → Now bridge */}
      {!!v.then_now_bridge && (
        <p className="mt-2 text-sm italic opacity-90">“{v.then_now_bridge}”</p>
      )}

      {open && (
        <div className="mt-4 space-y-2">
          <div className="h-px bg-gray-100" />
          {/* Author/Role combined */}
          <Field label="Author/Role">
            {[v.author_name, v.author_role].filter(Boolean).join(' — ')}
          </Field>
          <Field label="Setting (heart posture)">{v.setting_context}</Field>
          <Field label="5th Grade Explanation">{v.simplified_5th}</Field>

          {!!keywords?.length && (
            <Field label={v.testament === 'old' ? 'Hebrew Keywords' : 'Greek Keywords'}>
              <ul className="list-disc ml-5">{keywords.map((k, i) => <li key={i}>{k}</li>)}</ul>
            </Field>
          )}

          {/* Removed Classification per request */}

          {!!v.tags?.length && (
            <Field label="Tags">
              <div className="flex flex-wrap gap-2">
                {v.tags.map((t, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100">
                    {t}
                  </span>
                ))}
              </div>
            </Field>
          )}

          {v.status === 'error' && v.error_message && (
            <div className="text-sm text-red-600">Error: {v.error_message}</div>
          )}

          {/* Cross references */}
          {!!v.cross_references?.length && (
            <div className="pt-2">
              <button className="text-sm underline" onClick={() => setShowRefs(s => !s)}>
                {showRefs ? 'Hide related passages' : 'Show related passages'}
              </button>
              {showRefs && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.cross_references.map((r, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 border">{r}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* My personal tags */}
      <div className="mt-4">
        <div className="text-sm font-medium mb-2">My Tags</div>
        <PersonalTags
          verseId={v.id}
          tags={myTags}
          onChange={(next) => onTagsChange(v.id, next)}
        />
      </div>

      {/* Collapsible SOAP journaling */}
      <SoapPanel
        groupId={groupId}
        verseId={v.id}
        scriptureRef={v.reference}
        scriptureText={v.verse_text}
        onSaved={onRefresh}
      />
    </div>
  );
}
