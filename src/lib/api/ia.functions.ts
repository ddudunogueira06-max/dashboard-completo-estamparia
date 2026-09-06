import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1),
});

const SCHEMA_DOC = `
Banco de dados Postgres (schema public) do sistema de controle industrial:

- production_records: registros de PROGRAMAÇÃO (estamparia). Colunas: fpp, dt_prog (timestamptz, data em que foi programado/realizado), seq, produto, linha, cliente, item, data_rg, dt_pacote, dt_fim_prog, dt_fim_estamparia (data planejada, col. L), dt_fim_agrup, tempo_fpp_seg, maquina (int), tempo_execucao_seg.
- waste_records: DESPERDÍCIO de material. Colunas: tipo, numero, codigo_item, descricao, armazem, fator_perda (numeric), linha, qtde_solicitada, data_registro (timestamptz), retalho, status.
- dobra_rgs: RGs da DOBRA. Colunas: rg_key, rg, fpp_key, fpp, status (texto do status: Concluído, Em produção, Pendente, Logística Interna...), cliente, nr_ov, data_rg, produto, item_ov, tarefa_desc, operador, maquina_ativa, data_planejamento, data_conclusao, tempo_seg.
- dobra_fpps: FPPs da dobra. Colunas: fpp_key, fpp, dt_programada, seq, produto, linha, cliente, item, data_rg, dt_pacote, dt_fim_prog, dt_planejamento, tempo_fpp_seg, maquina.
- dobra_controle_rg: controle/SLA por RG. Colunas: rg_key, rg, cliente, produto, quantidade, data_rg, data_planejamento, ultima_seq, data_conclusao, tempo_execucao_dias, data_pacote, fpp_key, fpp, sla (texto), ta_rg, eficiencia.
- dobra_performance: performance por FPP. Colunas: fpp_key, fpp, maquina, qtd_pecas, tempo_estimado_seg, tempo_planejado_seg, tempo_real_seg, data_inicio, data_final, qtd_produzida, qtd_refugo, qtd_retrabalho, performance, obs.
- oee_dias: OEE por dia. Colunas: turno, maquina, data, horas_disp_seg, horas_prog_seg, horas_reg_seg, paradas_prog_seg, paradas_nao_prog_seg, oee.
- oee_paradas: paradas agrupadas. Colunas: turno, maquina, mes_ref, categoria, total_seg.
- product_categories: canonical_name, difficulty (1 a 5). product_aliases: raw_name, canonical_name.
- dobra_settings: configurações em jsonb (key, value).
- Tabelas de importação (histórico de uploads): production_imports, waste_imports, dobra_imports, oee_imports.
`;

const SYSTEM = `Você é o assistente de dados da Trox (Controle Industrial). Responde em português do Brasil, de forma curta, objetiva e com números.

Você tem acesso somente-leitura ao banco pela ferramenta executar_sql. Sempre consulte o banco antes de responder qualquer pergunta sobre números — nunca invente valores.

${SCHEMA_DOC}

Regras:
- Só SELECT (ou WITH). Uma consulta por chamada, sem ponto e vírgula.
- Agregue no SQL (count, sum, avg, date_trunc) em vez de trazer muitas linhas. O limite é 500 linhas.
- Se a pergunta for vaga, escolha a interpretação mais útil e diga qual usou.
- Formate resultados em markdown (tabelas curtas, listas, negrito nos números).`;

type ChatMessage = {
  role: string;
  content: string | null;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

export const perguntarIA = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false as const, error: "Assistente não configurado." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "executar_sql",
          description: "Executa uma consulta SELECT somente-leitura no banco e retorna as linhas em JSON.",
          parameters: {
            type: "object",
            properties: { sql: { type: "string", description: "Consulta SELECT em Postgres, sem ponto e vírgula." } },
            required: ["sql"],
            additionalProperties: false,
          },
        },
      },
    ];

    for (let round = 0; round < 6; round++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: "google/gemini-3.7-flash", messages, tools }),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) return { ok: false as const, error: "Muitas perguntas ao mesmo tempo. Tente de novo em instantes." };
        if (res.status === 402) return { ok: false as const, error: "Créditos de IA esgotados no workspace." };
        return { ok: false as const, error: `Falha na IA (${res.status}): ${text.slice(0, 200)}` };
      }

      const json = (await res.json()) as {
        choices?: { message: ChatMessage }[];
      };
      const msg = json.choices?.[0]?.message;
      if (!msg) return { ok: false as const, error: "Resposta vazia da IA." };

      messages.push(msg);

      const calls = msg.tool_calls ?? [];
      if (calls.length === 0) {
        return { ok: true as const, answer: msg.content ?? "" };
      }

      for (const call of calls) {
        let payload = "";
        try {
          const args = JSON.parse(call.function.arguments || "{}") as { sql?: string };
          const sql = (args.sql ?? "").trim();
          if (!sql) throw new Error("SQL vazio");
          const { data: rows, error } = await supabaseAdmin.rpc("ia_query" as never, { sql_text: sql } as never);
          if (error) throw new Error(error.message);
          payload = JSON.stringify(rows).slice(0, 20000);
        } catch (e) {
          payload = JSON.stringify({ erro: e instanceof Error ? e.message : String(e) });
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: payload });
      }
    }

    // Rodadas esgotadas: pede a resposta final sem ferramentas, usando o que já foi consultado.
    messages.push({
      role: "user",
      content: "Responda agora, em português, usando apenas os dados já consultados acima. Não peça mais consultas.",
    });
    const finalRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: "google/gemini-3.7-flash", messages }),
    });
    if (finalRes.ok) {
      const finalJson = (await finalRes.json()) as { choices?: { message: ChatMessage }[] };
      const answer = finalJson.choices?.[0]?.message?.content;
      if (answer) return { ok: true as const, answer };
    }
    return { ok: false as const, error: "Não consegui concluir a análise. Tente reformular a pergunta." };
  });
