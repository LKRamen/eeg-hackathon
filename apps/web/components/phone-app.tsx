'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, LogoMark } from './icons';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── types (mirror apps/api/models/schemas.py) ────────────────────────────────

interface Color { hex: string; role: string; name: string; }
interface AgencyMatch {
  agency_id: string; name: string; blurb: string;
  specialty_tags: string[]; match_score: number; why: string;
}
interface FontSpec { family: string; google_url: string; }
interface Mockup   { label: string; url: string; }
interface LogoVariants {
  primary: string; mono_dark: string; mono_light: string;
  on_brand: string; avatar: string;
}
interface InfluencerMatch {
  handle: string; platform: string; niche: string;
  follower_tier: string; why: string; content_style: string;
  estimated_reach: string; collab_angle: string;
}
interface BrandResult {
  persona: {
    name: string; age_range: string; summary: string;
    aesthetic_keywords: string[]; voice_traits: string[];
    interests: string[]; psychographics: string[];
  };
  brand_assets: {
    brand_name: string; tagline: string; logo_url: string;
    logo: LogoVariants;
    palette: Color[];
    typography: { display: FontSpec; body: FontSpec; };
    voice: { tone: string; do: string[]; dont: string[]; examples: string[]; };
    mockups: Mockup[];
  };
  agency_matches: AgencyMatch[];
  influencer_matches?: InfluencerMatch[];
  canva_edit_urls?: Record<string, string> | null;
  canva_folder_url?: string | null;
}

type Screen = 'input' | 'generating' | 'results' | 'library';
const FLOW_SCREENS: Screen[] = ['input', 'generating', 'results'];

// ─── saved brands (localStorage) ─────────────────────────────────────────────
interface SavedBrand {
  id: string;
  handle: string;
  savedAt: string;
  result: BrandResult;
}

const STORAGE_KEY = 'stencil_brands';

function loadSaved(): SavedBrand[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveBrand(handle: string, result: BrandResult) {
  const all = loadSaved();
  const entry: SavedBrand = { id: crypto.randomUUID(), handle, savedAt: new Date().toISOString(), result };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...all].slice(0, 50)));
}

// ─── shared micro-components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.3)', marginBottom: 10 }}>
      {children}
    </p>
  );
}

function DownloadChip({ label }: { label: string }) {
  return (
    <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(240,238,244,0.5)', fontSize: 10, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
      <Icon name="package" size={9} color="rgba(255,255,255,0.3)"/> {label}
    </button>
  );
}

// ─── progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, onBack }: { current: Screen; onBack: (s: Screen) => void }) {
  const idx = FLOW_SCREENS.indexOf(current);
  if (idx === -1) return null;
  return (
    <div style={{ position: 'absolute', top: 60, left: 22, right: 22, zIndex: 40, display: 'flex', gap: 5 }}>
      {FLOW_SCREENS.map((s, i) => {
        const done   = i < idx;
        const active = i === idx;
        return (
          <div
            key={s}
            onClick={() => done && onBack(s)}
            style={{ flex: 1, height: 2, borderRadius: 99, background: active ? 'rgba(210,190,255,0.9)' : done ? 'rgba(210,190,255,0.45)' : 'rgba(255,255,255,0.1)', cursor: done ? 'pointer' : 'default', transition: 'background 0.3s' }}
          />
        );
      })}
    </div>
  );
}

// ─── phone chrome ─────────────────────────────────────────────────────────────

function StatusBar() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, pointerEvents: 'none' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: 0.8 }}>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><rect x="0" y="4" width="3" height="8" rx="1" fill="white" opacity="0.4"/><rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill="white" opacity="0.6"/><rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="white"/><rect x="13.5" y="3" width="2" height="2" rx="0.5" fill="white"/></svg>
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.35"/><rect x="2" y="2" width="17" height="8" rx="2" fill="white"/><path d="M23 4.5v3a1.5 1.5 0 0 0 0-3z" fill="white" opacity="0.4"/></svg>
      </div>
    </div>
  );
}

function HomeIndicator() {
  return <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 130, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}/>;
}

// ─── screen 1 — input ─────────────────────────────────────────────────────────

function InputScreen({ onNext }: { onNext: (jobId: string, handle: string) => void }) {
  const [handle, setHandle]     = useState('');
  const [idea, setIdea]         = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'x'>('instagram');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async () => {
    if (!handle.trim() || !idea.trim()) return;
    setLoading(true);
    setError(null);
    const cleanHandle = handle.replace(/^@/, '');
    try {
      const res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: cleanHandle, product_idea: idea, platform }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { job_id } = await res.json();
      onNext(job_id, cleanHandle);
    } catch {
      setError('Could not start — is the API running?');
      setLoading(false);
    }
  };

  const canSubmit = handle.trim() && idea.trim() && !loading;

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 26px', paddingTop: 20 }}>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <p style={{ fontSize: 13, color: 'rgba(240,238,244,0.4)', fontWeight: 400, marginBottom: 4 }}>grow with</p>
        <h1 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 42, letterSpacing: '-0.5px', lineHeight: 1, background: 'linear-gradient(135deg,#fff 0%,#d2beff 60%,#f9a8d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>stencil</h1>
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* handle */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.3)', marginBottom: 6 }}>your handle</p>
          <input
            className="input-pill"
            placeholder="@yourhandle"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* product idea */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.3)', marginBottom: 6 }}>product idea</p>
          <textarea
            className="input-pill"
            placeholder="What are you building?"
            value={idea}
            onChange={e => setIdea(e.target.value)}
            disabled={loading}
            rows={3}
            style={{ resize: 'none' }}
          />
        </div>

        {/* platform toggle */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.3)', marginBottom: 6 }}>platform</p>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['instagram', 'x'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`chip${platform === p ? ' selected' : ''}`}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {p === 'instagram' ? '◎ instagram' : '𝕏 x / twitter'}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p style={{ fontSize: 11, color: 'rgba(255,120,120,0.8)', textAlign: 'center' }}>{error}</p>
        )}

        <button
          className="btn-primary"
          disabled={!canSubmit}
          onClick={submit}
          style={{ marginTop: 4, opacity: canSubmit ? 1 : 0.3, cursor: canSubmit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {loading ? (
            <>
              <span className="dot-1" style={{ width: 4, height: 4, borderRadius: '50%', background: '#0c0b0f', display: 'inline-block' }}/>
              <span className="dot-2" style={{ width: 4, height: 4, borderRadius: '50%', background: '#0c0b0f', display: 'inline-block' }}/>
              <span className="dot-3" style={{ width: 4, height: 4, borderRadius: '50%', background: '#0c0b0f', display: 'inline-block' }}/>
            </>
          ) : (
            <>generate my brand kit <Icon name="sparkle" size={13} color="#0c0b0f"/></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── screen 2 — generating (polls real API) ───────────────────────────────────

const STATUS_STEPS: Record<string, { label: string; idx: number }> = {
  queued:       { label: 'queued…',                idx: 0 },
  scraping:     { label: 'reading your profile…',  idx: 1 },
  synthesizing: { label: 'analyzing your tone…',   idx: 2 },
  generating:   { label: 'generating brand kit…',  idx: 3 },
  matching:     { label: 'matching agencies…',      idx: 4 },
  exporting:    { label: 'finishing up…',           idx: 5 },
  done:         { label: 'done!',                   idx: 6 },
};
const TOTAL_STEPS = 6;

function GeneratingScreen({ jobId, onDone, onError }: {
  jobId: string;
  onDone: (result: BrandResult) => void;
  onError: () => void;
}) {
  const [status, setStatus] = useState('queued');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API}/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        setStatus(job.status);
        if (job.status === 'done') {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimeout(() => onDone(job.result), 500);
        } else if (job.status === 'error') {
          if (timerRef.current) clearInterval(timerRef.current);
          setErrMsg(job.error_message ?? 'Something went wrong');
        }
      } catch { /* network hiccup — keep polling */ }
    };

    poll();
    timerRef.current = setInterval(poll, 1500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [jobId, onDone]);

  const step     = STATUS_STEPS[status] ?? STATUS_STEPS.queued;
  const progress = (step.idx / TOTAL_STEPS) * 100;

  if (errMsg) {
    return (
      <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 36 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,120,120,0.8)', textAlign: 'center', marginBottom: 20 }}>{errMsg}</p>
        <button className="btn-ghost" onClick={onError}>try again</button>
      </div>
    );
  }

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 36 }}>
      <div style={{ width: 80, height: 80, borderRadius: 26, background: 'rgba(210,190,255,0.06)', border: '1px solid rgba(210,190,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, animation: 'pulse-glow 1.6s ease-in-out infinite' }}>
        <LogoMark size={32} color="rgba(210,190,255,0.8)"/>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 22, textAlign: 'center', marginBottom: 8, color: '#f0eef4' }}>building your brand</h2>
      <p style={{ fontSize: 12, color: 'rgba(240,238,244,0.4)', textAlign: 'center', marginBottom: 24, height: 18 }}>{step.label}</p>
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ height: 2, borderRadius: 99, width: i <= step.idx ? 16 : 5, background: i < step.idx ? 'rgba(210,190,255,0.6)' : i === step.idx ? 'rgba(210,190,255,1)' : 'rgba(255,255,255,0.1)', transition: 'all 0.4s' }}/>
        ))}
      </div>
      <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 1, background: 'rgba(210,190,255,0.75)', width: `${progress}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }}/>
      </div>
    </div>
  );
}

// ─── screen 3 — brand deliverables deck ──────────────────────────────────────

function ResultsScreen({ result, onReset }: { result: BrandResult; onReset: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const { brand_assets: brand } = result;

  const accentColor =
    brand.palette.find(c => c.role === 'accent')?.hex ??
    brand.palette.find(c => c.role === 'primary')?.hex ??
    '#c4b5fd';

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <button
      onClick={() => copy(k, text)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: copied === k ? 'rgba(210,190,255,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${copied === k ? 'rgba(210,190,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: copied === k ? 'rgba(210,190,255,0.9)' : 'rgba(240,238,244,0.4)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' as const }}
    >
      <Icon name={copied === k ? 'check' : 'copy'} size={9} color={copied === k ? 'rgba(210,190,255,0.9)' : 'rgba(255,255,255,0.3)'}/> {copied === k ? 'copied!' : 'copy'}
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── hero ── */}
      <div style={{ flexShrink: 0, background: 'linear-gradient(135deg,#1a1025,#0f0e13)', padding: '72px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', marginBottom: 8 }}>YOUR BRAND KIT</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: `${accentColor}22`, border: `1px solid ${accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {brand.logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={brand.logo_url} alt="logo" style={{ width: 22, height: 22, objectFit: 'contain' }}/>
              : <LogoMark size={16} color={accentColor}/>}
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 24, color: '#f0eef4', letterSpacing: '-0.5px' }}>{brand.brand_name}</span>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{brand.tagline}</p>
          </div>
        </div>
      </div>

      {/* ── scrollable deck ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const }}>

        {/* 01 — logo */}
        {brand.logo && (
          <div style={{ padding: '18px 22px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SectionLabel>01 · logo</SectionLabel>
              <DownloadChip label=".png"/>
            </div>
            {/* primary — large hero */}
            <div style={{ background: '#ffffff', borderRadius: 16, padding: '28px 20px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logo.primary} alt="primary logo" style={{ width: '100%', maxWidth: 180, height: 180, objectFit: 'contain', display: 'block' }}/>
            </div>
            {/* variant row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
              {[
                { url: brand.logo.mono_dark,  label: 'black',   bg: '#ffffff' },
                { url: brand.logo.mono_light, label: 'white',   bg: '#0a0a0a' },
                { url: brand.logo.on_brand,   label: 'on-brand', bg: accentColor + '22' },
                { url: brand.logo.avatar,     label: 'avatar',   bg: accentColor + '22', round: true },
              ].map(({ url, label, bg, round }) => (
                <div key={label} style={{ background: bg, borderRadius: round ? '50%' : 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={label} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block', padding: round ? 8 : 6 }}/>
                  {!round && <p style={{ fontSize: 7, color: 'rgba(240,238,244,0.35)', padding: '3px 0 5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 02 — color palette */}
        <div style={{ padding: brand.logo ? '0 22px 0' : '18px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>02 · color palette</SectionLabel>
            <DownloadChip label=".ase"/>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 18 }}>
            {brand.palette.map((c, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  onClick={() => copy(`color-${i}`, c.hex)}
                  style={{ width: '100%', height: 50, borderRadius: 10, background: c.hex, cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}
                >
                  {copied === `color-${i}` && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <Icon name="check" size={12} color="#fff"/>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 7, color: 'rgba(240,238,244,0.4)', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.4 }}>{c.name}<br/>{c.hex}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 02 — typography */}
        {brand.typography && (
          <div style={{ padding: '0 22px', marginBottom: 18 }}>
            <SectionLabel>03 · typography</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'display', spec: brand.typography.display },
                { label: 'body',    spec: brand.typography.body    },
              ].map(({ label, spec }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 12px 10px' }}>
                  <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.25)', marginBottom: 6 }}>{label}</p>
                  <p style={{ fontSize: 18, fontWeight: label === 'display' ? 700 : 400, color: '#f0eef4', lineHeight: 1.1, marginBottom: 6, letterSpacing: label === 'display' ? '-0.5px' : '0' }}>Aa</p>
                  <p style={{ fontSize: 9, color: accentColor, fontWeight: 600 }}>{spec.family}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 03 — brand voice */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <SectionLabel>04 · brand voice</SectionLabel>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: 'rgba(240,238,244,0.65)', fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5 }}>{brand.voice.tone}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(120,220,120,0.8)', marginBottom: 5 }}>DO</p>
                {brand.voice.do.slice(0, 3).map((d, i) => (
                  <p key={i} style={{ fontSize: 9.5, color: 'rgba(240,238,244,0.45)', lineHeight: 1.5, marginBottom: 3 }}>+ {d}</p>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(255,100,100,0.8)', marginBottom: 5 }}>{"DON'T"}</p>
                {brand.voice.dont.slice(0, 3).map((d, i) => (
                  <p key={i} style={{ fontSize: 9.5, color: 'rgba(240,238,244,0.45)', lineHeight: 1.5, marginBottom: 3 }}>− {d}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 04 — merchandise */}
        {brand.mockups && brand.mockups.length > 0 && (
          <div style={{ padding: '0 22px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SectionLabel>05 · merchandise</SectionLabel>
              <DownloadChip label=".png"/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(brand.mockups.length, 2)}, 1fr)`, gap: 8 }}>
              {brand.mockups.map((m, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.label} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}/>
                  <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.4)', textAlign: 'center', padding: '6px 0 8px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 05 — social copy */}
        <div style={{ padding: '0 22px', marginBottom: 28 }}>
          <SectionLabel>06 · social copy</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brand.voice.examples.map((ex, i) => {
              const icons     = ['𝕏', '◎', '♪'];
              const platforms = ['x / twitter', 'instagram', 'threads'];
              const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(ex)}`;
              return (
                <div key={i} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(240,238,244,0.4)' }}>{icons[i % 3]}</span>
                      <span style={{ fontSize: 9, color: 'rgba(240,238,244,0.3)', letterSpacing: '0.3px' }}>{platforms[i % 3]}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <CopyBtn k={`post-${i}`} text={ex}/>
                      {i === 0 && (
                        <a href={tweetHref} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,238,244,0.4)', fontSize: 10, textDecoration: 'none' }}>
                          post <Icon name="arrow" size={8} color="rgba(255,255,255,0.3)"/>
                        </a>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#f0eef4', lineHeight: 1.65 }}>{ex}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* 07 — influencer matches */}
        {result.influencer_matches && result.influencer_matches.length > 0 && (
          <div style={{ padding: '0 22px', marginBottom: 28 }}>
            <SectionLabel>07 · creator matches</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.influencer_matches.map((inf, i) => {
                const platformIcon: Record<string, string> = { instagram: '◎', tiktok: '♪', youtube: '▶' };
                const tierColor: Record<string, string> = {
                  'nano (1K–10K)': 'rgba(120,220,120,0.8)',
                  'micro (10K–100K)': 'rgba(100,180,255,0.8)',
                  'macro (100K–1M)': 'rgba(210,160,255,0.8)',
                };
                const tc = tierColor[inf.follower_tier] ?? 'rgba(240,238,244,0.4)';
                return (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 14px' }}>
                    {/* header row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: accentColor }}>{platformIcon[inf.platform] ?? '◎'}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0eef4', letterSpacing: '-0.2px' }}>{inf.handle}</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, color: tc, background: tc.replace('0.8)', '0.1)'), border: `1px solid ${tc.replace('0.8)', '0.2)')}`, borderRadius: 6, padding: '2px 7px' }}>
                        {inf.follower_tier.split(' ')[0]}
                      </span>
                    </div>
                    {/* niche + reach */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                      <span style={{ fontSize: 9, color: 'rgba(240,238,244,0.4)', background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 7px' }}>{inf.niche}</span>
                      <span style={{ fontSize: 9, color: 'rgba(240,238,244,0.35)', padding: '2px 0' }}>{inf.estimated_reach}</span>
                    </div>
                    {/* why */}
                    <p style={{ fontSize: 11, color: 'rgba(240,238,244,0.65)', lineHeight: 1.5, marginBottom: 7 }}>{inf.why}</p>
                    {/* content style + collab */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 9.5, color: 'rgba(240,238,244,0.35)', fontStyle: 'italic' }}>{inf.content_style}</p>
                      <span style={{ fontSize: 9, fontWeight: 600, color: accentColor, background: `${accentColor}18`, borderRadius: 5, padding: '2px 7px' }}>{inf.collab_angle}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 08 — canva templates */}
        {(result.canva_edit_urls || result.canva_folder_url) && (
          <div style={{ padding: '0 22px', marginBottom: 28 }}>
            <SectionLabel>08 · canva templates</SectionLabel>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124,77,255,0.15)', border: '1px solid rgba(124,77,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>✦</span>
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#f0eef4' }}>Brand kit in Canva</p>
                  <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.4)' }}>logos, mockups + social templates ready to edit</p>
                </div>
              </div>
              {result.canva_folder_url && (
                <a href={result.canva_folder_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                  <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(124,77,255,0.12)', border: '1px solid rgba(124,77,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'rgba(210,190,255,0.9)', fontWeight: 600 }}>open asset folder</span>
                    <Icon name="arrow" size={10} color="rgba(210,190,255,0.7)"/>
                  </div>
                </a>
              )}
              {result.canva_edit_urls && Object.entries(result.canva_edit_urls).slice(0, 5).map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', marginBottom: 5 }}>
                  <div style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10, color: 'rgba(240,238,244,0.6)', textTransform: 'capitalize' }}>{label.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 9, color: 'rgba(210,190,255,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>edit <Icon name="arrow" size={8} color="rgba(210,190,255,0.4)"/></span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* start over */}
        <div style={{ padding: '0 22px 40px' }}>
          <button className="btn-ghost" onClick={onReset} style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="refresh" size={11} color="rgba(255,255,255,0.3)"/> start over
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── screen 4 — library ───────────────────────────────────────────────────────

function LibraryScreen({ onOpen }: { onOpen: (b: SavedBrand) => void }) {
  const [brands, setBrands] = useState<SavedBrand[]>([]);

  useEffect(() => { setBrands(loadSaved()); }, []);

  const left  = brands.filter((_, i) => i % 2 === 0);
  const right = brands.filter((_, i) => i % 2 === 1);

  const BrandCard = ({ b }: { b: SavedBrand }) => {
    const brand = b.result.brand_assets;
    const accent = brand.palette.find(c => c.role === 'accent')?.hex ?? brand.palette[0]?.hex ?? '#c4b5fd';
    const tall = brand.mockups && brand.mockups.length > 0;
    return (
      <div
        onClick={() => onOpen(b)}
        style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', marginBottom: 10, transition: 'transform 0.15s' }}
      >
        {/* color bar */}
        <div style={{ display: 'flex', height: 6 }}>
          {brand.palette.slice(0, 5).map((c, i) => (
            <div key={i} style={{ flex: 1, background: c.hex }}/>
          ))}
        </div>

        {/* logo / mockup image */}
        {tall && brand.mockups[0]?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.mockups[0].url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}/>
        ) : brand.logo?.primary ? (
          <div style={{ background: '#fff', padding: '14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo.primary} alt="" style={{ width: '100%', maxHeight: 64, objectFit: 'contain', display: 'block' }}/>
          </div>
        ) : (
          <div style={{ height: 64, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogoMark size={22} color={accent}/>
          </div>
        )}

        {/* name + meta */}
        <div style={{ padding: '9px 10px 10px' }}>
          <p style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 15, color: '#f0eef4', letterSpacing: '-0.3px', marginBottom: 2, lineHeight: 1.1 }}>{brand.brand_name}</p>
          <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.35)', lineHeight: 1.3, marginBottom: 6 }}>{brand.tagline}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: 'rgba(240,238,244,0.25)', letterSpacing: '0.3px' }}>@{b.handle}</span>
            <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block' }}/>
            <span style={{ fontSize: 8, color: 'rgba(240,238,244,0.2)' }}>
              {new Date(b.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ flexShrink: 0, padding: '72px 22px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(240,238,244,0.3)', marginBottom: 4 }}>stencil</p>
        <h2 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 26, color: '#f0eef4', letterSpacing: '-0.5px', lineHeight: 1 }}>your brands</h2>
      </div>

      {/* grid */}
      {brands.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(210,190,255,0.06)', border: '1px solid rgba(210,190,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="package" size={20} color="rgba(210,190,255,0.4)"/>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(240,238,244,0.3)', textAlign: 'center', lineHeight: 1.5 }}>no brand kits yet.<br/>generate your first one.</p>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const, padding: '14px 12px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
            <div>{left.map(b  => <BrandCard key={b.id} b={b}/>)}</div>
            <div style={{ marginTop: 20 }}>{right.map(b => <BrandCard key={b.id} b={b}/>)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── bottom tab bar ───────────────────────────────────────────────────────────

function BottomTabs({ active, onChange }: { active: 'create' | 'library'; onChange: (t: 'create' | 'library') => void }) {
  const tabs: { key: 'create' | 'library'; label: string; icon: 'sparkle' | 'package' }[] = [
    { key: 'create',  label: 'create',     icon: 'sparkle' },
    { key: 'library', label: 'your brands', icon: 'package' },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60, background: 'rgba(20,18,26,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', paddingBottom: 22 }}>
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} style={{ flex: 1, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 0 0', fontFamily: 'inherit' }}>
            <Icon name={t.icon} size={18} color={on ? 'rgba(210,190,255,0.95)' : 'rgba(255,255,255,0.25)'}/>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.4px', color: on ? 'rgba(210,190,255,0.9)' : 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── phone shell ──────────────────────────────────────────────────────────────

export function PhoneAppScreen() {
  const [screen,  setScreen]  = useState<Screen>('input');
  const [tab,     setTab]     = useState<'create' | 'library'>('create');
  const [jobId,   setJobId]   = useState<string | null>(null);
  const [result,  setResult]  = useState<BrandResult | null>(null);
  const [handle,  setHandle]  = useState('');
  const [preview, setPreview] = useState<SavedBrand | null>(null);

  const reset = () => {
    setScreen('input');
    setJobId(null);
    setResult(null);
    setPreview(null);
  };

  const handleTabChange = (t: 'create' | 'library') => {
    setTab(t);
    setPreview(null);
  };

  const activeScreen: Screen = tab === 'library' ? (preview ? 'results' : 'library') : screen;

  return (
    <div className="phone-screen">
      <StatusBar/>
      <ProgressBar current={activeScreen} onBack={s => { if (s === 'input') reset(); }}/>

      {tab === 'create' && screen === 'input' && (
        <InputScreen onNext={(id, h) => { setJobId(id); setHandle(h); setScreen('generating'); }}/>
      )}
      {tab === 'create' && screen === 'generating' && jobId && (
        <GeneratingScreen
          jobId={jobId}
          onDone={r => { saveBrand(handle, r); setResult(r); setScreen('results'); }}
          onError={reset}
        />
      )}
      {tab === 'create' && screen === 'results' && result && (
        <ResultsScreen result={result} onReset={reset}/>
      )}

      {tab === 'library' && !preview && (
        <LibraryScreen onOpen={b => setPreview(b)}/>
      )}
      {tab === 'library' && preview && (
        <ResultsScreen result={preview.result} onReset={() => setPreview(null)}/>
      )}

      <BottomTabs active={tab} onChange={handleTabChange}/>
      <HomeIndicator/>
    </div>
  );
}

export function PhoneApp() {
  return (
    <div className="phone-shell">
      <div className="dynamic-island"/>
      <PhoneAppScreen />
    </div>
  );
}
