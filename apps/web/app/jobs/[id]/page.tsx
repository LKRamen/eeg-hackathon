"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import type { Job, JobStatus, BrandResult } from "@halo/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
      {children}
    </p>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-zinc-800 bg-zinc-900 px-3 py-0.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}

function Divider() {
  return <div className="border-t border-zinc-900" />;
}

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

// ─── Persona ──────────────────────────────────────────────────────────────────

function PersonaSection({ persona }: { persona: BrandResult["persona"] }) {
  return (
    <section className="space-y-4">
      <SectionLabel>Persona</SectionLabel>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-3xl font-bold">{persona.name}</h2>
        <span className="text-sm text-zinc-400">{persona.age_range}</span>
        <span className="text-sm text-zinc-600">{persona.location_archetype}</span>
      </div>
      <p className="max-w-prose text-sm leading-relaxed text-zinc-300">
        {persona.summary}
      </p>
      <div className="flex flex-wrap gap-2">
        {persona.interests.map((t) => <Chip key={t}>{t}</Chip>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {persona.psychographics.map((t) => <Chip key={t}>{t}</Chip>)}
      </div>
    </section>
  );
}

// ─── Brand ────────────────────────────────────────────────────────────────────

function BrandSection({
  brand,
}: {
  brand: BrandResult["brand_assets"];
}) {
  const display = brand.typography.display.family;
  const body    = brand.typography.body.family;

  return (
    <section className="space-y-10">
      {/* Name + tagline */}
      <div>
        <SectionLabel>Brand</SectionLabel>
        <h1
          className="text-5xl font-bold leading-tight"
          style={{ fontFamily: `'${display}', system-ui, sans-serif` }}
        >
          {brand.brand_name}
        </h1>
        <p className="mt-2 text-lg text-zinc-400">{brand.tagline}</p>
      </div>

      {/* Logo */}
      <div>
        <SectionLabel>Logo</SectionLabel>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brand.logo_url}
          alt={`${brand.brand_name} logo`}
          width={256}
          height={256}
          className="rounded-lg"
        />
      </div>

      {/* Palette */}
      <div>
        <SectionLabel>Palette</SectionLabel>
        <div className="flex flex-wrap gap-4">
          {brand.palette.map((c) => (
            <div key={c.hex} className="flex flex-col gap-1">
              <div
                className="h-12 w-20 rounded-md border border-zinc-900"
                style={{ backgroundColor: c.hex }}
              />
              <span className="font-mono text-[10px] text-zinc-400">{c.hex}</span>
              <span className="text-[10px] text-zinc-600">{c.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <SectionLabel>Typography</SectionLabel>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] text-zinc-600">
              Display — {brand.typography.display.family}
            </p>
            <p
              className="text-3xl"
              style={{ fontFamily: `'${display}', system-ui, sans-serif` }}
            >
              The quick brown fox
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] text-zinc-600">
              Body — {brand.typography.body.family}
            </p>
            <p
              className="text-base text-zinc-300"
              style={{ fontFamily: `'${body}', system-ui, sans-serif` }}
            >
              The quick brown fox
            </p>
          </div>
        </div>
      </div>

      {/* Voice */}
      <div>
        <SectionLabel>Voice</SectionLabel>
        <p className="mb-5 text-sm text-zinc-400">{brand.voice.tone}</p>
        <div className="mb-5 grid grid-cols-2 gap-6">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-emerald-500">Do</p>
            <ul className="space-y-2">
              {brand.voice.do.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 shrink-0 text-emerald-500">+</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-red-500">{"Don't"}</p>
            <ul className="space-y-2">
              {brand.voice.dont.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-zinc-300">
                  <span className="mt-0.5 shrink-0 text-red-500">−</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="space-y-2">
          {brand.voice.examples.map((ex) => (
            <blockquote
              key={ex}
              className="border-l-2 border-primary pl-4 text-sm italic text-zinc-400"
            >
              &ldquo;{ex}&rdquo;
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Mockups ──────────────────────────────────────────────────────────────────

function MockupsSection({ mockups }: { mockups: BrandResult["brand_assets"]["mockups"] }) {
  return (
    <section>
      <SectionLabel>Mockups</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        {mockups.map((m) => (
          <div key={m.label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.label} className="w-full rounded-lg" />
            <p className="mt-2 text-xs text-zinc-500">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Agency matches ───────────────────────────────────────────────────────────

function AgencySection({ matches }: { matches: BrandResult["agency_matches"] }) {
  return (
    <section>
      <SectionLabel>Agency matches</SectionLabel>
      <div className="space-y-3">
        {matches.map((a) => (
          <div
            key={a.agency_id}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-semibold">{a.name}</span>
              <span className="font-mono text-sm text-primary">
                {Math.round(a.match_score * 100)}%
              </span>
            </div>
            <p className="mb-2 text-sm text-zinc-400">{a.blurb}</p>
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-700">Why: </span>
              {a.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function FooterSection({
  pdfUrl,
  onToast,
}: {
  pdfUrl: string;
  onToast: (msg: string) => void;
}) {
  return (
    <section className="flex flex-wrap items-center gap-3 border-t border-zinc-900 pt-8">
      <a
        href={pdfUrl}
        download
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Download brand guide PDF
      </a>
      <Button variant="outline" onClick={() => onToast("Sent to 3 manufacturers")}>
        Request manufacturing quote
      </Button>
      <Button variant="outline" onClick={() => onToast("Intro request sent")}>
        Connect with agency
      </Button>
    </section>
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

  // Inject Google Fonts when typography data arrives
  useEffect(() => {
    const typo = job?.result?.brand_assets?.typography;
    if (!typo) return;
    [typo.display.family, typo.body.family].forEach((family) => {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });
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
    <main className="mx-auto max-w-2xl px-4 pb-24">
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

      {/* Results */}
      {job.status === "done" && job.result && (
        <div className="animate-in fade-in duration-700 space-y-12">
          <PersonaSection persona={job.result.persona} />
          <Divider />
          <BrandSection brand={job.result.brand_assets} />
          <Divider />
          <MockupsSection mockups={job.result.brand_assets.mockups} />
          <Divider />
          <AgencySection matches={job.result.agency_matches} />
          <Divider />
          <FooterSection pdfUrl={job.result.brand_guide_pdf_url} onToast={showToast} />
        </div>
      )}

      {toast && <Toast message={toast} />}
    </main>
  );
}
