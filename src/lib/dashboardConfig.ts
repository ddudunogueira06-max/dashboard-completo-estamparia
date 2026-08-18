import { supabase } from "@/integrations/supabase/client";

/**
 * Configuração do painel compartilhada por todos os usuários.
 * Fica salva no banco (tabela dobra_settings) e tem cópia local como cache/fallback.
 * Somente administradores conseguem gravar (RLS).
 */
export const LAYOUT_KEY = "dashboard.layout.v1";
export const TICKER_KEY = "dashboard.ticker.v1";
export const SHARED_ROW_KEY = "dashboard.shared.v1";

export interface SharedDashboardConfig {
  layout?: unknown;
  ticker?: string[];
  filters?: unknown;
}

export async function fetchSharedDashboard(): Promise<SharedDashboardConfig | null> {
  const { data, error } = await supabase
    .from("dobra_settings")
    .select("value")
    .eq("key", SHARED_ROW_KEY)
    .maybeSingle();
  if (error || !data) return null;
  return (data.value ?? null) as SharedDashboardConfig | null;
}

export async function saveSharedDashboard(patch: SharedDashboardConfig): Promise<string | null> {
  const current = (await fetchSharedDashboard()) ?? {};
  const value = { ...current, ...patch };
  const { error } = await supabase
    .from("dobra_settings")
    .upsert({ key: SHARED_ROW_KEY, value: value as never }, { onConflict: "key" });
  return error ? error.message : null;
}

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
