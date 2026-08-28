import Link from "next/link";
import type { Agent } from "@/lib/types";

export function AgentPageHeading({
  agent,
  section,
  description,
  actions,
}: {
  agent: Agent;
  section: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-heading agent-page-heading">
      <div>
        <div className="agent-breadcrumb">
          <Link href="/app">Agents</Link><span>/</span><strong>{agent.name}</strong>
        </div>
        <h1>{section}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
