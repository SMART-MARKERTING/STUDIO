"use client";

import { useEffect, useMemo, useState } from "react";
import ContentStudio from "../studio";
import { AppsView } from "./apps";
import { CalendarView } from "./calendar";
import { CampaignsView } from "./campaigns";
import { ConversationsView } from "./conversations";
import { createCrmState, initials, newId } from "./data";
import { DashboardView } from "./dashboard";
import { FileStorageView } from "./file-storage";
import { ReputationView } from "./reputation";
import { SearchView } from "./search";
import { SettingsView } from "./settings";
import type { AppNotice, CrmConversation, CrmState, CrmView, MessageChannel } from "./types";
import { Modal } from "./ui";

const STORAGE_KEY = "smartr8-crm-mobile-v1";

const primaryNav: Array<{ view: CrmView; label: string; mark: string }> = [
  { view: "home", label: "Home", mark: "H" },
  { view: "conversations", label: "Conversations", mark: "C" },
  { view: "search", label: "Search", mark: "S" },
  { view: "calendar", label: "Calendar", mark: "A" },
  { view: "apps", label: "Apps", mark: "G" },
];

const desktopNav: Array<{ view: CrmView; label: string; mark: string }> = [
  ...primaryNav,
  { view: "social", label: "Social Planner", mark: "SP" },
  { view: "files", label: "File Storage", mark: "FS" },
  { view: "campaigns", label: "Campaigns", mark: "CA" },
  { view: "reputation", label: "Reputation", mark: "RE" },
  { view: "settings", label: "Settings", mark: "SE" },
];

const titles: Record<CrmView, string> = {
  home: "Dashboard", conversations: "Conversations", search: "Search", calendar: "Calendar", apps: "Apps", social: "Social Planner", files: "File Storage", campaigns: "Campaigns", reputation: "Reputation", settings: "Settings",
};

export default function SmartR8Crm() {
  const [state, setState] = useState<CrmState>(createCrmState);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<CrmView>("home");
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [search, setSearch] = useState("");
  const [addContact, setAddContact] = useState(false);
  const [dialer, setDialer] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", phone: "", email: "", channel: "sms" as MessageChannel });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CrmState;
          if (parsed.version === 1 && Array.isArray(parsed.conversations)) setState(parsed);
        }
      } catch { /* A damaged local workspace should not stop the application. */ }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { notify("Browser storage is full. Remove large local files or connect object storage.", "error"); }
  }, [hydrated, state]);

  useEffect(() => {
    document.documentElement.dataset.crmTheme = state.appearance;
  }, [state.appearance]);

  const unread = useMemo(() => state.conversations.filter((item) => item.unread).length, [state.conversations]);
  const updateState = (updater: (current: CrmState) => CrmState) => setState(updater);

  function notify(message: string, tone: AppNotice["tone"] = "success") {
    setNotice({ message, tone });
    window.setTimeout(() => setNotice((current) => current?.message === message ? null : current), 4500);
  }

  function navigate(next: CrmView) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePinned(target: CrmView) {
    setState((current) => ({ ...current, pinnedApps: current.pinnedApps.includes(target) ? current.pinnedApps.filter((item) => item !== target) : [...current.pinnedApps, target] }));
  }

  function createContact() {
    if (!contactForm.name.trim() || (!contactForm.phone.trim() && !contactForm.email.trim())) return;
    const now = new Date().toISOString();
    const conversation: CrmConversation = {
      id: newId("conversation"),
      contact: { id: newId("contact"), name: contactForm.name.trim(), phone: contactForm.phone.trim(), email: contactForm.email.trim(), owner: "Mykoal DeShazo", source: "Manual", stage: "New inquiry", value: 0 },
      channel: contactForm.channel,
      assignedTo: "Mykoal DeShazo",
      unread: false,
      starred: false,
      updatedAt: now,
      messages: [],
    };
    setState((current) => ({ ...current, conversations: [conversation, ...current.conversations] }));
    setAddContact(false);
    setContactForm({ name: "", phone: "", email: "", channel: "sms" });
    notify("Contact saved to this SmartR8 browser workspace.", "info");
    navigate("conversations");
  }

  function runAction(action: string) {
    if (action === "add-contact" || action === "opportunity") return setAddContact(true);
    if (action === "call") return setDialer(true);
    if (action === "message") return navigate("conversations");
    if (action === "appointment") return navigate("calendar");
    if (action === "review") return navigate("reputation");
    if (action === "payment") { navigate("apps"); return notify("Connect a payment provider before creating a payment.", "info"); }
    if (action === "scan") return notify("Business-card scanning requires a camera/OCR service and is not connected yet.", "info");
  }

  function openDialer(conversation?: CrmConversation) {
    setDialNumber(conversation?.contact.phone || "");
    setDialer(true);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search.trim()) navigate("search");
  }

  return <main className="crm-shell">
    <aside className="crm-sidebar">
      <button className="crm-brand" onClick={() => navigate("home")}><img src="/assets/smart-marketing-logo.jpg" alt="" /><span><strong>SmartR8</strong><small>Smart Marketing CRM</small></span></button>
      <nav aria-label="Workspace navigation">{desktopNav.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><span>{item.mark}</span>{item.label}{item.view === "conversations" && unread ? <b>{unread}</b> : null}</button>)}</nav>
      <div className="crm-sidebar-profile"><img src="/assets/headshot.jpeg" alt="Mykoal DeShazo" /><span><strong>Mykoal DeShazo</strong><small>Administrator</small></span><button onClick={() => navigate("settings")} aria-label="Open settings">...</button></div>
    </aside>
    <section className="crm-workspace">
      <header className="crm-topbar"><div><span className="crm-mobile-logo">SR</span><strong>{titles[view]}</strong></div><form onSubmit={submitSearch}><span>Q</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contacts, conversations..." aria-label="Global search" /></form><div className="crm-top-actions"><button className="crm-phone-button" onClick={() => setDialer((value) => !value)} aria-label="Open dialer">Call</button><button onClick={() => navigate("conversations")} aria-label={`${unread} unread notifications`}>Alerts{unread ? <b>{unread}</b> : null}</button><button className="crm-user-button" onClick={() => navigate("settings")}><span>{initials("Mykoal DeShazo")}</span><strong>Mykoal</strong></button></div></header>
      <div className="crm-content">
        {view === "home" ? <DashboardView state={state} navigate={navigate} runAction={runAction} toggleTask={(id) => setState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task) }))} /> : null}
        {view === "conversations" ? <ConversationsView state={state} setState={updateState} onDial={openDialer} /> : null}
        {view === "search" ? <SearchView state={state} initialQuery={search} navigate={navigate} /> : null}
        {view === "calendar" ? <CalendarView state={state} setState={updateState} /> : null}
        {view === "apps" ? <AppsView state={state} navigate={navigate} notify={notify} togglePinned={togglePinned} /> : null}
        {view === "social" ? <div className="crm-social"><ContentStudio embedded /></div> : null}
        {view === "files" ? <FileStorageView state={state} setState={updateState} notify={notify} /> : null}
        {view === "campaigns" ? <CampaignsView state={state} setState={updateState} /> : null}
        {view === "reputation" ? <ReputationView state={state} notify={notify} /> : null}
        {view === "settings" ? <SettingsView state={state} setState={updateState} notify={notify} /> : null}
      </div>
    </section>
    <nav className="crm-bottom-nav" aria-label="Mobile navigation">{primaryNav.map((item) => <button key={item.view} className={view === item.view ? "active" : ""} onClick={() => navigate(item.view)}><span>{item.mark}{item.view === "conversations" && unread ? <b>{unread}</b> : null}</span><small>{item.label}</small></button>)}</nav>
    {dialer ? <aside className="crm-dialer" aria-label="Dialer"><header><div><strong>SmartR8 Dialer</strong><small>Telephony setup required</small></div><button onClick={() => setDialer(false)} aria-label="Close dialer">x</button></header><input value={dialNumber} onChange={(event) => setDialNumber(event.target.value)} placeholder="Enter phone number" aria-label="Phone number" /><div className="crm-keypad">{"123456789*0#".split("").map((key) => <button key={key} onClick={() => setDialNumber((value) => value + key)}>{key}</button>)}</div><button className="primary crm-call-submit" onClick={() => notify("A telephony adapter is not connected. No call was placed.", "info")} disabled={!dialNumber.trim()}>Call {dialNumber || "number"}</button></aside> : null}
    {addContact ? <Modal title="Add contact" close={() => setAddContact(false)}><div className="crm-form-grid"><label>Full name<input autoFocus value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} /></label><label>Phone<input value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} /></label><label>Email<input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} /></label><label>Starting channel<select value={contactForm.channel} onChange={(event) => setContactForm({ ...contactForm, channel: event.target.value as MessageChannel })}><option value="sms">SMS</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="google">Google Business</option><option value="tiktok">TikTok</option></select></label></div><footer className="crm-modal-actions"><button onClick={() => setAddContact(false)}>Cancel</button><button className="primary" onClick={createContact} disabled={!contactForm.name.trim() || (!contactForm.phone.trim() && !contactForm.email.trim())}>Save contact</button></footer></Modal> : null}
    {notice ? <div className={`crm-toast ${notice.tone}`} role="status"><strong>{notice.tone === "error" ? "Action blocked" : notice.tone === "success" ? "Complete" : "SmartR8"}</strong><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss">x</button></div> : null}
  </main>;
}
