# ATENA SOLUTION — contexto para o Claude Code

Dono: **Lincoln**. Produto NOVO e SEPARADO da LB Marketplace: **não usar, copiar ou ler nada dos repositórios, do Firebase, da Vercel ou dos dados da LB.** Projeto próprio, contas próprias.

## O que é
SaaS brasileiro, em português, para pequenas e médias empresas (clínicas, barbearias, estética, imobiliárias, escolas, lojas, agências). Uma plataforma só, com **abas bem separadas e fáceis de entender**:

1. **Atendimento** — atendente de IA no WhatsApp que responde o cliente novo NA HORA (24h), tira dúvidas com o que a empresa ensinou, marca na agenda, confirma, lembra, recupera quem faltou e pede avaliação. A equipe vê as conversas ao vivo e assume quando quiser.
2. **Coach de Vendas** — grava reunião/ligação de venda, transcreve, dá nota ao vendedor contra o roteiro da empresa, aponta objeções e como responder, escreve o follow-up; placar da equipe pro dono.
3. **Estúdio** — foto profissional, vídeo curto e posts a partir da foto do celular, com a marca da empresa (logo, cores, tom). Por créditos.

Base comum: empresa (multi-empresa), equipe com papéis, **Contatos e funil** (todo cliente, origem, etapa, histórico), WhatsApp, agenda, plano e créditos.
O cliente pode contratar uma aba ou o pacote.

## Regras de trabalho
- Português do Brasil em tudo (tela, mensagens, comentários). Texto curto e claro, sem jargão.
- **Visual próprio e premium**, sem "cara de template/cloud": identidade da Atena (ver `docs/design.md`). Nada de painel genérico de admin.
- Multi-empresa desde o 1º dia: TODO dado pertence a uma `empresaId`; nenhuma rota devolve dado de outra empresa (testar isso).
- Segredos só em variáveis de ambiente. Nunca em arquivo versionado.
- Toda lógica de regra em funções puras com testes (`npm test`). Integrações externas atrás de um módulo `lib/integracoes/*` com modo simulado (`SIMULAR=1`) — as sessões na nuvem não têm chaves nem internet pras APIs reais; testes ao vivo são feitos depois no Mac.
- Nunca chutar formato de API externa: escrever o que a doc oficial diz num comentário com a data, e marcar `// CONFIRMAR AO VIVO` o que não foi testado.
- Commits pequenos e frequentes, mensagens em português.

## Arquitetura (decidida)
- **Next.js (App Router) + TypeScript + Tailwind**, deploy na **Vercel** (projeto novo `atena-solution`).
- **Firebase NOVO** (projeto `atena-solution`): Auth (Google + e-mail/senha) e Firestore (tempo real para o Atendimento). Admin SDK no servidor.
- IA: **Claude API** (Anthropic) para conversa/atendimento/análise (modelo `claude-sonnet-5-5`; respostas rápidas `claude-haiku-5-5`; NÃO mandar `temperature`). **Gemini** para transcrição de áudio e geração de imagem/vídeo.
- WhatsApp: **Meta WhatsApp Cloud API** — cada empresa conecta o próprio número; webhook único roteia por `phone_number_id` → empresa.
- Agenda própria da Atena (com sincronização opcional com Google Agenda depois).
- Cobrança: Asaas (conta própria da Atena) — fase posterior.

Estrutura: `app/` (telas e rotas), `lib/` (regras puras + integrações), `tests/`, `docs/`.
Ver `docs/plano.md` (ordem e entregas) e `docs/modulos/*.md` (especificação de cada parte).
