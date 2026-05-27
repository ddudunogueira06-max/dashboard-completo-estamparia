import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { BarChart3, Upload, Boxes } from "lucide-react";

export function AppLayout() {
  const { pathname } = useLocation();
  const navItems = [
    { to: "/", label: "Dashboard", icon: BarChart3 },
    { to: "/importar", label: "Importar Planilha", icon: Upload },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="size-10 rounded-lg bg-primary/15 grid place-items-center">
            <Boxes className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">Controle</div>
            <div className="text-xs text-muted-foreground">Desperdícios Industrial</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-[11px] text-muted-foreground border-t border-sidebar-border">
          v1.0 · BI Industrial
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
