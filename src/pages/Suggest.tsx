import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { REPO_URL, SITE_NAME } from '@/lib/site';
import { LESSONS } from '@/content/registry';
import { USE_CASES } from '@/usecases/data';
import { IconArrow } from '@/shell/Icons';

/**
 * Suggest an improvement without touching code. The form builds a well-structured GitHub issue and
 * opens it prefilled; the visitor only signs in (free) and presses "Submit new issue".
 * Deep links: #/suggest?kind=fix&from=<lesson-id or page>
 */
type Kind = 'fix' | 'lesson' | 'usecase' | 'feature' | 'bug';

const KINDS: { id: Kind; label: string; blurb: string; titlePrefix: string; labels: string; detailsLabel: string; detailsHint: string }[] = [
  { id: 'fix', label: 'Fix an error', blurb: 'A wrong number, equation, explanation or citation.', titlePrefix: 'Correction', labels: 'content,bug', detailsLabel: 'What is wrong, and what should it say?', detailsHint: 'e.g. "The FOV in equation 3 should be the half-angle, not the full angle (see Kahn & Barry 1997, eq. 10)."' },
  { id: 'lesson', label: 'Suggest a lesson or figure', blurb: 'A topic that is missing, or an interactive figure that would help.', titlePrefix: 'Lesson idea', labels: 'content', detailsLabel: 'What should a learner understand or be able to do afterwards?', detailsHint: 'e.g. "A lesson on optical beamforming with a figure where you steer a VCSEL array and watch the received power."' },
  { id: 'usecase', label: 'Add a use case or Bench part', blurb: 'A real application, scenario or component worth modelling.', titlePrefix: 'Use case / Bench', labels: 'content,enhancement', detailsLabel: 'Describe it: where it is used, typical range, rate and hardware', detailsHint: 'e.g. "Li-Fi in operating theatres: no RF interference with equipment, 2–3 m, 100 Mb/s, ceiling LED panels."' },
  { id: 'feature', label: 'Idea for the website', blurb: 'Something that would make Photonova easier or more useful.', titlePrefix: 'Idea', labels: 'enhancement', detailsLabel: 'What would you like, and why?', detailsHint: 'e.g. "Let me export a Bench setup as a PDF report for my lab notes."' },
  { id: 'bug', label: 'Something is broken', blurb: 'A page or figure that does not work or looks wrong.', titlePrefix: 'Bug', labels: 'bug', detailsLabel: 'What did you do, what happened, and what did you expect?', detailsHint: 'e.g. "On my phone the Link Lab eye diagram is blank after I change the modulation to PAM-4."' },
];

export function Suggest() {
  const [params] = useSearchParams();
  const initialKind = (KINDS.find((k) => k.id === params.get('kind'))?.id ?? 'fix') as Kind;
  const from = params.get('from') ?? '';
  const [kind, setKind] = useState<Kind>(initialKind);
  const [where, setWhere] = useState(from);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [honey, setHoney] = useState('');
  const [send, setSend] = useState<{ state: 'idle' | 'sending' | 'sent' | 'error'; url?: string; msg?: string }>({ state: 'idle' });
  const k = KINDS.find((x) => x.id === kind)!;

  const places = useMemo(
    () => [
      { value: '', label: 'General / not specific' },
      ...LESSONS.map((l) => ({ value: l.id, label: `Lesson: ${l.title}` })),
      ...USE_CASES.map((u) => ({ value: `use-case:${u.id}`, label: `Use case: ${u.title}` })),
      { value: 'bench', label: 'Optical Bench' },
      { value: 'system', label: 'System view (3D)' },
      { value: 'lab', label: 'Link Lab' },
      { value: 'home', label: 'Home page' },
    ],
    [],
  );
  const placeLabel = places.find((p) => p.value === where)?.label ?? where;

  const issueTitle = `[${k.titlePrefix}] ${title.trim() || '(short summary)'}`;
  const body = [
    `**Type:** ${k.label}`,
    `**Where:** ${where ? `${placeLabel} (\`${where}\`)` : 'General'}`,
    '',
    `**${k.detailsLabel}**`,
    details.trim() || '_(details)_',
    '',
    source.trim() ? `**Source / link:** ${source.trim()}\n` : null,
    name.trim() ? `**Suggested by:** ${name.trim()}\n` : null,
    `---\n_Sent from the ${SITE_NAME} suggestion form._`,
  ]
    .filter((x) => x !== null)
    .join('\n');

  const ready = title.trim().length >= 4 && details.trim().length >= 10;
  const issueUrl = `${REPO_URL}/issues/new?${new URLSearchParams({ title: issueTitle, body, labels: k.labels }).toString()}`;

  // The no-account path posts to a Cloudflare Pages Function. The GitHub Pages mirror has no functions,
  // so it posts to the Cloudflare deployment instead.
  const api = typeof location !== 'undefined' && location.hostname.endsWith('github.io') ? 'https://photonova.pages.dev/api/suggest' : '/api/suggest';
  const submit = async () => {
    if (!ready || send.state === 'sending') return;
    setSend({ state: 'sending' });
    try {
      const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: issueTitle, body, labels: k.labels, website: honey }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
      if (res.ok && j.ok) setSend({ state: 'sent', url: j.url });
      else setSend({ state: 'error', msg: j.error || 'The suggestion could not be sent right now.' });
    } catch {
      setSend({ state: 'error', msg: 'The suggestion could not be sent right now.' });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${issueTitle}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked: the preview text can still be selected by hand */
    }
  };

  return (
    <div className="page suggest">
      <span className="eyebrow">Suggest an improvement</span>
      <h1>
        Help make {SITE_NAME} <em>better</em>
      </h1>
      <p className="muted lede">Spotted an error, missing a topic, or have an idea? No code and no account needed: fill in the form and it becomes a tracked request the maintainers review.</p>

      <ol className="sg-steps" aria-label="How it works">
        <li>
          <b>1</b>
          <span>Fill in the form below.</span>
        </li>
        <li>
          <b>2</b>
          <span>
            Press <em>Send suggestion</em>. No account or email needed.
          </span>
        </li>
        <li>
          <b>3</b>
          <span>It becomes a public request that the maintainers review. You get a link to follow it.</span>
        </li>
      </ol>

      <div className="sg-grid">
        <form className="sg-form" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>What kind of suggestion?</legend>
            <div className="sg-kinds">
              {KINDS.map((x) => (
                <label key={x.id} className={`sg-kind ${kind === x.id ? 'on' : ''}`}>
                  <input type="radio" name="kind" value={x.id} checked={kind === x.id} onChange={() => setKind(x.id)} />
                  <b>{x.label}</b>
                  <span>{x.blurb}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="sg-field">
            <span>Where is it about?</span>
            <select className="select" value={where} onChange={(e) => setWhere(e.target.value)}>
              {!places.some((p) => p.value === where) && <option value={where}>{where}</option>}
              {places.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sg-field">
            <span>Short summary</span>
            <input className="sg-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="One line, e.g. “Wrong unit for responsivity in the photodetector lesson”" required />
          </label>

          <label className="sg-field">
            <span>{k.detailsLabel}</span>
            <textarea className="sg-input" rows={7} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={k.detailsHint} required />
          </label>

          <label className="sg-field">
            <span>
              Source or link <i>(optional, but very helpful for corrections)</i>
            </span>
            <input className="sg-input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="DOI, paper, standard or URL" />
          </label>

          <label className="sg-field">
            <span>
              Your name for the credits <i>(optional, will be public)</i>
            </span>
            <input className="sg-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>

          {/* honeypot: hidden from people, tempting for bots */}
          <label className="sg-hp" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} />
          </label>

          {send.state === 'sent' ? (
            <div className="sg-done" role="status">
              <b>Thank you, your suggestion was sent.</b>
              <span>
                It is now a public issue the maintainers will review.{' '}
                {send.url && (
                  <a href={send.url} target="_blank" rel="noreferrer">
                    See it on GitHub
                  </a>
                )}
              </span>
            </div>
          ) : (
            <>
              <div className="sg-actions">
                <button type="button" className="btn primary" onClick={submit} disabled={!ready || send.state === 'sending'}>
                  {send.state === 'sending' ? 'Sending…' : 'Send suggestion'}
                </button>
                {!ready && <span className="small muted">Add a summary and a few words of detail to continue.</span>}
              </div>
              {send.state === 'error' && (
                <p className="sg-err" role="alert">
                  {send.msg} You can still send it with a GitHub account, or copy the text below.
                </p>
              )}
              <div className="sg-alt">
                <span className="small muted">Have a GitHub account? Send it yourself and get notified of replies:</span>
                {REPO_URL ? (
                  <a className={`btn small ${ready ? '' : 'disabled'}`} href={ready ? issueUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!ready} onClick={(e) => !ready && e.preventDefault()}>
                    Open on GitHub <IconArrow />
                  </a>
                ) : null}
                <button type="button" className="btn small ghost" onClick={copy} disabled={!ready}>
                  {copied ? 'Copied' : 'Copy the text'}
                </button>
              </div>
            </>
          )}
          <p className="small muted" style={{ margin: 0 }}>
            No account needed. Suggestions become public GitHub issues, so please don’t include private information. Nothing about you is collected beyond what you type.
          </p>
        </form>

        <aside className="sg-preview" aria-label="Preview">
          <span className="eyebrow">Preview</span>
          <h3>{issueTitle}</h3>
          <pre>{body}</pre>
        </aside>
      </div>

      <p className="muted small" style={{ marginTop: 28 }}>
        Want to make the change yourself? See <Link to="/contribute">how to contribute</Link>.
      </p>
    </div>
  );
}
