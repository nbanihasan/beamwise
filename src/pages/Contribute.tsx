import { REPO_URL } from '@/lib/site';
import { WIDGETS } from '@/widgets';

export function Contribute() {
  return (
    <div className="page contribute">
      <span className="eyebrow">Contribute</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0 12px' }}>Add what you know</h1>
      <p className="muted" style={{ maxWidth: '66ch', marginTop: 0 }}>
        The field moves every month. Photonova is structured so a new lesson, figure, reference or simulation is a small, self-contained pull request. Content is
        CC BY 4.0, code is MIT.
      </p>

      <div className="contrib-grid">
        <section>
          <h2>Add a lesson</h2>
          <ol className="steps">
            <li>
              <div>
                Run <code>npm run new:lesson -- channel my-topic</code>, or copy any folder in <code>src/content/lessons/</code>.
              </div>
            </li>
            <li>
              <div>
                Fill in <code>meta.ts</code>: title, level, minutes, prerequisites, objectives and reference ids.
              </div>
            </li>
            <li>
              <div>
                Write <code>lesson.mdx</code>: Markdown, <code>$inline$</code> and <code>$$display$$</code> LaTeX, and any figure by name, such as{' '}
                <code>{'<LambertianRoom />'}</code>.
              </div>
            </li>
            <li>
              <div>
                Run <code>npm run dev</code>. The lesson appears in the curriculum, search and navigation automatically.
              </div>
            </li>
          </ol>
        </section>
        <section>
          <h2>Add a figure or simulation</h2>
          <ol className="steps">
            <li>
              <div>
                Put the physics or DSP in <code>src/sim/</code> as pure TypeScript and test it in <code>src/sim/sim.test.ts</code>.
              </div>
            </li>
            <li>
              <div>
                Build the figure in <code>src/widgets/</code> with the shared <code>Widget</code>, <code>Plot</code>, <code>Slider</code> and <code>Stage</code> (3D) parts.
              </div>
            </li>
            <li>
              <div>
                Register it in <code>src/widgets/index.ts</code>. It is then usable in every lesson.
              </div>
            </li>
          </ol>
        </section>
      </div>

      <h2 style={{ marginTop: 40 }}>Figures available today</h2>
      <div className="widget-names">
        {Object.keys(WIDGETS).map((n) => (
          <code key={n}>{`<${n} />`}</code>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>Quality bar</h2>
      <ul className="muted" style={{ maxWidth: '70ch' }}>
        <li>Every equation states its assumptions and cites a survey, tutorial, textbook or standard from the Library.</li>
        <li>Every simulation is deterministic (seeded) and has at least one unit test against a known result.</li>
        <li>Figures work at phone width, in light and dark themes, and without WebGL (3D degrades to a message, the plots still work).</li>
        <li>Plain language first; the maths follows the intuition, never the other way round.</li>
      </ul>
      {REPO_URL && (
        <p>
          <a className="btn primary" href={REPO_URL} target="_blank" rel="noreferrer">
            Open the repository
          </a>
        </p>
      )}
    </div>
  );
}
