import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme, type ThemeChoice } from '@/lib/theme';
import { BrandMark, IconAuto, IconGithub, IconMenu, IconMoon, IconSearch, IconSun } from './Icons';
import { REPO_URL } from '@/lib/site';

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'dark', dark: 'light', light: 'system' };

export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { choice, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Lumen Atlas home">
        <BrandMark />
        <span>Lumen Atlas</span>
      </Link>
      <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
        <NavLink to="/learn">Learn</NavLink>
        <NavLink to="/lab">Link Lab</NavLink>
        <NavLink to="/library">Library</NavLink>
        <NavLink to="/glossary">Glossary</NavLink>
        <NavLink to="/contribute">Contribute</NavLink>
      </nav>
      <div className="topbar-right">
        <button className="search-btn" type="button" onClick={onSearch} aria-label="Search lessons, terms and papers">
          <IconSearch />
          <span className="label">Search the atlas</span>
          <kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => setChoice(NEXT[choice])}
          aria-label={`Theme: ${choice}. Switch to ${NEXT[choice]}`}
          title={`Theme: ${choice}`}
        >
          {choice === 'system' ? <IconAuto /> : choice === 'dark' ? <IconMoon /> : <IconSun />}
        </button>
        {REPO_URL && (
          <a className="icon-btn" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source code on GitHub">
            <IconGithub />
          </a>
        )}
        <button className="icon-btn menu-btn" type="button" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          <IconMenu />
        </button>
      </div>
    </header>
  );
}
