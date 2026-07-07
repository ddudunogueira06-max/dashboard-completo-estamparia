import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Upload,
  Boxes,
  Menu,
  X,
  PanelLeft,
  Gauge,
  FileUp,
  Activity,
  FileText,
  LogOut,
  Users,
  Package,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { user, role, loading, isAdmin } = useAuth();

  // Auth gate
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
    }
  }, [loading, user, navigate]);

  // Role gate: viewers cannot access import pages
  useEffect(() => {
    if (loading || !role) return;
    const importRoutes = ["/importar", "/importar-producao", "/importar-oee", "/admin/users"];
    if (role !== "admin" && importRoutes.some((r) => pathname.startsWith(r))) {
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
    { to: "/", label: "Desperdícios", icon: BarChart3, adminOnly: false },
    { to: "/importar", label: "Importar Desperdício", icon: Upload, adminOnly: true },
    { to: "/producao", label: "Produção", icon: Gauge, adminOnly: false },
    { to: "/produtos", label: "Produtos", icon: Package, adminOnly: false },
    { to: "/importar-producao", label: "Importar Produção", icon: FileUp, adminOnly: true },
    { to: "/oee", label: "OEE", icon: Activity, adminOnly: false },
    { to: "/importar-oee", label: "Importar OEE", icon: FileText, adminOnly: true },
    { to: "/admin/users", label: "Usuários", icon: Users, adminOnly: true },
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
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={onLogout}
            title="Sair"
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60"
          >
            <LogOut className="size-4 shrink-0" />
            {expanded && <span className="truncate">Sair</span>}
          </button>
          {expanded && (
            <div className="px-2 pt-2 text-[11px] text-muted-foreground truncate">{user.email}</div>
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
          <span className="text-sm font-semibold">Desperdícios</span>
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
    </div>
  );
}
