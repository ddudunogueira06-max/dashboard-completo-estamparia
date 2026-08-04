import { useEffect, useMemo, useState } from "react";
import { useTickerMetrics } from "@/components/widgets/metrics";

interface Props {
  selected: string[];
  intervalMs?: number;
  variant?: "widget" | "tv";
}

export function TickerPanel({ selected, intervalMs = 6000, variant = "widget" }: Props) {
  const { metrics, loading } = useTickerMetrics();
  const list = useMemo(() => {
    const chosen = metrics.filter((m) => selected.includes(m.id));
    return chosen.length > 0 ? chosen : metrics;
  }, [metrics, selected]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), intervalMs);
    return () => clearInterval(t);
  }, [list.length, intervalMs]);

  useEffect(() => {
    if (idx >= list.length) setIdx(0);
  }, [list.length, idx]);

  const current = list[idx];

  if (loading) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!current) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">Nada selecionado</div>;
  }

  const tv = variant === "tv";

  return (
    <div className="h-full w-full flex flex-col justify-center items-center text-center px-6 py-4 overflow-hidden">
      <div key={current.id} className="animate-fade-in w-full">
        <div className={`uppercase tracking-widest text-muted-foreground ${tv ? "text-xl mb-4" : "text-[11px] mb-1"}`}>
          {current.module} · {current.label}
        </div>
        <div className={`font-bold text-primary leading-none truncate ${tv ? "text-[8vw]" : "text-4xl"}`}>
          {current.value}
        </div>
        {current.hint && (
          <div className={`text-muted-foreground ${tv ? "text-2xl mt-4" : "text-xs mt-1"}`}>{current.hint}</div>
        )}
      </div>
      <div className={`flex gap-1.5 ${tv ? "mt-10" : "mt-3"}`}>
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
