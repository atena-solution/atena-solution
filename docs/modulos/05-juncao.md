# Módulo 05 — Junção (sessão F)

As sessões A–E já foram juntadas na `main` (399 testes passando, typecheck e build ok em 01/11/2026).
Cada uma deixou pontos marcados `JUNÇÃO` e pendências no `docs/status.md`. Esta sessão costura tudo.

## Entregas
1. **Login único**: Coach (`lib/coach/servidor.ts → autenticar`, `garantirFirebase`, `dadosEmpresa`; `_componentes/api.ts → cabecalhosAuth`) e Estúdio passam a usar `exigirEmpresa(...)`, o Admin SDK e o leitor de empresa da Base. Nada de autenticação paralela.
2. **Visual único**: trocar `_componentes/ui.tsx` do Coach (e o que houver no Estúdio/Atendimento) e as variáveis `--coach-*` pelos componentes e tokens de `app/ui`. Mesmo cabeçalho de página, cartões e botões em todas as abas.
3. **Plano e créditos ligados**: usar `podeUsarAba` / `lerAcesso` antes de a IA responder (Atendimento), antes de analisar (Coach) e antes de gerar (Estúdio); `registrarUsoIA(...)` depois de toda chamada de IA; `<AvisoPlano />` no topo da moldura (`app/(app)/Casca.tsx`). Aba fora do plano: tela convidando a contratar (não erro).
4. **Ficha do contato**: encaixar `BotaoGravarReuniao`, `ReunioesDoContato` (Coach) e a conversa do WhatsApp (Atendimento) na ficha; Início com `CartaoCoachInicio`, cartão do Atendimento e do Estúdio.
5. **Follow-up do Coach pelo WhatsApp da empresa** (`app/api/coach/reunioes/[id]/followup`) usando o envio do Atendimento (respeitando a janela de 24h).
6. **Áudio do cliente no Atendimento**: ligar `Deps.transcrever` à transcrição do Gemini (`lib/integracoes/gemini.ts`).
7. **Um onboarding só**: o fim do `/onboarding` da Base leva ao `/comecar` (treinar IA e WhatsApp), sem perguntar duas vezes a mesma coisa.
8. **Agenda**: unificar a trava de horário do Atendimento com `lib/agenda/operacoes.ts` (uma regra só para "horário ocupado").
9. **Regras e índices**: `firestore.rules` e `firestore.indexes.json` com tudo que as abas usam (reunioes, coach, estudio, atendimento, cobranca), Storage `empresas/{id}/**` só para membros; testes das regras puras.
10. **Estúdio**: escrever a seção D do `docs/status.md` (pronto / simulado / testar ao vivo), no mesmo formato das outras.
11. **Revisão final de produto**: navegar por todas as telas no modo simulado (desktop e celular), corrigir textos, estados vazios, rolagem lateral e links quebrados. Atualizar `docs/status.md` com um "Como testar" geral e a lista única do que precisa de teste ao vivo.

Regras: `npm test`, `npx tsc --noEmit` e `npx next build` passando a cada commit. Commits pequenos, push na própria branch.
