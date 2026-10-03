import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="section"><div className="section-heading"><h2>{title}</h2><p>{description}</p></div>{children}</section>;
}

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="action-link" href={href}>{children}<span aria-hidden="true"> ↗</span></a>;
}
