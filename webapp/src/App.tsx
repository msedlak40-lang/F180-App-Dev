import * as React from 'react';
import { supabase } from './lib/supabaseClient';

// NEW: point to F180 pages
import VersesTab from './pages/Group/VersesTabF180';
import DevotionsTab from './pages/Group/DevotionsTabF180';
import StudyTab from './pages/Group/StudyTabF180';
import JournalTab from './pages/Group/JournalTabF180';
// Keep Prayers (switch to F180 if you have it)
import PrayersTab from './pages/Group/PrayersTab';

import GroupSelector from './components/GroupSelector';
// import GroupSubNav from './components/GroupSubNav'; // (optional) if you use it

// Keep these utility pages
import AcceptStudyInvite from './pages/AcceptStudyInvite';
import ApprovalsPage from './pages/Admin/ApprovalsPage';
import RequestGroupPage from './pages/Group/RequestGroupPage';

// Removed: Library (Preview) and Inbox
// import LibraryPage from './pages/Library/LibraryPage';
// import LeaderInbox from './components/LeaderInbox';

// F180 toast provider
import { F180ToastProvider as ToastProvider } from './components/f180/F180ToastProvider';

/** Tiny hash router helper */
function useHashRoute() {
  const [hash, setHash] = React.useState<string>(() => window.location.hash || '#/');

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const raw = hash.replace(/^#/, '');
  const [path, queryStr] = raw.split('?');
  const segments = path.split('/').filter(Boolean);

  const query = React.useMemo(() => {
    const out: Record<string, string> = {};
    if (!queryStr) return out;
    for (const part of queryStr.split('&')) {
      const [k, v] = part.split('=');
      if (!k) continue;
      out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
    return out;
  }, [queryStr]);

  return { hash, path, segments, query };
}

function App() {
  const { segments } = useHashRoute();

  // Redirect root to /groups so users hit the NEW flow immediately
  if (segments.length === 0) {
    window.location.hash = '/groups';
    return null;
  }

  // Simple goto helper
  const goto = (to: string) => {
    if (!to.startsWith('/')) to = '/' + to;
    window.location.hash = to;
  };

  // --- ROUTES ---

  // Request a new group (form)
  if (segments[0] === 'request-group') {
    return (
      <ToastProvider>
        <div className="mx-auto max-w-5xl px-4 py-6">
          <RequestGroupPage />
        </div>
      </ToastProvider>
    );
  }

  // Admin approvals
  if (segments[0] === 'admin' && segments[1] === 'approvals') {
    return (
      <ToastProvider>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <ApprovalsPage />
        </div>
      </ToastProvider>
    );
  }

  // Accept study invite
  if (segments[0] === 'accept-study-invite') {
    return (
      <ToastProvider>
        <div className="mx-auto max-w-3xl px-4 py-6">
          <AcceptStudyInvite />
        </div>
      </ToastProvider>
    );
  }

  // Groups hub
  if (segments[0] === 'groups') {
    return (
      <ToastProvider>
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">Your Fires</h1>
          <GroupSelector
            onSelect={(gid: string) => goto(`/group/${gid}/devotions`)}
            // add other props you use (e.g., currentGroupId) if needed
          />
        </div>
      </ToastProvider>
    );
  }

  // Group routes: /group/:gid/:tab
  if (segments[0] === 'group' && segments[1]) {
    const gid = segments[1];
    const tab = segments[2] || 'devotions';

    // Optional: your own subnav component if you want it
    // const subnav = (
    //   <GroupSubNav
    //     groupId={gid}
    //     active={tab}
    //     onNavigate={(next: string) => goto(`/group/${gid}/${next}`)}
    //   />
    // );

    return (
      <ToastProvider>
        <div className="mx-auto max-w-6xl px-3 md:px-6 py-4">
          {/* {subnav} */}
          {tab === 'verses' && <VersesTab groupId={gid} />}
          {tab === 'devotions' && <DevotionsTab groupId={gid} />}
          {tab === 'study' && <StudyTab groupId={gid} />}
          {tab === 'journal' && <JournalTab groupId={gid} />}
          {tab === 'prayers' && <PrayersTab groupId={gid} />}

          {/* default to devotions if no known tab */}
          {!['verses', 'devotions', 'study', 'journal', 'prayers'].includes(tab) && (
            <DevotionsTab groupId={gid} />
          )}
        </div>
      </ToastProvider>
    );
  }

  // Fallback: anything else -> groups
  window.location.hash = '/groups';
  return null;
}

export default App;
