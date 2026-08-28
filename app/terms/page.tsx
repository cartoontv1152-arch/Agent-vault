import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main id="main-content" className="legal-page page-width">
      <header className="legal-header"><Brand /><Link className="text-link" href="/">Back home</Link></header>
      <article className="legal-copy">
        <p className="eyebrow">AgentVault terms</p>
        <h1>Use the testnet thoughtfully.</h1>
        <p className="legal-updated">Last updated: August 28, 2026</p>
        <h2>Experimental software</h2>
        <p>AgentVault is an experimental interface for wallet-owned AI agent identities, encrypted memory, 0G Compute, and 0G Storage. It is provided for evaluation on the 0G Galileo testnet and may change without notice.</p>
        <h2>Your responsibilities</h2>
        <p>You are responsible for the wallet you connect, the testnet funds used for identity and root transactions, and the content you choose to send to configured compute providers. Keep your wallet credentials private and review transactions before signing.</p>
        <h2>No guarantee of availability</h2>
        <p>Chain RPCs, compute models, storage uploads, and the application can be rate-limited or unavailable. A successful chat response does not guarantee that a memory was extracted or that a root was anchored; the workspace shows the current status of each operation.</p>
        <h2>Contact and updates</h2>
        <p>For project updates, consult the repository documentation and the linked 0G documentation. These terms are a plain-language product notice, not legal advice.</p>
      </article>
    </main>
  );
}
