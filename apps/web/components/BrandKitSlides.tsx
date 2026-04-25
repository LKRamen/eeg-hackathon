/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrandResult } from "@halo/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Palette = BrandResult["brand_assets"]["palette"];

interface PanelTheme {
  bg: string;
  fg: string;
  accent: string;
  dim: string;
  pop: string;
}

type GeometryStyle = "minimal" | "bold" | "organic" | "tech";

// ─── Palette utilities ─────────────────────────────────────────────────────────

const FB: Record<string, string> = {
  primary: "#FFE500",
  secondary: "#7B2FFF",
  bg: "#0D0D0D",
  fg: "#F5F5F0",
  accent: "#FF4D00",
};

function pc(palette: Palette, role: string): string {
  return palette?.find((c) => c.role === role)?.hex ?? FB[role] ?? "#888";
}

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
const dark = (hex: string) => lum(hex) < 140;

const BG_SEQ = ["primary","bg","secondary","fg","bg","primary","bg","fg","secondary","primary","bg","secondary"] as const;

export function getPanelTheme(i: number, palette: Palette): PanelTheme {
  const bgRole = BG_SEQ[i] ?? "bg";
  const bg = pc(palette, bgRole);
  const secondary = pc(palette, "secondary");
  const fgColor = pc(palette, "fg");
  const accent = pc(palette, "accent");
  const primary = pc(palette, "primary");
  const textBase = dark(bg) ? secondary : fgColor;
  return {
    bg,
    fg: textBase,
    accent,
    dim: textBase + "88",
    pop: dark(bg) ? accent : primary,
  };
}

export function getGeometryStyle(keywords: string[]): GeometryStyle {
  const j = keywords.map((k) => k.toLowerCase()).join(" ");
  if (/tech|digital|cyber|futur|glitch|pixel|code|data/.test(j)) return "tech";
  if (/organic|natural|earth|flow|wave|curve|soft|bloom/.test(j)) return "organic";
  if (/bold|loud|maximal|street|vivid|energy|graphic/.test(j)) return "bold";
  return "minimal";
}

function fixUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `http://localhost:8000${url.startsWith("/") ? "" : "/"}${url}`;
}

// ─── Shared Chrome ────────────────────────────────────────────────────────────

function Chrome({ n, name, t }: { n: number; name: string; t: PanelTheme }) {
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0,
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "28px 48px", zIndex: 20, pointerEvents: "none",
    }}>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: t.dim }}>
        {name}
      </span>
      <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.15em", color: t.accent }}>
        {String(n + 1).padStart(2, "0")} / 12
      </span>
    </div>
  );
}

// ─── Panel 01: Cover ──────────────────────────────────────────────────────────

function Cover({ brand, persona, palette }: { brand: BrandResult["brand_assets"]; persona: BrandResult["persona"]; palette: Palette }) {
  const t = getPanelTheme(0, palette);
  const sec = pc(palette, "secondary");
  const acc = pc(palette, "accent");
  const keywords = persona?.aesthetic_keywords ?? [];

  return (
    <section className="panel" style={{ background: t.bg, overflow: "hidden" }}>
      <Chrome n={0} name={brand.brand_name} t={t} />

      {/* Geometric background */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <circle cx="1260" cy="120" r="500" fill={acc} className="geo-pulse" />
        <circle cx="120" cy="780" r="320" fill={sec} className="geo-pulse2" />
        <rect x="580" y="240" width="380" height="380" fill={acc} opacity="0.5" className="geo-spin" transform="rotate(20 770 430)" />
        <line x1="0" y1="900" x2="1440" y2="0" stroke={sec} strokeWidth="1" opacity="0.4" />
        <line x1="0" y1="600" x2="1440" y2="200" stroke={sec} strokeWidth="1" opacity="0.2" />
        <circle cx="720" cy="450" r="600" fill="none" stroke={sec} strokeWidth="1" opacity="0.3" />
      </svg>

      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10%", gap: 0 }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: t.accent, marginBottom: "28px" }}>
          Brand Identity System — {new Date().getFullYear()}
        </div>

        <h1 style={{
          fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`,
          fontSize: "clamp(72px,11vw,152px)", fontWeight: 700, lineHeight: 0.9,
          color: t.fg, margin: 0, letterSpacing: "-0.03em",
        }}>
          {brand.brand_name}
        </h1>

        <div style={{ width: 100, height: 2, background: t.accent, margin: "40px 0" }} />

        <p style={{
          fontFamily: `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`,
          fontSize: "clamp(16px,2vw,26px)", color: dark(t.bg) ? sec + "cc" : t.fg + "99",
          maxWidth: 560, margin: 0, lineHeight: 1.45, fontStyle: "italic",
        }}>
          {brand.tagline}
        </p>

        {keywords.length > 0 && (
          <div style={{ marginTop: 52, display: "flex", gap: 12, flexWrap: "wrap" }}>
            {keywords.slice(0, 5).map((kw: string) => (
              <span key={kw} style={{
                fontFamily: "'Space Mono',monospace", fontSize: "9px",
                letterSpacing: "0.22em", textTransform: "uppercase",
                color: t.accent, border: `1px solid ${t.accent}55`, padding: "6px 14px",
              }}>
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Panel 02: Brand Essence ──────────────────────────────────────────────────

function Essence({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(1, palette);
  const voice = brand.voice as any;
  const pillars: string[] = voice?.do ?? ["Quality over speed", "Story-first storytelling", "Function over decoration"];
  const examples: string[] = voice?.examples ?? [];
  const tone: string = voice?.tone ?? "";
  const displayFont = `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`;
  const bodyFont = `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`;

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={1} name={brand.brand_name} t={t} />

      <div style={{
        height: "100%", display: "grid",
        gridTemplateColumns: "1fr 1px 1fr",
        gridTemplateRows: "1fr",
        padding: "100px 0 60px",
      }}>
        {/* Left: tagline + tone */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 8%", gap: 32 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent }}>
            02 — Brand Essence
          </div>
          <h2 style={{
            fontFamily: displayFont, fontSize: "clamp(36px,5vw,64px)",
            fontWeight: 700, color: t.fg, lineHeight: 1.05, margin: 0,
          }}>
            {brand.tagline}
          </h2>
          {tone && (
            <p style={{ fontFamily: bodyFont, fontSize: 15, color: t.dim, lineHeight: 1.6, maxWidth: 400, margin: 0 }}>
              Voice: {tone}
            </p>
          )}
          {examples.length > 0 && (
            <div style={{ borderLeft: `2px solid ${t.accent}`, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {examples.slice(0, 3).map((ex: string, i: number) => (
                <p key={i} style={{ fontFamily: displayFont, fontSize: 18, color: t.fg + "cc", margin: 0, fontStyle: "italic" }}>
                   &ldquo;{ex}&rdquo;
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ background: t.fg + "22", margin: "10% 0" }} />

        {/* Right: 3 pillars */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 8%", gap: 40 }}>
          {pillars.slice(0, 3).map((pillar: string, i: number) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", color: dark(t.accent) ? pc(palette, "secondary") : pc(palette, "fg") }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent }}>
                  Principle
                </span>
              </div>
              <p style={{ fontFamily: displayFont, fontSize: "clamp(16px,1.8vw,22px)", color: t.fg, margin: 0, lineHeight: 1.35 }}>
                {pillar}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 03: Logo Suite ─────────────────────────────────────────────────────

function LogoSuite({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(2, palette);
  const fgDark = pc(palette, "fg");
  const bgLight = pc(palette, "bg");
  const logo = brand.logo as any;
  const variants = [
    { label: "Primary", url: fixUrl(logo?.primary ?? brand.logo_url), bg: bgLight, border: true },
    { label: "Reversed", url: fixUrl(logo?.mono_light ?? logo?.primary ?? brand.logo_url), bg: fgDark, border: false },
    { label: "On Brand", url: fixUrl(logo?.on_brand ?? logo?.primary ?? brand.logo_url), bg: pc(palette, "accent"), border: false },
    { label: "Monochrome", url: fixUrl(logo?.mono_dark ?? logo?.primary ?? brand.logo_url), bg: pc(palette, "secondary"), border: true },
  ];

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={2} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "100px 6% 60px", gap: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              03 — Logo Suite
            </div>
            <h2 style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Logo Applications
            </h2>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, maxWidth: 260, textAlign: "right", lineHeight: 1.6 }}>
            Minimum size 24px.<br />Clear space = cap-height on all sides.
          </p>
        </div>

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {variants.map(({ label, url, bg, border }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                flex: 1, background: bg, display: "flex", alignItems: "center",
                justifyContent: "center", padding: 32, minHeight: 180,
                border: border ? `1px solid ${t.fg}22` : "none",
              }}>
                {url ? (
                  <img src={url} alt={label} style={{ maxWidth: "80%", maxHeight: 120, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: 28, fontWeight: 700, color: dark(bg) ? bgLight : fgDark }}>
                    {brand.brand_name}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: t.dim }}>
                  {label}
                </span>
                <div style={{ width: 12, height: 12, background: bg, border: `1px solid ${t.fg}33` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 04: Color System ───────────────────────────────────────────────────

function ColorSystem({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(3, palette);
  const primary = pc(palette, "primary");
  const secondary = pc(palette, "secondary");
  const accent = pc(palette, "accent");
  const bg = pc(palette, "bg");
  const fg = pc(palette, "fg");

  const swatches = palette?.length
    ? palette
    : [
        { role: "primary", hex: primary, name: "Primary" },
        { role: "secondary", hex: secondary, name: "Secondary" },
        { role: "accent", hex: accent, name: "Accent" },
        { role: "bg", hex: bg, name: "Background" },
        { role: "fg", hex: fg, name: "Foreground" },
      ];

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={3} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto 1fr auto", gap: 0, padding: "100px 0 0" }}>
        {/* Header */}
        <div style={{ gridColumn: "1/-1", padding: "0 6% 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              04 — Color System
            </div>
            <h2 style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Palette
            </h2>
          </div>
        </div>

        {/* Swatches */}
        <div style={{ gridColumn: "1/-1", display: "flex", flex: 1 }}>
          {swatches.map((swatch: any) => (
            <div key={swatch.role} style={{ flex: 1, background: swatch.hex, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 20px 28px", minHeight: 260 }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: dark(swatch.hex) ? "#ffffff88" : "#00000088", display: "block", marginBottom: 6 }}>
                {swatch.role}
              </span>
              <span style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: 16, fontWeight: 700, color: dark(swatch.hex) ? "#ffffffe0" : "#000000cc", display: "block", marginBottom: 4 }}>
                {swatch.name ?? swatch.role}
              </span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: dark(swatch.hex) ? "#ffffff66" : "#00000066" }}>
                {swatch.hex.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Gradient strips */}
        <div style={{ gridColumn: "1/-1", display: "flex", height: 48 }}>
          <div style={{ flex: 1, background: `linear-gradient(135deg, ${primary}, ${accent})` }} />
          <div style={{ flex: 1, background: `radial-gradient(ellipse at center, ${secondary}, ${bg})` }} />
        </div>
      </div>
    </section>
  );
}

// ─── Panel 05: Typography ─────────────────────────────────────────────────────

function Typography({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(4, palette);
  const displayFamily = brand.typography?.display?.family ?? "Space Grotesk";
  const bodyFamily = brand.typography?.body?.family ?? "Inter";
  const displayFont = `'${displayFamily}','Space Grotesk',sans-serif`;
  const bodyFont = `'${bodyFamily}',Inter,sans-serif`;

  const scale = [
    { label: "Display / 96px", size: 96, font: displayFont, weight: 700, text: brand.brand_name },
    { label: "H1 / 56px", size: 56, font: displayFont, weight: 700, text: brand.tagline },
    { label: "H2 / 36px", size: 36, font: displayFont, weight: 400, text: "Brand Identity System" },
    { label: "Body / 18px", size: 18, font: bodyFont, weight: 400, text: "Designed for creators who move between discipline and instinct." },
    { label: "Caption / 11px", size: 11, font: bodyFont, weight: 400, text: "© " + brand.brand_name + "  ·  All rights reserved  ·  Brand Kit 2025" },
  ];

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={4} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "flex", padding: "100px 6% 60px", gap: 48 }}>
        {/* Type scale */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0, overflow: "hidden" }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 32 }}>
            05 — Typography
          </div>
          {scale.map(({ label, size, font, weight, text }) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 20, borderBottom: `1px solid ${t.fg}11`, padding: "12px 0" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: t.dim, minWidth: 120, letterSpacing: "0.1em" }}>
                {label}
              </span>
              <span style={{ fontFamily: font, fontSize: Math.min(size, 56), fontWeight: weight, color: t.fg, lineHeight: 1.1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {text}
              </span>
            </div>
          ))}
        </div>

        {/* Right: typeface specimens */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
          {[
            { family: displayFamily, weights: brand.typography?.display?.weights ?? [400, 700], label: "Display" },
            { family: bodyFamily, weights: brand.typography?.body?.weights ?? [400, 700], label: "Body" },
          ].map(({ family, weights, label }) => (
            <div key={family} style={{ padding: "24px", border: `1px solid ${t.fg}22`, background: t.fg + "05" }}>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
                {label} / {family}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {weights.map((w: number) => (
                  <span key={w} style={{ fontFamily: `'${family}',sans-serif`, fontSize: 32, fontWeight: w, color: t.fg, lineHeight: 1 }}>
                    Aa
                  </span>
                ))}
              </div>
              <div style={{ fontFamily: `'${family}',sans-serif`, fontSize: 13, color: t.dim, marginTop: 12, lineHeight: 1.5 }}>
                ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />
                abcdefghijklmnopqrstuvwxyz<br />
                0123456789 !@#$%
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 06: Graphic Language ───────────────────────────────────────────────

function MinimalGeometry({ t, palette }: { t: PanelTheme; palette: Palette }) {
  const acc = t.accent;
  const fg = t.fg;
  const sec = pc(palette, "secondary");
  return (
    <svg viewBox="0 0 800 600" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      {/* Sparse grid lines */}
      {[100, 200, 300, 400, 500, 600, 700].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={600} stroke={fg} strokeWidth="0.5" opacity="0.15" />)}
      {[100, 200, 300, 400, 500].map((y) => <line key={y} x1={0} y1={y} x2={800} y2={y} stroke={fg} strokeWidth="0.5" opacity="0.15" />)}
      {/* Minimal shapes */}
      <rect x="100" y="100" width="200" height="200" fill="none" stroke={acc} strokeWidth="1" />
      <rect x="320" y="120" width="160" height="160" fill={acc} opacity="0.08" />
      <line x1="100" y1="100" x2="500" y2="400" stroke={acc} strokeWidth="1" opacity="0.5" />
      <circle cx="600" cy="200" r="80" fill="none" stroke={fg} strokeWidth="0.8" opacity="0.3" />
      <circle cx="600" cy="200" r="4" fill={acc} />
      <rect x="450" y="350" width="240" height="1" fill={sec} opacity="0.6" />
      <rect x="450" y="380" width="180" height="1" fill={sec} opacity="0.4" />
      <rect x="450" y="410" width="120" height="1" fill={sec} opacity="0.2" />
    </svg>
  );
}

function BoldGeometry({ t, palette }: { t: PanelTheme; palette: Palette }) {
  const acc = t.accent;
  const sec = pc(palette, "secondary");
  return (
    <svg viewBox="0 0 800 600" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <rect x="0" y="0" width="400" height="600" fill={acc} opacity="0.12" />
      <rect x="50" y="50" width="300" height="300" fill={sec} opacity="0.15" />
      <rect x="100" y="100" width="200" height="200" fill={acc} opacity="0.2" />
      <polygon points="400,0 800,0 800,400" fill={t.fg} opacity="0.05" />
      <line x1="0" y1="0" x2="800" y2="600" stroke={acc} strokeWidth="4" opacity="0.5" />
      <line x1="800" y1="0" x2="0" y2="600" stroke={sec} strokeWidth="4" opacity="0.3" />
      <circle cx="400" cy="300" r="150" fill="none" stroke={acc} strokeWidth="6" opacity="0.4" />
      <circle cx="400" cy="300" r="80" fill={acc} opacity="0.15" />
    </svg>
  );
}

function OrganicGeometry({ t, palette }: { t: PanelTheme; palette: Palette }) {
  const acc = t.accent;
  const primary = pc(palette, "primary");
  const sec = pc(palette, "secondary");
  return (
    <svg viewBox="0 0 800 600" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="og1" cx="50%" cy="50%">
          <stop offset="0%" stopColor={acc} stopOpacity="0.3" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="250" rx="250" ry="200" fill="url(#og1)" className="geo-pulse" />
      <path d="M 100 500 Q 200 200 400 300 Q 600 400 700 100" stroke={acc} strokeWidth="2" fill="none" opacity="0.5" />
      <path d="M 0 400 Q 200 300 400 450 Q 600 600 800 350" stroke={sec} strokeWidth="1.5" fill="none" opacity="0.4" />
      <ellipse cx="600" cy="400" rx="120" ry="90" fill={sec} opacity="0.1" />
      <ellipse cx="150" cy="150" rx="80" ry="60" fill={acc} opacity="0.15" />
    </svg>
  );
}

function TechGeometry({ t, palette }: { t: PanelTheme; palette: Palette }) {
  const acc = t.accent;
  const sec = pc(palette, "secondary");
  const fg = t.fg;
  return (
    <svg viewBox="0 0 800 600" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      {/* Dense grid */}
      {Array.from({ length: 16 }).map((_, i) => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={600} stroke={fg} strokeWidth="0.4" opacity="0.12" />)}
      {Array.from({ length: 12 }).map((_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke={fg} strokeWidth="0.4" opacity="0.12" />)}
      {/* Sharp geometric forms */}
      <polygon points="200,100 400,100 500,250 400,400 200,400 100,250" fill={acc} opacity="0.08" stroke={acc} strokeWidth="1" />
      <rect x="500" y="150" width="200" height="200" fill="none" stroke={sec} strokeWidth="1" />
      <rect x="510" y="160" width="180" height="180" fill="none" stroke={sec} strokeWidth="0.5" opacity="0.5" />
      {/* Glitch offset */}
      <rect x="100" y="450" width="400" height="3" fill={acc} opacity="0.6" />
      <rect x="108" y="456" width="400" height="3" fill={sec} opacity="0.3" />
      <line x1="600" y1="0" x2="700" y2="600" stroke={acc} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function GraphicLanguage({ brand, persona, palette }: { brand: BrandResult["brand_assets"]; persona: BrandResult["persona"]; palette: Palette }) {
  const t = getPanelTheme(5, palette);
  const keywords = persona?.aesthetic_keywords ?? [];
  const style = getGeometryStyle(keywords);
  const motifs = {
    minimal: ["Rule line", "Corner mark", "Grid overlay", "Hairline circle"],
    bold: ["Block fill", "Diagonal slash", "Overlap mass", "Heavy stroke"],
    organic: ["Blob shape", "Flowing arc", "Soft gradient", "Rounded form"],
    tech: ["Data grid", "Sharp hex", "Glitch bar", "Monospace grid"],
  }[style];

  return (
    <section className="panel" style={{ background: t.bg, overflow: "hidden" }}>
      <Chrome n={5} name={brand.brand_name} t={t} />

      <div style={{ position: "absolute", inset: 0, top: 80 }}>
        {style === "minimal" && <MinimalGeometry t={t} palette={palette} />}
        {style === "bold" && <BoldGeometry t={t} palette={palette} />}
        {style === "organic" && <OrganicGeometry t={t} palette={palette} />}
        {style === "tech" && <TechGeometry t={t} palette={palette} />}
      </div>

      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", padding: "100px 6% 60px" }}>
        <div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
            06 — Graphic Language
          </div>
          <h2 style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
            {style.charAt(0).toUpperCase() + style.slice(1)} System
          </h2>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {motifs.map((m: string) => (
            <div key={m} style={{
              padding: "10px 20px",
              border: `1px solid ${t.accent}55`,
              background: t.accent + "10",
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: t.fg,
            }}>
              {m}
            </div>
          ))}
          {keywords.slice(0, 4).map((kw: string) => (
            <div key={kw} style={{
              padding: "10px 20px",
              border: `1px solid ${t.fg}22`,
              fontFamily: "'Space Mono',monospace",
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: t.dim,
            }}>
              {kw}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 07: Product Mockups ────────────────────────────────────────────────

function ProductMockups({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(6, palette);
  const mockups = brand.mockups ?? [];
  const tee = fixUrl(mockups.find((m: any) => m.label === "tee")?.url ?? mockups[0]?.url);
  const tote = fixUrl(mockups.find((m: any) => m.label === "tote")?.url ?? mockups[1]?.url);
  const acc = t.accent;

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={6} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "88px 0 0", gap: 0 }}>
        {/* Tee */}
        <div style={{ position: "relative", overflow: "hidden", background: pc(palette, "secondary") }}>
          {tee ? (
            <img src={tee} alt="Tee mockup" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, textTransform: "uppercase", letterSpacing: "0.2em" }}>Tee — Generating</span>
            </div>
          )}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 28px", background: `linear-gradient(transparent, ${pc(palette, "fg")}dd)`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff99" }}>Tee</span>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: acc }}>07 / 10</span>
          </div>
        </div>

        {/* Tote */}
        <div style={{ position: "relative", overflow: "hidden", background: pc(palette, "primary") }}>
          {tote ? (
            <img src={tote} alt="Tote mockup" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, textTransform: "uppercase", letterSpacing: "0.2em" }}>Tote — Generating</span>
            </div>
          )}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
            <div style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: 18, fontWeight: 700, color: "#ffffff22", letterSpacing: "0.05em" }}>
              {brand.brand_name}
            </div>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 28px", background: `linear-gradient(transparent, ${pc(palette, "secondary")}dd)`, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#00000099" }}>Tote</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Panel 08: Editorial Photography ──────────────────────────────────────────

function Editorial({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(7, palette);
  const social = brand.social_kit ?? [];
  const imgs = social.slice(0, 5).map((s: any) => ({ url: fixUrl(s.url), label: s.label ?? "" }));
  const sec = pc(palette, "secondary");

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={7} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "100px 6% 60px", gap: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              08 — Editorial Direction
            </div>
            <h2 style={{ fontFamily: `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Visual World
            </h2>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, maxWidth: 300, textAlign: "right", lineHeight: 1.7 }}>
            Shoot natural light or hard shadow.<br />
            No studio white. Texture first.<br />
            Product as prop, not hero.
          </p>
        </div>

        {/* Bento grid */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 8 }}>
          {/* Hero large */}
          <div style={{ gridRow: "1/3", position: "relative", overflow: "hidden", background: sec + "44" }}>
            {imgs[2]?.url ? (
              <img src={imgs[2].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${t.accent}22, ${sec}44)` }} />
            )}
            <div style={{ position: "absolute", bottom: 20, left: 20 }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffffff88" }}>Hero</span>
            </div>
          </div>

          {[imgs[0], imgs[1], imgs[3], imgs[4]].map((img, i) => (
            <div key={i} style={{ position: "relative", overflow: "hidden", background: t.fg + "11" }}>
              {img?.url ? (
                <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: `linear-gradient(${45 + i * 30}deg, ${t.accent}11, ${sec}22)` }} />
              )}
              {img?.label && (
                <div style={{ position: "absolute", bottom: 10, left: 10 }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#ffffff66" }}>
                    {img.label.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 09: Cross-Platform ─────────────────────────────────────────────────

function CrossPlatform({ brand, palette }: { brand: BrandResult["brand_assets"]; palette: Palette }) {
  const t = getPanelTheme(8, palette);
  const logo = brand.logo as any;
  const logoUrl = fixUrl(logo?.primary ?? brand.logo_url);
  const primary = pc(palette, "primary");
  const fg = pc(palette, "fg");
  const acc = t.accent;
  const bodyFont = `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`;
  const displayFont = `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`;

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={8} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 2fr", padding: "100px 6% 60px", gap: 48 }}>
        {/* Left: Phone frame */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 4 }}>
            09 — Cross-Platform
          </div>
          <div style={{
            width: 200, height: 380, border: `3px solid ${t.fg}44`, borderRadius: 28,
            padding: "40px 16px 20px", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 12, background: primary, position: "relative",
            margin: "0 auto",
          }}>
            {/* Notch */}
            <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: 50, height: 8, background: t.fg + "44", borderRadius: 4 }} />
            {/* Screen */}
            <div style={{ flex: 1, width: "100%", background: pc(palette, "bg"), borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {/* Nav bar */}
              <div style={{ padding: "10px 12px", borderBottom: `1px solid ${fg}11`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="" style={{ height: 16, objectFit: "contain" }} />
                ) : (
                  <span style={{ fontFamily: displayFont, fontSize: 11, fontWeight: 700, color: fg }}>{brand.brand_name}</span>
                )}
                <div style={{ display: "flex", gap: 4 }}>
                  {[1,2,3].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: fg + "44" }} />)}
                </div>
              </div>
              {/* Hero block */}
              <div style={{ height: 80, background: `linear-gradient(135deg, ${primary}, ${acc})`, margin: 8, borderRadius: 6 }} />
              {/* Content lines */}
              <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {[100, 85, 70].map((w, i) => <div key={i} style={{ height: 8, background: fg + "22", borderRadius: 2, width: `${w}%` }} />)}
              </div>
              {/* CTA */}
              <div style={{ margin: "12px 12px 0", height: 28, background: acc, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, color: dark(acc) ? "#fff" : "#000", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Shop Now
                </span>
              </div>
            </div>
            {/* Home indicator */}
            <div style={{ width: 50, height: 4, background: t.fg + "33", borderRadius: 2 }} />
          </div>
          <p style={{ fontFamily: bodyFont, fontSize: 11, color: t.dim, textAlign: "center", lineHeight: 1.5 }}>
            Mobile-first<br />primary touchpoint
          </p>
        </div>

        {/* Right: Desktop UI strip + merch grid */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 32 }}>
          {/* Desktop bar */}
          <div style={{ border: `1px solid ${t.fg}22`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ height: 32, background: t.fg + "11", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
              {[acc, t.dim, t.dim].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, height: 16, background: t.fg + "11", borderRadius: 8, marginLeft: 8 }} />
            </div>
            <div style={{ height: 100, background: `linear-gradient(90deg, ${primary}22, ${acc}11)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ height: 40, objectFit: "contain", opacity: 0.9 }} />
              ) : (
                <span style={{ fontFamily: displayFont, fontSize: 28, fontWeight: 700, color: t.fg }}>{brand.brand_name}</span>
              )}
            </div>
            <div style={{ padding: "16px", display: "flex", gap: 8 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 60, background: t.fg + "08", borderRadius: 4, border: `1px solid ${t.fg}11` }} />)}
            </div>
          </div>

          {/* Merch tokens */}
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: t.dim, marginBottom: 12 }}>
              Merch Grid
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {["Tee","Tote","Cap","Poster"].map((item) => (
                <div key={item} style={{
                  aspectRatio: "3/4", background: primary,
                  border: `1px solid ${t.fg}22`,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "flex-end", padding: "8px",
                }}>
                  <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", color: dark(primary) ? "#ffffff66" : "#00000066" }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Panel 10: Social Captions ───────────────────────────────────────────────

function buildCaptions(brand: BrandResult["brand_assets"], persona: BrandResult["persona"]) {
  const brandName  = brand.brand_name;
  const tagline    = brand.tagline;
  const examples   = brand.voice?.examples ?? [];
  const voiceTraits = persona?.voice_traits ?? [];
  const keywords   = persona?.aesthetic_keywords ?? [];
  const interests  = persona?.interests ?? [];

  const toTag = (s: string) =>
    `#${s.toLowerCase().split(/[\s,]+/)[0].replace(/[^a-z0-9]/g, "")}`;
  const brandTag    = toTag(brandName);
  const iTagsFull   = interests.slice(0, 4).map(toTag);
  const kTagsFull   = keywords.slice(0, 2).map(toTag);

  return [
    {
      icon: "📸",
      name: "Instagram",
      captions: [
        {
          text: `${examples[0] ?? tagline}\n\n${keywords.slice(0, 2).join(". ")}.`,
          tags: [brandTag, ...iTagsFull.slice(0, 3)].join(" "),
        },
        {
          text: `${brandName} — ${tagline}\n\n${keywords[0] ?? ""} design. ${voiceTraits[0] ?? "honest"} by default.`,
          tags: [brandTag, kTagsFull[0], "#lifestyle"].filter(Boolean).join(" "),
        },
        {
          text: `built for people who ${interests[0] ?? "move with intention"}.\n\nnot for everyone. for you.`,
          tags: [brandTag, iTagsFull[1], "#brand"].filter(Boolean).join(" "),
        },
      ],
    },
    {
      icon: "🎵",
      name: "TikTok",
      captions: [
        {
          text: `POV: you found the brand that actually gets it 👀\n\n${examples[1] ?? tagline}`,
          tags: `${brandTag} #fyp #brand`,
        },
        {
          text: `${voiceTraits[0] ?? "Real"}. ${voiceTraits[1] ?? "Direct"}. ${brandName}.\n\n${tagline}`,
          tags: [brandTag, "#fyp", kTagsFull[0]].filter(Boolean).join(" "),
        },
        {
          text: `the ${keywords[0] ?? "minimal"} brand for people who ${interests[0] ?? "know the difference"}`,
          tags: `#tiktokshop ${brandTag} ${iTagsFull[0] ?? ""} #fyp`.trim(),
        },
      ],
    },
    {
      icon: "𝕏",
      name: "Twitter / X",
      captions: [
        {
          text: examples[0] ?? tagline,
          tags: [brandTag, iTagsFull[0]].filter(Boolean).join(" "),
        },
        {
          text: `${tagline}\n\nwe said what we said.`,
          tags: brandTag,
        },
        {
          text: `${keywords.slice(0, 2).join(" + ")} brand for people who ${interests[0] ?? "value craft"}.\n\nthat's ${brandName}.`,
          tags: [brandTag, kTagsFull[0]].filter(Boolean).join(" "),
        },
      ],
    },
  ];
}

function SocialCaptions({
  brand, persona, palette,
}: {
  brand: BrandResult["brand_assets"];
  persona: BrandResult["persona"];
  palette: Palette;
}) {
  const t = getPanelTheme(9, palette);
  const [copied, setCopied] = useState<string | null>(null);

  const displayFont = `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`;
  const bodyFont    = `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`;
  const voiceTraits = persona?.voice_traits ?? [];
  const platforms   = buildCaptions(brand, persona);

  const handleCopy = (text: string, tags: string, id: string) => {
    navigator.clipboard.writeText(`${text}\n\n${tags}`).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={9} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "100px 6% 60px", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              10 — Social Captions
            </div>
            <h2 style={{ fontFamily: displayFont, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Ready to Post
            </h2>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, maxWidth: 260, textAlign: "right", lineHeight: 1.7 }}>
            Voice: {voiceTraits.join(" · ") || brand.voice?.tone || "—"}
          </p>
        </div>

        {/* 3-column platform grid */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, minHeight: 0 }}>
          {platforms.map((platform) => (
            <div key={platform.name} style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              {/* Platform header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${t.fg}22`, flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>{platform.icon}</span>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: t.accent }}>
                  {platform.name}
                </span>
              </div>

              {/* Caption cards */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
                {platform.captions.map((caption, j) => {
                  const id      = `${platform.name}-${j}`;
                  const active  = copied === id;
                  return (
                    <div
                      key={j}
                      style={{
                        border: `1px solid ${t.fg}18`,
                        background: t.fg + "06",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <p style={{
                        fontFamily: bodyFont, fontSize: 12, color: t.fg + "dd",
                        margin: 0, lineHeight: 1.65, whiteSpace: "pre-line",
                      }}>
                        {caption.text}
                      </p>
                      <p style={{
                        fontFamily: "'Space Mono',monospace", fontSize: 9,
                        color: t.accent + "99", margin: 0, lineHeight: 1.6,
                      }}>
                        {caption.tags}
                      </p>
                      <button
                        onClick={() => handleCopy(caption.text, caption.tags, id)}
                        style={{
                          alignSelf: "flex-end",
                          fontFamily: "'Space Mono',monospace",
                          fontSize: 9,
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          background: active ? t.accent : "transparent",
                          color: active ? (dark(t.accent) ? "#fff" : "#000") : t.dim,
                          border: `1px solid ${active ? t.accent : t.fg + "33"}`,
                          padding: "5px 12px",
                          cursor: "pointer",
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = t.accent; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = t.fg + "33"; }}
                      >
                        {active ? "✓ copied" : "copy"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Panel 11: Agency Matches ─────────────────────────────────────────────────

function AgencyMatches({
  agencies, brand, palette,
}: {
  agencies: BrandResult["agency_matches"];
  brand: BrandResult["brand_assets"];
  palette: Palette;
}) {
  const t           = getPanelTheme(10, palette);
  const [toast, setToast] = useState<string | null>(null);

  const displayFont = `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`;
  const bodyFont    = `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`;
  const primary     = pc(palette, "primary");
  const secondary   = pc(palette, "secondary");
  const accent      = pc(palette, "accent");

  const showToast = (name: string) => {
    setToast(`Intro request sent to ${name}`);
    setTimeout(() => setToast(null), 2500);
  };

  const cards = agencies?.slice(0, 3) ?? [];

  return (
    <section className="panel" style={{ background: t.bg, overflow: "hidden" }}>
      <Chrome n={10} name={brand.brand_name} t={t} />

      {/* Background geometry: one large faint circle per card column */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="240"  cy="520" r="340" fill={primary}   opacity="0.06" className="geo-pulse" />
        <circle cx="720"  cy="420" r="320" fill={secondary} opacity="0.07" className="geo-pulse2" />
        <circle cx="1200" cy="510" r="340" fill={accent}    opacity="0.05" className="geo-pulse" />
      </svg>

      <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", padding: "100px 6% 60px", gap: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              11 — Agency Matches
            </div>
            <h2 style={{ fontFamily: displayFont, fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Your Brand Partners
            </h2>
          </div>
          <p style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: t.dim, maxWidth: 240, textAlign: "right", lineHeight: 1.7 }}>
            Matched by audience<br />embedding similarity
          </p>
        </div>

        {/* 3 cards */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, minHeight: 0 }}>
          {cards.map((agency) => {
            const scorePct = Math.round(
              agency.match_score > 1 ? agency.match_score : agency.match_score * 100
            );
            return (
              <div
                key={agency.agency_id}
                style={{
                  border: `1px solid ${t.fg}18`,
                  background: t.fg + "05",
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Name + big score */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <h3 style={{
                    fontFamily: displayFont, fontSize: "clamp(16px,1.8vw,24px)",
                    fontWeight: 700, color: t.fg, margin: 0, lineHeight: 1.2,
                  }}>
                    {agency.name}
                  </h3>
                  <span style={{
                    fontFamily: "'Space Mono',monospace",
                    fontSize: "clamp(32px,3.5vw,52px)",
                    fontWeight: 700, color: t.accent, lineHeight: 1, flexShrink: 0,
                  }}>
                    {scorePct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 3, background: t.fg + "18", borderRadius: 2 }}>
                  <div style={{
                    height: "100%", background: t.accent,
                    borderRadius: 2, width: `${scorePct}%`,
                  }} />
                </div>

                {/* Blurb */}
                <p style={{
                  fontFamily: bodyFont, fontSize: 13, color: t.fg + "cc",
                  margin: 0, lineHeight: 1.65,
                }}>
                  {agency.blurb}
                </p>

                {/* Why */}
                <div style={{ borderLeft: `2px solid ${t.accent}55`, paddingLeft: 14 }}>
                  <span style={{
                    fontFamily: "'Space Mono',monospace", fontSize: 9,
                    letterSpacing: "0.18em", textTransform: "uppercase",
                    color: t.accent, display: "block", marginBottom: 6,
                  }}>
                    Why you matched
                  </span>
                  <p style={{
                    fontFamily: bodyFont, fontSize: 12, color: t.dim,
                    margin: 0, lineHeight: 1.6, fontStyle: "italic",
                  }}>
                    {agency.why}
                  </p>
                </div>

                {/* Specialty tag chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {agency.specialty_tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: "'Space Mono',monospace", fontSize: 9,
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        color: t.dim, border: `1px solid ${t.fg}22`,
                        padding: "4px 10px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div style={{ flex: 1 }} />

                {/* Request intro button */}
                <button
                  onClick={() => showToast(agency.name)}
                  style={{
                    fontFamily: "'Space Mono',monospace", fontSize: 10,
                    letterSpacing: "0.18em", textTransform: "uppercase",
                    cursor: "pointer", background: t.accent,
                    color: dark(t.accent) ? "#fff" : "#000",
                    border: "none", padding: "12px 20px", width: "100%",
                    transition: "opacity .2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Request Intro
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel-scoped toast */}
      {toast && (
        <div style={{
          position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: t.fg, color: t.bg,
          fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: "0.15em",
          padding: "12px 28px", zIndex: 50, whiteSpace: "nowrap",
          boxShadow: `0 4px 24px ${t.accent}33`,
        }}>
          {toast}
        </div>
      )}
    </section>
  );
}

// ─── Panel 12: Motion + Retail ────────────────────────────────────────────────

function MotionRetail({ brand, palette, onPrint }: { brand: BrandResult["brand_assets"]; palette: Palette; onPrint: () => void }) {
  const t = getPanelTheme(9, palette);
  const sec = pc(palette, "secondary");
  const bodyFont = `'${brand.typography?.body?.family ?? "Inter"}',Inter,sans-serif`;
  const displayFont = `'${brand.typography?.display?.family ?? "Space Grotesk"}','Space Grotesk',sans-serif`;

  const motionCues = [
    { label: "Entrance", desc: "Slide up 40px, opacity 0→1, 400ms ease-out" },
    { label: "Hover", desc: "Scale 1→1.02, 200ms ease, accent underline reveal" },
    { label: "Transition", desc: "Cross-dissolve 300ms, brand color flash frame" },
    { label: "Loading", desc: "Pulsing dot sequence in accent, 800ms loop" },
  ];

  return (
    <section className="panel" style={{ background: t.bg }}>
      <Chrome n={11} name={brand.brand_name} t={t} />

      <div style={{ height: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", padding: "100px 6% 60px", gap: 48 }}>
        {/* Motion cues */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: t.accent, marginBottom: 12 }}>
              12 — Motion + Retail
            </div>
            <h2 style={{ fontFamily: displayFont, fontSize: "clamp(24px,3.5vw,44px)", fontWeight: 700, color: t.fg, margin: 0 }}>
              Motion System
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {motionCues.map(({ label, desc }) => (
              <div key={label} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                {/* Animated dot */}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, marginTop: 5, flexShrink: 0 }} className="geo-pulse" />
                <div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: t.accent, marginBottom: 4 }}>
                    {label}
                  </div>
                  <p style={{ fontFamily: bodyFont, fontSize: 14, color: t.fg + "cc", margin: 0, lineHeight: 1.5 }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retail concept */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h3 style={{ fontFamily: displayFont, fontSize: "clamp(20px,2.5vw,36px)", fontWeight: 700, color: t.fg, margin: 0 }}>
            Retail Environment
          </h3>

          {/* Illustrated concept block */}
          <div style={{ flex: 1, border: `1px solid ${t.fg}22`, position: "relative", overflow: "hidden", minHeight: 200 }}>
            <svg viewBox="0 0 500 300" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              {/* Shelf */}
              <rect x="0" y="200" width="500" height="4" fill={sec} opacity="0.4" />
              <rect x="0" y="296" width="500" height="4" fill={sec} opacity="0.2" />
              {/* Products on shelf */}
              {[60, 140, 220, 300, 380].map((x, i) => (
                <g key={x}>
                  <rect x={x} y={140 + (i % 2) * 20} width={50} height={60 - (i % 2) * 20} fill={i % 2 === 0 ? t.accent : sec} opacity={0.3 + i * 0.08} />
                  <rect x={x + 14} y={155 + (i % 2) * 20} width={22} height={30 - (i % 2) * 10} fill={t.bg} opacity="0.5" />
                </g>
              ))}
              {/* Price tags */}
              <line x1="200" y1="80" x2="200" y2="140" stroke={t.fg} strokeWidth="0.5" opacity="0.3" />
              <rect x="170" y="60" width="60" height="20" fill={t.accent} opacity="0.8" />
              {/* Brand signage */}
              <rect x="150" y="20" width="200" height="30" fill={t.fg} opacity="0.1" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontFamily: displayFont, fontSize: 14, fontWeight: 700, color: dark(t.bg) ? sec + "55" : t.fg + "22", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                {brand.brand_name} — Retail Concept
              </span>
            </div>
          </div>

          <p style={{ fontFamily: bodyFont, fontSize: 13, color: t.dim, lineHeight: 1.6, margin: 0 }}>
            Matte shelf presence. Minimal signage. Let texture sell.
            One SKU per shelf face — clarity over abundance.
          </p>

          {/* Export button */}
          <button
            onClick={onPrint}
            style={{
              fontFamily: "'Space Mono',monospace", fontSize: 11, letterSpacing: "0.2em",
              textTransform: "uppercase", cursor: "pointer",
              background: t.accent, color: dark(t.accent) ? "#fff" : "#000",
              border: "none", padding: "14px 28px", alignSelf: "flex-start",
              transition: "opacity .2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Export PDF — All 12 Pages
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Props = { result: BrandResult; className?: string };

export function BrandKitSlides({ result, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);

  const brand = result.brand_assets;
  const persona = result.persona;
  const palette = brand.palette ?? [];

  // Step 2: console.log full result on mount + verify image URLs
  useEffect(() => {
    console.log("[BrandKit] full result:", result);
    const logo = brand.logo as any;
    console.log("[BrandKit] image srcs", {
      logo_primary: fixUrl(logo?.primary ?? brand.logo_url),
      mockup0: fixUrl((brand.mockups ?? [])[0]?.url),
      mockup1: fixUrl((brand.mockups ?? [])[1]?.url),
      social0: fixUrl((brand.social_kit ?? [])[0]?.url),
      social2: fixUrl((brand.social_kit ?? [])[2]?.url),
    });
  }, []);

  // Track current panel on scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const panels = panelRefs.current;
      const scrollTop = el.scrollTop;
      const height = el.clientHeight;
      const idx = Math.round(scrollTop / height);
      setCurrentIdx(Math.max(0, Math.min(11, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (i: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: i * el.clientHeight, behavior: "smooth" });
  };

  const handlePrint = () => window.print();

  const panels = [
    <Cover key="cover" brand={brand} persona={persona} palette={palette} />,
    <Essence key="essence" brand={brand} palette={palette} />,
    <LogoSuite key="logos" brand={brand} palette={palette} />,
    <ColorSystem key="colors" brand={brand} palette={palette} />,
    <Typography key="type" brand={brand} palette={palette} />,
    <GraphicLanguage key="graphic" brand={brand} persona={persona} palette={palette} />,
    <ProductMockups key="mockups" brand={brand} palette={palette} />,
    <Editorial key="editorial" brand={brand} palette={palette} />,
    <CrossPlatform key="crossplatform" brand={brand} palette={palette} />,
    <SocialCaptions key="social" brand={brand} persona={persona} palette={palette} />,
    <AgencyMatches key="agencies" agencies={result.agency_matches} brand={brand} palette={palette} />,
    <MotionRetail key="motion" brand={brand} palette={palette} onPrint={handlePrint} />,
  ];

  return (
    <div className={className} style={{ position: "relative" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');

        .bk-scroll {
          height: 100vh;
          overflow-y: scroll;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }
        .panel {
          scroll-snap-align: start;
          scroll-snap-stop: always;
          height: 100vh;
          min-height: 100vh;
          position: relative;
          box-sizing: border-box;
        }

        /* Geometric animations */
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes pulse2 { 0%,100%{transform:scale(1)} 50%{transform:scale(0.94)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .geo-pulse { animation: pulse 6s ease-in-out infinite; transform-origin: center; }
        .geo-pulse2 { animation: pulse2 8s ease-in-out infinite; transform-origin: center; }
        .geo-spin { animation: spin 30s linear infinite; transform-origin: 50% 50%; }

        /* Nav dots */
        .bk-nav-dot {
          width: 6px; height: 6px; border-radius: 50%;
          transition: background .3s, transform .3s;
          cursor: pointer; border: none; padding: 0;
        }

        /* Print styles */
        @media print {
          .bk-scroll {
            height: auto !important;
            overflow: visible !important;
            scroll-snap-type: none !important;
          }
          .panel {
            height: 100vh !important;
            page-break-after: always;
            break-after: page;
            scroll-snap-align: none !important;
          }
          .bk-nav, .bk-toolbar { display: none !important; }
        }
      `}</style>

      {/* Scroll container */}
      <div ref={containerRef} className="bk-scroll">
        {panels.map((panel, i) => (
          <div key={i} ref={(el) => { panelRefs.current[i] = el as HTMLElement | null; }}>
            {panel}
          </div>
        ))}
      </div>

      {/* Nav dots */}
      <div
        className="bk-nav"
        style={{
          position: "fixed", right: 24, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", gap: 10, zIndex: 100,
        }}
      >
        {panels.map((_, i) => {
          const t = getPanelTheme(i, palette);
          return (
            <button
              key={i}
              className="bk-nav-dot"
              onClick={() => scrollTo(i)}
              style={{
                background: currentIdx === i ? t.accent : t.fg + "44",
                transform: currentIdx === i ? "scale(1.5)" : "scale(1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
