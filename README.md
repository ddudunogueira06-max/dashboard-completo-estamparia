# DASHBOARD ESTAMPARIA

Preciso criar um sistema web/dashboard para controle e análise de desperdício industrial baseado em uma planilha Excel que será importada diariamente.

O sistema deve funcionar como uma plataforma de BI/dashboard automatizado.

OBJETIVO:
Criar um dashboard interativo que leia dados de uma planilha Excel enviada manualmente todos os dias, atualize automaticamente o banco de dados e reflita as mudanças nos gráficos, indicadores e relatórios.

ESTRUTURA DO SISTEMA:

DASHBOARD PRINCIPAL
A tela principal deve mostrar indicadores visuais e gráficos automáticos com base nos dados importados da planilha.

O visual precisa ser moderno, industrial, limpo e profissional.

O dashboard deve conter:

Cards de indicadores principais:

Total de desperdício

Valor total do desperdício

Quantidade de peças

Setor com maior desperdício

Material mais desperdiçado

Percentual de desperdício

Gráficos dinâmicos:

Desperdício por setor

Desperdício por material

Desperdício por mês

Evolução diária

Ranking de maiores desperdícios

Comparativo mensal

Filtros:

Data inicial e final

Setor

Material

Máquina

Tipo de desperdício

Tabelas detalhadas:

Lista de registros importados

Busca rápida

Ordenação

Exportação Excel/PDF

ABA DE IMPORTAÇÃO DE PLANILHA (MUITO IMPORTANTE)
Essa é a parte mais importante do sistema.

Preciso de uma aba chamada:
“Importar Planilha”

Nessa aba deve existir:

Botão para upload de arquivo Excel (.xlsx)

Sistema de leitura automática da planilha

Importação dos dados para o banco de dados

Atualização automática dos gráficos e indicadores após importar

Evitar duplicidade de dados

Mostrar mensagem de sucesso ou erro na importação

Histórico das importações realizadas

Possibilidade de substituir ou adicionar novos dados

FUNCIONAMENTO:
Todos os dias vou receber uma nova planilha Excel.
Vou entrar no sistema, importar essa planilha e o dashboard deve atualizar automaticamente com os novos dados.

BANCO DE DADOS:
Os dados importados precisam ser armazenados em banco de dados real, não apenas em memória temporária.

O sistema deve ser preparado para crescer com milhares de linhas futuramente.

TECNOLOGIAS:
Pode usar:

React

Next.js

Supabase

PostgreSQL

Tailwind

Recharts/Charts

IMPORTANTE:
O sistema precisa ser realmente funcional para importação de Excel e atualização automática do dashboard.
A parte de importação é prioridade máxima.

O layout deve ser semelhante a dashboards industriais/Power BI, com aparência moderna e profissional.

Vou enviar:

A imagem de referência visual

A planilha modelo do banco de dados

Com base nisso, gerar toda a estrutura completa do sistema.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://dashboard-completo-estamparia.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f4f25117-6d1e-4f90-81cb-5df7d415b1d3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
