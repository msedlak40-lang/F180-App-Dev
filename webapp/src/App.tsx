import React from 'react';
import { supabase } from './lib/supabaseClient';

import VersesTab from './pages/Group/VersesTab';
import DevotionsTab from './pages/Group/DevotionsTab';
import StudyTab from './pages/Group/StudyTab';
import JournalTab from './pages/Group/JournalTab';
import PrayersTab from './pages/Group/PrayersTab';

import LibraryPage from './pages/Library/LibraryPage';
import AcceptStudyInvite from './pages/AcceptStudyInvite';
import ApprovalsPage from './pages/Admin/ApprovalsPage';
import RequestGroupPage from './pages/Group/RequestGroupPage'; // 👈 your full form page
import LeaderInbox from './components/LeaderInbox';

import GroupSelector from './components/GroupSelector';
import AuthBar from './components/AuthBar';
import { ToastProvider } from './components/ToastProvider';

/** Parse the current hash into path + segments + query. */
function useHashRoute() {
  const [hash, setHash] = React.useState<string>(() => window.location.hash || '#/');

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const noHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [pathPart, queryPart] = noHash.split('?');
  const path = pathPart.replace(/^\/+/, '');
  const segments = path.split('/').filter(Boolean);
  const query = new URLSearchParams(queryPart || '');

  return { hash, path, segments, query };
}

export default function App() {
  const { segments } = useHashRoute();

  const [currentGroupId, setCurrentGroupId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  // Ensure auth is initialized
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      await supabase.auth.getSession();
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Sync currentGroupId from URL
  React.useEffect(() => {
    if (segments[0] === 'group' && segments[1]) {
      setCurrentGroupId(segments[1]);
    }
  }, [segments]);

  function goto(nextHash: string) {
    window.location.hash = nextHash.startsWith('#') ? nextHash : `#${nextHash}`;
  }

  function Header({ showSelector }: { showSelector: boolean }) {
    return (
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
        {/* Top row: brand + nav + auth */}
        <div className="max-w-5xl mx-auto p-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">Fireside</div>

          <div className="flex items-center gap-3">
            {/* Groups → default to current group's Verses, else welcome */}
            <button
              className="text-sm underline"
              onClick={() => {
                if (currentGroupId) goto(`/group/${currentGroupId}/verses`);
                else goto('/');
              }}
            >
              Groups
            </button>

            {/* Request Group → dedicated page with only the form */}
            <button
              className="text-sm underline"
              onClick={() => goto('/request-group')}
            >
              Request Group
            </button>

            <button className="text-sm underline" onClick={() => goto('/library')}>
              Library
            </button>

            {/* Inbox → dedicated view */}
            <button
              className="text-sm underline disabled:opacity-50"
              disabled={!currentGroupId}
              onClick={() => currentGroupId && goto(`/group/${currentGroupId}/inbox`)}
              title={currentGroupId ? 'Open Leader Inbox' : 'Pick a group first'}
            >
              Inbox
            </button>

            <AuthBar />
          </div>
        </div>

        {/* Second row: group selector */}
        {showSelector && (
          <div className="border-t">
            <div className="max-w-5xl mx-auto p-3">
              <div className="w-full max-w-md">
                <GroupSelector
                  groupId={currentGroupId ?? ''}
                  onChange={(gid: string) => {
                    setCurrentGroupId(gid);
                    goto(`/group/${gid}/verses`);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  // Standalone pages
  if (segments[0] === 'study-accept') {
    return (
      <ToastProvider>
        <div className="max-w-4xl mx-auto p-4">
          <AcceptStudyInvite />
        </div>
      </ToastProvider>
    );
  }

  if (segments[0] === 'admin' && segments[1] === 'approvals') {
    return (
      <ToastProvider>
        <Header showSelector={false} />
        <div className="max-w-5xl mx-auto p-4">
          <ApprovalsPage />
        </div>
      </ToastProvider>
    );
  }

  if (segments[0] === 'library') {
    return (
      <ToastProvider>
        <Header showSelector={false} />
        <div className="max-w-5xl mx-auto p-4">
          <LibraryPage />
        </div>
      </ToastProvider>
    );
  }

  // NEW: request-group dedicated page (form only, no welcome block)
  if (segments[0] === 'request-group') {
    return (
      <ToastProvider>
        <Header showSelector={false} />
        <div className="max-w-5xl mx-auto p-4">
          <RequestGroupPage />
        </div>
      </ToastProvider>
    );
  }

  // Dedicated Leader Inbox page
  if (segments[0] === 'group' && segments[1] && segments[2] === 'inbox') {
    const gid = segments[1];
    return (
      <ToastProvider>
        <Header showSelector={true} />
        <div className="max-w-5xl mx-auto p-4">
          <div className="rounded-2xl border p-4 bg-white">
            <div className="text-sm font-semibold mb-2">Leader Inbox</div>
            <LeaderInbox groupId={gid} />
          </div>
        </div>
      </ToastProvider>
    );
  }

  // Group tabs
  if (segments[0] === 'group' && segments[1]) {
    const gid = segments[1];
    const tab = segments[2] || 'verses';

    return (
      <ToastProvider>
        <Header showSelector={true} />
        <div className="max-w-5xl mx-auto p-4">
          {/* Tabs */}
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {[
                ['verses', 'Verses'],
                ['devotions', 'Devotions'],
                ['study', 'Study'],
                ['journal', 'Journal'],
                ['prayers', 'Prayers'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`text-sm rounded-lg border px-3 py-1.5 ${
                    tab === key ? 'bg-gray-50' : 'bg-white'
                  }`}
                  onClick={() => goto(`/group/${gid}/${key}`)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Active tab */}
          {tab === 'verses' && <VersesTab groupId={gid} />}
          {tab === 'devotions' && <DevotionsTab groupId={gid} />}
          {tab === 'study' && <StudyTab groupId={gid} />}
          {tab === 'journal' && <JournalTab groupId={gid} />}
          {tab === 'prayers' && <PrayersTab groupId={gid} />}
        </div>
      </ToastProvider>
    );
  }

  // Fallback (welcome)
  return (
    <ToastProvider>
      <Header showSelector={true} />
      <div className="max-w-5xl mx-auto p-6 grid gap-4">
        <div className="rounded-2xl border p-4 bg-white">
          <div className="text-sm font-semibold mb-2">Welcome</div>
          <div className="text-sm opacity-80">
            Pick a group to get started, or head to your Library.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-[260px] max-w-md w-full">
              <GroupSelector
                groupId={currentGroupId ?? ''}
                onChange={(gid: string) => {
                  setCurrentGroupId(gid);
                  goto(`/group/${gid}/verses`);
                }}
              />
            </div>
            <button
              className="text-sm rounded-lg border px-3 py-1.5"
              onClick={() => goto('/library')}
            >
              Open Library
            </button>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
