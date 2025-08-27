import React from 'react';
import AuthBar from './components/AuthBar';
import GroupSelector from './components/GroupSelector';
import VersesTab from './pages/Group/VersesTab';
import JournalTab from './pages/Group/JournalTab';
import PrayersTab from './pages/Group/PrayersTab';
import DevotionsTab from './pages/Group/DevotionsTab';
import AcceptDevotionInvite from './pages/Public/AcceptDevotionInvite'; // ⬅️ NEW
import { ToastProvider } from './components/ToastProvider';

function useHashRoute() {
  const [hash, setHash] = React.useState<string>(window.location.hash || '#/');
  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash.replace(/^#/, '');
}

export default function App() {
  const route = useHashRoute();

  if (route.startsWith('/accept-devotion-invite')) {
    return <AcceptDevotionInvite />;
  }

  // ...existing code below (unchanged) ...
  const [groupId, setGroupId] = React.useState<string>(localStorage.getItem('groupId') || '');
  const [tab, setTab] = React.useState<'verses' | 'journal' | 'prayers' | 'devotions'>('verses');
  const [prayersHasNew, setPrayersHasNew] = React.useState(false);

  const onGroupChange = (id: string) => {
    setGroupId(id);
    if (id) localStorage.setItem('groupId', id);
  };

  const TabButton = ({
    k, label, badge, onClick,
  }: {
    k: 'verses' | 'journal' | 'prayers' | 'devotions';
    label: string;
    badge?: boolean;
    onClick?: () => void;
  }) => (
    <button
      className={`px-3 py-2 rounded-xl border text-sm relative ${tab === k ? 'bg-white shadow-sm' : 'opacity-80 hover:opacity-100'}`}
      onClick={() => { onClick?.(); setTab(k); }}
    >
      <span>{label}</span>
      {badge && tab !== k && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500 align-middle" />}
    </button>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Fireside</h1>
          </header>

          <AuthBar />

          <div className="rounded-2xl border p-4 bg-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-lg font-semibold">My Groups</div>
              <GroupSelector value={groupId} onChange={onGroupChange} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <TabButton k="verses"  label="Verses" />
              <TabButton k="journal" label="Journal" />
              <TabButton k="prayers" label="Prayers" badge={prayersHasNew} onClick={() => setPrayersHasNew(false)} />
              <TabButton k="devotions" label="Devotions" />
            </div>
          </div>

          {!groupId ? (
            <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">Select a group to begin.</div>
          ) : tab === 'verses' ? (
            <VersesTab groupId={groupId} />
          ) : tab === 'journal' ? (
            <JournalTab groupId={groupId} />
          ) : tab === 'prayers' ? (
            <PrayersTab groupId={groupId} active={tab === 'prayers'} onNew={(v) => setPrayersHasNew(v)} />
          ) : (
            <DevotionsTab groupId={groupId} />
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
