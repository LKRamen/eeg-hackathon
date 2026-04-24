'use client';

export type IconName =
  | 'asterisk' | 'arrow' | 'upload' | 'check' | 'copy' | 'refresh'
  | 'link' | 'x' | 'sparkle' | 'users' | 'video' | 'package'
  | 'brain' | 'zap' | 'map' | 'tag';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5 }: IconProps) {
  const s: React.CSSProperties = { width: size, height: size, display: 'block', flexShrink: 0 };
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  const icons: Record<IconName, React.ReactNode> = {
    asterisk: <svg viewBox="0 0 24 24" style={s}><line x1="12" y1="2" x2="12" y2="22" {...p}/><line x1="4.93" y1="6" x2="19.07" y2="18" {...p}/><line x1="19.07" y1="6" x2="4.93" y2="18" {...p}/></svg>,
    arrow:    <svg viewBox="0 0 24 24" style={s}><line x1="5" y1="12" x2="19" y2="12" {...p}/><polyline points="13 6 19 12 13 18" {...p}/></svg>,
    upload:   <svg viewBox="0 0 24 24" style={s}><polyline points="16 16 12 12 8 16" {...p}/><line x1="12" y1="12" x2="12" y2="21" {...p}/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" {...p}/></svg>,
    check:    <svg viewBox="0 0 24 24" style={s}><polyline points="20 6 9 17 4 12" {...p}/></svg>,
    copy:     <svg viewBox="0 0 24 24" style={s}><rect x="9" y="9" width="13" height="13" rx="2" {...p}/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...p}/></svg>,
    refresh:  <svg viewBox="0 0 24 24" style={s}><polyline points="23 4 23 10 17 10" {...p}/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" {...p}/></svg>,
    link:     <svg viewBox="0 0 24 24" style={s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" {...p}/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" {...p}/></svg>,
    x:        <svg viewBox="0 0 24 24" style={s}><line x1="18" y1="6" x2="6" y2="18" {...p}/><line x1="6" y1="6" x2="18" y2="18" {...p}/></svg>,
    sparkle:  <svg viewBox="0 0 24 24" style={s}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" {...p}/></svg>,
    users:    <svg viewBox="0 0 24 24" style={s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...p}/><circle cx="9" cy="7" r="4" {...p}/><path d="M23 21v-2a4 4 0 0 0-3-3.87" {...p}/><path d="M16 3.13a4 4 0 0 1 0 7.75" {...p}/></svg>,
    video:    <svg viewBox="0 0 24 24" style={s}><polygon points="23 7 16 12 23 17 23 7" {...p}/><rect x="1" y="5" width="15" height="14" rx="2" {...p}/></svg>,
    package:  <svg viewBox="0 0 24 24" style={s}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" {...p}/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" {...p}/><polyline points="3.27 6.96 12 12.01 20.73 6.96" {...p}/><line x1="12" y1="22.08" x2="12" y2="12" {...p}/></svg>,
    brain:    <svg viewBox="0 0 24 24" style={s}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14" {...p}/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14" {...p}/></svg>,
    zap:      <svg viewBox="0 0 24 24" style={s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...p}/></svg>,
    map:      <svg viewBox="0 0 24 24" style={s}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" {...p}/><line x1="8" y1="2" x2="8" y2="18" {...p}/><line x1="16" y1="6" x2="16" y2="22" {...p}/></svg>,
    tag:      <svg viewBox="0 0 24 24" style={s}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" {...p}/><line x1="7" y1="7" x2="7.01" y2="7" {...p}/></svg>,
  };

  return <>{icons[name] ?? null}</>;
}

export function LogoMark({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="12" y1="1" x2="12" y2="23" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="4.27" y1="5.5" x2="19.73" y2="18.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="19.73" y1="5.5" x2="4.27" y2="18.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
