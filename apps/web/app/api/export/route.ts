import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
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

interface BrandAssets {
  brand_name: string;
  logo_url: string;
  palette: PaletteColor[];
  typography: { display: { family: string }; body: { family: string } };
  voice: Voice;
  mockups: Mockup[];
}

interface Persona {
  name: string;
  age_range: string;
  location_archetype: string;
  psychographics: string[];
  interests: string[];
  aesthetic_keywords: string[];
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
  const primary = b.palette.find((c) => c.role === "primary") ?? b.palette[0];
  const accent = b.palette.find((c) => c.role === "accent") ?? b.palette[1] ?? primary;

  const paletteSwatches = b.palette
    .map(
      (c) => `
      <div style="text-align:center">
        <div style="width:80px;height:80px;border-radius:8px;background:${c.hex};margin-bottom:8px"></div>
        <div style="font-size:12px;font-weight:600">${c.name}</div>
        <div style="font-size:11px;color:#666">${c.hex.toUpperCase()}</div>
        <div style="font-size:10px;color:#999">${c.role}</div>
      </div>`
    )
    .join("");

  const mockupImages = b.mockups
    .map(
      (m) => `
      <div>
        <img src="${m.url}" style="width:100%;border-radius:12px;display:block" />
        <div style="text-align:center;margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#999">${m.label}</div>
      </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(b.typography.display.family)}:wght@400;700&family=${encodeURIComponent(b.typography.body.family)}:wght@400;600&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: '${b.typography.body.family}', sans-serif; background: #fff; color: #111; }
  h1, h2, h3 { font-family: '${b.typography.display.family}', sans-serif; }

  .page { width: 794px; min-height: 1123px; padding: 64px; page-break-after: always; }

  /* Cover */
  .cover { background: ${primary?.hex ?? "#000"}; color: #fff; display: flex; flex-direction: column; justify-content: flex-end; }
  .cover h1 { font-size: 72px; font-weight: 700; line-height: 1; margin-bottom: 16px; }
  .cover .tagline { font-size: 20px; opacity: 0.7; margin-bottom: 8px; }
  .cover img { width: 120px; height: 120px; object-fit: contain; margin-bottom: 48px; filter: brightness(0) invert(1); }

  /* Section label */
  .section-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 24px; }
  .section-title { font-size: 36px; font-weight: 700; margin-bottom: 32px; }

  /* Persona */
  .persona-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .persona-item h4 { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
  .persona-item p, .persona-item li { font-size: 15px; line-height: 1.6; }
  .persona-item ul { list-style: none; }
  .persona-item li::before { content: "— "; color: ${accent?.hex ?? "#000"}; }
  .persona-summary { grid-column: 1 / -1; font-size: 18px; line-height: 1.7; border-left: 3px solid ${primary?.hex ?? "#000"}; padding-left: 20px; }

  /* Palette */
  .swatches { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 32px; }

  /* Voice */
  .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 16px; }
  .voice-col h4 { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #999; margin-bottom: 12px; }
  .voice-col li { font-size: 14px; line-height: 1.8; list-style: none; }
  .do li::before { content: "✓ "; color: ${accent?.hex ?? "green"}; }
  .dont li::before { content: "✕ "; color: #e00; }
  .examples { margin-top: 32px; }
  .example { font-size: 15px; font-style: italic; padding: 16px; border-left: 2px solid ${accent?.hex ?? "#000"}; margin-bottom: 12px; }

  /* Mockups */
  .mockup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }

  /* Back cover */
  .back { background: #111; color: #fff; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; }
  .back h2 { font-size: 48px; }
  .back p { font-size: 14px; opacity: 0.4; }
</style>
</head>
<body>

<!-- COVER -->
<div class="page cover">
  <img src="${b.logo_url}" alt="logo" />
  <div>
    <h1>${b.brand_name}</h1>
    <div class="tagline">${b.voice.examples[0] ?? ""}</div>
  </div>
</div>

<!-- PERSONA -->
<div class="page">
  <div class="section-label">01 — Customer Persona</div>
  <h2 class="section-title">${p.name}</h2>
  <div class="persona-grid">
    <div class="persona-item">
      <h4>Age Range</h4><p>${p.age_range}</p>
    </div>
    <div class="persona-item">
      <h4>Location Archetype</h4><p>${p.location_archetype}</p>
    </div>
    <div class="persona-item">
      <h4>Psychographics</h4>
      <ul>${p.psychographics.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
    <div class="persona-item">
      <h4>Interests</h4>
      <ul>${p.interests.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
    <div class="persona-summary"><p>${p.summary}</p></div>
  </div>
</div>

<!-- PALETTE -->
<div class="page">
  <div class="section-label">02 — Color Palette</div>
  <h2 class="section-title">Color System</h2>
  <div class="swatches">${paletteSwatches}</div>
</div>

<!-- VOICE -->
<div class="page">
  <div class="section-label">03 — Brand Voice</div>
  <h2 class="section-title">${b.voice.tone}</h2>
  <div class="voice-grid">
    <div class="voice-col do">
      <h4>Do</h4>
      <ul>${b.voice.do.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
    <div class="voice-col dont">
      <h4>Don't</h4>
      <ul>${b.voice.dont.map((x) => `<li>${x}</li>`).join("")}</ul>
    </div>
  </div>
  <div class="examples">
    <h4 style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#999;margin-bottom:16px">Example Copy</h4>
    ${b.voice.examples.map((e) => `<div class="example">"${e}"</div>`).join("")}
  </div>
</div>

<!-- MOCKUPS -->
<div class="page">
  <div class="section-label">04 — Product Mockups</div>
  <h2 class="section-title">Manufacturing Previews</h2>
  <div class="mockup-grid">${mockupImages}</div>
</div>

<!-- BACK COVER -->
<div class="page back">
  <h2>${b.brand_name}</h2>
  <p>Brand guide generated by Halo · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
</div>

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
    // 794px at 96dpi; scale factor 3.125 ≈ 300dpi
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3.125 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      format: "A4",
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
      return new NextResponse(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.brand_assets.brand_name.replace(/\s+/g, "-")}-brand-guide.pdf"`,
        },
      });
    }

    if (type === "logo-print") {
      const png = await exportLogoPrintReady(result.brand_assets.logo_url);
      return new NextResponse(png, {
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
