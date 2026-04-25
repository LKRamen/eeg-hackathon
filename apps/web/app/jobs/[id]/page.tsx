"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import type { Job, JobStatus } from "@halo/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandKitSlides } from "@/components/BrandKitSlides";
import BrandAssetsSection from "@/components/BrandAssetsSection";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS: { status: JobStatus; label: string }[] = [
  { status: "scraping",     label: "Scraping" },
  { status: "synthesizing", label: "Synthesizing" },
  { status: "generating",   label: "Generating" },
  { status: "matching",     label: "Matching" },
  { status: "exporting",    label: "Exporting" },
  { status: "done",         label: "Done" },
];

const STATUS_IDX: Record<JobStatus, number> = {
  queued:       -1,
  scraping:      0,
  synthesizing:  1,
  generating:    2,
  matching:      3,
  exporting:     4,
  done:          5,
  error:         5,
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ status }: { status: JobStatus }) {
  const idx = STATUS_IDX[status] ?? -1;

  return (
    <nav className="flex items-start justify-center pb-12 pt-10">
      {STEPS.map(({ status: s, label }, i) => {
        const active = idx === i;
        const done   = idx > i;
        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  active ? "bg-primary shadow-[0_0_6px] shadow-primary/60"
                  : done  ? "bg-zinc-400"
                          : "bg-zinc-800"
                )}
              />
              <span
                className={cn(
                  "mt-2 text-[9px] uppercase tracking-widest",
                  active ? "text-primary"
                  : done  ? "text-zinc-400"
                          : "text-zinc-700"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-3 h-px w-8 flex-shrink-0",
                  done || active ? "bg-zinc-700" : "bg-zinc-900"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl">
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobPage({ params }: { params: { id: string } }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const [toast, setToast] = useState<string | null>(null);

  const { data: job, error: fetchError } = useSWR<Job>(
    `${apiUrl}/jobs/${params.id}`,
    fetcher,
    {
      refreshInterval: (data) =>
        data?.status === "done" || data?.status === "error" ? 0 : 2000,
    }
  );

  // Inject Google Fonts when typography data arrives (use google_url when available).
  useEffect(() => {
    const typo = job?.result?.brand_assets?.typography;
    if (!typo) return;
    const urls = [typo.display.google_url, typo.body.google_url].filter(Boolean);
    urls.forEach((href) => {
      if (!href) return;
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }, [job?.result]);

  useEffect(() => {
    if (!job?.result) return;
    console.log("social_kit raw", job.result.brand_assets?.social_kit);
    console.log("social_kit length", job.result.brand_assets?.social_kit?.length ?? "undefined");
  }, [job?.result]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Network error (SWR level, not a job error)
  if (fetchError) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-red-400">Could not load job.</p>
      </main>
    );
  }

  // Initial load
  if (!job) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-600 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full px-6 pb-20">
      <div className="mx-auto w-full max-w-[1400px]">
        <Timeline status={job.status} />

        {/* Error state */}
        {job.status === "error" && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {job.error_message ?? "Something went wrong."}
          </div>
        )}

        {/* In-progress state */}
        {job.status !== "done" && job.status !== "error" && (
          <p className="text-center text-sm text-zinc-600">Working on it…</p>
        )}

        {/* Results (Preview Mode) */}
        {job.status === "done" && job.result && (
          <div className="animate-in fade-in duration-700">
            <BrandKitSlides result={job.result} className="w-full" />
            <BrandAssetsSection result={job.result} />

            {/* Keep secondary actions available but out of the slide canvas */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {job.result.brand_guide_pdf_url && (
                <a
                  href={job.result.brand_guide_pdf_url}
                  download
                  className="inline-flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 text-sm text-white/80 hover:bg-white/10"
                >
                  Download rendered guide (URL)
                </a>
              )}
              <Button variant="outline" onClick={() => showToast("Sent to 3 manufacturers")}>
                Request manufacturing quote
              </Button>
              <Button variant="outline" onClick={() => showToast("Intro request sent")}>
                Connect with agency
              </Button>
            </div>
          </div>
        )}

        {toast && <Toast message={toast} />}
      </div>
    </main>
  );
}
