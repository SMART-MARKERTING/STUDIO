"use client";

import { useEffect, useState } from "react";
import type { AppearanceMode, CrmState, IntegrationStatus } from "./types";
import { Badge, PageHeader } from "./ui";

const social = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["twitter", "X"],
  ["gmb", "Google Business Profile"],
  ["tiktok", "TikTok"],
] as const;

export function SettingsView({ state, setState, notify }: { state: CrmState; setState: (updater: (current: CrmState) => CrmState) => void; notify: (message: string, tone?: "info" | "error" | "success") => void }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrations", { cache: "no-store" });
      const result = await response.json() as IntegrationStatus & { error?: string };
      if (!response.ok) throw new Error(result.error || "Connection status could not be loaded.");
      setStatus(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Connection status could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function appearance(mode: AppearanceMode) {
    setState((current) => ({ ...current, appearance: mode }));
  }

  return <div className="crm-page"><PageHeader title="Settings" description="Manage appearance, connections, and workspace controls." actions={<button onClick={refresh} disabled={loading}>{loading ? "Checking..." : "Refresh status"}</button>} />
    <div className="crm-settings-grid">
      <section className="crm-section"><div className="crm-section-heading"><div><h2>Appearance</h2><p>Choose how SmartR8 looks on this device.</p></div></div><div className="crm-appearance-picker">{(["light", "dark", "system"] as AppearanceMode[]).map((mode) => <button key={mode} className={state.appearance === mode ? "active" : ""} onClick={() => appearance(mode)}><span className={`appearance-preview ${mode}`} /><strong>{mode[0].toUpperCase() + mode.slice(1)}</strong></button>)}</div></section>
      <section className="crm-section"><div className="crm-section-heading"><div><h2>Workspace</h2><p>Regional and account preferences.</p></div></div><div className="crm-settings-list"><label>Language<select defaultValue="en-US"><option value="en-US">English (United States)</option></select></label><label>Inbound calls<select defaultValue="crm"><option value="crm">Ring in SmartR8</option><option value="forward">Forward to configured number</option></select></label><button onClick={() => notify("Support contact configuration is not connected in this deployment.", "info")}>Contact support</button><button className="danger-text" onClick={() => notify("Authentication is managed by the hosting identity provider; no local session was ended.", "info")}>Log out</button></div></section>
    </div>
    <section className="crm-section"><div className="crm-section-heading"><div><h2>Social connections</h2><p>Status comes directly from the server-side publishing provider.</p></div>{status?.configured ? <Badge tone="green">Provider configured</Badge> : <Badge tone="amber">Provider setup needed</Badge>}</div>
      {error ? <div className="crm-error" role="alert">{error}</div> : null}
      <div className="crm-connection-grid">{social.map(([id, name]) => { const channel = status?.channels?.[id]; return <article key={id}><span className="crm-app-mark">{name.slice(0, 2).toUpperCase()}</span><div><strong>{name}</strong><small>{loading ? "Checking provider..." : channel?.connected ? channel.handle || "Connected account" : "Not connected"}</small></div><Badge tone={channel?.connected ? "green" : "amber"}>{channel?.connected ? "Connected" : "Setup"}</Badge></article>; })}</div>
      <div className="crm-setup-note"><strong>Connection flow</strong><p>Connect or reauthorize accounts in Ayrshare Social Accounts, then return here and refresh. Google Business Profile requires a verified business profile. TikTok requires an approved public video asset for publishing.</p></div>
    </section>
    <section className="crm-section"><div className="crm-section-heading"><div><h2>Provider readiness</h2><p>No credentials are exposed to this browser.</p></div></div><div className="crm-readiness-row"><div><span>Publishing provider</span><Badge tone={status?.configured ? "green" : "amber"}>{status?.configured ? "Configured" : "Missing"}</Badge></div><div><span>AI generation</span><Badge tone={status?.modelConfigured ? "green" : "amber"}>{status?.modelConfigured ? "Configured" : "Missing"}</Badge></div><div><span>Paid publishing plan</span><Badge tone={status?.paidPlan ? "green" : "amber"}>{status?.paidPlan ? "Verified" : "Blocked"}</Badge></div><div><span>Payments</span><Badge tone="amber">Not connected</Badge></div></div></section>
  </div>;
}
