import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle,
  Fingerprint,
  LockKey,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/brand";
import { StartButton } from "@/components/start-button";
import { WalletButton } from "@/components/wallet-button";

export default function LandingPage() {
  return (
    <main id="main-content" className="landing">
      <header className="landing-nav page-width">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#ownership">Ownership</a>
          <Link href="/app">Open app</Link>
        </nav>
        <WalletButton compact />
      </header>

      <section className="hero page-width">
        <div className="hero-copy reveal">
          <p className="eyebrow">Portable memory for AI agents</p>
          <h1>
            Your AI changes.
            <br />
            Its memory stays yours.
          </h1>
          <p className="hero-lede">
            Give any AI agent a persistent, encrypted memory and a portable identity
            that you control on 0G.
          </p>
          <div className="hero-actions">
            <StartButton />
            <a className="text-link" href="#how-it-works">
              See how it works <ArrowUpRight weight="bold" aria-hidden="true" />
            </a>
          </div>
          <div className="hero-proof" aria-label="Core properties">
            <span><CheckCircle weight="fill" /> Encrypted memory</span>
            <span><CheckCircle weight="fill" /> On-chain ownership</span>
            <span><CheckCircle weight="fill" /> 0G testnet</span>
          </div>
        </div>

        <div className="vault-visual reveal reveal-delay" aria-label="Illustrative AgentVault memory flow">
          <div className="visual-label">Illustrative vault</div>
          <div className="agent-portrait" aria-hidden="true">
            <span>AV</span>
          </div>
          <div className="visual-heading">
            <div>
              <strong>Your coding agent</strong>
              <span>Portable across models</span>
            </div>
            <span className="verified-mark"><CheckCircle weight="fill" /> Verified</span>
          </div>
          <div className="memory-lines">
            <div><span>01</span><p>Prefers TypeScript for product work</p></div>
            <div><span>02</span><p>Uses PostgreSQL for relational data</p></div>
            <div><span>03</span><p>Building AgentVault on 0G</p></div>
          </div>
          <div className="visual-footer">
            <span><LockKey weight="bold" /> AES-256 encrypted</span>
            <span className="mono">root appears after sync</span>
          </div>
        </div>
      </section>

      <section className="process page-width" id="how-it-works">
        <div className="section-intro reveal">
          <p className="eyebrow">One memory layer</p>
          <h2>Built for continuity, not lock-in.</h2>
          <p>
            AgentVault separates what an agent knows from the model currently answering.
          </p>
        </div>
        <div className="process-grid">
          <article className="process-card reveal">
            <Fingerprint weight="fill" aria-hidden="true" />
            <span className="step">01</span>
            <h3>Create an identity</h3>
            <p>Mint a portable ERC-8004 identity owned by your wallet on 0G Galileo.</p>
          </article>
          <article className="process-card reveal reveal-delay">
            <LockKey weight="fill" aria-hidden="true" />
            <span className="step">02</span>
            <h3>Keep useful memory</h3>
            <p>Important preferences and project facts are extracted, encrypted, and stored.</p>
          </article>
          <article className="process-card reveal reveal-delay-two">
            <Stack weight="fill" aria-hidden="true" />
            <span className="step">03</span>
            <h3>Carry it forward</h3>
            <p>Switch the model or begin a new session. The agent retrieves the same memory.</p>
          </article>
        </div>
      </section>

      <section className="continuity page-width" id="ownership">
        <div className="section-intro reveal">
          <p className="eyebrow">A calmer model boundary</p>
          <h2>One memory layer. Any model.</h2>
          <p>
            AgentVault keeps the durable context with your identity, so changing a model does not mean starting over.
          </p>
        </div>
        <div className="continuity-grid">
          <article className="continuity-card reveal">
            <span className="continuity-kicker">Before a model switch</span>
            <h3>Context stays in your vault</h3>
            <p>Preferences, project decisions, and useful facts remain encrypted and reviewable by the owner wallet.</p>
            <div className="continuity-line"><span className="status-dot" /> <span>Same agent identity</span><span className="mono">ERC-8004</span></div>
          </article>
          <article className="continuity-card continuity-card-dark reveal reveal-delay">
            <span className="continuity-kicker">After a model switch</span>
            <h3>New answers, familiar context</h3>
            <p>Choose an available 0G Compute model and the agent retrieves the same ranked memories for the next session.</p>
            <div className="continuity-line"><span className="status-dot" /> <span>Portable memory root</span><span className="mono">0G Storage</span></div>
          </article>
        </div>
      </section>

      <section className="architecture page-width reveal" aria-labelledby="architecture-title">
        <div className="architecture-heading">
          <p className="eyebrow">Designed for verifiable ownership</p>
          <h2 id="architecture-title">Four layers, one clear boundary.</h2>
        </div>
        <div className="architecture-grid">
          <div><strong>Wallet</strong><span>Signs in and derives the private vault key.</span></div>
          <div><strong>Compute</strong><span>Routes prompts to configured 0G models.</span></div>
          <div><strong>Storage</strong><span>Stores encrypted snapshots through 0G Turbo.</span></div>
          <div><strong>Chain</strong><span>Anchors the latest root in the agent identity.</span></div>
        </div>
      </section>

      <section className="closing page-width reveal">
        <div>
          <p className="eyebrow">Memory should be inspectable</p>
          <h2>You decide what stays.</h2>
        </div>
        <div>
          <p>
            Review, edit, remove, verify, and anchor every memory root. No hidden profile
            and no invented activity.
          </p>
          <StartButton />
        </div>
      </section>

      <footer className="landing-footer page-width">
        <Brand />
        <p>Built on the 0G Galileo testnet.</p>
        <div className="footer-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="https://docs.0g.ai" target="_blank" rel="noreferrer">
            0G documentation <ArrowUpRight weight="bold" />
          </a>
        </div>
      </footer>
    </main>
  );
}
