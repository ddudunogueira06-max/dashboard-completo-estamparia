import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useServerFn } from "@tanstack/react-start";
import { passwordPreAuth, seedAdminIfMissing } from "@/lib/auth.functions";
import { markMfaVerified } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"login" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preAuth = useServerFn(passwordPreAuth);
  const seed = useServerFn(seedAdminIfMissing);

  useEffect(() => {
    // Seed initial admin once (no-op if already exists)
    seed({}).catch(() => {});
    // If already signed in + MFA passed, leave the page
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, []);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const emailNorm = email.trim().toLowerCase();
      const res = await preAuth({ data: { email: emailNorm, password } });
      if (res?.skipMfa) {
        // Admin: estabelece sessão diretamente no cliente, sem OTP
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailNorm,
          password,
        });
        if (error) throw error;
        if (data.user) markMfaVerified(data.user.id);
        navigate({ to: "/" });
      } else {
        setStep("otp");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Falha no login");
    } finally {
      setBusy(false);
    }
  };

  const onOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      if (data.user) markMfaVerified(data.user.id);
      navigate({ to: "/" });
    } catch (e: any) {
      setErr(e?.message ?? "Código inválido");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          markMfaVerified(data.user.id);
          navigate({ to: "/" });
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Falha no Google");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-4">
      <div className="w-full max-w-sm border border-border rounded-xl bg-card p-6 space-y-5 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="text-sm text-muted-foreground">
            {step === "login" ? "Acesse sua conta" : "Digite o código enviado ao seu email"}
          </p>
        </div>

        {err && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded px-3 py-2">
            {err}
          </div>
        )}

        {step === "login" ? (
          <>
            <form onSubmit={onLogin} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                placeholder="Senha"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                disabled={busy}
                className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Validando..." : "Continuar"}
              </button>
            </form>
            <div className="relative">
              <div className="h-px bg-border" />
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-card px-2 text-xs text-muted-foreground">
                ou
              </span>
            </div>
            <button
              onClick={onGoogle}
              disabled={busy}
              className="w-full rounded-md border border-input bg-background py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Continuar com Google
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Não tem conta? Peça ao admin para criar.
            </p>
          </>
        ) : (
          <form onSubmit={onOtp} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              placeholder="Código de 6 dígitos"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm tracking-widest text-center"
            />
            <button
              disabled={busy}
              className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Verificando..." : "Verificar e entrar"}
            </button>
            <button
              type="button"
              onClick={() => setStep("login")}
              className="w-full text-xs text-muted-foreground hover:underline"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
