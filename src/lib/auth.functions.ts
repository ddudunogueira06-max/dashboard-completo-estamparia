import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Step 1 of 2FA: validate email+password without persisting session,
 * then trigger Supabase email OTP. Frontend then asks user for code
 * and calls supabase.auth.verifyOtp directly.
 */
export const passwordPreAuth = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) }).parse(d),
  )
  .handler(async ({ data }) => {
    const client = publicClient();
    const { error } = await client.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      throw new Error("Email ou senha inválidos");
    }
    // Discard the throwaway session
    await client.auth.signOut();

    // Admin bypasses 2FA
    if (data.email === "lucas@admin.com") {
      return { ok: true, skipMfa: true };
    }

    // Send email OTP for the second factor
    const { error: otpErr } = await client.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: false },
    });
    if (otpErr) {
      throw new Error("Não foi possível enviar o código de verificação: " + otpErr.message);
    }
    return { ok: true, skipMfa: false };
  });

/**
 * Seed the initial admin user (lucas@admin.com) using the password stored
 * in ADMIN_INITIAL_PASSWORD. Only runs while NO admin exists yet.
 */
export const seedAdminIfMissing = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count ?? 0) > 0) return { seeded: false };

  const pwd = process.env.ADMIN_INITIAL_PASSWORD;
  if (!pwd) throw new Error("ADMIN_INITIAL_PASSWORD não configurado");

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const already = existing.users.find((u) => u.email?.toLowerCase() === "lucas@admin.com");
  if (already) {
    // Ensure role row exists
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: already.id, role: "admin" }, { onConflict: "user_id,role" });
    return { seeded: true, reused: true };
  }

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: "lucas@admin.com",
    password: pwd,
    email_confirm: true,
    user_metadata: { full_name: "Lucas (Admin)" },
  });
  if (error) throw new Error(error.message);
  return { seeded: true };
});

// ===== Admin user management =====

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso negado: apenas admins");
}

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name,created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(128),
        full_name: z.string().trim().max(100).optional(),
        role: z.enum(["admin", "viewer"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    // Override role if admin requested
    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" });
    }
    return { id: created.user.id };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
