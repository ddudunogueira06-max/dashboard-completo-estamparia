import { useEffect, useMemo, useRef, useState } from "react";
import { useTickerMetrics, type MetricModule } from "@/components/widgets/metrics";

export const MODULE_DOT: Record<MetricModule, string> = {
  "Programação": "bg-[var(--mod-programacao)]",
  Puncionadeira: "bg-[var(--mod-puncionadeira)]",
  Dobra: "bg-[var(--mod-dobra)]",
};

interface Props {
  selected: string[];
  intervalMs?: number;
  variant?: "widget" | "tv";
  /** "slide" = troca card a card · "marquee" = faixa contínua estilo aeroporto */
  mode?: "slide" | "marquee";
  /** Velocidade da faixa em pixels por segundo. */
  speed?: number;
}

export function TickerPanel({ selected, intervalMs = 6000, variant = "widget", mode = "marquee", speed = 48 }: Props) {
  const { metrics, loading } = useTickerMetrics();
  const list = useMemo(() => {
    const chosen = metrics.filter((m) => selected.includes(m.id));
    return chosen.length > 0 ? chosen : metrics;
  }, [metrics, selected]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (mode !== "slide" || list.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), intervalMs);
    return () => clearInterval(t);
  }, [list.length, intervalMs, mode]);

  useEffect(() => {
    if (idx >= list.length) setIdx(0);
  }, [list.length, idx]);

  const tv = variant === "tv";

  if (loading) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (list.length === 0) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">Nada selecionado</div>;
  }

  if (mode === "marquee") return <Marquee list={list} tv={tv} speed={speed} />;

  const current = list[idx];
  if (!current) return null;

  return (
    <div className="h-full w-full flex flex-col justify-center items-center text-center px-6 py-4 overflow-hidden">
      <div key={current.id} className="animate-fade-in w-full min-w-0">
        <div
          className={`inline-flex items-center gap-2 uppercase tracking-widest text-muted-foreground ${
            tv ? "text-xl mb-4" : "text-[11px] mb-1"
          }`}
        >
          <span className={`rounded-full ${tv ? "size-3" : "size-2"} ${MODULE_DOT[current.module]}`} />
          {current.module} · {current.label}
        </div>
        <div className={`font-bold text-primary leading-none truncate ${tv ? "text-[8vw]" : "text-4xl"}`}>
          {current.value}
        </div>
        {current.hint && (
          <div className={`text-muted-foreground ${tv ? "text-2xl mt-4" : "text-xs mt-1"}`}>{current.hint}</div>
        )}
      </div>
      <div className={`flex flex-wrap justify-center gap-1.5 ${tv ? "mt-10" : "mt-3"}`}>
        {list.map((m, i) => (
          <span
            key={m.id}
            className={`rounded-full transition-colors ${tv ? "size-3" : "size-1.5"} ${
              i === idx ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Marquee({
  list,
  tv,
  speed,
}: {
  list: ReturnType<typeof useTickerMetrics>["metrics"];
  tv: boolean;
  speed: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(40);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.scrollWidth / 2;
      if (w > 0) setDuration(Math.max(10, w / Math.max(10, speed)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list, speed]);

  const items = [...list, ...list];

  return (
    <div className="h-full w-full flex items-center overflow-hidden">
      <div ref={ref} className="marquee-track items-center" style={{ animationDuration: `${duration}s` }}>
        {items.map((m, i) => (
          <span key={`${m.id}-${i}`} className={`inline-flex items-center ${tv ? "gap-4 px-10" : "gap-2 px-5"}`}>
            <span className={`rounded-full shrink-0 ${tv ? "size-4" : "size-2"} ${MODULE_DOT[m.module]}`} />
            <span className={`uppercase tracking-wider text-muted-foreground ${tv ? "text-2xl" : "text-xs"}`}>
              {m.module} · {m.label}
            </span>
            <span className={`font-bold text-foreground ${tv ? "text-3xl" : "text-sm"}`}>{m.value}</span>
            {m.hint && (
              <span className={`text-muted-foreground ${tv ? "text-xl" : "text-xs"}`}>({m.hint})</span>
            )}
            <span className={`text-border ${tv ? "text-3xl pl-6" : "text-sm pl-3"}`}>•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
