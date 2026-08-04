interface Tab {
  id: string;
  label: string;
}

interface Props {
  title: string;
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function ModuleTabs({ title, tabs, active, onChange }: Props) {
  return (
    <div className="border-b border-border bg-card/50 sticky top-0 z-20 backdrop-blur">
      <div className="px-4 md:px-6 pt-4">
        <h1 className="text-xl font-semibold tracking-tight uppercase">{title}</h1>
      </div>
      <div className="px-4 md:px-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === t.id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
