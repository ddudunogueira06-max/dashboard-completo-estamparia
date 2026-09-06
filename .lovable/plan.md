# Finalizar o assistente de dados (IA)

A parte que consulta o banco já está pronta. Falta a parte visível: o botão flutuante com o logo e a janelinha de conversa.

## O que será feito

1. **Botão flutuante**
   - Pequeno botão redondo no canto inferior direito, em todas as páginas, com o logo X enviado.
   - Discreto, acima do conteúdo, sem cobrir botões existentes; escondido no Modo TV.

2. **Janela de conversa**
   - Abre ao clicar no botão: painel compacto com histórico da conversa, campo de pergunta e botão de enviar.
   - Mostra "pensando..." enquanto busca, e mensagem de erro clara se algo falhar.
   - Respostas formatadas (números em destaque, listas e tabelas curtas).
   - Sugestões iniciais de perguntas (ex.: "SLA da dobra este mês", "FPPs realizadas na semana", "desperdício por material").
   - Fecha com Esc ou clicando fora; a conversa se mantém enquanto navega entre páginas.

3. **Ajustes finais**
   - Contraste conferido no modo claro e escuro.
   - Verificação com uma pergunta real para confirmar que a resposta traz números do banco.

## Detalhes técnicos

- Novo `src/components/DatabaseAssistant.tsx` (botão + painel), montado uma vez em `src/components/AppLayout.tsx`, oculto na rota `/painel-tv`.
- Chama a função de servidor existente `perguntarIA` de `src/lib/api/ia.functions.ts` via `useServerFn`; nenhuma credencial vai para o navegador.
- Logo carregado pelo pointer já existente `src/assets/x-branco.png.asset.json`.
- Renderização das respostas em markdown simples feita com formatação própria (sem adicionar dependência nova).
