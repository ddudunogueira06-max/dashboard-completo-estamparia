interface Props {
  value: number; // 0..100
  label?: string;
  goal?: number; // threshold for green
  size?: number;
}

const polar = (cx: number, cy: number, r: number, pct: number) => {
  const a = Math.PI * (1 - pct / 100);
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
};

/** Speedometer-style gauge (semicircle) with a large centered % readout. */
export function Gauge({ value, label, goal = 90, size = 240 }: Props) {
  const pct = Math.max(0, Math.min(100, value));

  const w = size;
  const stroke = size * 0.11;
  const cx = w / 2;
  const r = (w - stroke) / 2 - 6;
  const cy = stroke / 2 + r + 6;
  const h = cy + size * 0.16;

  const red = "oklch(0.62 0.23 25)";
  const yellow = "oklch(0.85 0.18 90)";
  const green = "oklch(0.65 0.18 145)";
  const t1 = Math.max(0, goal - 20);
  const t2 = goal;
  const color = pct >= t2 ? green : pct >= t1 ? yellow : red;

  const arc = (from: number, to: number, c: string) => {
    const p0 = polar(cx, cy, r, from);
    const p1 = polar(cx, cy, r, to);
    const large = to - from > 50 ? 1 : 0;
    return <path d={`M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`} stroke={c} strokeWidth={stroke} fill="none" strokeLinecap="round" />;
  };

  const needle = polar(cx, cy, r - stroke * 0.7, pct);
  const goalMark = polar(cx, cy, r, goal);
  const goalInner = polar(cx, cy, r - stroke, goal);

  return (
    <div className="flex flex-col items-center">
      {label && <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* track */}
        {arc(0, 100, "oklch(0.3 0.02 250)")}
        {/* zones */}
        {arc(0, t1, red)}
        {arc(t1, t2, yellow)}
        {arc(t2, 100, green)}
        {/* goal marker */}
        <line x1={goalInner.x} y1={goalInner.y} x2={goalMark.x} y2={goalMark.y} stroke="oklch(0.99 0 0)" strokeWidth={2} />
        {/* needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="oklch(0.95 0.01 240)" strokeWidth={size * 0.02} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={size * 0.05} fill="oklch(0.95 0.01 240)" />
        <circle cx={cx} cy={cy} r={size * 0.024} fill={color} />
        {/* big centered value */}
        <text x={cx} y={cy - size * 0.16} textAnchor="middle" fontSize={size * 0.2} fontWeight={800} fill={color}>{pct.toFixed(1)}%</text>
        {/* min/max labels */}
        <text x={polar(cx, cy, r, 0).x} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.05} fill="oklch(0.7 0.02 240)">0%</text>
        <text x={polar(cx, cy, r, 100).x} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.05} fill="oklch(0.7 0.02 240)">100%</text>
      </svg>
    </div>
  );
}
