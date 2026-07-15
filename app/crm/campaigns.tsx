"use client";

import { useMemo, useState } from "react";
import type { CrmCampaign, CrmState } from "./types";
import { Badge, EmptyState, PageHeader } from "./ui";

const statuses = ["All", "Succeeded", "Failed", "Draft", "Archived"] as const;

export function CampaignsView({ state, setState }: { state: CrmState; setState: (updater: (current: CrmState) => CrmState) => void }) {
  const [filter, setFilter] = useState<(typeof statuses)[number]>("All");
  const [search, setSearch] = useState("");
  const campaigns = useMemo(() => state.campaigns.filter((item) => (filter === "All" || item.status === filter) && item.name.toLowerCase().includes(search.trim().toLowerCase())), [filter, search, state.campaigns]);

  function createCampaign() {
    const name = window.prompt("Campaign name")?.trim();
    if (!name) return;
    const campaign: CrmCampaign = { id: `campaign-${Date.now()}`, name, status: "Draft", updatedAt: new Date().toISOString(), executedAt: "", audience: 0 };
    setState((current) => ({ ...current, campaigns: [campaign, ...current.campaigns] }));
  }

  return <div className="crm-page"><PageHeader title="Campaigns" description="Review campaign health and execution without invented delivery results." actions={<button className="primary" onClick={createCampaign}>+ Campaign</button>} />
    <section className="crm-section"><div className="crm-filter-row"><label className="crm-search-field"><span>Q</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns" /></label>{statuses.map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status}<small>{status === "All" ? state.campaigns.length : state.campaigns.filter((item) => item.status === status).length}</small></button>)}</div>
      {campaigns.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Campaign</th><th>Status</th><th>Audience</th><th>Updated</th><th>Executed</th><th>Actions</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong></td><td><Badge tone={campaign.status === "Succeeded" ? "green" : campaign.status === "Failed" ? "red" : campaign.status === "Draft" ? "amber" : "neutral"}>{campaign.status}</Badge></td><td>{campaign.audience.toLocaleString()}</td><td>{new Date(campaign.updatedAt).toLocaleDateString()}</td><td>{campaign.executedAt ? new Date(campaign.executedAt).toLocaleString() : "Not executed"}</td><td><button onClick={() => setState((current) => ({ ...current, campaigns: current.campaigns.map((item) => item.id === campaign.id ? { ...item, status: item.status === "Archived" ? "Draft" : "Archived", updatedAt: new Date().toISOString() } : item) }))}>{campaign.status === "Archived" ? "Restore" : "Archive"}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching campaigns" body="Create a draft or clear the current filters." />}
    </section></div>;
}
