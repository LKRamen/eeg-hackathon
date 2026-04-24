'use client';

import { useState, useEffect, useRef } from 'react';
import { Icon, LogoMark } from './icons';

// ─── types & data ─────────────────────────────────────────────────────────────

type Screen = 'upload' | 'style' | 'generating' | 'results';
const SCREENS: Screen[] = ['upload', 'style', 'generating', 'results'];

const PALETTE_SETS: Record<string, string[]> = {
  lovable:  ['#c4b5fd','#f9a8d4','#7dd3fc','#fde68a','#111114'],
  apple:    ['#1d1d1f','#f5f5f7','#0071e3','#86868b','#ffffff'],
  nike:     ['#111111','#fa5a28','#ffffff','#888888','#1a1a1a'],
  glossier: ['#fde8eb','#ffb3c1','#c77dff','#f8edff','#1a1a1a'],
  notion:   ['#191919','#ffffff','#2eaadc','#e9e5e3','#9b9b9b'],
  supreme:  ['#ff0000','#ffffff','#000000','#cccccc','#1a1a1a'],
};

const COLOR_NAMES: Record<string, string[]> = {
  lovable:  ['lavender','rose','sky','lemon','void'],
  apple:    ['midnight','silver','cobalt','graphite','white'],
  nike:     ['black','ember','white','ash','shadow'],
  glossier: ['blush','rose','violet','petal','noir'],
  notion:   ['obsidian','white','azure','sand','stone'],
  supreme:  ['scarlet','white','black','chrome','shadow'],
};

const STYLES = [
  {
    id: 'lovable', name: 'lovable', tag: 'gradient · playful · warm',
    palette: ['#c4b5fd','#f9a8d4','#7dd3fc'],
    preview: {
      bg: 'linear-gradient(135deg,#1a0533,#2d1060)',
      text: 'stencil',
      textStyle: { fontFamily: 'var(--font-sans), Inter, sans-serif', fontWeight: 800, fontSize: 28, background: 'linear-gradient(135deg,#c4b5fd,#f9a8d4)', WebkitBackgroundClip: 'text' as const, WebkitTextFillColor: 'transparent' as const, backgroundClip: 'text' as const, letterSpacing: '-1px' },
      accent: '#c4b5fd',
    },
  },
  {
    id: 'apple', name: 'apple', tag: 'minimal · premium · silent',
    palette: ['#f5f5f7','#86868b','#0071e3'],
    preview: {
      bg: 'linear-gradient(135deg,#141414,#1d1d1f)',
      text: 'stencil',
      textStyle: { fontFamily: '-apple-system, "SF Pro Display", system-ui', fontWeight: 200, fontSize: 24, color: '#f5f5f7', letterSpacing: '6px' },
      accent: '#f5f5f7',
    },
  },
  {
    id: 'nike', name: 'nike', tag: 'raw · bold · athletic',
    palette: ['#fa5a28','#ffffff','#111111'],
    preview: {
      bg: 'linear-gradient(135deg,#0a0a0a,#1a0000)',
      text: 'stencil',
      textStyle: { fontFamily: 'var(--font-sans), Inter, sans-serif', fontWeight: 900, fontSize: 28, color: '#ffffff', letterSpacing: '-2px', textTransform: 'uppercase' as const },
      accent: '#fa5a28',
    },
  },
  {
    id: 'glossier', name: 'glossier', tag: 'soft · warm · lifestyle',
    palette: ['#ffb3c1','#fde8eb','#c77dff'],
    preview: {
      bg: 'linear-gradient(135deg,#1a0a10,#200a18)',
      text: 'stencil',
      textStyle: { fontFamily: 'var(--font-display), serif', fontStyle: 'italic' as const, fontWeight: 400, fontSize: 28, color: '#ffb3c1', letterSpacing: '1px' },
      accent: '#ffb3c1',
    },
  },
  {
    id: 'notion', name: 'notion', tag: 'structured · calm · editorial',
    palette: ['#ffffff','#2eaadc','#e9e5e3'],
    preview: {
      bg: 'linear-gradient(135deg,#111111,#191919)',
      text: 'stencil',
      textStyle: { fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 400, fontSize: 28, color: '#ffffff', letterSpacing: '0px' },
      accent: '#2eaadc',
    },
  },
  {
    id: 'supreme', name: 'supreme', tag: 'graphic · street · loud',
    palette: ['#ff0000','#ffffff','#000000'],
    preview: {
      bg: 'linear-gradient(135deg,#0a0a0a,#1a0000)',
      text: 'stencil',
      textStyle: { fontFamily: 'var(--font-sans), Impact, sans-serif', fontWeight: 900, fontSize: 24, color: '#ff0000', letterSpacing: '6px', textTransform: 'uppercase' as const },
      accent: '#ff0000',
    },
  },
];

const INFLUENCERS = [
  {
    name: 'maya chen', handle: '@mayatech', niche: 'tech & lifestyle',
    followers: '2.3m', match: 97, hue: '#c4b5fd',
    avatar: { initials: 'MC', bg: 'linear-gradient(135deg,#7c3aed,#c4b5fd)' },
    phone: '+1 (323) 555-0192', ig: 'mayatech', email: 'maya@mayatech.co',
    bio: 'tech & lifestyle creator, nyc. viral content for forward-thinking brands.',
  },
  {
    name: 'jaden volt', handle: '@jadenvolt', niche: 'streetwear',
    followers: '890k', match: 94, hue: '#7dd3fc',
    avatar: { initials: 'JV', bg: 'linear-gradient(135deg,#0369a1,#7dd3fc)' },
    phone: '+1 (213) 555-0847', ig: 'jadenvolt', email: 'jaden@volt.studio',
    bio: 'drops, fits, culture. streetwear since 2018. la based.',
  },
  {
    name: 'sofia reyes', handle: '@sofiabeauty', niche: 'beauty & wellness',
    followers: '1.1m', match: 91, hue: '#f9a8d4',
    avatar: { initials: 'SR', bg: 'linear-gradient(135deg,#be185d,#f9a8d4)' },
    phone: '+1 (786) 555-0341', ig: 'sofiabeauty', email: 'sofia@sofiareyes.com',
    bio: 'clean beauty, real reviews. 1.1m community. miami & everywhere.',
  },
  {
    name: 'luca torres', handle: '@lucacreates', niche: 'creative / art',
    followers: '540k', match: 88, hue: '#fde68a',
    avatar: { initials: 'LT', bg: 'linear-gradient(135deg,#b45309,#fde68a)' },
    phone: '+1 (512) 555-0628', ig: 'lucacreates', email: 'luca@lucatorres.art',
    bio: 'visual artist, creative director. brand collabs that feel like art.',
  },
];

const POSTS = [
  { platform: 'x', icon: 'X', text: "we didn't reinvent the category. we erased it. introducing aurora studio — link in bio." },
  { platform: 'ig', icon: '◎', text: "some things you feel before you see them. this is one of those things. pre-order open now." },
  { platform: 'tt', icon: '♪', text: "pov: you find the brand that actually gets you. #aesthetic #brand #launch" },
];

const MERCH = [
  { name: 'premium tee', sub: 'heavyweight 300gsm', icon: '👕' },
  { name: 'hoodie',      sub: 'oversized, embroidered', icon: '🧥' },
  { name: 'tote bag',    sub: 'canvas, screen print', icon: '🛍' },
  { name: 'enamel pin',  sub: 'hard enamel, 3-pack', icon: '📌' },
];

// ─── shared components ────────────────────────────────────────────────────────

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
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} onClick={() => done && onBack(s)} style={{ flex: 1, height: 2, borderRadius: 99, background: active ? 'rgba(210,190,255,0.9)' : done ? 'rgba(210,190,255,0.45)' : 'rgba(255,255,255,0.1)', cursor: done ? 'pointer' : 'default', transition: 'background 0.3s' }}/>
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

// ─── screen 1 — upload ────────────────────────────────────────────────────────

function UploadScreen({ onNext }: { onNext: () => void }) {
  const [hasFile, setHasFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) setHasFile(true);
  };

  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 26px', paddingTop: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 13, color: 'rgba(240,238,244,0.4)', fontWeight: 400, marginBottom: 4 }}>grow with</p>
        <h1 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 42, letterSpacing: '-0.5px', lineHeight: 1, background: 'linear-gradient(135deg,#fff 0%,#d2beff 60%,#f9a8d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>stencil</h1>
      </div>
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={() => setHasFile(true)} accept="image/*,.pdf"/>
      <div
        onClick={() => !hasFile && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ width: '100%', borderRadius: 20, border: hasFile ? '1.5px solid rgba(210,190,255,0.5)' : dragging ? '1.5px dashed rgba(210,190,255,0.5)' : '1.5px dashed rgba(255,255,255,0.12)', background: hasFile ? 'rgba(210,190,255,0.07)' : dragging ? 'rgba(210,190,255,0.05)' : 'rgba(255,255,255,0.02)', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: hasFile ? 'default' : 'pointer', transition: 'all 0.2s' }}
      >
        {hasFile ? (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: 'rgba(210,190,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={24} color="rgba(210,190,255,0.9)"/>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(210,190,255,0.9)', fontWeight: 500 }}>uploaded</p>
            <button onClick={() => setHasFile(false)} style={{ fontSize: 11, color: 'rgba(240,238,244,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>remove</button>
          </>
        ) : (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 18, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="upload" size={22} color="rgba(255,255,255,0.3)"/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: '#f0eef4', fontWeight: 500, marginBottom: 4 }}>drop your brand idea</p>
              <p style={{ fontSize: 12, color: 'rgba(240,238,244,0.35)', lineHeight: 1.5 }}>logo, screenshot, product photo<br/>or anything that represents you</p>
            </div>
            <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.2)', letterSpacing: '0.3px' }}>PNG · JPG · PDF</p>
          </>
        )}
      </div>
      <button className="btn-primary" disabled={!hasFile} onClick={onNext} style={{ marginTop: 20, opacity: hasFile ? 1 : 0.3, cursor: hasFile ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        continue <Icon name="arrow" size={13} color="#0c0b0f"/>
      </button>
    </div>
  );
}

// ─── screen 2 — style picker ──────────────────────────────────────────────────

function StyleScreen({ onNext }: { onNext: (style: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '72px 22px 12px', flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.35)', fontWeight: 600, letterSpacing: '0.5px', marginBottom: 4 }}>step 2</p>
        <h2 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 24, letterSpacing: '-0.3px', color: '#f0eef4', marginBottom: 4 }}>choose your style</h2>
        <p style={{ fontSize: 12, color: 'rgba(240,238,244,0.35)', lineHeight: 1.5 }}>we'll apply this aesthetic to your brand while keeping it unmistakably stencil.</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, paddingTop: 4 }}>
          {STYLES.map(s => {
            const isSelected = selected === s.id;
            return (
              <div key={s.id} onClick={() => setSelected(s.id)} style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: isSelected ? '1.5px solid rgba(210,190,255,0.6)' : '1px solid rgba(255,255,255,0.07)', transition: 'all 0.15s', boxShadow: isSelected ? '0 0 0 3px rgba(210,190,255,0.1)' : 'none' }}>
                <div style={{ background: s.preview.bg, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,0.3) 0,rgba(255,255,255,0.3) 1px,transparent 1px,transparent 8px)' }}/>
                  <span style={s.preview.textStyle as React.CSSProperties}>{s.preview.text}</span>
                  {isSelected && <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: 'rgba(210,190,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={9} color="#0c0b0f"/></div>}
                </div>
                <div style={{ padding: '9px 10px 10px', background: isSelected ? 'rgba(210,190,255,0.06)' : 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    {s.palette.map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }}/>)}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: isSelected ? 'rgba(210,190,255,0.9)' : '#f0eef4', marginBottom: 2 }}>{s.name}</p>
                  <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.35)', lineHeight: 1.3 }}>{s.tag}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 24, left: 22, right: 22 }}>
        <button className="btn-primary" disabled={!selected} onClick={() => selected && onNext(selected)} style={{ opacity: selected ? 1 : 0.3, cursor: selected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          generate my brand kit <Icon name="sparkle" size={13} color="#0c0b0f"/>
        </button>
      </div>
    </div>
  );
}

// ─── screen 3 — generating ────────────────────────────────────────────────────

function GeneratingScreen({ onNext }: { onNext: () => void }) {
  const steps = ['reading your upload…','building logo system…','generating palette…','matching creators…','writing social copy…'];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (i < steps.length) setIdx(i);
      else { clearInterval(t); setTimeout(onNext, 500); }
    }, 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="screen-enter" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 36 }}>
      <div style={{ width: 80, height: 80, borderRadius: 26, background: 'rgba(210,190,255,0.06)', border: '1px solid rgba(210,190,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, animation: 'pulse-glow 1.6s ease-in-out infinite' }}>
        <LogoMark size={32} color="rgba(210,190,255,0.8)"/>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 22, textAlign: 'center', marginBottom: 8, color: '#f0eef4' }}>building your brand</h2>
      <p style={{ fontSize: 12, color: 'rgba(240,238,244,0.4)', textAlign: 'center', marginBottom: 24, height: 18 }}>{steps[idx]}</p>
      <div style={{ display: 'flex', gap: 5, marginBottom: 20 }}>
        {steps.map((_, i) => <div key={i} style={{ height: 2, borderRadius: 99, width: i <= idx ? 16 : 5, background: i < idx ? 'rgba(210,190,255,0.6)' : i === idx ? 'rgba(210,190,255,1)' : 'rgba(255,255,255,0.1)', transition: 'all 0.4s' }}/>)}
      </div>
      <div style={{ width: '100%', height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 1, background: 'rgba(210,190,255,0.75)', width: `${((idx + 1) / steps.length) * 100}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }}/>
      </div>
    </div>
  );
}

// ─── screen 4 — results (single scroll) ──────────────────────────────────────

function CreatorAvatar({ inf }: { inf: typeof INFLUENCERS[0] }) {
  return (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: inf.avatar.bg, border: `2px solid ${inf.hue}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display), serif', fontStyle: 'italic' }}>{inf.avatar.initials}</span>
      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 17, height: 17, borderRadius: '50%', background: '#18161c', border: `1.5px solid ${inf.hue}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 8, fontWeight: 800, color: inf.hue }}>{inf.match}</span>
      </div>
    </div>
  );
}

function ResultsScreen({ style, onReset }: { style: string; onReset: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const palette = PALETTE_SETS[style] ?? PALETTE_SETS.lovable;
  const colorNames = COLOR_NAMES[style] ?? COLOR_NAMES.lovable;
  const styleDef = STYLES.find(s => s.id === style) ?? STYLES[0];

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const CopyBtn = ({ k, text }: { k: string; text: string }) => (
    <button onClick={() => copy(k, text)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: copied === k ? 'rgba(210,190,255,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${copied === k ? 'rgba(210,190,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: copied === k ? 'rgba(210,190,255,0.9)' : 'rgba(240,238,244,0.4)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' as const }}>
      <Icon name={copied === k ? 'check' : 'copy'} size={9} color={copied === k ? 'rgba(210,190,255,0.9)' : 'rgba(255,255,255,0.3)'}/> {copied === k ? 'copied!' : 'copy'}
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── sticky hero header ── */}
      <div style={{ flexShrink: 0, position: 'relative', zIndex: 5 }}>
        <div style={{ background: styleDef.preview.bg, padding: '72px 22px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', marginBottom: 6 }}>YOUR BRAND KIT</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LogoMark size={16} color="rgba(255,255,255,0.85)"/>
                </div>
                <span style={{ ...styleDef.preview.textStyle as React.CSSProperties, fontSize: 26 }}>aurora studio</span>
              </div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{styleDef.tag}</p>
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

        {/* logo variants */}
        <div style={{ padding: '18px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>logo system</SectionLabel>
            <DownloadChip label="SVG pack"/>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {[
              { bg: styleDef.preview.bg, logoColor: 'rgba(255,255,255,0.85)', label: 'primary', border: 'none' },
              { bg: 'rgba(255,255,255,0.04)', logoColor: 'rgba(255,255,255,0.55)', label: 'mono', border: '1px solid rgba(255,255,255,0.08)' },
              { bg: '#f0eef4', logoColor: '#1a1820', label: 'light', border: 'none' },
            ].map((v, i) => (
              <div key={i} style={{ flex: 1, height: 68, borderRadius: 12, background: v.bg, border: v.border, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <LogoMark size={i === 0 ? 20 : 16} color={v.logoColor}/>
                <span style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 9, color: v.logoColor, opacity: 0.7, letterSpacing: '0.5px' }}>stencil</span>
              </div>
            ))}
          </div>
        </div>

        {/* color palette */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>brand palette</SectionLabel>
            <DownloadChip label=".ase file"/>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {palette.map((c, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div
                  onClick={() => copy(`color-${i}`, c)}
                  style={{ width: '100%', height: 52, borderRadius: 10, background: c, boxShadow: '0 4px 12px rgba(0,0,0,0.4)', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'transform 0.15s' }}
                >
                  {copied === `color-${i}` && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                      <Icon name="check" size={12} color="#fff"/>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 7.5, color: 'rgba(240,238,244,0.45)', fontFamily: 'monospace', textAlign: 'center', lineHeight: 1.3 }}>{colorNames[i]}<br/>{c}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.25)', marginTop: 6, textAlign: 'center' }}>tap a swatch to copy hex</p>
        </div>

        {/* merch mockups */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionLabel>merch line</SectionLabel>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 7, background: 'rgba(210,190,255,0.1)', border: '1px solid rgba(210,190,255,0.2)', color: 'rgba(210,190,255,0.8)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              order samples
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MERCH.map((m, i) => (
              <div key={i} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ height: 80, background: `linear-gradient(135deg,${palette[i % palette.length]}22,${palette[(i+1) % palette.length]}11)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.015),rgba(255,255,255,0.015) 2px,transparent 2px,transparent 10px)' }}/>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1 }}>
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{m.icon}</span>
                    <div style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontFamily: 'var(--font-display), serif', fontStyle: 'italic', fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>stencil</span>
                    </div>
                  </div>
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#f0eef4', marginBottom: 2 }}>{m.name}</p>
                  <p style={{ fontSize: 9, color: 'rgba(240,238,244,0.35)' }}>{m.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* creators */}
        <div style={{ padding: '0 22px', marginBottom: 18 }}>
          <SectionLabel>matched creators</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {INFLUENCERS.map((inf, i) => (
              <div key={i} style={{ borderRadius: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                {/* top row: avatar + info */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px 10px' }}>
                  <CreatorAvatar inf={inf}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#f0eef4' }}>{inf.name}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, color: inf.hue, background: `${inf.hue}18`, padding: '2px 6px', borderRadius: 5 }}>{inf.match}%</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(240,238,244,0.4)', marginBottom: 1 }}>{inf.handle} · {inf.followers} followers</p>
                    <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.3)', lineHeight: 1.4 }}>{inf.niche}</p>
                  </div>
                </div>
                {/* bio */}
                <div style={{ padding: '0 14px 10px' }}>
                  <p style={{ fontSize: 10, color: 'rgba(240,238,244,0.35)', lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{inf.bio}&rdquo;</p>
                </div>
                {/* outbound actions */}
                <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {[
                    { label: 'text now', icon: 'zap' as const, href: `sms:${inf.phone}`, accent: inf.hue },
                    { label: 'instagram', icon: 'link' as const, href: `https://instagram.com/${inf.ig}`, accent: 'rgba(255,255,255,0.5)' },
                    { label: 'email', icon: 'arrow' as const, href: `mailto:${inf.email}`, accent: 'rgba(255,255,255,0.5)' },
                  ].map((a, j) => (
                    <a key={j} href={a.href} target="_blank" rel="noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 4px', borderRight: j < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', textDecoration: 'none', color: j === 0 ? inf.hue : 'rgba(240,238,244,0.4)', fontSize: 10, fontWeight: j === 0 ? 600 : 400, background: 'transparent', cursor: 'pointer' }}>
                      <Icon name={a.icon} size={9} color={j === 0 ? inf.hue : 'rgba(255,255,255,0.25)'}/> {a.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* social posts */}
        <div style={{ padding: '0 22px', marginBottom: 28 }}>
          <SectionLabel>social copy</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {POSTS.map((p, i) => (
              <div key={i} style={{ borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(240,238,244,0.5)', fontFamily: 'monospace' }}>{p.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(240,238,244,0.4)', letterSpacing: '0.3px' }}>{p.platform}</span>
                  </div>
                  <CopyBtn k={`post-${i}`} text={p.text}/>
                </div>
                <p style={{ fontSize: 12, color: '#f0eef4', lineHeight: 1.65 }}>{p.text}</p>
              </div>
            ))}
          </div>
          <button style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 12, border: '1px solid rgba(210,190,255,0.2)', background: 'rgba(210,190,255,0.05)', color: 'rgba(210,190,255,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <Icon name="refresh" size={11} color="rgba(210,190,255,0.6)"/> regenerate all posts
          </button>
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
  const [screen, setScreen] = useState<Screen>('upload');
  const [style, setStyle] = useState('lovable');

  const goTo = (s: Screen, st?: string) => {
    if (st) setStyle(st);
    setScreen(s);
  };

  return (
    <div className="phone-shell">
      <div className="dynamic-island"/>
      <div className="phone-screen">
        <StatusBar/>
        <ProgressBar current={screen} onBack={s => goTo(s)}/>
        {screen === 'upload'     && <UploadScreen     onNext={() => goTo('style')}/>}
        {screen === 'style'      && <StyleScreen      onNext={st => goTo('generating', st)}/>}
        {screen === 'generating' && <GeneratingScreen onNext={() => goTo('results')}/>}
        {screen === 'results'    && <ResultsScreen    style={style} onReset={() => goTo('upload')}/>}
        <HomeIndicator/>
      </div>
    </div>
  );
}
