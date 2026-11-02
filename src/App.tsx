import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TopBar } from '@/shell/TopBar';
import { Footer } from '@/shell/Footer';
import { CommandPalette } from '@/shell/CommandPalette';
import { Home } from '@/pages/Home';
import { Learn } from '@/pages/Learn';
import { LessonPage } from '@/pages/LessonPage';
import { Library } from '@/pages/Library';
import { Glossary } from '@/pages/Glossary';
import { Contribute } from '@/pages/Contribute';
import { NotFound } from '@/pages/NotFound';

const LinkLabPage = lazy(() => import('@/pages/LinkLabPage'));

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [loc.pathname]);

  return (
    <div className="app">
      <TopBar onSearch={() => setPaletteOpen(true)} />
      <main>
        <Suspense fallback={<div className="page muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:id" element={<LessonPage />} />
            <Route path="/lab" element={<LinkLabPage />} />
            <Route path="/library" element={<Library />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/contribute" element={<Contribute />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
