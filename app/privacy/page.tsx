import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-page page-width">
      <header className="legal-header"><Brand /><Link className="text-link" href="/">Back home</Link></header>
      <article className="legal-copy">
        <p className="eyebrow">AgentVault privacy</p>
        <h1>Your vault is private by design.</h1>
        <p className="legal-updated">Last updated: August 28, 2026</p>
        <h2>What AgentVault receives</h2>
        <p>When you connect a wallet, AgentVault receives the public wallet address and a signed login message. The signature proves control of the address; it does not authorize a transaction or expose your private key.</p>
        <h2>What is stored</h2>
        <p>Agent configuration and encrypted message and memory records are stored by the application. The server stores ciphertext, not plaintext vault content. Encrypted snapshots are uploaded to the configured 0G Storage service, and only a root hash is anchored to the ERC-8004 identity on 0G Galileo.</p>
        <h2>What stays in your browser</h2>
        <p>The wallet-derived vault key is held in session storage while you are unlocked. Locking the vault or closing the session removes that key from the browser. Never share a wallet seed phrase or private key with AgentVault.</p>
        <h2>Testnet notice</h2>
        <p>AgentVault currently runs on the 0G Galileo testnet. Testnet services and data can be reset, delayed, or unavailable. Do not use the testnet for sensitive production information.</p>
      </article>
    </main>
  );
}
