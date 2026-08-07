import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// (OTP/2FA flow removed — login uses email+password directly via supabase.auth.signInWithPassword)


/**
 * Seed the initial admin user (lucas@admin.com) using the password stored
 * in ADMIN_INITIAL_PASSWORD. Only runs while NO admin exists yet.
 */
export const seedAdminIfMissing = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const pwd = process.env.ADMIN_INITIAL_PASSWORD;
  if (!pwd) throw new Error("ADMIN_INITIAL_PASSWORD não configurado");

  // Try to find existing admin user by email
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const already = existing.users.find((u) => u.email?.toLowerCase() === "lucas@admin.com");

  if (already) {
    // Reset password to match current secret + ensure admin role
    await supabaseAdmin.auth.admin.updateUserById(already.id, {
      password: pwd,
      email_confirm: true,
    });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: already.id, role: "admin" }, { onConflict: "user_id,role" });
    return { seeded: true, reused: true };
  }

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: "lucas@admin.com",
    password: pwd,
    email_confirm: true,
    user_metadata: { full_name: "Lucas (Admin)" },
  });
  if (error) {
    // Race: created between listUsers and createUser — fetch and continue
    if (!/already/i.test(error.message)) throw new Error(error.message);
  } else if (created?.user) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
  }
  return { seeded: true };
});

// ===== Admin user management =====

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Acesso negado: apenas admins");
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
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Acesso negado: apenas admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      email: data.email,
      full_name: data.full_name ?? null,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(`Não foi possível salvar o perfil: ${profileError.message}`);
    }
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
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Acesso negado: apenas admins");
    if (data.id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().email().max(255).optional(),
        password: z.string().min(8).max(128).optional(),
        full_name: z.string().trim().max(100).optional(),
        role: z.enum(["admin", "viewer"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !allowed) throw new Error("Acesso negado: apenas admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attrs: { email?: string; password?: string; user_metadata?: Record<string, unknown>; email_confirm?: boolean } = {};
    if (data.email) { attrs.email = data.email; attrs.email_confirm = true; }
    if (data.password) attrs.password = data.password;
    if (data.full_name !== undefined) attrs.user_metadata = { full_name: data.full_name };
    if (Object.keys(attrs).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, attrs);
      if (error) throw new Error(error.message);
    }
    if (data.email || data.full_name !== undefined) {
      await supabaseAdmin
        .from("profiles")
        .update({
          ...(data.email ? { email: data.email } : {}),
          ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
        })
        .eq("id", data.id);
    }
    if (data.role) {
      // Prevent an admin from removing their own admin role (locks themselves out)
      if (data.id === context.userId && data.role !== "admin") {
        throw new Error("Você não pode remover seu próprio papel de admin");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    }
    return { ok: true };
  });

