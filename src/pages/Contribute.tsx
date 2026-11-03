import { Link } from 'react-router-dom';
import { REPO_URL, SITE_NAME } from '@/lib/site';
import { WIDGETS } from '@/widgets';
import { IconArrow } from '@/shell/Icons';

const repo = REPO_URL || 'https://github.com/nbanihasan/photonova';

/** How to contribute: a no-code path (suggestions) and a step-by-step code path (fork → PR). */
export function Contribute() {
  return (
    <div className="page contribute">
      <span className="eyebrow">Contribute</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0 12px' }}>Help build {SITE_NAME}</h1>
      <p className="muted" style={{ maxWidth: '68ch', marginTop: 0 }}>
        The field moves every month. Anyone can improve {SITE_NAME}: fix a mistake, propose a lesson, add a figure, a use case or a Bench component. Lesson text and
        figures are CC BY 4.0, code is MIT, and every contributor is credited.
      </p>

      <div className="ct-paths">
        <Link to="/suggest" className="ct-path">
          <span className="eyebrow">No code needed</span>
          <h2>Suggest an improvement</h2>
          <p>Fill in a short form. It becomes a tracked GitHub issue, ready to send. Best for corrections, topic ideas and bug reports.</p>
          <span className="bento-go">
            Open the form <IconArrow />
          </span>
        </Link>
        <a href="#code-path" className="ct-path" onClick={(e) => { e.preventDefault(); document.getElementById('code-path')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <span className="eyebrow">For developers and authors</span>
          <h2>Change it yourself</h2>
          <p>Write a lesson, build a figure or extend the simulator, then send a pull request. Follow the seven steps below.</p>
          <span className="bento-go">
            See the steps <IconArrow />
          </span>
        </a>
      </div>

      <h2 id="code-path" className="ct-h2">
        Contribute code or content in seven steps
      </h2>
      <p className="muted" style={{ maxWidth: '68ch' }}>
        You need a free GitHub account, Git and Node.js 20 or newer. Nothing changes on the live site until a maintainer reviews and merges your pull request, so you
        cannot break anything by trying.
      </p>
      <ol className="ct-steps">
        <li>
          <h3>Fork the repository</h3>
          <p>
            On{' '}
            <a href={repo} target="_blank" rel="noreferrer">
              GitHub
            </a>
            , press <b>Fork</b>. You get your own copy to work in.
          </p>
        </li>
        <li>
          <h3>Get it running on your computer</h3>
          <pre className="ct-code">{`git clone https://github.com/<your-name>/photonova.git
cd photonova
npm install
npm run dev        # opens http://localhost:5173`}</pre>
        </li>
        <li>
          <h3>Make a branch for your change</h3>
          <pre className="ct-code">{`git checkout -b fix-photodiode-units`}</pre>
        </li>
        <li>
          <h3>Make your change</h3>
          <p>Pick the recipe that fits; the browser reloads as you save.</p>
          <div className="ct-recipes">
            <div>
              <b>A lesson</b>
              <p>
                Run <code>npm run new:lesson -- channel my-topic "My topic"</code>. Edit <code>meta.ts</code> (title, level, prerequisites, references) and{' '}
                <code>lesson.mdx</code> (Markdown with <code>$LaTeX$</code> and any figure by name). It appears in the curriculum and search automatically.
              </p>
            </div>
            <div>
              <b>A figure or simulation</b>
              <p>
                Put the maths in <code>src/sim/</code> with a test, build the figure in <code>src/widgets/</code> from the shared <code>Widget</code>, <code>Plot</code>,{' '}
                <code>Slider</code> and <code>Stage</code> parts, and register it in <code>src/widgets/index.ts</code>.
              </p>
            </div>
            <div>
              <b>A Bench component or scenario</b>
              <p>
                Add it to <code>src/bench/catalog.ts</code> or <code>scenarios.ts</code>, its optics in <code>tracer.ts</code> or detector model in <code>link.ts</code>, and
                a 3D model in <code>BenchModels.tsx</code>.
              </p>
            </div>
            <div>
              <b>A use case or reference</b>
              <p>
                Use cases live in <code>src/usecases/data.ts</code> with a scene in <code>scenes.tsx</code>; references in <code>src/content/references.ts</code>, each with
                a checked DOI.
              </p>
            </div>
          </div>
        </li>
        <li>
          <h3>Check it</h3>
          <pre className="ct-code">{`npm run typecheck
npm test
npm run build`}</pre>
          <p>Also look at your page at phone width and in both light and dark themes.</p>
        </li>
        <li>
          <h3>Commit and push</h3>
          <pre className="ct-code">{`git add -A
git commit -m "Fix photodiode responsivity units"
git push -u origin fix-photodiode-units`}</pre>
        </li>
        <li>
          <h3>Open a pull request</h3>
          <p>
            GitHub shows a <b>Compare &amp; pull request</b> button on your fork. Describe what you changed and why, with sources for any physics. The automatic checks run,
            a maintainer reviews, and once merged your work is live within minutes.
          </p>
        </li>
      </ol>

      <h2 className="ct-h2">Quality bar</h2>
      <ul className="muted" style={{ maxWidth: '70ch' }}>
        <li>Every equation states its assumptions and cites a survey, tutorial, textbook or standard from the Library.</li>
        <li>Every simulation is deterministic (seeded) and has at least one unit test against a known result.</li>
        <li>Figures work at phone width, in light and dark themes, and without WebGL (3D degrades to a message, the plots still work).</li>
        <li>Plain language first; the maths follows the intuition, never the other way round.</li>
      </ul>

      <h2 className="ct-h2">Figures you can use in any lesson</h2>
      <div className="widget-names">
        {Object.keys(WIDGETS).map((n) => (
          <code key={n}>{`<${n} />`}</code>
        ))}
      </div>

      <div className="ct-cta">
        <a className="btn primary" href={repo} target="_blank" rel="noreferrer">
          Open the repository
        </a>
        <a className="btn" href={`${repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
          Full contributor guide
        </a>
        <Link className="btn ghost" to="/suggest">
          Or just suggest something
        </Link>
      </div>
    </div>
  );
}
