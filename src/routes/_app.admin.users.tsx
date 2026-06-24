import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAppUsers,
  createAppUser,
  deleteAppUser,
} from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/users")({
  ssr: false,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const deleteFn = useServerFn(deleteAppUser);
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const r = await listFn({});
      setUsers(r as any[]);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao listar");
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
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("viewer");
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este usuário?")) return;
    try {
      await deleteFn({ data: { id } });
      await reload();
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao excluir");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Usuários</h1>

      <form
        onSubmit={onCreate}
        className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border border-border rounded-lg bg-card"
      >
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-1"
        />
        <input
          type="text"
          placeholder="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-1"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Senha (mín 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-1"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-1"
        >
          <option value="viewer">Visualizador</option>
          <option value="admin">Admin</option>
        </select>
        <button
          disabled={busy}
          className="rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Criando..." : "Criar usuário"}
        </button>
      </form>

      {err && <div className="text-sm text-destructive">{err}</div>}
      {msg && <div className="text-sm text-green-600">{msg}</div>}

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2">Criado em</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2">
                  {(u.roles ?? []).join(", ") || "viewer"}
                </td>
                <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => onDelete(u.id)}
                    className="text-destructive hover:bg-destructive/10 p-1.5 rounded"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum usuário
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
