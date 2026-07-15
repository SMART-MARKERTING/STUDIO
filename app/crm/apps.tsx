"use client";

import type { CrmState, CrmView } from "./types";
import { Badge, PageHeader } from "./ui";

type AppItem = { name: string; description: string; mark: string; target?: CrmView; integration?: string };

const groups: Array<{ title: string; items: AppItem[] }> = [
  { title: "Communication", items: [
    { name: "Conversations", description: "Team inbox and channel history", mark: "CO", target: "conversations" },
    { name: "Dialer", description: "Call contacts from the CRM", mark: "DI", integration: "Telephony adapter" },
    { name: "Contacts", description: "Search every contact and conversation", mark: "CT", target: "search" },
    { name: "Notifications", description: "Unread and assigned activity", mark: "NO", target: "conversations" },
  ] },
  { title: "Sales & Operations", items: [
    { name: "POS", description: "Point-of-sale application handoff", mark: "PO", integration: "POS URL" },
    { name: "Estimates", description: "Create and track estimates", mark: "ES", integration: "Estimates backend" },
    { name: "Invoices", description: "Billing and payment status", mark: "IN", integration: "Payments provider" },
    { name: "Products", description: "Manage products and services", mark: "PR", integration: "Products backend" },
    { name: "Opportunities", description: "Pipeline contacts and value", mark: "OP", target: "conversations" },
    { name: "File Storage", description: "Folders, previews, and files", mark: "FS", target: "files" },
  ] },
  { title: "Marketing & Growth", items: [
    { name: "Social Planner", description: "Create, approve, and publish posts", mark: "SP", target: "social" },
    { name: "Campaigns", description: "Campaign health and execution", mark: "CA", target: "campaigns" },
    { name: "Reputation", description: "Reviews and review requests", mark: "RE", target: "reputation" },
    { name: "Google Business Profile", description: "Connection and publishing status", mark: "GB", target: "settings" },
    { name: "TikTok", description: "Video publishing connection", mark: "TK", target: "settings" },
    { name: "Manual Actions", description: "Review work requiring a person", mark: "MA", target: "campaigns" },
  ] },
];

export function AppsView({ state, navigate, notify, togglePinned }: { state: CrmState; navigate: (view: CrmView) => void; notify: (message: string, tone?: "info" | "error" | "success") => void; togglePinned: (view: CrmView) => void }) {
  function open(item: AppItem) {
    if (item.target) return navigate(item.target);
    notify(`${item.name} needs a ${item.integration || "server integration"} before it can be used.`, "info");
  }

  return (
    <div className="crm-page">
      <PageHeader title="Apps" description="Open the tools connected to your SmartR8 workspace." />
      {groups.map((group) => (
        <section className="crm-app-group" key={group.title}>
          <div className="crm-section-heading"><div><h2>{group.title}</h2><p>{group.items.length} applications</p></div></div>
          <div className="crm-app-grid">
            {group.items.map((item) => {
              const pinned = item.target ? state.pinnedApps.includes(item.target) : false;
              return <article key={item.name} className="crm-app-card">
                <button className="crm-app-open" onClick={() => open(item)}>
                  <span className="crm-app-mark">{item.mark}</span>
                  <span><strong>{item.name}</strong><small>{item.description}</small></span>
                  {item.integration ? <Badge tone="amber">Setup needed</Badge> : <span className="crm-chevron">›</span>}
                </button>
                {item.target ? <button className="crm-pin" onClick={() => togglePinned(item.target!)} aria-pressed={pinned}>{pinned ? "Pinned" : "Pin app"}</button> : null}
              </article>;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
