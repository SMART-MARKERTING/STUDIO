"use client";

import { useMemo, useState } from "react";
import { channelLabels, initials, newId, relativeTime } from "./data";
import type { CrmConversation, CrmState, MessageChannel, MessageDirection } from "./types";
import { Badge, EmptyState, PageHeader } from "./ui";

type InboxTab = "team" | "mine" | "internal";

export function ConversationsView({
  state,
  setState,
  initialId,
  onDial,
}: {
  state: CrmState;
  setState: (updater: (current: CrmState) => CrmState) => void;
  initialId?: string | null;
  onDial: (conversation: CrmConversation) => void;
}) {
  const [tab, setTab] = useState<InboxTab>("team");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? state.conversations[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [recency, setRecency] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [channel, setChannel] = useState<"all" | MessageChannel>("all");
  const [assigned, setAssigned] = useState("all");
  const [direction, setDirection] = useState<"all" | MessageDirection>("all");
  const [draft, setDraft] = useState("");
  const [filterNow] = useState(() => Date.now());

  const assignees = useMemo(
    () => Array.from(new Set(state.conversations.map((item) => item.assignedTo))).sort(),
    [state.conversations],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const cutoff = recency === "today" ? filterNow - 86400000 : recency === "week" ? filterNow - 604800000 : 0;
    return state.conversations.filter((item) => {
      if (tab === "mine" && item.assignedTo !== "Mykoal DeShazo") return false;
      if (tab === "internal" && item.channel !== "internal") return false;
      if (tab !== "internal" && item.channel === "internal") return false;
      if (query && !`${item.contact.name} ${item.contact.phone} ${item.contact.email} ${item.messages.at(-1)?.body || ""}`.toLowerCase().includes(query)) return false;
      if (cutoff && Date.parse(item.updatedAt) < cutoff) return false;
      if (unreadOnly && !item.unread) return false;
      if (starredOnly && !item.starred) return false;
      if (channel !== "all" && item.channel !== channel) return false;
      if (assigned !== "all" && item.assignedTo !== assigned) return false;
      if (direction !== "all" && !item.messages.some((message) => message.direction === direction)) return false;
      return true;
    });
  }, [assigned, channel, direction, filterNow, recency, search, starredOnly, state.conversations, tab, unreadOnly]);

  const selected = state.conversations.find((item) => item.id === selectedId) ?? null;

  function patchConversation(id: string, patch: Partial<CrmConversation>) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  }

  function openConversation(id: string) {
    setSelectedId(id);
    patchConversation(id, { unread: false });
  }

  function sendMessage() {
    const body = draft.trim();
    if (!selected || !body) return;
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((item) => item.id === selected.id ? {
        ...item,
        updatedAt: now,
        unread: false,
        messages: [...item.messages, {
          id: newId("message"),
          body,
          direction: item.channel === "internal" ? "internal" : "outbound",
          createdAt: now,
          sender: "Mykoal DeShazo",
          status: "saved-local",
        }],
      } : item),
    }));
    setDraft("");
  }

  return (
    <div className="crm-page crm-conversations-page">
      <PageHeader title="Conversations" description="Handle every configured channel from one focused inbox." />
      <div className="crm-inbox-tabs" role="tablist" aria-label="Inbox">
        {(["team", "mine", "internal"] as InboxTab[]).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "team" ? "Team Inbox" : item === "mine" ? "My Inbox" : "Internal Chat"}
          </button>
        ))}
      </div>
      <div className="crm-inbox-filters">
        <label className="crm-search-field"><span aria-hidden="true">Q</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" aria-label="Search conversations" /></label>
        <select value={recency} onChange={(event) => setRecency(event.target.value)} aria-label="Recency"><option value="all">Any time</option><option value="today">Today</option><option value="week">Last 7 days</option></select>
        <button className={unreadOnly ? "filter-on" : ""} onClick={() => setUnreadOnly((value) => !value)}>Unread</button>
        <button className={starredOnly ? "filter-on" : ""} onClick={() => setStarredOnly((value) => !value)}>Starred</button>
        <select value={channel} onChange={(event) => setChannel(event.target.value as "all" | MessageChannel)} aria-label="Channel">
          <option value="all">All channels</option>
          {Object.entries(channelLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select value={assigned} onChange={(event) => setAssigned(event.target.value)} aria-label="Assigned user"><option value="all">All users</option>{assignees.map((name) => <option key={name}>{name}</option>)}</select>
        <select value={direction} onChange={(event) => setDirection(event.target.value as "all" | MessageDirection)} aria-label="Message direction"><option value="all">Any direction</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="internal">Internal</option></select>
      </div>
      <div className={`crm-inbox ${selected ? "has-selection" : ""}`}>
        <aside className="crm-thread-list" aria-label="Conversations">
          {filtered.length ? filtered.map((item) => {
            const preview = item.messages.at(-1);
            return (
              <button key={item.id} className={`crm-thread-row ${selectedId === item.id ? "active" : ""}`} onClick={() => openConversation(item.id)}>
                <span className="crm-avatar">{initials(item.contact.name)}</span>
                <span className="crm-thread-copy">
                  <span><strong>{item.contact.name}</strong><time>{relativeTime(item.updatedAt)}</time></span>
                  <span className="crm-thread-meta"><Badge tone="blue">{channelLabels[item.channel]}</Badge>{item.assignedTo}</span>
                  <small>{preview?.body || "No messages yet"}</small>
                </span>
                {item.unread ? <i className="crm-unread-dot" aria-label="Unread" /> : null}
              </button>
            );
          }) : <EmptyState title="No matching conversations" body="Clear a filter or start a new conversation from the dashboard." />}
        </aside>
        <section className="crm-thread-detail">
          {selected ? (
            <>
              <header className="crm-thread-header">
                <button className="crm-mobile-back" onClick={() => setSelectedId(null)}>Back</button>
                <span className="crm-avatar large">{initials(selected.contact.name)}</span>
                <div><h2>{selected.contact.name}</h2><p>{selected.contact.phone || selected.contact.email} · {channelLabels[selected.channel]}</p></div>
                <div className="crm-thread-actions">
                  <button onClick={() => patchConversation(selected.id, { starred: !selected.starred })} aria-pressed={selected.starred}>{selected.starred ? "Unstar" : "Star"}</button>
                  <button onClick={() => patchConversation(selected.id, { unread: !selected.unread })}>{selected.unread ? "Mark read" : "Mark unread"}</button>
                  {selected.contact.phone ? <button className="primary" onClick={() => onDial(selected)}>Call</button> : null}
                </div>
              </header>
              {selected.sample ? <div className="crm-local-banner">Starter conversation. Replies are saved locally until a CRM messaging adapter is connected.</div> : null}
              <div className="crm-message-history" aria-live="polite">
                {selected.messages.map((message) => (
                  <article key={message.id} className={`crm-message ${message.direction}`}>
                    <div>{message.body}</div>
                    <footer>{message.sender} · {new Date(message.createdAt).toLocaleString()} {message.status === "saved-local" ? "· Saved locally" : ""}</footer>
                  </article>
                ))}
              </div>
              <div className="crm-composer">
                <div className="crm-composer-row">
                  <select value={selected.assignedTo} onChange={(event) => patchConversation(selected.id, { assignedTo: event.target.value })} aria-label="Assign conversation">
                    {assignees.map((name) => <option key={name}>{name}</option>)}
                    {!assignees.includes("Team") ? <option>Team</option> : null}
                  </select>
                  <Badge tone={selected.channel === "internal" ? "amber" : "blue"}>{channelLabels[selected.channel]}</Badge>
                </div>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={selected.channel === "internal" ? "Write an internal note" : "Write a reply"} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") sendMessage(); }} />
                <div><small>Ctrl/Command + Enter to save</small><button className="primary" onClick={sendMessage} disabled={!draft.trim()}>{selected.channel === "internal" ? "Add note" : "Save reply"}</button></div>
              </div>
            </>
          ) : <EmptyState title="Select a conversation" body="Message history and contact details will open here." />}
        </section>
        <aside className="crm-contact-panel">
          {selected ? <>
            <span className="crm-eyebrow">Contact details</span>
            <h3>{selected.contact.name}</h3>
            <dl>
              <div><dt>Phone</dt><dd>{selected.contact.phone || "Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{selected.contact.email || "Not provided"}</dd></div>
              <div><dt>Owner</dt><dd>{selected.contact.owner}</dd></div>
              <div><dt>Stage</dt><dd>{selected.contact.stage}</dd></div>
              <div><dt>Source</dt><dd>{selected.contact.source}</dd></div>
            </dl>
          </> : null}
        </aside>
      </div>
    </div>
  );
}
