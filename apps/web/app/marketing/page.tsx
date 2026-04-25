"use client";

import { PhoneApp } from "@/components/phone-app";
import { Icon, LogoMark } from "@/components/icons";

export default function MarketingPage() {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Gradient background */}
      <div id="stencil-bg"/>

      {/* Nav */}
      <nav style={{ height: 58, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 36px", justifyContent: "space-between", backdropFilter: "blur(16px)", background: "rgba(15,14,17,0.6)", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={18} color="rgba(255,255,255,0.85)"/>
          <span style={{ fontFamily: "var(--font-display), serif", fontStyle: "italic", fontSize: 20, letterSpacing: "-0.3px", color: "rgba(255,255,255,0.9)" }}>stencil</span>
        </div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["features", "pricing", "about"].map(l => (
            <span key={l} className="nav-link">{l}</span>
          ))}
        </div>
        <a href="/" style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid rgba(210,190,255,0.25)", background: "rgba(210,190,255,0.08)", color: "rgba(210,190,255,0.9)", fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.1px", display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
          get early access <Icon name="arrow" size={12} color="rgba(210,190,255,0.7)"/>
        </a>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 56, padding: "0 48px", overflow: "hidden" }}>

        {/* Left copy */}
        <div style={{ maxWidth: 340, flexShrink: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)", marginBottom: 22, background: "rgba(255,255,255,0.02)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(210,190,255,0.8)", display: "inline-block" }}/>
            <span style={{ fontSize: 11, color: "rgba(240,238,244,0.4)", fontWeight: 500, letterSpacing: "0.3px" }}>live beta · 12k+ founders</span>
          </div>
          <h1 style={{ lineHeight: 1.08, marginBottom: 16, letterSpacing: "-1px" }}>
            <span style={{ fontFamily: "var(--font-display), serif", fontStyle: "italic", fontSize: 50, display: "block", background: "linear-gradient(135deg,#fff 0%,#d2beff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>idea to brand</span>
            <span style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontWeight: 300, fontSize: 38, color: "rgba(255,255,255,0.55)", display: "block", letterSpacing: "-0.5px" }}>in one session.</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(240,238,244,0.4)", lineHeight: 1.65, marginBottom: 28, maxWidth: 300, fontWeight: 300 }}>
            Drop a product idea. AI builds your logo, palette, social posts, influencer network, and merch — ready to launch.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/" style={{ padding: "12px 22px", borderRadius: 12, border: "none", background: "rgba(210,190,255,0.9)", color: "#0c0b0f", fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, letterSpacing: "-0.1px", textDecoration: "none" }}>
              try the demo <Icon name="arrow" size={13} color="#0c0b0f"/>
            </a>
            <button style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.09)", background: "transparent", color: "rgba(240,238,244,0.4)", fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 14, cursor: "pointer" }}>
              see examples
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 24 }}>
            {([["tag", "brand kit"], ["users", "influencers"], ["video", "video effects"], ["copy", "social posts"], ["package", "merch line"]] as const).map(([icon, label]) => (
              <span key={label} className="chip" style={{ gap: 6 }}>
                <Icon name={icon} size={11} color="rgba(255,255,255,0.3)"/> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Phone */}
        <PhoneApp/>

        {/* Right feature cards */}
        <div style={{ maxWidth: 210, flexShrink: 0 }}>
          {[
            { icon: "brain" as const, title: "ai brand engine",    desc: "reads your tone, audience, and product category instantly." },
            { icon: "users" as const, title: "audience scraping",  desc: "real-time creator and market matching based on your niche." },
            { icon: "link"  as const, title: "direct connect",     desc: "one-click to manufacturers, agencies, and capcut." },
          ].map((f, i) => (
            <div key={i} className="feat-card">
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(210,190,255,0.07)", border: "1px solid rgba(210,190,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Icon name={f.icon} size={15} color="rgba(210,190,255,0.7)"/>
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#f0eef4" }}>{f.title}</p>
              <p style={{ fontSize: 11, color: "rgba(240,238,244,0.4)", lineHeight: 1.55 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
