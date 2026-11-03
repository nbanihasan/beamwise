import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { REPO_URL } from '@/lib/site';
import { NavIcon } from './NavIcons';

/**
 * Navigation for phones and small laptops.
 * - MenuSheet: a full overlay opened from ☰ (or "More" in the tab bar), with large targets, sections,
 *   the theme switch and search. Closes on ✕, backdrop tap, Escape and navigation; locks page scroll.
 * - TabBar: a thumb-reachable bottom bar on phones (hidden on the Optical Bench, which has its own).
 */
const EXPLORE = [
  { to: '/', label: 'Home', icon: NavIcon.home, end: true },
  { to: '/learn', label: 'Learn', icon: NavIcon.learn, hint: '32 lessons, zero to hero' },
  { to: '/system', label: 'System in 3D', icon: NavIcon.system, hint: 'The whole link, block by block' },
  { to: '/use-cases', label: 'Use cases', icon: NavIcon.usecases, hint: '13 applications in 3D' },
  { to: '/bench', label: 'Optical Bench', icon: NavIcon.bench, hint: 'Build and test a link' },
  { to: '/lab', label: 'Link Lab', icon: NavIcon.lab, hint: 'Simulate a link sample by sample' },
  { to: '/library', label: 'Library', icon: NavIcon.library, hint: 'Every reference, checked' },
  { to: '/glossary', label: 'Glossary', icon: NavIcon.glossary },
];

const THEMES: { v: ThemeChoice; label: string }[] = [
  { v: 'dark', label: 'Dark' },
  { v: 'light', label: 'Light' },
  { v: 'system', label: 'Auto' },
];

export function MenuSheet({ open, onClose, onSearch }: { open: boolean; onClose: () => void; onSearch: () => void }) {
  const { choice, setChoice } = useTheme();
  const panel = useRef<HTMLDivElement>(null);
  const loc = useLocation();

  useEffect(() => {
    if (open) onClose();
    // close whenever the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className={`msheet ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="msheet-backdrop" onClick={onClose} />
      <div className="msheet-panel" ref={panel} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="msheet-head">
          <button type="button" className="msheet-search" onClick={() => { onClose(); onSearch(); }}>
            <NavIcon.search />
            Search Photonova
          </button>
          <button type="button" className="msheet-close" onClick={onClose} aria-label="Close menu">
            <NavIcon.close />
          </button>
        </div>

        <span className="msheet-sec">Explore</span>
        <nav className="msheet-list" aria-label="Main">
          {EXPLORE.map(({ to, label, icon: I, hint, end }) => (
            <NavLink key={to} to={to} end={end} className="msheet-item" tabIndex={open ? 0 : -1}>
              <span className="msheet-ic">
                <I />
              </span>
              <span className="msheet-txt">
                <b>{label}</b>
                {hint && <small>{hint}</small>}
              </span>
            </NavLink>
          ))}
        </nav>

        <span className="msheet-sec">Get involved</span>
        <div className="msheet-list two">
          <NavLink to="/contribute" className="msheet-item cta" tabIndex={open ? 0 : -1}>
            <span className="msheet-ic">
              <NavIcon.contribute />
            </span>
            <span className="msheet-txt">
              <b>Contribute</b>
            </span>
          </NavLink>
          <NavLink to="/suggest" className="msheet-item" tabIndex={open ? 0 : -1}>
            <span className="msheet-ic">
              <NavIcon.suggest />
            </span>
            <span className="msheet-txt">
              <b>Suggest</b>
            </span>
          </NavLink>
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="msheet-item" tabIndex={open ? 0 : -1}>
              <span className="msheet-ic">
                <NavIcon.github />
              </span>
              <span className="msheet-txt">
                <b>Source on GitHub</b>
              </span>
            </a>
          )}
        </div>

        <span className="msheet-sec">Appearance</span>
        <div className="msheet-theme" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.v} type="button" role="radio" aria-checked={choice === t.v} className={choice === t.v ? 'on' : ''} onClick={() => setChoice(t.v)} tabIndex={open ? 0 : -1}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const loc = useLocation();
  if (loc.pathname.startsWith('/bench')) return null;
  const items = [
    { to: '/learn', label: 'Learn', icon: NavIcon.learn },
    { to: '/system', label: 'System', icon: NavIcon.system },
    { to: '/use-cases', label: 'Use cases', icon: NavIcon.usecases },
    { to: '/bench', label: 'Bench', icon: NavIcon.bench },
  ];
  return (
    <nav className="tabbar" aria-label="Quick navigation">
      {items.map(({ to, label, icon: I }) => (
        <NavLink key={to} to={to} className="tab">
          <I />
          <span>{label}</span>
        </NavLink>
      ))}
      <button type="button" className={`tab ${moreOpen ? 'active' : ''}`} onClick={onMore} aria-label="More: all pages and settings" aria-expanded={moreOpen}>
        <NavIcon.more />
        <span>More</span>
      </button>
    </nav>
  );
}
