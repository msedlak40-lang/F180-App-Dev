import React from 'react';
import GroupSelector from '../../components/GroupSelector';
import LeaderInbox from '../../components/LeaderInbox';

export default function InboxPage() {
  const [groupId, setGroupId] = React.useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
      <GroupSelector value={groupId ?? ''} onChange={(g) => setGroupId(g)} />
      {!groupId && (
        <div className="rounded-2xl border p-4 bg-white text-sm opacity-80">
          Select a group to see your leader inbox.
        </div>
      )}
      {groupId && (
        <div className="rounded-2xl border bg-white">
          <LeaderInbox groupId={groupId} />
        </div>
      )}
    </div>
  );
}
