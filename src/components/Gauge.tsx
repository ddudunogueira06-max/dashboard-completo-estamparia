interface Props {
  value: number; // 0..100
  label?: string;
  goal?: number; // threshold for green
  size?: number;
}

/** Speedometer-style gauge (semicircle) with explicit % readout. */
export function Gauge({ value, label, goal = 90, size = 220 }: Props) {
  const pct = Math.max(0, Math.min(100, value));

  const stroke = size * 0.12;
  const pad = stroke / 2 + 4;
  const cx = size / 2;
  const r = (size - 2 * pad) / 2;
  const cy = pad + r; // baseline of the semicircle
  const height = cy + size * 0.22; // room for the value pill below

  const angle = Math.PI * (1 - pct / 100); // 0% → π (left), 100% → 0 (right)
  const needleR = r - stroke / 2;
  const nx = cx + needleR * Math.cos(angle);
  const ny = cy - needleR * Math.sin(angle);

  const arc = (from: number, to: number, color: string) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    const large = to - from > 50 ? 1 : 0;
    return <path d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="butt" />;
  };

  const red = "oklch(0.62 0.23 25)";
  const yellow = "oklch(0.85 0.18 90)";
  const green = "oklch(0.65 0.18 145)";
  const t1 = Math.max(0, goal - 20);
  const t2 = goal;

  const color = pct >= t2 ? green : pct >= t1 ? yellow : red;

  const pillW = size * 0.34;
  const pillH = size * 0.16;
  const pillY = cy + size * 0.02;

  return (
    <div className="flex flex-col items-center">
      {label && <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>}
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`}>
        {arc(0, t1, red)}
        {arc(t1, t2, yellow)}
        {arc(t2, 100, green)}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="oklch(0.92 0.01 240)" strokeWidth={size * 0.018} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={size * 0.045} fill="oklch(0.92 0.01 240)" />
        {/* value pill */}
        <rect x={cx - pillW / 2} y={pillY} width={pillW} height={pillH} rx={pillH * 0.3} fill={color} />
        <text x={cx} y={pillY + pillH * 0.7} textAnchor="middle" fontSize={size * 0.1} fontWeight={800} fill="oklch(0.99 0 0)">{pct.toFixed(1)}%</text>
      </svg>
    </div>
  );
}
