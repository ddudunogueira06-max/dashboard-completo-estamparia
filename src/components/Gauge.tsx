interface Props {
  value: number; // 0..100
  label?: string;
  goal?: number; // threshold for green
  size?: number;
}

/** Speedometer-style gauge (semicircle) with explicit % readout. */
export function Gauge({ value, label, goal = 90, size = 220 }: Props) {
  const pct = Math.max(0, Math.min(100, value));
  const cx = size / 2;
  const cy = size * 0.85;
  const r = size * 0.4;
  const angle = Math.PI * (1 - pct / 100); // 0% → π (left), 100% → 0 (right)
  const nx = cx + r * 0.85 * Math.cos(angle);
  const ny = cy - r * 0.85 * Math.sin(angle);

  const arc = (from: number, to: number, color: string) => {
    const a0 = Math.PI * (1 - from / 100);
    const a1 = Math.PI * (1 - to / 100);
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    const large = to - from > 50 ? 1 : 0;
    return <path d={`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`} stroke={color} strokeWidth={size * 0.13} fill="none" strokeLinecap="butt" />;
  };

  const red = "oklch(0.62 0.23 25)";
  const yellow = "oklch(0.85 0.18 90)";
  const green = "oklch(0.65 0.18 145)";
  const t1 = Math.max(0, goal - 20);
  const t2 = goal;

  const color = pct >= t2 ? green : pct >= t1 ? yellow : red;

  return (
    <div className="flex flex-col items-center">
      {label && <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>}
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65 + 10}`}>
        {arc(0, t1, red)}
        {arc(t1, t2, yellow)}
        {arc(t2, 100, green)}
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="oklch(0.2 0.02 240)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={size * 0.05} fill="oklch(0.2 0.02 240)" />
        {/* value pill */}
        <rect x={cx - 30} y={cy + 12} width={60} height={22} rx={6} fill={color} />
        <text x={cx} y={cy + 28} textAnchor="middle" fontSize={14} fontWeight={800} fill="oklch(0.99 0 0)">{pct.toFixed(1)}%</text>
      </svg>
    </div>
  );
}
