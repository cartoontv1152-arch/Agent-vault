import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171916",
          borderRadius: 38,
        }}
      >
        <div style={{ width: 57, height: 57, borderRadius: 14, background: "#e9f0eb", display: "flex" }} />
        <div style={{ position: "absolute", width: 29, height: 29, borderRadius: 8, background: "#315b43", left: 104, top: 104, display: "flex" }} />
      </div>
    ),
    { ...size },
  );
}
