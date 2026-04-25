"use client";

import { MutableRefObject, useEffect, useRef } from "react";
import { PhoneAppScreen } from "./phone-app";

export function CSSPhoneMockup({
  pointerRef,
  phoneHoverRef,
}: {
  pointerRef: MutableRefObject<{ x: number; y: number }>;
  phoneHoverRef: MutableRefObject<boolean>;
}) {
  const floatRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ tx: 0, ty: 0, raf: 0, t0: 0 });

  useEffect(() => {
    const s = stateRef.current;
    s.t0 = performance.now();

    function lerp(a: number, b: number, k: number) {
      return a + (b - a) * k;
    }

    function tick(now: number) {
      const elapsed = (now - s.t0) / 1000;
      const floatY = Math.sin(elapsed * 0.65) * 10;

      const target = phoneHoverRef.current
        ? { x: 0, y: 0 }
        : pointerRef.current;

      s.tx = lerp(s.tx, target.y * -6, 0.055);
      s.ty = lerp(s.ty, target.x * 9, 0.055);

      if (floatRef.current) {
        floatRef.current.style.transform = `translateY(${floatY}px)`;
      }
      if (tiltRef.current) {
        tiltRef.current.style.transform = `perspective(1200px) rotateX(${s.tx}deg) rotateY(${s.ty}deg)`;
      }

      s.raf = requestAnimationFrame(tick);
    }

    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [pointerRef, phoneHoverRef]);

  return (
    <div ref={floatRef} style={{ willChange: "transform" }}>
      <div
        ref={tiltRef}
        style={{
          willChange: "transform",
          filter:
            "drop-shadow(0 24px 56px rgba(0,0,0,0.65)) drop-shadow(0 0 48px rgba(140,100,255,0.28))",
        }}
      >
        <div className="phone-shell-scaler">
          <div className="phone-shell">
            <div className="dynamic-island" />
            <div className="phone-screen">
              <PhoneAppScreen />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
