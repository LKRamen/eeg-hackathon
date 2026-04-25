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
interface BrandResult {
  persona: {
    name: string; age_range: string; summary: string;
    aesthetic_keywords: string[]; voice_traits: string[];
    interests: string[]; psychographics: string[];
  };
  brand_assets: {
    brand_name: string; tagline: string; logo_url: string;
    palette: Color[];
    voice: { tone: string; do: string[]; dont: string[]; examples: string[]; };
  };
  agency_matches: AgencyMatch[];
}

type Screen = 'input' | 'generating' | 'results';
const SCREENS: Screen[] = ['input', 'generating', 'results'];

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
  const idx = SCREENS.indexOf(current);
  return (
    <div style={{ position: 'absolute', top: 60, left: 22, right: 22, zIndex: 40, display: 'flex', gap: 5 }}>
      {SCREENS.map((s, i) => {
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

function InputScreen({ onNext }: { onNext: (jobId: string) => void }) {
  const [handle, setHandle]     = useState('');
  const [idea, setIdea]         = useState('');
  const [platform, setPlatform] = useState<'instagram' | 'x'>('instagram');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const submit = async () => {
    if (!handle.trim() || !idea.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: handle.replace(/^@/, ''),
          product_idea: idea,
          platform,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const { job_id } = await res.json();
      onNext(job_id);
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
  synthesizing: { label: 'building your persona…', idx: 2 },
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
  }, [jobId]);

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

// ─── screen 3 — results (real BrandResult) ────────────────────────────────────

function ResultsScreen({ result, onReset }: { result: BrandResult; onReset: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const { brand_assets: brand, persona, agency_matches } = result;

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

  const hues = [accentColor, 'rgba(125,211,252,0.9)', 'rgba(249,168,212,0.9)'];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── hero header ── */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 5 }}>
        <div style={{ background: 'linear-gradient(135deg,#1a1025,#0f0e13)', padding: '72px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6 }}>YOUR BRAND KIT</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accentColor}22`, border: `1px solid ${accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {brand.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt="logo" style={{ width: 20, height: 20, objectFit: 'contain' }}/>
                  ) : (
                    <LogoMark size={16} color={accentColor}/>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 26, color: '#f0eef4', letterSpacing: '-0.5px' }}>{brand.brand_name}</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{brand.tagline}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <span style={{ fontSize: 9, color: 'rgba(210,190,255,0.9)', background: 'rgba(210,190,255,0.15)', padding: '3px 8px', borderRadius: 5, fontWeight: 700, letterSpacing: '0.8px' }}>LIVE</span>
              <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Icon name="package" size={10} color="#fff"/> download all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── scrollable content ── */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' as const }}>

        {/* persona card */}
        <div style={{ padding: '18px 22px 0' }}>
          <SectionLabel>your audience persona</SectionLabel>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${accentColor}25`, border: `1.5px solid ${accentColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: accentColor, fontFamily: 'var(--font-display), serif', fontStyle: 'italic' }}>{persona.name[0]}</span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#f0eef4' }}>{persona.name}</p>
                <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.4)' }}>{persona.age_range}</p>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(240,238,244,0.55)', lineHeight: 1.6, marginBottom: 10, fontStyle: 'italic' }}>&ldquo;{persona.summary}&rdquo;</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {persona.aesthetic_keywords.map((k, i) => (
                <span key={i} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 20, background: `${accentColor}18`, border: `1px solid ${accentColor}35`, color: accentColor }}>{k}</span>
              ))}
            </div>
          </div>
        </div>

        {/* brand palette */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>brand palette</SectionLabel>
            <DownloadChip label=".ase file"/>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {brand.palette.map((c, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div
                  onClick={() => copy(`color-${i}`, c.hex)}
                  style={{ width: '100%', height: 52, borderRadius: 10, background: c.hex, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                >
                  {copied === `color-${i}` && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <Icon name="check" size={12} color="#fff"/>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 7.5, color: 'rgba(240,238,244,0.45)', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3 }}>{c.name}<br/>{c.hex}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.25)', marginTop: 6, textAlign: 'center' }}>tap a swatch to copy hex</p>
        </div>

        {/* agency matches */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <SectionLabel>matched agencies</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {agency_matches.slice(0, 3).map((a, i) => {
              const hue = hues[i] ?? accentColor;
              return (
                <div key={a.agency_id} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px 8px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="users" size={15} color={hue}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#f0eef4' }}>{a.name}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, color: hue, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 5 }}>{Math.round(a.match_score)}%</span>
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.35)', lineHeight: 1.4, fontStyle: 'italic' }}>{a.why}</p>
                    </div>
                  </div>
                  <div style={{ padding: '0 14px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {a.specialty_tags.slice(0, 3).map((t, j) => (
                      <span key={j} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(240,238,244,0.4)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* brand voice / social copy */}
        <div style={{ padding: '0 22px', marginBottom: 28 }}>
          <SectionLabel>brand voice · social copy</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {brand.voice.examples.map((ex, i) => {
              const icons     = ['X', '◎', '♪'];
              const platforms = ['x', 'ig', 'tt'];
              return (
                <div key={i} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(240,238,244,0.5)', fontFamily: 'monospace' }}>{icons[i % 3]}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(240,238,244,0.4)', letterSpacing: '0.3px' }}>{platforms[i % 3]}</span>
                    </div>
                    <CopyBtn k={`post-${i}`} text={ex}/>
                  </div>
                  <p style={{ fontSize: 12, color: '#f0eef4', lineHeight: 1.65 }}>{ex}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* voice tone */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <SectionLabel>voice tone</SectionLabel>
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, color: 'rgba(240,238,244,0.6)', fontStyle: 'italic', marginBottom: 10 }}>{brand.voice.tone}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(120,220,120,0.7)', marginBottom: 6 }}>DO</p>
                {brand.voice.do.slice(0, 2).map((d, i) => (
                  <p key={i} style={{ fontSize: 10, color: 'rgba(240,238,244,0.4)', lineHeight: 1.5, marginBottom: 4 }}>+ {d}</p>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(255,100,100,0.7)', marginBottom: 6 }}>{"DON'T"}</p>
                {brand.voice.dont.slice(0, 2).map((d, i) => (
                  <p key={i} style={{ fontSize: 10, color: 'rgba(240,238,244,0.4)', lineHeight: 1.5, marginBottom: 4 }}>− {d}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

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

// ─── phone shell ──────────────────────────────────────────────────────────────

export function PhoneApp() {
  const [screen, setScreen] = useState<Screen>('input');
  const [jobId,  setJobId]  = useState<string | null>(null);
  const [result, setResult] = useState<BrandResult | null>(null);

  const reset = () => {
    setScreen('input');
    setJobId(null);
    setResult(null);
  };

  return (
    <div className="phone-shell">
      <div className="dynamic-island"/>
      <div className="phone-screen">
        <StatusBar/>
        <ProgressBar current={screen} onBack={s => { if (s === 'input') reset(); }}/>

        {screen === 'input' && (
          <InputScreen onNext={id => { setJobId(id); setScreen('generating'); }}/>
        )}
        {screen === 'generating' && jobId && (
          <GeneratingScreen
            jobId={jobId}
            onDone={r => { setResult(r); setScreen('results'); }}
            onError={reset}
          />
        )}
        {screen === 'results' && result && (
          <ResultsScreen result={result} onReset={reset}/>
        )}

        <HomeIndicator/>
      </div>
    </div>
  );
}
