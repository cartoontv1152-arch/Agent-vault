import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <main id="main-content" className="error-page">
      <Brand />
      <div className="error-card">
        <p className="eyebrow">404 · Not found</p>
        <h1>That page has moved.</h1>
        <p>The route you requested does not exist, but your vault is still safe.</p>
        <div className="error-actions"><Link className="button button-primary" href="/">Back home</Link><Link className="text-link" href="/app">Open app</Link></div>
      </div>
    </main>
  );
}
