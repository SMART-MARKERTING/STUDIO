"use client";

import { useMemo, useState } from "react";
import { channelLabels, initials } from "./data";
import type { CrmState, CrmView } from "./types";
import { Badge, EmptyState, PageHeader } from "./ui";

export function SearchView({ state, initialQuery = "", navigate }: { state: CrmState; initialQuery?: string; navigate: (view: CrmView) => void }) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return state.conversations.filter((item) => `${item.contact.name} ${item.contact.email} ${item.contact.phone} ${item.contact.source} ${item.messages.map((message) => message.body).join(" ")}`.toLowerCase().includes(needle));
  }, [query, state.conversations]);
  return <div className="crm-page"><PageHeader title="Search" description="Find contacts, phone numbers, email addresses, and conversation text." />
    <label className="crm-global-search-page"><span>Q</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the entire workspace" /></label>
    <section className="crm-section"><div className="crm-section-heading"><div><h2>Results</h2><p>{query.trim() ? `${results.length} matches` : "Start typing to search"}</p></div></div>{results.length ? <div className="crm-search-results">{results.map((item) => <button key={item.id} onClick={() => navigate("conversations")}><span className="crm-avatar">{initials(item.contact.name)}</span><span><strong>{item.contact.name}</strong><small>{item.contact.phone} · {item.contact.email}</small></span><Badge tone="blue">{channelLabels[item.channel]}</Badge></button>)}</div> : <EmptyState title={query.trim() ? "No matches found" : "Search SmartR8"} body={query.trim() ? "Try a name, phone number, email, or message phrase." : "Results from conversations and contacts will appear here."} />}</section>
  </div>;
}
