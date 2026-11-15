import { ImageResponse } from "next/og";

export const alt = "Memecoin Journal — review every trading decision";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 82px", color: "#f8fafc", background: "linear-gradient(135deg,#07111f 0%,#0d1725 55%,#111827 100%)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ width: 78, height: 78, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "#1d4ed8", color: "white", fontSize: 31, fontWeight: 800 }}>MJ</div>
        <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 30, fontWeight: 750 }}>Memecoin Journal</span><span style={{ marginTop: 8, color: "#94a3b8", fontSize: 19 }}>Private trading workspace</span></div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 940 }}>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 68, lineHeight: 1.06, letterSpacing: -2.5, fontWeight: 800 }}><span>Trade less blindly.</span><span>Review every decision.</span></div>
        <div style={{ marginTop: 30, color: "#cbd5e1", fontSize: 25, lineHeight: 1.45 }}>Track realized P&amp;L, journal your reasoning, connect coin theses, and uncover the habits behind your results.</div>
      </div>
      <div style={{ display: "flex", gap: 14, color: "#bfdbfe", fontSize: 18 }}><span style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(37,99,235,.2)" }}>Trades</span><span style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(37,99,235,.2)" }}>Journal</span><span style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(37,99,235,.2)" }}>Analytics</span><span style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(37,99,235,.2)" }}>AI review</span></div>
    </div>,
    size,
  );
}
