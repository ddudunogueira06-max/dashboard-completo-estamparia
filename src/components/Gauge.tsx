interface Props {
  value: number;
  label?: string;
  goal?: number;
  size?: number;
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

function pointOnGauge(percent: number, radius = 118) {
  const cx = 160;
  const cy = 166;
  const r = radius;
  const angle = Math.PI * (1 - clamp(percent) / 100);
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

function Segment({ from, to, stroke, rounded = false }: { from: number; to: number; stroke: string; rounded?: boolean }) {
  return (
    <path
      d="M 42 166 A 118 118 0 0 1 278 166"
      pathLength={100}
      fill="none"
      stroke={stroke}
      strokeWidth={28}
      strokeLinecap={rounded ? "round" : "butt"}
      strokeDasharray={`${to - from} ${100 - (to - from)}`}
      strokeDashoffset={-from}
    />
  );
}

/** Classic speedometer with clear red/yellow/green percentage bands. */
export function Gauge({ value, label, goal = 90, size = 280 }: Props) {
  const pct = clamp(value);
  const warningStart = Math.max(65, goal - 18);
  const statusColor = pct >= goal ? "var(--success)" : pct >= warningStart ? "var(--warning)" : "var(--destructive)";
  const needle = pointOnGauge(pct, 86);
  const goalOuter = pointOnGauge(goal, 132);
  const goalInner = pointOnGauge(goal, 100);

  return (
    <div className="w-full flex flex-col items-center">
      {label && <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</div>}
      <svg
        width="100%"
        height={Math.round(size * 0.8)}
        viewBox="0 0 320 224"
        role="img"
        aria-label={`Atravessamento ${pct.toFixed(1)} por cento`}
        className="max-w-[340px] overflow-visible"
      >
        <path
          d="M 42 166 A 118 118 0 0 1 278 166"
          pathLength={100}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={34}
          strokeLinecap="round"
          opacity={0.55}
        />
        <Segment from={0} to={18} stroke="var(--destructive)" rounded />
        <Segment from={warningStart} to={goal} stroke="var(--warning)" />
        <Segment from={goal} to={100} stroke="var(--success)" rounded />
        <path d="M 42 166 A 118 118 0 0 1 278 166" fill="none" stroke="var(--background)" strokeWidth={2} opacity={0.35} />
        <line
          x1={goalInner.x}
          y1={goalInner.y}
          x2={goalOuter.x}
          y2={goalOuter.y}
          stroke="var(--foreground)"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
        <line x1="160" y1="166" x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth={5} strokeLinecap="round" />
        <circle cx="160" cy="166" r="16" fill="var(--foreground)" />
        <circle cx="160" cy="166" r="8" fill={statusColor} />
        <text x="160" y="128" textAnchor="middle" fontSize="46" fontWeight={800} fill={statusColor}>
          {pct.toFixed(1)}%
        </text>
        <text x="42" y="204" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">0%</text>
        <text x="278" y="204" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">100%</text>
        <text x="246" y="66" textAnchor="middle" fontSize="12" fontWeight={700} fill="var(--foreground)">Meta {goal}%</text>
      </svg>
    </div>
  );
}
