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

const REGRAS_NEGOCIO = `
REGRAS DE NEGÓCIO (use exatamente estas definições, elas são as mesmas do site):

1) RG "dobrada" (já passou pela dobra) = dobra_rgs.status que começa com "Concluíd" OU contém "Logíst" (Logística Interna) OU contém "Separa" OU começa com "Finaliz"/"Encerrad"/"Entregue". Comparação sem acento e sem caixa.
   SQL de referência (use unaccent-free, com upper + translate):
   with s as (
     select *, upper(translate(coalesce(status,''),'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ','aaaaeeiooouucAAAAEEIOOOUUC')) as st
     from dobra_rgs
   )
   select ... from s where st like 'CONCLUID%' or st like '%LOGIST%' or st like '%SEPARA%' or st like 'FINALIZ%' or st like 'ENCERRAD%' or st like 'ENTREGUE%'

2) DATA em que a RG foi dobrada = coalesce(data_conclusao, data_planejamento) — só para RGs dobradas (regra 1). Nunca use data_rg para isso (data_rg é quando o RG foi criado).

3) Datas escritas pelo usuário estão em dd/mm (Brasil) e o fuso é America/Sao_Paulo. "04/09" = 2026-09-04 (ano atual, salvo indicação em contrário).

4) RG em aberto (ainda não dobrada) = status que NÃO se encaixa na regra 1.
   Atrasada = em aberto e data_planejamento < data de hoje.

5) SLA oficial da dobra vem da planilha (dobra_settings, chave que contém 'sla') e não deve ser recalculado, a não ser que peçam explicitamente o cálculo.

6) Tempo de dobra: dobra_rgs.tempo_seg é o tempo distribuído por RG (em segundos). Some e converta para horas quando pedirem horas.

7) CARGA FUTURA / "como está de RG e dobra para os próximos dias": use as RGs em aberto (regra 4) agrupadas por data_planejamento::date, a partir de hoje. Traga por dia: quantidade de RGs, soma de tempo_seg em horas, e destaque separado o que já está atrasado (data_planejamento < hoje e ainda em aberto).
   SQL de referência:
   with s as (
     select coalesce(data_planejamento, data_rg)::date as d, tempo_seg,
            upper(translate(coalesce(status,''),'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ','aaaaeeiooouucAAAAEEIOOOUUC')) as st
     from dobra_rgs
   )
   select d, count(*) rgs, round(sum(tempo_seg)/3600.0, 1) horas
   from s
   where not (st like 'CONCLUID%' or st like '%LOGIST%' or st like '%SEPARA%' or st like 'FINALIZ%' or st like 'ENCERRAD%' or st like 'ENTREGUE%')
     and d >= current_date and d < current_date + 15
   group by d order by d

8) "Como está de RG/dobra hoje" = três números juntos: dobradas hoje (regras 1+2), em aberto para hoje, e atrasadas — mesmo que o usuário peça só um.

9) Quando o período pedido estiver vazio, informe até que data existem dados (ex.: select max(coalesce(data_conclusao, data_planejamento)) from dobra_rgs) e mostre os dias vizinhos.

Exemplo — "quantas RGs foram dobradas no dia 04/09":
with s as (
  select coalesce(data_conclusao, data_planejamento) as d,
         upper(translate(coalesce(status,''),'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ','aaaaeeiooouucAAAAEEIOOOUUC')) as st
  from dobra_rgs
)
select count(*) as rgs_dobradas from s
where d = date '2026-09-04'
  and (st like 'CONCLUID%' or st like '%LOGIST%' or st like '%SEPARA%' or st like 'FINALIZ%' or st like 'ENCERRAD%' or st like 'ENTREGUE%')
`;

const SYSTEM = `Você é o assistente de dados da Trox (Controle Industrial). Responde em português do Brasil, de forma curta, objetiva e com números.

Você tem acesso somente-leitura ao banco pela ferramenta executar_sql. Sempre consulte o banco antes de responder qualquer pergunta sobre números — nunca invente valores.

${SCHEMA_DOC}
${REGRAS_NEGOCIO}

Regras:
- Só SELECT (ou WITH). Uma consulta por chamada, sem ponto e vírgula.
- Você pode fazer quantas consultas precisar (até 24 por pergunta). Prefira agregar no SQL (count, sum, avg, date_trunc) — cada consulta devolve no máximo 2000 linhas.
- Perguntas de contagem por data devem ser respondidas em 1 ou 2 consultas, usando as regras de negócio acima. Não fique explorando o schema quando a regra já está definida.
- Perguntas amplas ("como está a dobra?", "e os próximos dias?") merecem resposta completa: números de hoje, atrasados, carga por dia dos próximos dias e um comentário curto de risco (dias acima da média de horas).
- Entregue tabela em markdown quando houver série por dia/cliente/máquina, e sempre um resumo em uma frase antes.
- Se a pergunta for vaga, escolha a interpretação mais útil e diga qual usou. NUNCA devolva a pergunta sem antes consultar.
- É PROIBIDO responder "não sei", "não tenho acesso" ou "não há dados" sem ter feito pelo menos uma consulta que comprove isso.
- Se não souber onde está o dado, investigue o banco: consulte information_schema.columns (ex.: select table_name, column_name from information_schema.columns where table_schema='public') e olhe amostras com select * from <tabela> limit 5, ou valores distintos de uma coluna (select distinct status from dobra_rgs limit 50).
- Se uma consulta der erro ou vier vazia, tente outra abordagem (outra tabela, outro filtro, período maior, comparação case-insensitive com ilike) antes de desistir. Se o dia pedido vier zero, confirme com uma consulta dos dias vizinhos e diga isso na resposta.
- Datas: use date_trunc e intervalos explícitos; "este mês" = date_trunc('month', now()).
- Responda direto: primeiro a frase com o número em negrito, depois uma linha curta dizendo tabela/regra/período usados. Sem rodeios nem pedidos de esclarecimento quando a regra já resolve.`;


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
      {
        role: "system",
        content: `${SYSTEM}\n\nHoje é ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full" }).format(new Date())} (fuso America/Sao_Paulo).`,
      },
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

    for (let round = 0; round < 24; round++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: "google/gemini-3.1-pro-preview", messages, tools }),
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
      body: JSON.stringify({ model: "google/gemini-3.1-pro-preview", messages }),
    });
    if (finalRes.ok) {
      const finalJson = (await finalRes.json()) as { choices?: { message: ChatMessage }[] };
      const answer = finalJson.choices?.[0]?.message?.content;
      if (answer) return { ok: true as const, answer };
    }
    return { ok: false as const, error: "Não consegui concluir a análise. Tente reformular a pergunta." };
  });
