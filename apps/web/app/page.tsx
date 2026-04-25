"use client";

import { useEffect, useRef } from "react";
import { CSSPhoneMockup } from "../components/phone-css-mockup";

const PHRASE = "grow with stencil";
const MARQUEE_ITEMS = Array.from({ length: 8 }, (_, index) => `${PHRASE} ${index}`);
const MARQUEE_ROWS = [
  { id: "far-top", rowClass: "marquee-row marquee-row-far-top", trackClass: "marquee-track marquee-track-fast", wordClass: "marquee-word" },
  { id: "top", rowClass: "marquee-row marquee-row-top", trackClass: "marquee-track", wordClass: "marquee-word" },
  { id: "mid", rowClass: "marquee-row marquee-row-mid", trackClass: "marquee-track marquee-track-slower", wordClass: "marquee-word marquee-word-filled" },
  { id: "bottom", rowClass: "marquee-row marquee-row-bottom", trackClass: "marquee-track", wordClass: "marquee-word" },
  { id: "far-bottom", rowClass: "marquee-row marquee-row-far-bottom", trackClass: "marquee-track marquee-track-fast", wordClass: "marquee-word" },
] as const;

export default function HomePage() {
  const pointerRef = useRef({ x: 0, y: 0 });
  const phoneHoverRef = useRef(false);

  useEffect(() => {
    const reset = () => { pointerRef.current.x = 0; pointerRef.current.y = 0; };
    const onMove = (e: PointerEvent) => {
      if (phoneHoverRef.current) { reset(); return; }
      pointerRef.current.x = e.clientX / window.innerWidth - 0.5;
      pointerRef.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <main className="marquee-page">
      <div id="stencil-bg" />
      <div className="marquee-stage">
        <div className="marquee-backdrop" aria-hidden="true">
          <div className="marquee-orb">
            {MARQUEE_ROWS.map((row) => (
              <div className={row.rowClass} key={row.id}>
                <div className={row.trackClass}>
                  {[0, 1].map((copyIndex) => (
                    <div className="marquee-segment" key={`${row.id}-${copyIndex}`}>
                      {MARQUEE_ITEMS.map((_, itemIndex) => (
                        <span className={row.wordClass} key={`${row.id}-${copyIndex}-${itemIndex}`}>
                          {PHRASE}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="marquee-phone-wrap"
          onPointerEnter={() => {
            phoneHoverRef.current = true;
            pointerRef.current.x = 0;
            pointerRef.current.y = 0;
          }}
          onPointerLeave={() => {
            phoneHoverRef.current = false;
          }}
        >
          <CSSPhoneMockup pointerRef={pointerRef} phoneHoverRef={phoneHoverRef} />
        </div>
      </div>
    </main>
  );
}
