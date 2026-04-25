"use client";

import { useEffect, useRef, useState } from "react";
import Konva from "konva";

interface MockupCanvasProps {
  mockupUrl: string;
  logoUrl: string;
  brandColorHex: string;
  label: string;
  /** Canvas display size in CSS pixels — actual export is 3x (300dpi equivalent). */
  displaySize?: number;
}

interface LogoState {
  x: number;
  y: number;
  scale: number;
}

const DISPLAY_SIZE = 480;
const EXPORT_SCALE = 3; // 3× → ~300dpi

export function MockupCanvas({
  mockupUrl,
  logoUrl,
  brandColorHex,
  label,
  displaySize = DISPLAY_SIZE,
}: MockupCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [logoState, setLogoState] = useState<LogoState>({
    x: displaySize * 0.15,
    y: displaySize * 0.15,
    scale: 0.25,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const stage = new Konva.Stage({
      container: containerRef.current,
      width: displaySize,
      height: displaySize,
    });
    stageRef.current = stage;

    const layer = new Konva.Layer();
    stage.add(layer);

    // Load mockup background
    const bgImage = new window.Image();
    bgImage.crossOrigin = "anonymous";
    bgImage.src = mockupUrl;
    bgImage.onload = () => {
      const bg = new Konva.Image({
        image: bgImage,
        x: 0,
        y: 0,
        width: displaySize,
        height: displaySize,
        listening: false,
      });
      layer.add(bg);

      // Load logo overlay
      const logoImage = new window.Image();
      logoImage.crossOrigin = "anonymous";
      logoImage.src = logoUrl;
      logoImage.onload = () => {
        const logoSize = displaySize * logoState.scale;
        const logo = new Konva.Image({
          image: logoImage,
          x: logoState.x,
          y: logoState.y,
          width: logoSize,
          height: logoSize,
          draggable: true,
        });

        // Scale handle on scroll
        logo.on("wheel", (e) => {
          e.evt.preventDefault();
          const factor = e.evt.deltaY > 0 ? 0.95 : 1.05;
          logo.scaleX(logo.scaleX() * factor);
          logo.scaleY(logo.scaleY() * factor);
          layer.batchDraw();
        });

        // Update state on drag end for export
        logo.on("dragend", () => {
          setLogoState((prev) => ({
            ...prev,
            x: logo.x(),
            y: logo.y(),
          }));
        });

        // Transform handles
        const tr = new Konva.Transformer({
          nodes: [logo],
          keepRatio: true,
          enabledAnchors: ["top-left", "top-right", "bottom-left", "bottom-right"],
          borderStroke: brandColorHex,
          anchorFill: brandColorHex,
          anchorStroke: "#fff",
        });

        layer.add(logo, tr);
        layer.draw();
        setReady(true);
      };
    };

    return () => {
      stage.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockupUrl, logoUrl, displaySize]);

  const handleExport = () => {
    if (!stageRef.current) return;

    // Export at 3× pixel ratio for ~300dpi
    const dataUrl = stageRef.current.toDataURL({
      pixelRatio: EXPORT_SCALE,
      mimeType: "image/png",
    });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${label}-mockup-300dpi.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-xl overflow-hidden border border-white/10 bg-zinc-900"
        style={{ width: displaySize, height: displaySize }}
      >
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            Loading…
          </div>
        )}
        <div ref={containerRef} />
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Drag to reposition · Scroll to resize · Handles to transform</span>
        <button
          onClick={handleExport}
          className="ml-auto px-3 py-1.5 rounded-md bg-white text-black font-medium text-xs hover:bg-zinc-100 transition-colors"
        >
          Export 300dpi PNG
        </button>
      </div>
    </div>
  );
}
