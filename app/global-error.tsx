"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f5f0", color: "#171916", fontFamily: "Arial, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 460 }}>
            <p style={{ color: "#315b43", fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>AgentVault</p>
            <h1 style={{ fontSize: 42, lineHeight: 1.05 }}>AgentVault needs a refresh.</h1>
            <p style={{ color: "#687068", lineHeight: 1.6 }}>The application encountered an unexpected error. Your encrypted vault data was not changed.</p>
            <button type="button" onClick={() => reset()} style={{ marginTop: 16, padding: "12px 18px", border: 0, borderRadius: 6, background: "#171916", color: "#fff", fontWeight: 700 }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
