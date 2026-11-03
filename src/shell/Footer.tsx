import { Link } from 'react-router-dom';
import { REPO_URL } from '@/lib/site';
import { LESSONS } from '@/content/registry';
import { REFERENCES } from '@/content/references';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-spectrum" aria-hidden />
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-title">
            photo<span className="brand-accent">nova</span>
          </span>
          <span>
            Open courseware for optical wireless communications. MIT code, CC BY 4.0 content. {LESSONS.length} lessons, {REFERENCES.length} references.
          </span>
          <span className="footer-author">Created by Dr Navid Bani Hassan</span>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div>
            <span className="eyebrow">Learn</span>
            <Link to="/learn">Curriculum</Link>
            <Link to="/glossary">Glossary</Link>
            <Link to="/library">Library</Link>
          </div>
          <div>
            <span className="eyebrow">Explore</span>
            <Link to="/system">System in 3D</Link>
            <Link to="/use-cases">Use cases</Link>
            <Link to="/bench">Optical Bench</Link>
            <Link to="/lab">Link Lab</Link>
          </div>
          <div>
            <span className="eyebrow">Project</span>
            <Link to="/suggest">Suggest an improvement</Link>
            <Link to="/contribute">Contribute</Link>
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            )}
          </div>
        </nav>
      </div>
    </footer>
  );
}
