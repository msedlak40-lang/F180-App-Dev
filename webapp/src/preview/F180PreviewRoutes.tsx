import React from "react";

// Shell + toasts
import F180Page from "../components/F180Page";
import { F180ToastProvider } from "../components/f180/F180ToastProvider";
import { ToastProvider } from "../components/ToastProvider";

// Preview pages
import VersesTabF180 from "../pages/Group/VersesTabF180";
import ApprovalsPageF180 from "../pages/Admin/ApprovalsPageF180";
import RequestGroupPageF180 from "../pages/Group/RequestGroupPageF180";
import GroupMembersPageF180 from "../pages/Group/GroupMembersPageF180";

// Assets (logos)
import logoWordmarkUrl from "../assets/fireside180-wordmark.svg";
import logoMarkUrl from "../assets/fireside180-logo-mark.svg";

/**
 * Given hash segments (after `/#/`), return a preview page.
 * App.tsx expects a **named export**: renderF180PreviewRoute
 */
export function renderF180PreviewRoute(segments: string[]) {
  // ---------- Approvals (preview route; read-only; minimal shell) ----------
  if (segments[0] === "admin" && segments[1] === "approvals-f180") {
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page
            // keep preview shell minimal (no Library, no duplicate menus)
            nav={[]}
            logoMarkSrc={logoMarkUrl}
            logoWordmarkSrc={logoWordmarkUrl}
          >
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Approvals (styled preview)</h1>
              <ApprovalsPageF180 />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

  // ---------- Verses (preview route) ----------
  if (segments[0] === "group" && segments[1] && segments[2] === "verses-style") {
    const gid = segments[1];
    return (
      <ToastProvider>
        <F180ToastProvider>
          <F180Page
            nav={[{ label: "Groups", href: "/#/groups" }]} // simple breadcrumb if you want it; set [] to remove
            logoMarkSrc={logoMarkUrl}
            logoWordmarkSrc={logoWordmarkUrl}
          >
            <div className="space-y-6">
              <h1 className="text-2xl font-semibold tracking-tight">Verses (styled preview)</h1>
              <VersesTabF180 groupId={gid} />
            </div>
          </F180Page>
        </F180ToastProvider>
      </ToastProvider>
    );
  }

// ---------- Request Group (preview route) ----------
if (segments[0] === "request-group-f180") {
  return (
    <ToastProvider>
      <F180ToastProvider>
        <F180Page nav={[]} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Request Group (styled preview)</h1>
            <RequestGroupPageF180 />
          </div>
        </F180Page>
      </F180ToastProvider>
    </ToastProvider>
  );
}
// ---------- Group Members (preview route) ----------
// Usage: /#/group/{id}/members-f180  (append ?demo=1 to use demo data)
if (segments[0] === "group" && segments[1] && segments[2] === "members-f180") {
  const gid = segments[1];
  return (
    <ToastProvider>
      <F180ToastProvider>
        <F180Page nav={[]} logoMarkSrc={logoMarkUrl} logoWordmarkSrc={logoWordmarkUrl}>
          <div className="space-y-6">
            <h1 className="text-2xl font-semibold tracking-tight">Members (styled preview)</h1>
            <GroupMembersPageF180 groupId={gid} />
          </div>
        </F180Page>
      </F180ToastProvider>
    </ToastProvider>
  );
}

  // no preview match
  return null;
}
