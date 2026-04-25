/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BrandResult } from "@halo/types";
import { Button } from "@/components/ui/button";

type Props = {
  result: BrandResult;
  className?: string;
};

function pickHex(palette: BrandResult["brand_assets"]["palette"], role: string, fallback: string) {
  return palette.find((c) => c.role === (role as any))?.hex ?? palette[0]?.hex ?? fallback;
}

function cssVarStyle(result: BrandResult) {
  const p = result.brand_assets.palette ?? [];
  const display = result.brand_assets.typography?.display?.family ?? "Space Grotesk";
  const body = result.brand_assets.typography?.body?.family ?? "Inter";
  return {
    ["--color-primary" as any]: pickHex(p, "primary", "#6b3fa0"),
    ["--color-secondary" as any]: pickHex(p, "secondary", "#3a6ba0"),
    ["--color-accent" as any]: pickHex(p, "accent", "#d2beff"),
    ["--color-bg-dark" as any]: "#0a0a0a",
    ["--color-fg" as any]: "#f0ede6",
    ["--font-display" as any]: `'${display}', system-ui, sans-serif`,
    ["--font-body" as any]: `'${body}', system-ui, sans-serif`,
  } as React.CSSProperties;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function BrandKitSlides({ result, className }: Props) {
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const brand = result.brand_assets;
  const persona = result.persona;

  const slideCount = 10;

  const exportName = useMemo(() => brand.brand_name?.trim().replace(/\s+/g, "-") || "brand-kit", [brand.brand_name]);

  // Responsive scale: render at 1920×1080, scale down to fit container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const next = Math.min(w / 1920, h / 1080);
      setScale(clamp(next, 0.25, 1));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const exportPdf = async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "brand-guide", result }),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    downloadBlob(blob, `${exportName}-brand-guide.pdf`);
  };

  const exportLogoPng = async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "logo-print", result }),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    downloadBlob(blob, `${exportName}-logo-300dpi.png`);
  };

  const go = (next: number) => setIdx((v) => clamp(next, 0, slideCount - 1));
  const next = () => setIdx((v) => clamp(v + 1, 0, slideCount - 1));
  const prev = () => setIdx((v) => clamp(v - 1, 0, slideCount - 1));

  const primaryLogo = brand.logo?.primary ?? brand.logo_url;
  const monoDark = brand.logo?.mono_dark ?? primaryLogo;
  const monoLight = brand.logo?.mono_light ?? primaryLogo;
  const onBrand = brand.logo?.on_brand ?? primaryLogo;

  const social = brand.social_kit ?? [];
  const mockups = brand.mockups ?? [];

  const heroImg =
    social[2]?.url ??
    social[0]?.url ??
    mockups[0]?.url ??
    primaryLogo;

  const packagingImg = mockups[0]?.url ?? heroImg;
  const packagingDetail = mockups[1]?.url ?? onBrand;

  const editorialHero = social[4]?.url ?? social[2]?.url ?? mockups[0]?.url ?? heroImg;
  const editorialStrip = [social[2]?.url, social[4]?.url, social[3]?.url].filter(Boolean) as string[];

  const s10Social = [0, 1, 2, 3].map((i) => social[i]?.url).filter(Boolean) as string[];

  return (
    <div className={className} style={cssVarStyle(result)}>
      <style jsx global>{`
        .bk-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 14, 17, 0.55);
          backdrop-filter: blur(18px);
          border-radius: 14px;
        }
        .bk-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 240px;
        }
        .bk-title .name {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: -0.2px;
          color: rgba(240, 238, 244, 0.9);
        }
        .bk-title .sub {
          font-family: var(--font-body);
          font-size: 12px;
          color: rgba(240, 238, 244, 0.45);
        }
        .bk-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .bk-stage {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: var(--color-bg-dark);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          overflow: hidden;
          position: relative;
        }
        .bk-inner {
          width: 1920px;
          height: 1080px;
          transform-origin: top left;
        }
        .bk-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
        }
        .bk-dots {
          display: flex;
          gap: 8px;
          justify-content: center;
          flex: 1;
        }
        .bk-dot {
          width: 7px;
          height: 7px;
          border-radius: 99px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          cursor: pointer;
          transition: all 120ms ease;
        }
        .bk-dot.active {
          width: 22px;
          background: var(--color-accent);
          border-color: rgba(210, 190, 255, 0.55);
        }

        /* ------------------------------------------------------------------ */
        /* Slides: CSS ported from apps/api/templates/brand_guide.html         */
        /* ------------------------------------------------------------------ */
        .slide {
          width: 1920px;
          height: 1080px;
          background: var(--color-bg-dark);
          position: relative;
          overflow: hidden;
        }
        .sn {
          position: absolute;
          top: 44px;
          right: 60px;
          z-index: 50;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
        }
        .bm {
          position: absolute;
          top: 44px;
          left: 60px;
          z-index: 50;
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
        }
        img.fill {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        img.hold {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }

        /* 01 */
        .s01 {
          display: grid;
          grid-template-columns: 1100px 1fr;
        }
        .s01-l {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 96px 80px 96px 96px;
        }
        .s01-eye {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          margin-bottom: 20px;
        }
        .s01-name {
          font-family: var(--font-display);
          font-size: 144px;
          font-weight: 700;
          line-height: 0.88;
          letter-spacing: -0.03em;
          color: var(--color-fg);
          word-break: break-word;
        }
        .s01-tag {
          font-family: var(--font-body);
          font-size: 22px;
          line-height: 1.4;
          color: rgba(240, 237, 230, 0.38);
          margin-top: 28px;
          max-width: 640px;
        }
        .s01-foot {
          display: flex;
          justify-content: space-between;
          margin-top: 72px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
        }
        .s01-r {
          background: var(--color-primary);
          overflow: hidden;
          position: relative;
        }
        .s01-r img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.72;
        }
        .s01-r-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        .s01-r-logo img {
          max-width: 360px;
          max-height: 360px;
          object-fit: contain;
          opacity: 0.85;
        }

        /* 02 */
        .s02 {
          display: grid;
          grid-template-columns: 380px 1fr 420px;
        }
        .s02-l {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 80px 48px 80px 60px;
          border-right: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s02-hdg {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
          margin-bottom: 24px;
        }
        .s02-sum {
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 400;
          line-height: 1.5;
          color: var(--color-fg);
        }
        .s02-c {
          background: var(--color-accent);
          overflow: hidden;
        }
        .s02-c img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.82;
        }
        .s02-r {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 80px 60px 80px 48px;
          border-left: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s02-ph {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          margin-bottom: 24px;
        }
        .s02-pillar {
          padding: 22px 0;
          border-top: 1px solid var(--color-accent);
        }
        .s02-pn {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--color-accent);
          margin-bottom: 6px;
        }
        .s02-pt {
          font-family: var(--font-body);
          font-size: 16px;
          line-height: 1.45;
          color: var(--color-fg);
        }

        /* 03 */
        .s03 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s03-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 64px;
        }
        .s03-cell img {
          max-width: 320px;
          max-height: 320px;
          object-fit: contain;
        }
        .s03-cap {
          position: absolute;
          bottom: 28px;
          left: 36px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .s03-a {
          background: var(--color-bg-dark);
        }
        .s03-a .s03-cap {
          color: rgba(240, 237, 230, 0.38);
        }
        .s03-b {
          background: #f0ede6;
        }
        .s03-b .s03-cap {
          color: rgba(10, 10, 10, 0.4);
        }
        .s03-c {
          background: #161616;
        }
        .s03-c .s03-cap {
          color: rgba(240, 237, 230, 0.38);
        }
        .s03-d {
          background: var(--color-primary);
        }
        .s03-d .s03-cap {
          color: rgba(240, 237, 230, 0.4);
        }

        /* 04 */
        .s04 {
          display: grid;
          grid-template-columns: 1fr 440px;
        }
        .s04-sw-wrap {
          display: grid;
          grid-auto-columns: 1fr;
          grid-auto-flow: column;
        }
        .s04-sw {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 28px 22px;
        }
        .s04-role {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          opacity: 0.45;
        }
        .s04-name {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 700;
          margin-top: 4px;
        }
        .s04-hex {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          letter-spacing: 0.06em;
          margin-top: 3px;
        }
        .s04-r {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 64px 48px 64px 40px;
          border-left: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s04-grad {
          height: 220px;
          border-radius: 4px;
          margin-bottom: 40px;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
        }
        .s04-grad-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          margin-bottom: 32px;
        }
        .s04-pair {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }
        .s04-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .s04-pt {
          font-family: var(--font-body);
          font-size: 14px;
          color: rgba(240, 237, 230, 0.38);
        }

        /* 05 */
        .s05 {
          display: grid;
          grid-template-columns: 460px 1fr 480px;
        }
        .s05-l {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 80px 48px 80px 72px;
          border-right: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s05-fn {
          font-family: var(--font-display);
          font-size: 80px;
          font-weight: 700;
          line-height: 0.92;
          letter-spacing: -0.02em;
        }
        .s05-fn2 {
          font-family: var(--font-body);
          font-size: 36px;
          font-weight: 400;
          line-height: 0.92;
          letter-spacing: -0.01em;
          margin-top: 16px;
          color: rgba(240, 237, 230, 0.38);
        }
        .s05-fw {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-accent);
          margin-top: 20px;
        }
        .s05-c {
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary);
          overflow: hidden;
        }
        .s05-aa {
          font-family: var(--font-display);
          font-size: 480px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.04em;
          color: var(--color-fg);
          opacity: 0.9;
          margin-top: 60px;
        }
        .s05-r {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 80px 72px 80px 48px;
          border-left: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s05-scale-head {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          margin-bottom: 16px;
        }
        .s05-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 13px 0;
          border-top: 1px solid rgba(240, 237, 230, 0.07);
        }
        .s05-rl {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          min-width: 80px;
        }

        /* 06 */
        .s06 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s06-cell {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .s06-a {
          background: var(--color-primary);
        }
        .s06-b {
          background: var(--color-bg-dark);
        }
        .s06-c {
          background: var(--color-accent);
        }
        .s06-d {
          background: #161616;
        }
        .s06-e {
          background: var(--color-secondary);
        }
        .s06-f {
          background: var(--color-bg-dark);
        }
        .gfx-grid-bg {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(240, 237, 230, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240, 237, 230, 0.07) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .gfx-stripe-bg {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            -45deg,
            rgba(240, 237, 230, 0.06) 0,
            rgba(240, 237, 230, 0.06) 2px,
            transparent 2px,
            transparent 24px
          );
        }

        /* 07 */
        .s07 {
          display: grid;
          grid-template-columns: 1fr 1fr 500px;
          grid-template-rows: 3fr 1fr;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s07-hero {
          grid-row: span 2;
          overflow: hidden;
          background: var(--color-primary);
        }
        .s07-sub {
          overflow: hidden;
          background: var(--color-secondary);
        }
        .s07-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 56px 52px;
          background: var(--color-bg-dark);
        }
        .s07-copy-q {
          font-family: var(--font-display);
          font-size: 48px;
          font-weight: 700;
          line-height: 1.05;
          letter-spacing: -0.02em;
        }
        .s07-copy-sub {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.38);
          margin-top: 24px;
        }
        .s07-accent {
          background: var(--color-accent);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 28px 36px;
        }

        /* 08 */
        .s08 {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          grid-template-rows: 1fr 380px;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s08-main {
          grid-row: span 2;
          position: relative;
          overflow: hidden;
          background: var(--color-primary);
        }
        .s08-ov {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 64px 64px 56px;
          background: linear-gradient(to top, rgba(10, 10, 10, 0.88) 0%, transparent 100%);
        }
        .s08-ov-name {
          font-family: var(--font-display);
          font-size: 72px;
          font-weight: 700;
          line-height: 0.9;
          letter-spacing: -0.03em;
          color: var(--color-fg);
        }
        .s08-det {
          overflow: hidden;
          background: var(--color-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .s08-copy {
          background: var(--color-accent);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 36px 44px;
        }

        /* 09 */
        .s09 {
          display: grid;
          grid-template-rows: 330px 1fr;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s09-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
        }
        .s09-th,
        .s09-hero {
          overflow: hidden;
          position: relative;
          background: var(--color-primary);
        }
        .s09-cap {
          position: absolute;
          bottom: 14px;
          left: 18px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.5);
        }
        .s09-hero-ov {
          position: absolute;
          bottom: 56px;
          left: 72px;
        }
        .s09-hero-ov-t {
          font-family: var(--font-display);
          font-size: 64px;
          font-weight: 700;
          line-height: 0.92;
          letter-spacing: -0.03em;
          color: var(--color-fg);
        }
        .s09-hero-ov-s {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(240, 237, 230, 0.55);
          margin-top: 10px;
        }

        /* 10 */
        .s10 {
          display: grid;
          grid-template-columns: 420px 1fr 420px;
          grid-template-rows: 1fr 240px;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s10-phone,
        .s10-desk {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d0d0d;
        }
        .s10-merch {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 2px;
          background: var(--color-bg-dark);
        }
        .s10-mt {
          overflow: hidden;
          background: var(--color-primary);
        }
        .s10-social {
          grid-column: span 3;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2px;
        }
        .s10-sc {
          overflow: hidden;
          background: var(--color-primary);
        }
        .s10-sc-fill {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-primary);
        }
        .s10-sc-text {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.02em;
          opacity: 0.35;
          color: var(--color-fg);
        }

        /* simple CSS phone + desktop (lightweight port) */
        .phone {
          width: 220px;
          height: 440px;
          background: #1c1c1e;
          border-radius: 40px;
          border: 2px solid #333;
          position: relative;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.72);
        }
        .phone-notch {
          width: 80px;
          height: 24px;
          background: #1c1c1e;
          border-radius: 0 0 14px 14px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }
        .phone-scr {
          position: absolute;
          inset: 0;
          background: var(--color-primary);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 28px;
        }
        .phone-scr-brand {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--color-fg);
          text-align: center;
        }
        .phone-scr-tag {
          font-family: var(--font-body);
          font-size: 11px;
          line-height: 1.4;
          color: rgba(240, 237, 230, 0.38);
          text-align: center;
        }
        .phone-scr-btn {
          margin-top: 20px;
          background: var(--color-accent);
          padding: 9px 22px;
          border-radius: 22px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #0a0a0a;
        }
        .desktop {
          width: 660px;
          height: 414px;
          background: #1c1c1e;
          border-radius: 12px;
          border: 2px solid #2c2c2e;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
        }
        .desktop-bar {
          height: 32px;
          background: #2a2a2c;
          display: flex;
          align-items: center;
          padding: 0 14px;
          gap: 7px;
        }
        .desktop-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .desktop-scr {
          background: #0a0a0a;
          height: calc(100% - 32px);
          padding: 20px;
        }
        .desktop-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .desktop-logo {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--color-fg);
        }
        .desktop-links {
          display: flex;
          gap: 16px;
        }
        .desktop-link {
          height: 6px;
          width: 38px;
          background: rgba(240, 237, 230, 0.38);
          border-radius: 3px;
        }
        .desktop-hero-block {
          height: 140px;
          background: var(--color-primary);
          border-radius: 6px;
          position: relative;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .desktop-hero-txt {
          position: absolute;
          bottom: 14px;
          left: 16px;
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--color-fg);
        }
        .desktop-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .desktop-card {
          height: 58px;
          border-radius: 4px;
        }
      `}</style>

      <div className="bk-toolbar">
        <div className="bk-title">
          <div className="name">{brand.brand_name}</div>
          <div className="sub">{brand.tagline}</div>
        </div>
        <div className="bk-actions">
          {result.brand_kit_zip_url && (
            <a
              href={result.brand_kit_zip_url}
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm text-white/80 hover:bg-white/10"
              download
            >
              Download kit (.zip)
            </a>
          )}
          <Button variant="outline" onClick={exportLogoPng}>
            Export logo PNG (300dpi)
          </Button>
          <Button onClick={exportPdf}>Export PDF</Button>
        </div>
      </div>

      <div className="mt-5 bk-stage" ref={containerRef}>
        <div className="bk-inner" style={{ transform: `scale(${scale})` }}>
          {idx === 0 && (
            <section className="slide s01">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">01 —</span>
              <div className="s01-l">
                <div className="s01-eye">Brand Identity System</div>
                <div className="s01-name">{brand.brand_name}</div>
                {brand.tagline && <p className="s01-tag">{brand.tagline}</p>}
                <div className="s01-foot">
                  <span>Brand Kit — Version 1.0</span>
                  <span>{new Date().toISOString().slice(0, 10)}</span>
                </div>
              </div>
              <div className="s01-r">
                {heroImg ? <img src={heroImg} alt="" className="fill" /> : (
                  <div className="s01-r-logo">
                    <img src={primaryLogo} alt="" />
                  </div>
                )}
              </div>
            </section>
          )}

          {idx === 1 && (
            <section className="slide s02">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">02 —</span>
              <div className="s02-l">
                <div className="s02-hdg">Brand Essence</div>
                <p className="s02-sum">{persona.summary}</p>
                {persona.aesthetic_keywords?.length > 0 && (
                  <div style={{ marginTop: 32, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 2.0, color: "rgba(240,237,230,0.38)" }}>
                    {persona.aesthetic_keywords.join(" · ")}
                  </div>
                )}
              </div>
              <div className="s02-c">
                {heroImg && <img src={heroImg} alt="" className="fill" />}
              </div>
              <div className="s02-r">
                <div className="s02-ph">Brand Pillars</div>
                {[
                  persona.psychographics?.[0],
                  persona.interests?.[0],
                  persona.purchase_signals?.[0],
                ]
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((pillar, i) => (
                    <div className="s02-pillar" key={`${pillar}-${i}`}>
                      <div className="s02-pn">{`0${i + 1}`}</div>
                      <div className="s02-pt">{pillar}</div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {idx === 2 && (
            <section className="slide s03">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">03 —</span>
              <div className="s03-cell s03-a">
                <img src={primaryLogo} alt="" />
                <span className="s03-cap">Primary</span>
              </div>
              <div className="s03-cell s03-b">
                <img src={monoDark} alt="" />
                <span className="s03-cap">Monochrome — Light Ground</span>
              </div>
              <div className="s03-cell s03-c">
                <img src={monoLight} alt="" />
                <span className="s03-cap">Monochrome — Dark Ground</span>
              </div>
              <div className="s03-cell s03-d">
                <img src={onBrand} alt="" />
                <span className="s03-cap">On Brand Color</span>
              </div>
            </section>
          )}

          {idx === 3 && (
            <section className="slide s04">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">04 —</span>
              <div className="s04-sw-wrap">
                {(brand.palette ?? []).map((c) => (
                  <div className="s04-sw" key={`${c.role}-${c.hex}`} style={{ background: c.hex, color: "rgba(10,10,10,0.85)" }}>
                    <div className="s04-role">{c.role}</div>
                    <div className="s04-name">{c.name}</div>
                    <div className="s04-hex">{c.hex.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div className="s04-r">
                <div className="s04-grad" />
                <div className="s04-grad-label">Primary × Accent Gradient</div>
                <div className="s04-pair">
                  <div className="s04-dot" style={{ background: "var(--color-primary)" }} />
                  <div className="s04-pt">Primary — dominant structural tone</div>
                </div>
                <div className="s04-pair">
                  <div className="s04-dot" style={{ background: "var(--color-accent)" }} />
                  <div className="s04-pt">Accent — energy, CTAs, highlights</div>
                </div>
                <div className="s04-pair">
                  <div className="s04-dot" style={{ background: "var(--color-secondary)" }} />
                  <div className="s04-pt">Secondary — supporting surfaces</div>
                </div>
              </div>
            </section>
          )}

          {idx === 4 && (
            <section className="slide s05">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">05 —</span>
              <div className="s05-l">
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", marginBottom: 32 }}>
                  Display Type
                </div>
                <div className="s05-fn">{brand.typography.display.family}</div>
                <div style={{ marginTop: 32, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)" }}>
                  Body Type
                </div>
                <div className="s05-fn2">{brand.typography.body.family}</div>
                <div className="s05-fw">700 Bold — 400 Regular — 300 Light</div>
              </div>
              <div className="s05-c">
                <span className="s05-aa">Aa</span>
              </div>
              <div className="s05-r">
                <div className="s05-scale-head">Type Scale</div>
                <div className="s05-row">
                  <span className="s05-rl">Hero</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 1 }}>{brand.brand_name[0]}g</span>
                </div>
                <div className="s05-row">
                  <span className="s05-rl">H1</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 64, lineHeight: 1 }}>{brand.brand_name}</span>
                </div>
                <div className="s05-row">
                  <span className="s05-rl">H2</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 40, lineHeight: 1.1 }}>Brand Voice</span>
                </div>
                <div className="s05-row">
                  <span className="s05-rl">Body</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 400, lineHeight: 1.5 }}>
                    {persona.summary?.slice(0, 70) ?? "Body text at 18px, line-height 1.5."}
                  </span>
                </div>
                <div className="s05-row">
                  <span className="s05-rl">Caption</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)" }}>
                    12px — Mono Uppercase
                  </span>
                </div>
              </div>
            </section>
          )}

          {idx === 5 && (
            <section className="slide s06">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">06 —</span>
              <div className="s06-cell s06-a">
                <svg width="380" height="380" viewBox="0 0 380 380">
                  <circle cx="190" cy="190" r="180" fill="none" stroke="rgba(240,237,230,0.15)" strokeWidth="1" />
                  <circle cx="190" cy="190" r="130" fill="none" stroke="rgba(240,237,230,0.25)" strokeWidth="1" />
                  <circle cx="190" cy="190" r="80" fill="none" stroke="rgba(240,237,230,0.5)" strokeWidth="2" />
                  <circle cx="190" cy="190" r="24" fill="var(--color-fg)" opacity="0.9" />
                </svg>
              </div>
              <div className="s06-cell s06-b">
                <div className="gfx-grid-bg" />
                <svg width="240" height="240" viewBox="0 0 240 240" style={{ position: "relative", zIndex: 1 }}>
                  <rect x="40" y="40" width="160" height="160" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
                  <line x1="120" y1="0" x2="120" y2="240" stroke="var(--color-accent)" strokeWidth="1" opacity="0.4" />
                  <line x1="0" y1="120" x2="240" y2="120" stroke="var(--color-accent)" strokeWidth="1" opacity="0.4" />
                  <circle cx="120" cy="120" r="6" fill="var(--color-accent)" />
                </svg>
              </div>
              <div className="s06-cell s06-c">
                <span style={{ fontFamily: "var(--font-display)", fontSize: 340, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em", color: "rgba(10,10,10,0.18)" }}>
                  {brand.brand_name[0]?.toUpperCase()}
                </span>
                <div style={{ position: "absolute", bottom: 32, left: 36, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(10,10,10,0.55)" }}>
                  Graphic Mark
                </div>
              </div>
              <div className="s06-cell s06-d">
                <div className="gfx-stripe-bg" />
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: "relative", zIndex: 1 }}>
                  <polygon points="100,10 190,190 10,190" fill="none" stroke="rgba(240,237,230,0.5)" strokeWidth="2" />
                  <polygon points="100,50 160,170 40,170" fill="rgba(240,237,230,0.08)" />
                  <circle cx="100" cy="100" r="8" fill="var(--color-accent)" />
                </svg>
              </div>
              <div className="s06-cell s06-e" style={{ flexDirection: "column", alignItems: "flex-start", padding: 48 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-bg-dark)", marginBottom: 24 }}>
                  Aesthetic Direction
                </div>
                {(persona.aesthetic_keywords ?? []).slice(0, 6).map((kw) => (
                  <div key={kw} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(10,10,10,0.5)", marginBottom: 10 }}>
                    {kw}
                  </div>
                ))}
              </div>
              <div className="s06-cell s06-f">
                <svg width="320" height="320" viewBox="0 0 320 320">
                  {Array.from({ length: 8 }).map((_, row) =>
                    Array.from({ length: 8 }).map((__, col) => (
                      <circle
                        key={`${row}-${col}`}
                        cx={col * 44 + 16}
                        cy={row * 44 + 16}
                        r={3 + ((row + col) % 3)}
                        fill="var(--color-fg)"
                        opacity={0.1 + (((row + col) % 5) * 0.12)}
                      />
                    ))
                  )}
                </svg>
              </div>
            </section>
          )}

          {idx === 6 && (
            <section className="slide s07">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">07 —</span>
              <div className="s07-hero">{mockups[0]?.url ? <img src={mockups[0].url} alt="" className="fill" /> : <img src={heroImg} alt="" className="fill" />}</div>
              <div className="s07-sub">{mockups[1]?.url ? <img src={mockups[1].url} alt="" className="fill" /> : <img src={heroImg} alt="" className="fill" />}</div>
              <div className="s07-copy">
                <div className="s07-copy-q">"Obsessively<br />considered.<br />Every detail."</div>
                {brand.voice?.examples?.[0] && <div className="s07-copy-sub">{brand.voice.examples[0].slice(0, 80)}</div>}
              </div>
              <div className="s07-accent">
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(10,10,10,0.6)" }}>
                  {persona.age_range} · {(persona.location_archetype ?? "").slice(0, 40)}
                </div>
              </div>
            </section>
          )}

          {idx === 7 && (
            <section className="slide s08">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">08 —</span>
              <div className="s08-main">
                {packagingImg && <img src={packagingImg} alt="" className="fill" />}
                <div className="s08-ov">
                  <div className="s08-ov-name">{brand.brand_name}</div>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(240,237,230,0.38)", marginTop: 12 }}>
                    Packaging System — v1.0
                  </div>
                </div>
              </div>
              <div className="s08-det">
                {packagingDetail?.startsWith("http") ? <img src={packagingDetail} alt="" className="fill" /> : <img src={onBrand} alt="" className="hold" />}
              </div>
              <div className="s08-copy">
                <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em", color: "#0a0a0a" }}>
                  Every<br />touchpoint<br />matters.
                </div>
                <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(10,10,10,0.55)", marginTop: 8 }}>
                  Material, form, finish
                </div>
              </div>
            </section>
          )}

          {idx === 8 && (
            <section className="slide s09">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">09 —</span>
              <div className="s09-strip">
                {[0, 1, 2].map((i) => (
                  <div className="s09-th" key={i}>
                    <img src={editorialStrip[i] ?? editorialHero} alt="" className="fill" />
                    <span className="s09-cap">{`Editorial 0${i + 1} —`}</span>
                  </div>
                ))}
              </div>
              <div className="s09-hero">
                <img src={editorialHero} alt="" className="fill" />
                <div className="s09-hero-ov">
                  <div className="s09-hero-ov-t">
                    Art direction
                    <br />
                    by {brand.brand_name}.
                  </div>
                  <div className="s09-hero-ov-s">
                    {(persona.aesthetic_keywords?.[0] ?? "").slice(0, 22)} · editorial
                  </div>
                </div>
              </div>
            </section>
          )}

          {idx === 9 && (
            <section className="slide s10">
              <span className="bm">{brand.brand_name}</span>
              <span className="sn">10 —</span>
              <div className="s10-phone">
                <div className="phone">
                  <div className="phone-notch" />
                  <div className="phone-scr">
                    <div className="phone-scr-brand">{brand.brand_name}</div>
                    <div className="phone-scr-tag">{(brand.tagline ?? "").slice(0, 60)}</div>
                    <div className="phone-scr-btn">Shop Now</div>
                  </div>
                </div>
              </div>
              <div className="s10-desk">
                <div className="desktop">
                  <div className="desktop-bar">
                    <div className="desktop-dot" style={{ background: "#ff5f57" }} />
                    <div className="desktop-dot" style={{ background: "#febc2e" }} />
                    <div className="desktop-dot" style={{ background: "#28c840" }} />
                  </div>
                  <div className="desktop-scr">
                    <div className="desktop-nav">
                      <div className="desktop-logo">{brand.brand_name}</div>
                      <div className="desktop-links">
                        <div className="desktop-link" />
                        <div className="desktop-link" />
                        <div className="desktop-link" style={{ opacity: 0.4 }} />
                      </div>
                    </div>
                    <div className="desktop-hero-block">
                      <div className="desktop-hero-txt">{brand.brand_name}</div>
                    </div>
                    <div className="desktop-cards">
                      <div className="desktop-card" style={{ background: "var(--color-primary)", opacity: 0.8 }} />
                      <div className="desktop-card" style={{ background: "var(--color-accent)", opacity: 0.6 }} />
                      <div className="desktop-card" style={{ background: "var(--color-secondary)", opacity: 0.7 }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="s10-merch">
                <div className="s10-mt">
                  {mockups[0]?.url ? <img src={mockups[0].url} alt="" className="fill" /> : <img src={heroImg} alt="" className="fill" />}
                </div>
                <div className="s10-mt">
                  {mockups[1]?.url ? <img src={mockups[1].url} alt="" className="fill" /> : <img src={heroImg} alt="" className="fill" />}
                </div>
              </div>
              <div className="s10-social">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div className="s10-sc" key={i}>
                    {s10Social[i] ? (
                      <img src={s10Social[i]} alt="" className="fill" />
                    ) : (
                      <div className="s10-sc-fill">
                        <span className="s10-sc-text">{brand.brand_name[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="bk-nav">
        <Button variant="outline" onClick={prev} disabled={idx === 0}>
          Prev
        </Button>
        <div className="bk-dots" aria-label="Slide navigation">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              className={`bk-dot ${i === idx ? "active" : ""}`}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <Button variant="outline" onClick={next} disabled={idx === slideCount - 1}>
          Next
        </Button>
      </div>
    </div>
  );
}

