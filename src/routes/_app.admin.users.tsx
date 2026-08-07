import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAppUsers,
  createAppUser,
  deleteAppUser,
  updateAppUser,
} from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { Trash2, Pencil, X, Check } from "lucide-react";

export const Route = createFileRoute("/_app/admin/users")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Configurações — Controle Industrial" },
    { name: "description", content: "Configurações gerais, perfis, acessos, análises e alertas do sistema." },
    { property: "og:title", content: "Configurações — Controle Industrial" },
    { property: "og:description", content: "Administração de perfis e configurações do controle industrial." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminUsersPage,
});

interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const deleteFn = useServerFn(deleteAppUser);
  const updateFn = useServerFn(updateAppUser);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ email: string; full_name: string; password: string; role: "admin" | "viewer" }>({
    email: "", full_name: "", password: "", role: "viewer",
  });

  const reload = async () => {
    try {
      const r = await listFn({});
      setUsers(r as AppUser[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao listar");
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) navigate({ to: "/" });
    else reload();
  }, [loading, isAdmin]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await createFn({
        data: {
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || undefined,
          role,
        },
      });
      setMsg("Usuário criado");
      setEmail(""); setPassword(""); setFullName(""); setRole("viewer");
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este usuário?")) return;
    try {
      await deleteFn({ data: { id } });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const startEdit = (u: AppUser) => {
    setEditing(u.id);
    setEdit({
      email: u.email,
      full_name: u.full_name ?? "",
      password: "",
      role: (u.roles?.includes("admin") ? "admin" : "viewer"),
    });
    setErr(null); setMsg(null);
  };

  const cancelEdit = () => { setEditing(null); };

  const saveEdit = async (id: string) => {
    setErr(null); setMsg(null); setBusy(true);
    try {
      const payload: Record<string, unknown> = { id };
      const original = users.find((u) => u.id === id);
      if (edit.email && edit.email !== original?.email) payload.email = edit.email.trim().toLowerCase();
      if (edit.full_name !== (original?.full_name ?? "")) payload.full_name = edit.full_name.trim();
      if (edit.password) payload.password = edit.password;
      const originalRole = original?.roles?.includes("admin") ? "admin" : "viewer";
      if (edit.role !== originalRole) payload.role = edit.role;
      await updateFn({ data: payload as any });
      setMsg("Usuário atualizado");
      setEditing(null);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administração geral de perfis e acessos. Crie usuários, altere permissões e redefina senhas.
        </p>
      </div>

      <div className="border-b border-border">
        <div className="inline-flex border-b-2 border-primary px-1 pb-2 text-sm font-medium text-primary">Perfis e acessos</div>
      </div>

      <form
        onSubmit={onCreate}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border border-border rounded-lg bg-card"
      >
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="text" placeholder="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <input type="password" required minLength={8} placeholder="Senha (mín 8)" value={password} onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="viewer">Visualizador</option>
          <option value="admin">Admin</option>
        </select>
        <button disabled={busy} className="rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50">
          {busy ? "Salvando..." : "Criar usuário"}
        </button>
      </form>

      {err && <div className="text-sm text-destructive">{err}</div>}
      {msg && <div className="text-sm text-green-600">{msg}</div>}

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Email (login)</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2">Nova senha</th>
              <th className="px-3 py-2">Criado</th>
              <th className="px-3 py-2 w-24 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isEditing = editing === u.id;
              return (
                <tr key={u.id} className="border-t border-border align-middle">
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
                    ) : u.email}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="text" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm" />
                    ) : (u.full_name ?? "—")}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as "admin" | "viewer" })}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm">
                        <option value="viewer">Visualizador</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : ((u.roles ?? []).join(", ") || "viewer")}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input type="password" minLength={8} autoComplete="new-password" placeholder="deixe vazio p/ manter" value={edit.password}
                        onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono" />
                    ) : (
                      <span className="text-muted-foreground text-xs">••••••••</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(u.id)} disabled={busy}
                            className="text-green-600 hover:bg-green-500/10 p-1.5 rounded disabled:opacity-50" title="Salvar">
                            <Check className="size-4" />
                          </button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:bg-muted p-1.5 rounded" title="Cancelar">
                            <X className="size-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(u)} className="text-primary hover:bg-primary/10 p-1.5 rounded" title="Editar">
                            <Pencil className="size-4" />
                          </button>
                          <button onClick={() => onDelete(u.id)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded" title="Excluir">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum usuário
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        Por segurança, senhas não são visíveis — nem para o admin. Elas são armazenadas com hash. Você pode <strong>redefinir</strong> a senha de qualquer usuário editando a linha e preenchendo o campo &ldquo;Nova senha&rdquo;.
      </div>
    </div>
  );
}
