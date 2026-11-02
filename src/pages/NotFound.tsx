import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="page" style={{ minHeight: '50vh' }}>
      <span className="eyebrow">404 · no line of sight</span>
      <h1 style={{ fontSize: 'var(--step-4)', margin: '10px 0' }}>This page is outside the receiver’s field of view.</h1>
      <p className="muted">The link may point to a lesson that was renamed. The curriculum lists everything that exists today.</p>
      <Link className="btn primary" to="/learn">
        Go to the curriculum
      </Link>
    </div>
  );
}
