<<<<<<< HEAD
import { PhoneApp } from "@/components/phone-app";
import { Icon, LogoMark } from "@/components/icons";
=======
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
>>>>>>> 03b76d1a77f4a60a753e8e2ed6da9ac14d5ff511

export default function HomePage() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [productIdea, setProductIdea] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string>("");

  useEffect(() => {
    let id = localStorage.getItem("user_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("user_id", id);
    }
    userIdRef.current = id;
  }, []);

  const prefillDemo = () => {
    setHandle("@demo");
    setProductIdea("minimalist streetwear brand");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.replace(/^@/, ""),
          product_idea: productIdea,
          platform: "instagram",
          user_id: userIdRef.current,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Server error ${res.status}`);
      }

      const { job_id } = await res.json();
      router.push(`/jobs/${job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsLoading(false);
    }
  };

  return (
<<<<<<< HEAD
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
        <button style={{ padding: "9px 20px", borderRadius: 10, border: "1px solid rgba(210,190,255,0.25)", background: "rgba(210,190,255,0.08)", color: "rgba(210,190,255,0.9)", fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", letterSpacing: "-0.1px", display: "flex", alignItems: "center", gap: 7 }}>
          get early access <Icon name="arrow" size={12} color="rgba(210,190,255,0.7)"/>
        </button>
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
            <button style={{ padding: "12px 22px", borderRadius: 12, border: "none", background: "rgba(210,190,255,0.9)", color: "#0c0b0f", fontFamily: "var(--font-sans), Inter, sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.1px" }}>
              try the demo <Icon name="arrow" size={13} color="#0c0b0f"/>
            </button>
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
=======
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-10">
        <div className="space-y-2 text-center">
          <h1 className="text-5xl font-bold tracking-tight">Stencil</h1>
          <p className="text-sm text-muted-foreground">
            Turn your idea into a brand in 90 seconds
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="handle"
              className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              Creator handle
            </label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourcreatorhandle"
              required
              disabled={isLoading}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="product_idea"
              className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              Product idea
            </label>
            <Textarea
              id="product_idea"
              value={productIdea}
              onChange={(e) => setProductIdea(e.target.value)}
              placeholder="What are you building?"
              required
              disabled={isLoading}
              className="min-h-[120px] resize-none"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !handle.trim() || !productIdea.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate brand"
            )}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={prefillDemo}
            disabled={isLoading}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Try demo
          </button>
>>>>>>> 03b76d1a77f4a60a753e8e2ed6da9ac14d5ff511
        </div>
      </div>
    </div>
  );
}
