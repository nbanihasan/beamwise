import { Link } from 'react-router-dom';
import { REPO_URL } from '@/lib/site';
import { LESSONS } from '@/content/registry';
import { REFERENCES } from '@/content/references';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>
          Lumen Atlas · open source (MIT code, CC BY 4.0 content) · {LESSONS.length} lessons · {REFERENCES.length} curated references
        </span>
        <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link to="/contribute">Add a lesson</Link>
          {REPO_URL && (
            <>
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
                Report an error
              </a>
            </>
          )}
        </span>
      </div>
    </footer>
  );
}
