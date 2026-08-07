import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  Menu,
  X,
  PanelLeft,
  Gauge,
  Activity,
  LogOut,
  Package,
  Tv,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/lib/theme";

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { user, role, loading, isAdmin } = useAuth();
  const { toggle } = useTheme();

  // Auth gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  // Role gate: viewers cannot access admin pages
  useEffect(() => {
    if (loading || !role) return;
    if (role !== "admin" && pathname.startsWith("/admin")) {
      navigate({ to: "/" });
    }
  }, [pathname, role, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const allItems = [
    { to: "/", label: "Painel", icon: BarChart3, adminOnly: false },
    { to: "/programacao", label: "Programação", icon: Package, adminOnly: false },
    { to: "/puncionadeira", label: "Puncionadeira", icon: Activity, adminOnly: false },
    { to: "/dobra", label: "Dobra", icon: Gauge, adminOnly: false },
    { to: "/painel-tv", label: "Modo TV", icon: Tv, adminOnly: false },
    { to: "/admin/users", label: "Configurações", icon: Settings, adminOnly: true },
  ];
  const navItems = allItems.filter((i) => !i.adminOnly || isAdmin);

  const desktopW = expanded ? "w-56" : "w-16";

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };


  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={`hidden md:flex ${desktopW} shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col transition-[width] duration-200`}
      >
        <div className="px-3 py-4 flex items-center gap-2 border-b border-sidebar-border">
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Recolher" : "Expandir"}
            className="size-10 shrink-0 rounded-lg bg-primary/15 grid place-items-center hover:bg-primary/25 transition-colors"
          >
            {expanded ? <PanelLeft className="size-5 text-primary" /> : <Boxes className="size-5 text-primary" />}
          </button>
          {expanded && (
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">Controle</div>
              <div className="text-xs text-muted-foreground truncate">{isAdmin ? "Admin" : "Visualizador"}</div>
            </div>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {expanded && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={toggle}
            title="Alternar modo claro/escuro"
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <Sun className="size-4 shrink-0 dark:hidden" />
            <Moon className="size-4 shrink-0 hidden dark:block" />
            {expanded && <span className="truncate">Tema</span>}
          </button>
          <button
            onClick={onLogout}
            title="Sair"
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            {expanded && <span className="truncate">Sair</span>}
          </button>
          {expanded && (
            <div className="px-2 pt-2 text-[11px] text-sidebar-foreground/60 truncate">{user.email}</div>
          )}
        </div>

      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-12 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-3">
        <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded-md hover:bg-sidebar-accent/60">
          <Menu className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary/15 grid place-items-center">
            <Boxes className="size-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">Controle</span>
        </div>
        <button onClick={onLogout} className="p-2 -mr-2 rounded-md hover:bg-sidebar-accent/60">
          <LogOut className="size-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
            <div className="px-4 py-4 flex items-center justify-between border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-lg bg-primary/15 grid place-items-center">
                  <Boxes className="size-5 text-primary" />
                </div>
                <span className="font-semibold text-sm">Controle</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-sidebar-accent/60">
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground truncate">
              {user.email}
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-12 md:pt-0">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
