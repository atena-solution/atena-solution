# Prompts das sessões na nuvem (claude.ai/code → repositório atena-solution)

Abrir a sessão A primeiro. Depois de ~30 min (quando o esqueleto estiver no GitHub), abrir B, C, D e E.

**A — Base**
> Leia CLAUDE.md, docs/plano.md, docs/design.md e docs/modulos/00-base.md. Você é a sessão A (Base). Construa tudo da seção "Entregas" desse arquivo, com testes. Faça commit e push a cada parte pronta (comece pelo esqueleto Next.js + design system + layout, para as outras sessões poderem encaixar as abas). No fim, atualize docs/status.md.

**B — Atendimento**
> Leia CLAUDE.md, docs/plano.md, docs/design.md, docs/modulos/00-base.md (contrato de dados) e docs/modulos/01-atendimento.md. Você é a sessão B (Atendimento). Faça git pull antes de começar e com frequência; trabalhe só em app/(app)/atendimento, app/api/whatsapp, lib/atendimento e lib/integracoes/{whatsapp,claude}.ts (+ testes). Construa todas as entregas, com SIMULAR=1 pras APIs externas. Commit e push frequentes. No fim, atualize a sua seção em docs/status.md.

**C — Coach de Vendas**
> Leia CLAUDE.md, docs/plano.md, docs/design.md, docs/modulos/00-base.md e docs/modulos/02-coach.md. Você é a sessão C (Coach). Faça git pull com frequência; trabalhe só em app/(app)/coach, app/api/coach, lib/coach e lib/integracoes/gemini.ts (transcrição) (+ testes). Construa todas as entregas, com SIMULAR=1. Commit e push frequentes. No fim, atualize a sua seção em docs/status.md.

**D — Estúdio**
> Leia CLAUDE.md, docs/plano.md, docs/design.md, docs/modulos/00-base.md e docs/modulos/03-estudio.md. Você é a sessão D (Estúdio). Faça git pull com frequência; trabalhe só em app/(app)/estudio, app/api/estudio, lib/estudio e lib/integracoes/imagem.ts (+ testes). Construa todas as entregas, com SIMULAR=1. Commit e push frequentes. No fim, atualize a sua seção em docs/status.md.

**E — Site, planos e entrada**
> Leia CLAUDE.md, docs/plano.md, docs/design.md, docs/modulos/00-base.md e docs/modulos/04-site-planos.md. Você é a sessão E (Site e planos). Faça git pull com frequência; trabalhe só em app/(site), app/(app)/admin, app/api/cobranca, lib/cobranca e lib/planos (+ testes). Construa todas as entregas, com SIMULAR=1. Commit e push frequentes. No fim, atualize a sua seção em docs/status.md.
