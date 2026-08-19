import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const lastDay = (ano: number, mes: number) => new Date(ano, mes, 0).getDate();

/** Lista de meses (YYYY-MM) do mês atual para trás. */
function mesesDisponiveis(qtd = 24): string[] {
  const hoje = new Date();
  const out: string[] = [];
  for (let i = 0; i < qtd; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const label = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

/** Seletor mensal do widget: define o intervalo do mês escolhido. */
export function WidgetDateRange({
  de,
  ate,
  onChange,
}: {
  de?: string;
  ate?: string;
  onChange: (de?: string, ate?: string) => void;
}) {
  const atual = de ? de.slice(0, 7) : "";
  const meses = mesesDisponiveis();
  if (atual && !meses.includes(atual)) meses.unshift(atual);

  const selecionar = (m: string) => {
    if (!m) return onChange(undefined, undefined);
    const ano = Number(m.slice(0, 4));
    const mes = Number(m.slice(5, 7));
    onChange(`${m}-01`, `${m}-${String(lastDay(ano, mes)).padStart(2, "0")}`);
  };

  return (
    <label
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex h-6 items-center gap-1 rounded border border-border bg-input px-1.5 text-[11px] text-foreground",
        (de || ate) && "border-primary text-primary",
      )}
      title="Mês exibido neste widget"
    >
      <CalendarIcon className="size-3" />
      <select
        value={atual}
        onChange={(e) => selecionar(e.target.value)}
        className="bg-transparent text-[11px] outline-none"
      >
        <option value="">Todo período</option>
        {meses.map((m) => (
          <option key={m} value={m}>
            {label(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
