import React from 'react';
import VersesTab from './pages/Group/VersesTab';
import AuthBar from './components/AuthBar';
import GroupSelector from './components/GroupSelector';
import { ToastProvider } from './components/ToastProvider';

export default function App() {
  const [groupId, setGroupId] = React.useState<string>(() => localStorage.getItem('groupId') || '');
  React.useEffect(() => { localStorage.setItem('groupId', groupId); }, [groupId]);

  return (
    <ToastProvider>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <AuthBar />

        <header className="space-y-3">
          <h1 className="text-2xl font-bold">Fireside — Verses</h1>
          <GroupSelector value={groupId} onChange={setGroupId} />
        </header>

        {groupId ? (
          <VersesTab groupId={groupId} />
        ) : (
          <div className="rounded-2xl border p-6 bg-white">
            Join or create a group to get started.
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
