import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s?: string) => (s ? new Date(`${s}T12:00:00`) : undefined);
const br = (s?: string) => (s ? s.split("-").reverse().join("/") : "");

export function WidgetDateRange({
  de,
  ate,
  onChange,
}: {
  de?: string;
  ate?: string;
  onChange: (de?: string, ate?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined = de || ate ? { from: parse(de), to: parse(ate) } : undefined;
  const label = de || ate ? `${br(de) || "…"} – ${br(ate) || "…"}` : "Todo período";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex h-6 items-center gap-1 rounded border border-border bg-input px-1.5 text-[11px] text-foreground",
            (de || ate) && "border-primary text-primary",
          )}
          title="Intervalo de datas deste widget"
        >
          <CalendarIcon className="size-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="end"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => onChange(r?.from ? iso(r.from) : undefined, r?.to ? iso(r.to) : undefined)}
          numberOfMonths={2}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex justify-between border-t border-border p-2">
          <button
            onClick={() => onChange(undefined, undefined)}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Limpar
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
