"use client";

import { useMemo, useState } from "react";
import { newId } from "./data";
import type { CrmAppointment, CrmState } from "./types";
import { EmptyState, Modal, PageHeader } from "./ui";

function monthDays(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function CalendarView({ state, setState }: { state: CrmState; setState: (updater: (current: CrmState) => CrmState) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "Consultation", contactName: "", startAt: "", durationMinutes: 30, ccEmail: "", location: "Phone call" });
  const days = useMemo(() => monthDays(cursor), [cursor]);

  function save() {
    if (!form.title.trim() || !form.startAt) return;
    const appointment: CrmAppointment = { id: newId("appointment"), ...form, title: form.title.trim(), startAt: new Date(form.startAt).toISOString() };
    setState((current) => ({ ...current, appointments: [...current.appointments, appointment] }));
    setEditing(false);
    setForm({ title: "Consultation", contactName: "", startAt: "", durationMinutes: 30, ccEmail: "", location: "Phone call" });
  }

  return <div className="crm-page">
    <PageHeader title="Calendar" description="Schedule appointments and keep follow-up visible." actions={<button className="primary" onClick={() => setEditing(true)}>+ Appointment</button>} />
    <section className="crm-calendar-toolbar"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Previous</button><h2>{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button onClick={() => setCursor(new Date())}>Today</button><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button></section>
    <section className="crm-calendar-grid" aria-label={cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <strong className="crm-calendar-weekday" key={day}>{day}</strong>)}
      {days.map((day) => {
        const key = day.toDateString();
        const items = state.appointments.filter((item) => new Date(item.startAt).toDateString() === key);
        return <div className={`crm-calendar-day ${day.getMonth() !== cursor.getMonth() ? "outside" : ""}`} key={day.toISOString()}><span>{day.getDate()}</span>{items.map((item) => <button key={item.id} title={`${item.title} with ${item.contactName || "No contact"}`}>{new Date(item.startAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} {item.title}</button>)}</div>;
      })}
    </section>
    {!state.appointments.length ? <EmptyState title="No appointments yet" body="Add an appointment to place it on the monthly calendar." /> : null}
    {editing ? <Modal title="Book appointment" close={() => setEditing(false)}><div className="crm-form-grid">
      <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>Contact name<input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label>
      <label>Start<input type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></label>
      <label>Duration<select value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label>
      <label>CC email<input type="email" value={form.ccEmail} onChange={(event) => setForm({ ...form, ccEmail: event.target.value })} /></label>
      <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
    </div><footer className="crm-modal-actions"><button onClick={() => setEditing(false)}>Cancel</button><button className="primary" onClick={save} disabled={!form.title.trim() || !form.startAt}>Save appointment</button></footer></Modal> : null}
  </div>;
}
