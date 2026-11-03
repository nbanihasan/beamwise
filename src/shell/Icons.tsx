/** Hand-drawn icon set (stroke icons, 1.6px) so the app needs no icon dependency. */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconSearch = () => (
  <svg {...base} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const IconSun = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </svg>
);
export const IconMoon = () => (
  <svg {...base} aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </svg>
);
export const IconAuto = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
  </svg>
);
export const IconMenu = () => (
  <svg {...base} aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconGithub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);
export const IconArrow = () => (
  <svg {...base} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

/** Brand mark: an emitter sending a beam, wrapped in spectrum-coloured wireless arcs. */
export const BrandMark = () => (
  <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
    <defs>
      <linearGradient id="bw-beam" x1="0" x2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#ffd27a" stopOpacity="0.2" />
      </linearGradient>
      <radialGradient id="bw-glow">
        <stop offset="0" stopColor="#fff6dc" />
        <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="7" cy="16" r="6.5" fill="url(#bw-glow)" opacity="0.55" />
    <path d="M7 16H30" stroke="url(#bw-beam)" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M12.1 9.9A8 8 0 0 1 12.1 22.1" fill="none" stroke="#b49bff" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M16 5.3A14 14 0 0 1 16 26.7" fill="none" stroke="#5ad8ff" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M19.2 1.9A19 19 0 0 1 19.2 30.1" fill="none" stroke="#ffcf6b" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="7" cy="16" r="2.8" fill="#fff" />
  </svg>
);
