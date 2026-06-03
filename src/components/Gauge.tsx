interface Props {
  value: number;
  label?: string;
  goal?: number;
  size?: number;
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

function markerPoint(percent: number) {
  const cx = 160;
  const cy = 154;
  const r = 112;
  const angle = Math.PI * (1 - clamp(percent) / 100);
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

/** Clean semicircle gauge with one progress arc and no overlapping labels. */
export function Gauge({ value, label, goal = 90, size = 280 }: Props) {
  const pct = clamp(value);
  const statusColor = pct >= goal ? "var(--success)" : pct >= goal - 15 ? "var(--warning)" : "var(--destructive)";
  const goalPoint = markerPoint(goal);
  const goalLabelX = Math.min(292, Math.max(28, goalPoint.x));

  return (
    <div className="w-full flex flex-col items-center">
      {label && <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</div>}
      <svg
        width="100%"
        height={Math.round(size * 0.74)}
        viewBox="0 0 320 220"
        role="img"
        aria-label={`Atravessamento ${pct.toFixed(1)} por cento`}
        className="max-w-[320px] overflow-visible"
      >
        <path
          d="M 48 154 A 112 112 0 0 1 272 154"
          pathLength={100}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={28}
          strokeLinecap="round"
        />
        <path
          d="M 48 154 A 112 112 0 0 1 272 154"
          pathLength={100}
          fill="none"
          stroke={statusColor}
          strokeWidth={28}
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
        />
        <line
          x1={goalPoint.x}
          y1={goalPoint.y - 17}
          x2={goalPoint.x}
          y2={goalPoint.y + 17}
          stroke="var(--foreground)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
        <text x="160" y="130" textAnchor="middle" fontSize="46" fontWeight={800} fill={statusColor}>
          {pct.toFixed(1)}%
        </text>
        <text x="48" y="190" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">0%</text>
        <text x="272" y="190" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">100%</text>
        <text x={goalLabelX} y="35" textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--foreground)">
          Meta {goal}%
        </text>
      </svg>
    </div>
  );
}
