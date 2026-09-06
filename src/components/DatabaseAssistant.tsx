import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { perguntarIA } from "@/lib/api/ia.functions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logoUrl from "@/assets/x-branco.png";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Qual o SLA da dobra neste mês?",
  "Quantas FPPs foram realizadas nos últimos 7 dias?",
  "Desperdício por material no mês atual",
  "Top 5 clientes por quantidade de RGs",
];

export function DatabaseAssistant() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const ask = useServerFn(perguntarIA);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const enviar = async (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: pergunta }];
    setMsgs(next);
    setErro(null);
    setLoading(true);
    try {
      const res = await ask({ data: { messages: next } });
      if (res.ok) {
        setMsgs([...next, { role: "assistant", content: res.answer || "Sem resposta." }]);
      } else {
        setErro(res.error || "Não consegui responder agora.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao falar com o assistente.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Assistente de dados"
          aria-label="Abrir assistente de dados"
          className="fixed bottom-4 right-4 z-40 size-11 rounded-full bg-foreground shadow-lg ring-1 ring-border grid place-items-center hover:scale-105 transition-transform"
        >
          <img src={logoUrl} alt="" className="size-6 object-contain" />
        </button>
      )}

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-4 right-4 z-50 flex w-[min(26rem,calc(100vw-2rem))] h-[min(34rem,calc(100vh-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <header className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="size-7 rounded-md bg-foreground grid place-items-center">
              <img src={logoUrl} alt="" className="size-4 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight">Assistente de dados</div>
              <div className="text-[11px] text-muted-foreground">Consulta o banco em tempo real</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-md p-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <Conversation className="flex-1">
            <ConversationContent className="gap-3 p-3">
              {msgs.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Pergunte qualquer coisa sobre programação, dobra, puncionadeira, OEE ou desperdício.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        onClick={() => void enviar(s)}
                        className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((m, i) =>
                m.role === "user" ? (
                  <Message key={i} from="user">
                    <MessageContent className="bg-primary text-primary-foreground">
                      {m.content}
                    </MessageContent>
                  </Message>
                ) : (
                  <Message key={i} from="assistant">
                    <MessageContent className="bg-transparent text-foreground">
                      <MessageResponse>{m.content}</MessageResponse>
                    </MessageContent>
                  </Message>
                ),
              )}

              {loading && <Shimmer className="text-sm">Consultando o banco...</Shimmer>}
              {erro && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                  {erro}
                </p>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border p-2">
            <PromptInput
              onSubmit={(message, event) => {
                event.preventDefault();
                const texto = message.text ?? "";
                void enviar(texto);
                (event.currentTarget as HTMLFormElement).reset();
              }}
            >
              <PromptInputTextarea placeholder="Pergunte sobre os dados..." />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit
                  status={loading ? "submitted" : undefined}
                  disabled={loading}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
