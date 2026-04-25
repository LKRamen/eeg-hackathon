import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import puppeteer from "puppeteer";

// ---------------------------------------------------------------------------
// Types (mirrors Python BrandResult)
// ---------------------------------------------------------------------------

interface PaletteColor {
  hex: string;
  role: string;
  name: string;
}

interface Voice {
  tone: string;
  do: string[];
  dont: string[];
  examples: string[];
}

interface Mockup {
  label: string;
  url: string;
}

interface SocialAsset {
  label: string;
  url: string;
  format: "ig_square" | "ig_story";
}

interface LogoVariants {
  primary: string;
  mono_dark: string;
  mono_light: string;
  on_brand: string;
  avatar?: string;
}

interface BrandAssets {
  brand_name: string;
  tagline: string;
  logo_url: string;
  palette: PaletteColor[];
  typography: { display: { family: string; google_url?: string }; body: { family: string; google_url?: string } };
  voice: Voice;
  mockups: Mockup[];
  logo?: LogoVariants | null;
  social_kit?: SocialAsset[];
}

interface Persona {
  name: string;
  age_range: string;
  location_archetype: string;
  psychographics: string[];
  interests: string[];
  purchase_signals: string[];
  aesthetic_keywords: string[];
  purchase_signals: string[];
  voice_traits: string[];
  summary: string;
}

interface BrandResult {
  persona: Persona;
  brand_assets: BrandAssets;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Resize and embed image at 300dpi using Sharp. */
async function printReadyPng(url: string, widthPx: number): Promise<Buffer> {
  const raw = await fetchImageBuffer(url);
  return sharp(raw)
    .resize(widthPx, widthPx, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .withMetadata({ density: 300 })
    .png()
    .toBuffer();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// ---------------------------------------------------------------------------
// HTML brand guide template (used by Puppeteer)
// ---------------------------------------------------------------------------

function buildBrandGuideHtml(result: BrandResult): string {
  const { brand_assets: b, persona: p } = result;
  const primary = b.palette.find((c) => c.role === "primary") ?? b.palette[0] ?? { hex: "#6b3fa0", role: "primary", name: "Primary" };
  const secondary = b.palette.find((c) => c.role === "secondary") ?? b.palette[1] ?? primary;
  const accent = b.palette.find((c) => c.role === "accent") ?? b.palette[2] ?? primary;

  const paletteCols =
    (b.palette?.length ? b.palette : [primary, secondary, accent])
      .map((c) => {
        const [r, g, bl] = hexToRgb(c.hex);
        const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
        const tc = lum > 140 ? "rgba(10,10,10,0.86)" : "rgba(240,237,230,0.86)";
        return `
          <div class="s04-sw" style="background:${c.hex};color:${tc}">
            <div class="s04-role">${c.role}</div>
            <div class="s04-name">${c.name}</div>
            <div class="s04-hex">${c.hex.toUpperCase()}</div>
          </div>
        `;
      })
      .join("");

  const heroImg = b.social_kit?.[2]?.url ?? b.social_kit?.[0]?.url ?? b.mockups?.[0]?.url ?? b.logo?.primary ?? b.logo_url;
  const editorialHero = b.social_kit?.[4]?.url ?? b.social_kit?.[2]?.url ?? b.mockups?.[0]?.url ?? heroImg;

  const logoPrimary = b.logo?.primary ?? b.logo_url;
  const monoDark = b.logo?.mono_dark ?? logoPrimary;
  const monoLight = b.logo?.mono_light ?? logoPrimary;
  const onBrand = b.logo?.on_brand ?? logoPrimary;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
${b.typography?.display?.google_url ? `<link rel="stylesheet" href="${b.typography.display.google_url}" />` : ""}
${b.typography?.body?.google_url && b.typography.body.google_url !== b.typography.display.google_url ? `<link rel="stylesheet" href="${b.typography.body.google_url}" />` : ""}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" />
<style>
  @page { size: 1920px 1080px; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --c-p: ${primary.hex};
    --c-s: ${secondary.hex};
    --c-a: ${accent.hex};
    --c-bg: #0a0a0a;
    --c-fg: #f0ede6;
    --c-dim: rgba(240, 237, 230, 0.38);
    --c-rule: rgba(240, 237, 230, 0.07);
    --f-d: '${b.typography?.display?.family ?? "Space Grotesk"}', 'Space Grotesk', system-ui, sans-serif;
    --f-b: '${b.typography?.body?.family ?? "Inter"}', 'Inter', system-ui, sans-serif;
    --f-m: 'JetBrains Mono', ui-monospace, monospace;
  }
  html, body { width: 1920px; background: var(--c-bg); color: var(--c-fg); font-family: var(--f-b); }
  .slide { width: 1920px; height: 1080px; background: var(--c-bg); position: relative; overflow: hidden; page-break-after: always; break-after: page; }
  .slide:last-child { page-break-after: auto; break-after: auto; }
  .sn { position: absolute; top: 44px; right: 60px; z-index: 50; font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-dim); }
  .bm { position: absolute; top: 44px; left: 60px; z-index: 50; font-family: var(--f-d); font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-dim); }
  img.fill { width: 100%; height: 100%; object-fit: cover; display: block; }
  img.hold { width: 100%; height: 100%; object-fit: contain; display: block; }

  /* 01 */
  .s01 { display: grid; grid-template-columns: 1100px 1fr; }
  .s01-l { display: flex; flex-direction: column; justify-content: flex-end; padding: 96px 80px 96px 96px; }
  .s01-eye { font-family: var(--f-m); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--c-dim); margin-bottom: 20px; }
  .s01-name { font-family: var(--f-d); font-size: 144px; font-weight: 700; line-height: 0.88; letter-spacing: -0.03em; color: var(--c-fg); word-break: break-word; }
  .s01-tag { font-family: var(--f-b); font-size: 22px; line-height: 1.4; color: var(--c-dim); margin-top: 28px; max-width: 640px; }
  .s01-foot { display: flex; justify-content: space-between; margin-top: 72px; font-family: var(--f-m); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--c-dim); }
  .s01-r { background: var(--c-p); overflow: hidden; position: relative; }
  .s01-r img { width: 100%; height: 100%; object-fit: cover; opacity: 0.72; }
  .s01-r-logo { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
  .s01-r-logo img { max-width: 360px; max-height: 360px; object-fit: contain; opacity: 0.85; }

  /* 02 */
  .s02 { display: grid; grid-template-columns: 380px 1fr 420px; }
  .s02-l { display: flex; flex-direction: column; justify-content: flex-end; padding: 80px 48px 80px 60px; border-right: 1px solid var(--c-rule); }
  .s02-hdg { font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-a); margin-bottom: 24px; }
  .s02-sum { font-family: var(--f-d); font-size: 21px; font-weight: 400; line-height: 1.5; color: var(--c-fg); }
  .s02-c { background: var(--c-a); overflow: hidden; }
  .s02-c img { width: 100%; height: 100%; object-fit: cover; opacity: 0.82; }
  .s02-r { display: flex; flex-direction: column; justify-content: flex-end; padding: 80px 60px 80px 48px; border-left: 1px solid var(--c-rule); }
  .s02-ph { font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-dim); margin-bottom: 24px; }
  .s02-pillar { padding: 22px 0; border-top: 1px solid var(--c-a); }
  .s02-pn { font-family: var(--f-m); font-size: 11px; letter-spacing: 0.14em; color: var(--c-a); margin-bottom: 6px; }
  .s02-pt { font-family: var(--f-b); font-size: 16px; line-height: 1.45; color: var(--c-fg); }

  /* 03 */
  .s03 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; background: var(--c-bg); }
  .s03-cell { display:flex; align-items:center; justify-content:center; position:relative; padding:64px; }
  .s03-cell img { max-width:320px; max-height:320px; object-fit:contain; }
  .s03-cap { position:absolute; bottom:28px; left:36px; font-family: var(--f-m); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; }
  .s03-a { background: var(--c-bg); }  .s03-a .s03-cap { color: var(--c-dim); }
  .s03-b { background: #f0ede6; }      .s03-b .s03-cap { color: rgba(10,10,10,0.4); }
  .s03-c { background: #161616; }      .s03-c .s03-cap { color: var(--c-dim); }
  .s03-d { background: var(--c-p); }   .s03-d .s03-cap { color: rgba(240,237,230,0.4); }

  /* 04 */
  .s04 { display:grid; grid-template-columns: 1fr 440px; }
  .s04-sw-wrap { display:grid; grid-auto-columns:1fr; grid-auto-flow:column; }
  .s04-sw { display:flex; flex-direction:column; justify-content:flex-end; padding:28px 22px; }
  .s04-role { font-family: var(--f-m); font-size:10px; letter-spacing:0.16em; text-transform:uppercase; opacity:0.45; }
  .s04-name { font-family: var(--f-d); font-size:20px; font-weight:700; margin-top:4px; }
  .s04-hex { font-family: var(--f-m); font-size:13px; letter-spacing:0.06em; margin-top:3px; }
  .s04-r { display:flex; flex-direction:column; justify-content:flex-end; padding:64px 48px 64px 40px; border-left: 1px solid var(--c-rule); }
  .s04-grad { height: 220px; border-radius:4px; margin-bottom:40px; background: linear-gradient(135deg, var(--c-p) 0%, var(--c-a) 100%); }
  .s04-grad-label { font-family: var(--f-m); font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color: var(--c-dim); margin-bottom:32px; }
  .s04-pair { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
  .s04-dot { width:28px; height:28px; border-radius:50%; flex-shrink:0; }
  .s04-pt { font-family: var(--f-b); font-size:14px; color: var(--c-dim); }

  /* 05 */
  .s05 { display:grid; grid-template-columns: 460px 1fr 480px; }
  .s05-l { display:flex; flex-direction:column; justify-content:flex-end; padding:80px 48px 80px 72px; border-right: 1px solid var(--c-rule); }
  .s05-fn { font-family: var(--f-d); font-size:80px; font-weight:700; line-height:0.92; letter-spacing:-0.02em; }
  .s05-fn2 { font-family: var(--f-b); font-size:36px; font-weight:400; line-height:0.92; letter-spacing:-0.01em; margin-top:16px; color: var(--c-dim); }
  .s05-fw { font-family: var(--f-m); font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color: var(--c-a); margin-top:20px; }
  .s05-c { display:flex; align-items:center; justify-content:center; background: var(--c-p); overflow:hidden; }
  .s05-aa { font-family: var(--f-d); font-size:480px; font-weight:700; line-height:1; letter-spacing:-0.04em; color: var(--c-fg); opacity:0.9; margin-top:60px; }
  .s05-r { display:flex; flex-direction:column; justify-content:flex-end; padding:80px 72px 80px 48px; border-left: 1px solid var(--c-rule); }
  .s05-scale-head { font-family: var(--f-m); font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color: var(--c-dim); margin-bottom:16px; }
  .s05-row { display:flex; justify-content:space-between; align-items:baseline; padding:13px 0; border-top:1px solid var(--c-rule); }
  .s05-rl { font-family: var(--f-m); font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color: var(--c-dim); min-width:80px; }

  /* 06 */
  .s06 { display:grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr); gap: 2px; background: var(--c-bg); }
  .s06-cell { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
  .s06-a { background: var(--c-p); } .s06-b { background: var(--c-bg); } .s06-c { background: var(--c-a); }
  .s06-d { background: #161616; }    .s06-e { background: var(--c-s); }  .s06-f { background: var(--c-bg); }
  .gfx-grid-bg { position:absolute; inset:0; background-image: linear-gradient(var(--c-rule) 1px, transparent 1px), linear-gradient(90deg, var(--c-rule) 1px, transparent 1px); background-size: 48px 48px; }
  .gfx-stripe-bg { position:absolute; inset:0; background: repeating-linear-gradient(-45deg, rgba(240,237,230,0.06) 0, rgba(240,237,230,0.06) 2px, transparent 2px, transparent 24px); }

  /* 07 */
  .s07 { display:grid; grid-template-columns: 1fr 1fr 500px; grid-template-rows: 3fr 1fr; gap:2px; background: var(--c-bg); }
  .s07-hero { grid-row: span 2; overflow:hidden; background: var(--c-p); } .s07-hero img { width:100%; height:100%; object-fit:cover; }
  .s07-sub { overflow:hidden; background: var(--c-s); } .s07-sub img { width:100%; height:100%; object-fit:cover; }
  .s07-copy { display:flex; flex-direction:column; justify-content:center; padding:56px 52px; background: var(--c-bg); }
  .s07-copy-q { font-family: var(--f-d); font-size:48px; font-weight:700; line-height:1.05; letter-spacing:-0.02em; }
  .s07-copy-sub { font-family: var(--f-m); font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color: var(--c-dim); margin-top:24px; }
  .s07-accent { background: var(--c-a); display:flex; flex-direction:column; justify-content:flex-end; padding:28px 36px; }

  /* 08 */
  .s08 { display:grid; grid-template-columns: 1.8fr 1fr; grid-template-rows: 1fr 380px; gap:2px; background: var(--c-bg); }
  .s08-main { grid-row: span 2; position:relative; overflow:hidden; background: var(--c-p); } .s08-main img { width:100%; height:100%; object-fit:cover; }
  .s08-ov { position:absolute; bottom:0; left:0; right:0; padding:64px 64px 56px; background: linear-gradient(to top, rgba(10,10,10,0.88) 0%, transparent 100%); }
  .s08-ov-name { font-family: var(--f-d); font-size:72px; font-weight:700; line-height:0.9; letter-spacing:-0.03em; color: var(--c-fg); }
  .s08-det { overflow:hidden; background: var(--c-s); } .s08-det img { width:100%; height:100%; object-fit:cover; }
  .s08-copy { background: var(--c-a); display:flex; flex-direction:column; justify-content:flex-end; padding:36px 44px; }

  /* 09 */
  .s09 { display:grid; grid-template-rows: 330px 1fr; gap:2px; background: var(--c-bg); }
  .s09-strip { display:grid; grid-template-columns: repeat(3, 1fr); gap:2px; }
  .s09-th { overflow:hidden; background: var(--c-p); position:relative; } .s09-th img { width:100%; height:100%; object-fit:cover; }
  .s09-cap { position:absolute; bottom:14px; left:18px; font-family: var(--f-m); font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,237,230,0.5); }
  .s09-hero { overflow:hidden; background: var(--c-s); position:relative; } .s09-hero img { width:100%; height:100%; object-fit:cover; }
  .s09-hero-ov { position:absolute; bottom:56px; left:72px; }
  .s09-hero-ov-t { font-family: var(--f-d); font-size:64px; font-weight:700; line-height:0.92; letter-spacing:-0.03em; color: var(--c-fg); }
  .s09-hero-ov-s { font-family: var(--f-m); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color: rgba(240,237,230,0.55); margin-top:10px; }

  /* 10 */
  .s10 { display:grid; grid-template-columns: 420px 1fr 420px; grid-template-rows: 1fr 240px; gap:2px; background: var(--c-bg); }
  .s10-phone { display:flex; align-items:center; justify-content:center; background:#0d0d0d; }
  .s10-desk  { display:flex; align-items:center; justify-content:center; background:#0f0f0f; overflow:hidden; }
  .s10-merch { display:grid; grid-template-rows: 1fr 1fr; gap:2px; background: var(--c-bg); }
  .s10-mt { overflow:hidden; background: var(--c-p); } .s10-mt img { width:100%; height:100%; object-fit:cover; }
  .s10-social { grid-column: span 3; display:grid; grid-template-columns: repeat(4, 1fr); gap:2px; }
  .s10-sc { overflow:hidden; background: var(--c-p); } .s10-sc img { width:100%; height:100%; object-fit:cover; }
</style>
</head>
<body>

<section class="slide s01">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">01 —</span>
  <div class="s01-l">
    <div class="s01-eye">Brand Identity System</div>
    <div class="s01-name">${b.brand_name}</div>
    ${b.tagline ? `<p class="s01-tag">${b.tagline}</p>` : ""}
    <div class="s01-foot">
      <span>Brand Kit — Version 1.0</span>
      <span>${new Date().toISOString().slice(0, 10)}</span>
    </div>
  </div>
  <div class="s01-r">
    ${heroImg ? `<img src="${heroImg}" alt="" class="fill" />` : `<div class="s01-r-logo"><img src="${logoPrimary}" alt="" /></div>`}
  </div>
</section>

<section class="slide s02">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">02 —</span>
  <div class="s02-l">
    <div class="s02-hdg">Brand Essence</div>
    <p class="s02-sum">${p.summary ?? ""}</p>
    <div style="margin-top: 32px; font-family: var(--f-m); font-size: 13px; line-height: 2.0; color: var(--c-dim);">
      ${(p.aesthetic_keywords ?? []).join(" · ")}
    </div>
  </div>
  <div class="s02-c">${heroImg ? `<img src="${heroImg}" alt="" class="fill" />` : ""}</div>
  <div class="s02-r">
    <div class="s02-ph">Brand Pillars</div>
    ${[p.psychographics?.[0], p.interests?.[0], p.purchase_signals?.[0]].filter(Boolean).map((x, i) => `
      <div class="s02-pillar">
        <div class="s02-pn">0${i + 1}</div>
        <div class="s02-pt">${x}</div>
      </div>
    `).join("")}
  </div>
</section>

<section class="slide s03">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">03 —</span>
  <div class="s03-cell s03-a"><img src="${logoPrimary}" alt="" /><span class="s03-cap">Primary</span></div>
  <div class="s03-cell s03-b"><img src="${monoDark}" alt="" /><span class="s03-cap">Monochrome — Light Ground</span></div>
  <div class="s03-cell s03-c"><img src="${monoLight}" alt="" /><span class="s03-cap">Monochrome — Dark Ground</span></div>
  <div class="s03-cell s03-d"><img src="${onBrand}" alt="" /><span class="s03-cap">On Brand Color</span></div>
</section>

<section class="slide s04">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">04 —</span>
  <div class="s04-sw-wrap">${paletteCols}</div>
  <div class="s04-r">
    <div class="s04-grad"></div>
    <div class="s04-grad-label">Primary × Accent Gradient</div>
    <div class="s04-pair"><div class="s04-dot" style="background:var(--c-p)"></div><div class="s04-pt">Primary — dominant structural tone</div></div>
    <div class="s04-pair"><div class="s04-dot" style="background:var(--c-a)"></div><div class="s04-pt">Accent — energy, CTAs, highlights</div></div>
    <div class="s04-pair"><div class="s04-dot" style="background:var(--c-s)"></div><div class="s04-pt">Secondary — supporting surfaces</div></div>
  </div>
</section>

<section class="slide s05">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">05 —</span>
  <div class="s05-l">
    <div style="font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-dim); margin-bottom: 32px;">Display Type</div>
    <div class="s05-fn">${b.typography?.display?.family ?? ""}</div>
    <div style="margin-top: 32px; font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--c-dim);">Body Type</div>
    <div class="s05-fn2">${b.typography?.body?.family ?? ""}</div>
    <div class="s05-fw">700 Bold — 400 Regular — 300 Light</div>
  </div>
  <div class="s05-c"><span class="s05-aa">Aa</span></div>
  <div class="s05-r">
    <div class="s05-scale-head">Type Scale</div>
    <div class="s05-row"><span class="s05-rl">Hero</span><span style="font-family:var(--f-d);font-size:96px;line-height:1;">${b.brand_name?.[0] ?? "A"}g</span></div>
    <div class="s05-row"><span class="s05-rl">H1</span><span style="font-family:var(--f-d);font-size:64px;line-height:1;">${b.brand_name}</span></div>
    <div class="s05-row"><span class="s05-rl">H2</span><span style="font-family:var(--f-d);font-size:40px;line-height:1.1;">Brand Voice</span></div>
    <div class="s05-row"><span class="s05-rl">Body</span><span style="font-size:18px;font-weight:400;font-family:var(--f-b);line-height:1.5;">${(p.summary ?? "").slice(0, 70)}</span></div>
    <div class="s05-row"><span class="s05-rl">Caption</span><span style="font-size:12px;font-family:var(--f-m);letter-spacing:0.12em;text-transform:uppercase;color:var(--c-dim);">12px — Mono Uppercase</span></div>
  </div>
</section>

<section class="slide s06">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">06 —</span>
  <div class="s06-cell s06-a">
    <svg width="380" height="380" viewBox="0 0 380 380">
      <circle cx="190" cy="190" r="180" fill="none" stroke="rgba(240,237,230,0.15)" stroke-width="1"/>
      <circle cx="190" cy="190" r="130" fill="none" stroke="rgba(240,237,230,0.25)" stroke-width="1"/>
      <circle cx="190" cy="190" r="80"  fill="none" stroke="rgba(240,237,230,0.5)"  stroke-width="2"/>
      <circle cx="190" cy="190" r="24"  fill="var(--c-fg)" opacity="0.9"/>
    </svg>
  </div>
  <div class="s06-cell s06-b">
    <div class="gfx-grid-bg"></div>
    <svg width="240" height="240" viewBox="0 0 240 240" style="position:relative;z-index:1;">
      <rect x="40" y="40" width="160" height="160" fill="none" stroke="var(--c-a)" stroke-width="2"/>
      <line x1="120" y1="0"   x2="120" y2="240" stroke="var(--c-a)" stroke-width="1" opacity="0.4"/>
      <line x1="0"   y1="120" x2="240" y2="120" stroke="var(--c-a)" stroke-width="1" opacity="0.4"/>
      <circle cx="120" cy="120" r="6" fill="var(--c-a)"/>
    </svg>
  </div>
  <div class="s06-cell s06-c">
    <span style="font-family: var(--f-d); font-size: 340px; font-weight: 700; line-height: 1; letter-spacing: -0.04em; color: rgba(10,10,10,0.18);">${(b.brand_name?.[0] ?? "A").toUpperCase()}</span>
    <div style="position:absolute; bottom: 32px; left: 36px; font-family: var(--f-m); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(10,10,10,0.55);">Graphic Mark</div>
  </div>
  <div class="s06-cell s06-d">
    <div class="gfx-stripe-bg"></div>
    <svg width="200" height="200" viewBox="0 0 200 200" style="position:relative;z-index:1;">
      <polygon points="100,10 190,190 10,190" fill="none" stroke="rgba(240,237,230,0.5)" stroke-width="2"/>
      <polygon points="100,50 160,170 40,170" fill="rgba(240,237,230,0.08)"/>
      <circle cx="100" cy="100" r="8" fill="var(--c-a)"/>
    </svg>
  </div>
  <div class="s06-cell s06-e" style="flex-direction: column; align-items: flex-start; padding: 48px;">
    <div style="font-family: var(--f-d); font-size: 28px; font-weight: 700; letter-spacing: -0.01em; color: var(--c-bg); margin-bottom: 24px;">Aesthetic Direction</div>
    ${(p.aesthetic_keywords ?? []).slice(0, 6).map((kw) => `<div style="font-family: var(--f-m); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(10,10,10,0.5); margin-bottom: 10px;">${kw}</div>`).join("")}
  </div>
  <div class="s06-cell s06-f">
    <svg width="320" height="320" viewBox="0 0 320 320">
      ${Array.from({ length: 8 }).map((_, row) => Array.from({ length: 8 }).map((__, col) => {
        const op = 0.1 + (((row + col) % 5) * 0.12);
        const rr = 3 + ((row + col) % 3);
        return `<circle cx="${col * 44 + 16}" cy="${row * 44 + 16}" r="${rr}" fill="var(--c-fg)" opacity="${op}"></circle>`;
      }).join("")).join("")}
    </svg>
  </div>
</section>

<section class="slide s07">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">07 —</span>
  <div class="s07-hero">${b.mockups?.[0]?.url ? `<img src="${b.mockups[0].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}</div>
  <div class="s07-sub">${b.mockups?.[1]?.url ? `<img src="${b.mockups[1].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}</div>
  <div class="s07-copy">
    <div class="s07-copy-q">"Obsessively<br>considered.<br>Every detail."</div>
    ${b.voice?.examples?.[0] ? `<div class="s07-copy-sub">${b.voice.examples[0].slice(0, 80)}</div>` : ""}
  </div>
  <div class="s07-accent"><div style="font-family: var(--f-m); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(10,10,10,0.6);">${p.age_range ?? ""} · ${(p.location_archetype ?? "").slice(0, 40)}</div></div>
</section>

<section class="slide s08">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">08 —</span>
  <div class="s08-main">
    ${b.mockups?.[0]?.url ? `<img src="${b.mockups[0].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}
    <div class="s08-ov">
      <div class="s08-ov-name">${b.brand_name}</div>
      <div style="font-family: var(--f-m); font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--c-dim); margin-top: 12px;">Packaging System — v1.0</div>
    </div>
  </div>
  <div class="s08-det">
    ${b.mockups?.[1]?.url ? `<img src="${b.mockups[1].url}" class="fill" />` : `<div style="width:100%;height:100%;background:var(--c-p);display:flex;align-items:center;justify-content:center;"><img src="${onBrand}" style="max-width:60%;max-height:60%;object-fit:contain;"></div>`}
  </div>
  <div class="s08-copy">
    <div style="font-family: var(--f-d); font-size: 28px; font-weight: 700; letter-spacing: -0.01em; color: #0a0a0a;">Every<br>touchpoint<br>matters.</div>
    <div style="font-family: var(--f-m); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(10,10,10,0.55); margin-top: 8px;">Material, form, finish</div>
  </div>
</section>

<section class="slide s09">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">09 —</span>
  <div class="s09-strip">
    <div class="s09-th">${b.social_kit?.[2]?.url ? `<img src="${b.social_kit[2].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}<span class="s09-cap">Editorial 01 — Campaign</span></div>
    <div class="s09-th">${b.social_kit?.[4]?.url ? `<img src="${b.social_kit[4].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}<span class="s09-cap">Lifestyle 02 — Studio</span></div>
    <div class="s09-th">${b.social_kit?.[3]?.url ? `<img src="${b.social_kit[3].url}" class="fill" />` : `<div style="width:100%;height:100%;background:var(--c-a);display:flex;align-items:center;justify-content:center;"><img src="${monoLight}" style="max-width:55%;max-height:55%;object-fit:contain;"></div>`}<span class="s09-cap">Story 03 — Closeup</span></div>
  </div>
  <div class="s09-hero">
    ${editorialHero ? `<img src="${editorialHero}" class="fill" />` : ""}
    <div class="s09-hero-ov">
      <div class="s09-hero-ov-t">Art direction<br>by ${b.brand_name}.</div>
      <div class="s09-hero-ov-s">${(p.aesthetic_keywords?.[0] ?? "").slice(0, 22)} · editorial</div>
    </div>
  </div>
</section>

<section class="slide s10">
  <span class="bm">${b.brand_name}</span>
  <span class="sn">10 —</span>
  <div style="display:grid; grid-template-columns: 420px 1fr 420px; grid-template-rows: 1fr 240px; gap:2px; width:1920px; height:1080px;">
    <div class="s10-phone">
      <div class="phone" style="width:220px;height:440px;background:#1c1c1e;border-radius:40px;border:2px solid #333;position:relative;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.72);">
        <div class="phone-notch" style="width:80px;height:24px;background:#1c1c1e;border-radius:0 0 14px 14px;margin:0 auto;position:relative;z-index:2;"></div>
        <div class="phone-scr" style="position:absolute;inset:0;background:var(--c-p);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px;">
          <div style="font-family:var(--f-d);font-size:22px;font-weight:700;letter-spacing:-0.01em;color:var(--c-fg);text-align:center;">${b.brand_name}</div>
          <div style="font-family:var(--f-b);font-size:11px;line-height:1.4;color:var(--c-dim);text-align:center;">${(b.tagline ?? "").slice(0, 60)}</div>
          <div style="margin-top:20px;background:var(--c-a);padding:9px 22px;border-radius:22px;font-family:var(--f-m);font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:#0a0a0a;">Shop Now</div>
        </div>
      </div>
    </div>
    <div class="s10-desk">
      <div class="desktop" style="width:660px;height:414px;background:#1c1c1e;border-radius:12px;border:2px solid #2c2c2e;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.55);">
        <div class="desktop-bar" style="height:32px;background:#2a2a2c;display:flex;align-items:center;padding:0 14px;gap:7px;">
          <div style="width:10px;height:10px;border-radius:50%;background:#ff5f57;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#febc2e;"></div>
          <div style="width:10px;height:10px;border-radius:50%;background:#28c840;"></div>
        </div>
        <div class="desktop-scr" style="background:#0a0a0a;height:calc(100% - 32px);padding:20px;">
          <div class="desktop-nav" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-family:var(--f-d);font-size:14px;font-weight:700;letter-spacing:-0.01em;color:var(--c-fg);">${b.brand_name}</div>
            <div style="display:flex;gap:16px;">
              <div style="height:6px;width:38px;background:var(--c-dim);border-radius:3px;"></div>
              <div style="height:6px;width:38px;background:var(--c-dim);border-radius:3px;"></div>
              <div style="height:6px;width:38px;background:var(--c-dim);border-radius:3px;opacity:0.4;"></div>
            </div>
          </div>
          <div style="height:140px;background:var(--c-p);border-radius:6px;position:relative;overflow:hidden;margin-bottom:10px;">
            <div style="position:absolute;bottom:14px;left:16px;font-family:var(--f-d);font-size:24px;font-weight:700;letter-spacing:-0.01em;color:var(--c-fg);">${b.brand_name}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            <div style="height:58px;border-radius:4px;background:var(--c-p);opacity:0.8;"></div>
            <div style="height:58px;border-radius:4px;background:var(--c-a);opacity:0.6;"></div>
            <div style="height:58px;border-radius:4px;background:var(--c-s);opacity:0.7;"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="s10-merch">
      <div class="s10-mt">${b.mockups?.[0]?.url ? `<img src="${b.mockups[0].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}</div>
      <div class="s10-mt">${b.mockups?.[1]?.url ? `<img src="${b.mockups[1].url}" class="fill" />` : heroImg ? `<img src="${heroImg}" class="fill" />` : ""}</div>
    </div>
    <div class="s10-social">
      ${[0,1,2,3].map((i) => `
        <div class="s10-sc">
          ${b.social_kit?.[i]?.url ? `<img src="${b.social_kit[i].url}" class="fill" />` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--c-p);"><span style="font-family:var(--f-d);font-size:32px;font-weight:700;letter-spacing:-0.02em;opacity:0.35;color:var(--c-fg);">${(b.brand_name?.[0] ?? "A").toUpperCase()}</span></div>`}
        </div>
      `).join("")}
    </div>
  </div>
</section>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Export handlers
// ---------------------------------------------------------------------------

/** Full brand guide PDF rendered at 300dpi via Puppeteer. */
async function exportBrandGuidePdf(result: BrandResult): Promise<Buffer> {
  const html = buildBrandGuideHtml(result);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    // Headless slide deck: 1920×1080 per page.
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      width: "1920px",
      height: "1080px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Manufacturing-ready logo PNG at 300dpi (2480px = A4 width at 300dpi). */
async function exportLogoPrintReady(logoUrl: string): Promise<Buffer> {
  return printReadyPng(logoUrl, 2480);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const { type, result } = (await req.json()) as {
    type: "brand-guide" | "logo-print";
    result: BrandResult;
  };

  try {
    if (type === "brand-guide") {
      const pdf = await exportBrandGuidePdf(result);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.brand_assets.brand_name.replace(/\s+/g, "-")}-brand-guide.pdf"`,
        },
      });
    }

    if (type === "logo-print") {
      const png = await exportLogoPrintReady(result.brand_assets.logo_url);
      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${result.brand_assets.brand_name.replace(/\s+/g, "-")}-logo-300dpi.png"`,
        },
      });
    }

    return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
