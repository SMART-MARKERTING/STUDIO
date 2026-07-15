"use client";

import type { CrmState, CrmView } from "./types";
import { initials, relativeTime } from "./data";
import { Badge, EmptyState, PageHeader } from "./ui";

const quickActions: Array<{ label: string; action: string; mark: string }> = [
  { label: "Add contact", action: "add-contact", mark: "+" },
  { label: "Make call", action: "call", mark: "C" },
  { label: "New message", action: "message", mark: "M" },
  { label: "New payment", action: "payment", mark: "$" },
  { label: "New opportunity", action: "opportunity", mark: "O" },
  { label: "Book appointment", action: "appointment", mark: "A" },
  { label: "Scan business card", action: "scan", mark: "S" },
  { label: "Request review", action: "review", mark: "R" },
];

const appNames: Partial<Record<CrmView, string>> = {
  conversations: "Conversations",
  social: "Social Planner",
  files: "File Storage",
  calendar: "Calendar",
  campaigns: "Campaigns",
  reputation: "Reputation",
};

export function DashboardView({ state, navigate, runAction, toggleTask }: { state: CrmState; navigate: (view: CrmView) => void; runAction: (action: string) => void; toggleTask: (id: string) => void }) {
  const unread = state.conversations.filter((item) => item.unread).length;
  const pipeline = state.conversations.reduce((sum, item) => sum + item.contact.value, 0);
  const today = new Date().toDateString();
  const appointments = state.appointments.filter((item) => new Date(item.startAt).toDateString() === today);
  const openTasks = state.tasks.filter((task) => !task.completed).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

  return (
    <div className="crm-page">
      <PageHeader eyebrow="SmartR8 workspace" title="Good morning, Mykoal" description="Your conversations, follow-up, and marketing activity in one place." actions={<button className="primary" onClick={() => runAction("add-contact")}>+ Add contact</button>} />
      <section className="crm-metric-grid" aria-label="Workspace summary">
        <button onClick={() => navigate("conversations")}><span>Unread messages</span><strong>{unread}</strong><small>Across active inboxes</small></button>
        <button onClick={() => navigate("calendar")}><span>Today&apos;s appointments</span><strong>{appointments.length}</strong><small>Scheduled for today</small></button>
        <button onClick={() => navigate("conversations")}><span>Pipeline value</span><strong>${pipeline.toLocaleString()}</strong><small>Starter CRM records</small></button>
        <button onClick={() => navigate("home")}><span>Pending tasks</span><strong>{openTasks.length}</strong><small>Needs your attention</small></button>
      </section>
      <section className="crm-section">
        <div className="crm-section-heading"><div><h2>Quick actions</h2><p>Start common work without hunting through menus.</p></div></div>
        <div className="crm-quick-grid">
          {quickActions.map((item) => <button key={item.action} onClick={() => runAction(item.action)}><span>{item.mark}</span><strong>{item.label}</strong></button>)}
        </div>
      </section>
      <div className="crm-dashboard-columns">
        <section className="crm-section">
          <div className="crm-section-heading"><div><h2>Pending tasks</h2><p>Complete the next best actions.</p></div></div>
          <div className="crm-task-list">
            {openTasks.length ? openTasks.slice(0, 5).map((task) => (
              <label key={task.id}><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} /><span><strong>{task.title}</strong><small>Due {new Date(task.dueAt).toLocaleString()}</small></span></label>
            )) : <EmptyState title="You are caught up" body="New tasks will appear here." />}
          </div>
        </section>
        <section className="crm-section">
          <div className="crm-section-heading"><div><h2>Recent conversations</h2><p>Open the latest contact activity.</p></div><button onClick={() => navigate("conversations")}>View inbox</button></div>
          <div className="crm-recent-list">
            {state.conversations.filter((item) => item.channel !== "internal").slice(0, 4).map((item) => (
              <button key={item.id} onClick={() => navigate("conversations")}>
                <span className="crm-avatar">{initials(item.contact.name)}</span>
                <span><strong>{item.contact.name}</strong><small>{item.messages.at(-1)?.body}</small></span>
                <span>{item.unread ? <Badge tone="blue">New</Badge> : null}<time>{relativeTime(item.updatedAt)}</time></span>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="crm-section">
        <div className="crm-section-heading"><div><h2>Pinned apps</h2><p>Your most-used tools.</p></div><button onClick={() => navigate("apps")}>Manage apps</button></div>
        <div className="crm-pinned-apps">
          {state.pinnedApps.map((view) => <button key={view} onClick={() => navigate(view)}><span>{appNames[view]?.slice(0, 2).toUpperCase()}</span><strong>{appNames[view] || view}</strong></button>)}
        </div>
      </section>
    </div>
  );
}
