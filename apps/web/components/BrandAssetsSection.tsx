/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { BrandResult, SocialAsset } from "@halo/types";

function fixUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `http://localhost:8000${url.startsWith("/") ? "" : "/"}${url}`;
}

async function downloadAsset(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(href);
  } catch {
    // silently fail — broken asset
  }
}

function Placeholder({ text }: { text: string }) {
  return (
    <div style={{ border: "1px dashed rgba(255,255,255,0.15)", borderRadius: 6, padding: "32px 24px", textAlign: "center" }}>
      <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0 }}>{text}</p>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)", marginBottom: 20, margin: "0 0 20px" }}>
      {children}
    </p>
  );
}

function SocialCard({ asset, index }: { asset: SocialAsset; index: number }) {
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isStory = asset.format === "ig_story";
  const url = fixUrl(asset.url);
  const filename = `${asset.label ?? `social-${index + 1}`}.png`;

  const handleDownload = async () => {
    setSaving(true);
    await downloadAsset(url, filename);
    setSaving(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridRow: isStory ? "span 2" : "span 1",
        position: "relative",
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.1)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
      }}
    >
      <div style={{ position: "relative", paddingBottom: isStory ? "177.78%" : "100%" }}>
        {url ? (
          <img
            src={url}
            alt={asset.label}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.04)" }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.55) 100%)",
          opacity: hovered ? 1 : 0.7,
          transition: "opacity 0.2s ease",
          pointerEvents: "none",
        }} />
        <div style={{ position: "absolute", top: 10, left: 10 }}>
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.9)", background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)", padding: "3px 7px", borderRadius: 3,
          }}>
            {isStory ? "IG Story" : "IG Post"}
          </span>
        </div>
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
            {asset.label.replace(/_/g, " ")}
          </span>
          <button
            onClick={handleDownload}
            disabled={saving}
            title={`Download ${filename}`}
            style={{
              fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: "0.1em",
              color: saving ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.9)",
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
              border: "none", padding: "3px 8px", borderRadius: 3,
              cursor: saving ? "default" : "pointer", lineHeight: 1.5,
              transition: "color 0.15s",
            }}
          >
            {saving ? "…" : "↓"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props { result: BrandResult }

export default function BrandAssetsSection({ result }: Props) {
  const brand = result.brand_assets;
  const logo = brand.logo;
  const palette = brand.palette ?? [];
  const primaryHex = palette.find((c) => c.role === "primary")?.hex ?? "#888888";

  useEffect(() => {
    console.log("brand_assets", result.brand_assets);
  }, []);

  return (
    <div
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      className="animate-in fade-in duration-700 mt-16 space-y-16"
    >
      {/* ── Logo Suite ── */}
      <section>
        <SectionHead>Logo Suite</SectionHead>
        {logo ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: 12 }}>
            {/* primary — neutral light gray bg */}
            <LogoTile bg="#f0f0f0" label="Primary"     url={fixUrl(logo.primary)}   />
            {/* mono_dark — white bg */}
            <LogoTile bg="#ffffff" label="Mono Dark"   url={fixUrl(logo.mono_dark)} />
            {/* mono_light — dark bg */}
            <LogoTile bg="#111111" label="Mono Light"  url={fixUrl(logo.mono_light)} />
            {/* on_brand — brand primary hex, hero 2× */}
            <LogoTile bg={primaryHex} label="On Brand" url={fixUrl(logo.on_brand)} hero />
          </div>
        ) : (
          <Placeholder text="Logo variants not yet generated" />
        )}
      </section>

      {/* ── Product Mockups ── */}
      <section>
        <SectionHead>Product Mockups</SectionHead>
        {brand.mockups && brand.mockups.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {(["tee", "tote"] as const).map((type) => {
              const m = brand.mockups.find((x) => x.label === type);
              if (!m) return <Placeholder key={type} text={`${type} mockup not yet generated`} />;
              return (
                <div key={type} style={{ position: "relative", overflow: "hidden", borderRadius: 4 }}>
                  <img
                    src={fixUrl(m.url)}
                    alt={m.label}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 18px", background: "linear-gradient(transparent, rgba(0,0,0,0.65))" }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>
                      {m.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Placeholder text="Product mockups not yet generated" />
        )}
      </section>

      {/* ── Social Kit ── */}
      <section>
        <SectionHead>Social Kit</SectionHead>
        {brand.social_kit && brand.social_kit.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, alignItems: "start" }}>
            {brand.social_kit.slice(0, 5).map((asset, i) => (
              <SocialCard key={i} asset={asset} index={i} />
            ))}
          </div>
        ) : (
          <div style={{
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: 6,
            minHeight: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: "#888", margin: 0 }}>
              Social assets generating…
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function LogoTile({ bg, label, url, hero }: { bg: string; label: string; url: string; hero?: boolean }) {
  const isDark = (() => {
    const h = bg.replace("#", "");
    if (h.length < 6) return false;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b < 140;
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          background: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          aspectRatio: hero ? "2/1" : "1",
          padding: hero ? 32 : 24,
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 4,
        }}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            style={{ maxWidth: "80%", maxHeight: hero ? 160 : 100, objectFit: "contain" }}
          />
        ) : (
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)" }}>
            {label}
          </span>
        )}
      </div>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
    </div>
  );
}
