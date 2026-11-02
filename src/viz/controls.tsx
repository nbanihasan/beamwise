import { useId, type ReactNode } from 'react';

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unit?: string;
  /** logarithmic slider: min/max are the real values, track is uniform in log10 */
  log?: boolean;
}

export function Slider({ label, value, min, max, step, onChange, format, unit, log }: SliderProps) {
  const id = useId();
  const toPos = (v: number) => (log ? Math.log10(v) : v);
  const fromPos = (p: number) => (log ? Math.pow(10, p) : p);
  const pmin = toPos(min);
  const pmax = toPos(max);
  const pos = toPos(value);
  const fill = `${((pos - pmin) / (pmax - pmin)) * 100}%`;
  const shown = format ? format(value) : `${Number(value.toPrecision(3))}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="ctl">
      <div className="ctl-row">
        <label htmlFor={id}>{label}</label>
        <span className="ctl-value">{shown}</span>
      </div>
      <input
        id={id}
        type="range"
        min={pmin}
        max={pmax}
        step={log ? (pmax - pmin) / 200 : step ?? (max - min) / 100}
        value={pos}
        style={{ ['--fill' as string]: fill }}
        onChange={(e) => onChange(fromPos(parseFloat(e.target.value)))}
      />
    </div>
  );
}

interface SegProps<T extends string | number> {
  label?: ReactNode;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegProps<T>) {
  return (
    <div className="ctl">
      {label && (
        <div className="ctl-row">
          <label>{label}</label>
        </div>
      )}
      <div className="seg" role="radiogroup">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label className="toggle" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function GroupTitle({ children }: { children: ReactNode }) {
  return <div className="ctl-group-title">{children}</div>;
}

export function Readouts({ children }: { children: ReactNode }) {
  return <div className="readouts">{children}</div>;
}

export function Readout({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className={`readout ${tone ?? ''}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

interface WidgetProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  controls?: ReactNode;
  caption?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

/** Standard frame for every interactive figure: header, visual area, control rail, caption. */
export function Widget({ title, eyebrow = 'Interactive', controls, caption, children, flush }: WidgetProps) {
  return (
    <figure className="widget">
      <div className="widget-head">
        <div className="widget-title">{title}</div>
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <div className={`widget-body ${controls ? '' : 'stack'}`}>
        <div className={`widget-viz ${flush ? 'flush' : ''}`}>{children}</div>
        {controls && <div className="widget-controls">{controls}</div>}
      </div>
      {caption && <figcaption className="widget-caption">{caption}</figcaption>}
    </figure>
  );
}

export const berTone = (ber: number): 'good' | 'warn' | 'bad' => (ber < 1e-6 ? 'good' : ber < 3.8e-3 ? 'warn' : 'bad');

interface SelectProps<T extends string> {
  label?: ReactNode;
  value: T;
  options: { value: T; label: string; group?: string }[];
  onChange: (v: T) => void;
}

/** Native dropdown for long option lists (keyboard and screen-reader friendly). */
export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  const id = useId();
  const groups = Array.from(new Set(options.map((o) => o.group ?? '')));
  return (
    <div className="ctl">
      {label && (
        <div className="ctl-row">
          <label htmlFor={id}>{label}</label>
        </div>
      )}
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {groups.map((g) =>
          g ? (
            <optgroup key={g} label={g}>
              {options
                .filter((o) => o.group === g)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
          ) : (
            options
              .filter((o) => !o.group)
              .map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
          ),
        )}
      </select>
    </div>
  );
}
