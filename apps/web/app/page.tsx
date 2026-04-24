"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
        </div>
      </div>
    </main>
  );
}
