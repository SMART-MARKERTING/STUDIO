import type { PropsWithChildren, ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "blue" | "green" | "red" | "amber" }>) {
  return <span className={`crm-badge ${tone}`}>{children}</span>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="crm-empty" role="status">
      <span className="crm-empty-mark" aria-hidden="true">+</span>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="crm-page-header">
      <div>
        {eyebrow ? <span className="crm-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="crm-page-actions">{actions}</div> : null}
    </header>
  );
}

export function Modal({ title, close, children, wide = false }: PropsWithChildren<{ title: string; close: () => void; wide?: boolean }>) {
  return (
    <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className={`crm-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="crm-icon-button" onClick={close} aria-label="Close">x</button>
        </header>
        {children}
      </section>
    </div>
  );
}
