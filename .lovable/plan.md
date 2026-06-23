
Implementação dividida em 3 frentes. Os PDFs anexados confirmam o layout:

```text
Nome do arquivo: "<turno>º_<maquina>_<MÊS>.pdf"   ex.: 1º_2000_MAIO.pdf
Conteúdo:
 - Tabela "INFORMAÇÕES DE TEMPO" (por dia): Horas Disponíveis, Programados,
   Registrados, Paradas Programadas, Paradas Não Programadas, Acuracidade
 - Tabela "PARADAS DE MÁQUINA": categoria → total no mês (ex.: Refeição 21:39:00)
 - Tabela "DADOS OEE": Disponibilidade / Performance / Qualidade / OEE
```

### 1. Barra de RG no gráfico "Realidade × Capacidade — semana atual"

Em `ProductionDashboard.tsx`, no agregador `perDay` adicionar contagem de registros com `data_rg` no dia (todos os registros do `inPeriod`, ou seja, respeitando filtros já ativos). Cada ponto da série passa a ter `{ count, rg }`. O `BarChart` ganha uma segunda `<Bar dataKey="rg">` lado a lado da existente, com cor distinta e legenda atualizada ("Realizado" e "RG").

### 2. Nova aba "OEE" + importador de PDF

**Migration (banco):**

```sql
create table public.oee_imports (
  id uuid primary key default gen_random_uuid(),
  arquivo text not null,
  turno smallint not null,         -- 1 ou 2
  maquina int not null,            -- 2000/3000/5000
  mes_ref date,                    -- 1º dia do mês de referência
  created_at timestamptz default now()
);

create table public.oee_dias (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.oee_imports(id) on delete cascade,
  turno smallint not null,
  maquina int not null,
  data date not null,
  horas_disp_seg int,              -- "Horas Disponíveis"
  horas_prog_seg int,
  horas_reg_seg int,
  paradas_prog_seg int,
  paradas_nao_prog_seg int,
  oee numeric,
  unique (turno, maquina, data)    -- reimport substitui
);

create table public.oee_paradas (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.oee_imports(id) on delete cascade,
  turno smallint not null,
  maquina int not null,
  mes_ref date not null,
  categoria text not null,
  total_seg int not null
);
```
+ GRANTs (authenticated/service_role) + RLS permissiva no padrão do projeto.

**Parser (cliente, no `ImportPage` novo):**
- Usa `pdfjs-dist` já presente (ou `pdf-parse`) para extrair texto.
- Regex no nome do arquivo → turno / máquina / mês.
- Regex em "INFORMAÇÕES DE TEMPO" para capturar linhas `DIA - dd/mm/aaaa  HH:MM:00  HH:MM:00  HH:MM:00  HH:MM:00  HH:MM:00  100,00%`.
- Regex em "PARADAS DE MÁQUINA" para capturar `<categoria>  HH:MM:00` até a linha "Mês".
- Upsert via `supabase.from("oee_dias").upsert(..., { onConflict: "turno,maquina,data" })` e cria registros em `oee_paradas`.

**Nova rota:** `src/routes/_app.oee.tsx` + `src/components/OeeDashboard.tsx` + `src/components/OeeImportPage.tsx` (botão "Importar PDFs" aceitando múltiplos arquivos).

### 3. UI da aba OEE — pílulas e gráficos

Filtros: data inicial/final, máquina, turno.

**Capacidade real (substitui a estimativa atual baseada em 75h/semana):**

```text
capacidade_dia(máq, turno, dia) = 15h54 − (paradas_totais_dia − refeição_dia)
livre_dia = capacidade_dia − horas_registradas_dia
```

Quando o usuário aplica um período, agregamos por máquina (somatória dos dias úteis com PDF importado). Exibido como pílulas "MÁQ 2000 / 739h / 3900h" no formato atual.

**Nova pílula "Tempo de Paradas":**
- Logo abaixo da seção que mostra máquina/horários.
- Valor = soma de `paradas_prog + paradas_nao_prog` (excluindo refeição) no período.
- Click abre Dialog listando categorias agregadas (decrescente, com horas e %).

**Novo gráfico "Paradas por máquina e turno":**
- `BarChart` agrupado: eixo X = máquina (2000/3000/5000), 2 barras por máquina (Turno 1 / Turno 2), valor = nº de ocorrências de parada no período.
- Como o PDF só traz somatório por categoria, "número de paradas" = nº de categorias distintas com tempo > 0 nesse turno/máquina/período. (Se quiser contagem real de eventos, precisa de outro relatório — confirmar.)
- Click em uma barra abre Dialog com a lista detalhada (categoria, total de horas).

### Arquivos a alterar/criar

```text
supabase/migrations/<new>_oee.sql            (novo)
src/components/ProductionDashboard.tsx       (gráfico semanal: + barra RG)
src/routes/_app.oee.tsx                      (novo: rota)
src/components/OeeDashboard.tsx              (novo)
src/components/OeeImportPage.tsx             (novo)
src/lib/oeePdfParser.ts                      (novo: parser)
src/components/AppLayout.tsx                 (novo item de menu "OEE")
```

### Pontos a confirmar antes de codar

1. **Capacidade-base 15h54** vale para as 3 máquinas e nos 2 turnos igualmente, certo? (Os PDFs já trazem "Horas Disponíveis" variável por dia — vou usar 15h54 como o usuário pediu, ignorando esse campo do PDF.)
2. **"Refeição"** é o único item a excluir do cálculo de paradas? (Há "Reunião Diária", "Reunião" e "Treinamentos" — manter incluídos como parada?)
3. **"Número de paradas"** no gráfico novo: contar como **nº de categorias com tempo > 0** no período (única coisa derivável do PDF). OK?
4. **Barra RG** no gráfico semanal: respeita filtros (máquina/urgência/datas) — OK?

Se as 4 estiverem OK, sigo direto na implementação.
