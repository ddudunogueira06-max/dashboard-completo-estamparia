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

/**
 * Velocímetro com bandas FIXAS: vermelho (0–65%), amarelo (65–90%) e verde (90–100%).
 * Apenas o ponteiro se move conforme o valor.
 */
export function Gauge({ value, label, goal = 90, size = 280 }: Props) {
  const pct = clamp(value);
  // Bandas fixas — não dependem do valor.
  const RED_END = 65;
  const YELLOW_END = goal; // 90 por padrão
  const needle = pointOnGauge(pct, 86);

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
        {/* Bandas fixas, contínuas, sem sobreposição */}
        <Segment from={0} to={RED_END} stroke="var(--destructive)" rounded />
        <Segment from={RED_END} to={YELLOW_END} stroke="var(--warning)" />
        <Segment from={YELLOW_END} to={100} stroke="var(--success)" rounded />

        {/* Ponteiro (única coisa que se move) */}
        <line x1="160" y1="166" x2={needle.x} y2={needle.y} stroke="var(--foreground)" strokeWidth={5} strokeLinecap="round" />
        <circle cx="160" cy="166" r="16" fill="var(--foreground)" />
        <circle cx="160" cy="166" r="7" fill="var(--card)" />

        {/* Valor */}
        <text x="160" y="128" textAnchor="middle" fontSize="46" fontWeight={800} fill="var(--foreground)">
          {pct.toFixed(1)}%
        </text>

        {/* Marcações */}
        <text x="42" y="204" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">0%</text>
        <text x="160" y="216" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">{RED_END}%</text>
        <text x="278" y="204" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">100%</text>
        
      </svg>
    </div>
  );
}
