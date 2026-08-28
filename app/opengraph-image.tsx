import { ImageResponse } from "next/og";

export const alt = "AgentVault — Your AI memory, owned by you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#f6f5f0",
          color: "#171916",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "#171916", display: "flex", position: "relative" }}>
            <div style={{ width: 17, height: 17, borderRadius: 4, background: "#e9f0eb", position: "absolute", left: 12, top: 12 }} />
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#315b43", position: "absolute", left: 25, top: 25 }} />
          </div>
          AgentVault
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ color: "#315b43", fontSize: 18, letterSpacing: "0.14em", fontWeight: 700 }}>PORTABLE MEMORY FOR AI AGENTS</div>
          <div style={{ maxWidth: 900, fontSize: 70, lineHeight: 1.02, letterSpacing: "-0.045em", fontWeight: 600 }}>Your AI changes. Its memory stays yours.</div>
          <div style={{ color: "#687068", fontSize: 25 }}>Encrypted memory and on-chain identity, built on 0G Galileo.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#687068", fontSize: 18 }}>
          <span>Wallet-owned · AES-256 · ERC-8004</span>
          <span>0G GALILEO TESTNET</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
