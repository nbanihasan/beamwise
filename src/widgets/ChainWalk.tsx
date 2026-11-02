import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BLOCKS } from '@/arch/blocks';
import { runChain } from '@/arch/chain';
import { SignalView, describeSignal } from '@/arch/SignalView';
import { Widget } from '@/viz/controls';

/** Step through the 19 blocks of a VLC link and see the signal change at each one. */
export default function ChainWalk() {
  const sig = useMemo(runChain, []);
  const [i, setI] = useState(0);
  const b = BLOCKS[i];
  const d = describeSignal(b.signal, sig);
  return (
    <Widget title="Walk the chain" eyebrow="Interactive · end to end" caption={<p>{b.what}</p>}>
      <div className="chain-rail" role="tablist" aria-label="Blocks">
        {BLOCKS.map((x, k) => (
          <button key={x.id} type="button" role="tab" aria-selected={k === i} className={`chain-dot ${x.domain} ${k === i ? 'on' : ''} ${k < i ? 'past' : ''}`} onClick={() => setI(k)} title={x.name}>
            <span>{x.n}</span>
          </button>
        ))}
      </div>
      <div className="chain-card">
        <div className="chain-card-head">
          <span className="eyebrow">
            {b.side === 'tx' ? 'Transmitter' : b.side === 'rx' ? 'Receiver' : 'Channel'} · {b.domain}
          </span>
          <h3>
            {b.n}. {b.name}
          </h3>
          <span className="mono small muted">{d.title}</span>
        </div>
        <div className="chain-signal">
          <SignalView key={b.id} draw={d.draw} height={110} />
        </div>
        {d.legend && <p className="small muted" style={{ margin: '8px 0 0' }}>{d.legend}</p>}
        <div className="chain-nav">
          <button type="button" className="btn small" disabled={i === 0} onClick={() => setI(i - 1)}>
            Previous
          </button>
          <button type="button" className="btn small primary" disabled={i === BLOCKS.length - 1} onClick={() => setI(i + 1)}>
            Next block
          </button>
          <Link to={`/system?block=${b.id}`} className="btn small">
            See it in 3D
          </Link>
        </div>
      </div>
    </Widget>
  );
}
