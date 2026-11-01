# Plano — ATENA SOLUTION

Prazo da 1ª leva: até 05/11/2026 (créditos de nuvem do Claude Code). Trabalho em sessões paralelas, uma por parte.
Cada sessão: ler `CLAUDE.md`, `docs/design.md` e o arquivo do seu módulo; trabalhar SÓ nas pastas do seu módulo
(mais `lib/` compartilhado combinado em `docs/modulos/00-base.md`); testes passando; commits frequentes; no fim
atualizar `docs/status.md` com o que ficou pronto, o que é simulado e o que precisa de teste ao vivo.

| Sessão | Arquivo | Prioridade |
|---|---|---|
| A — Base (esqueleto, login, empresas, equipe, contatos/funil, agenda, layout e design) | `modulos/00-base.md` | 1 (começa primeiro) |
| B — Atendimento (WhatsApp + IA em tempo real + caixa de entrada) | `modulos/01-atendimento.md` | 1 |
| C — Coach de Vendas | `modulos/02-coach.md` | 2 |
| D — Estúdio | `modulos/03-estudio.md` | 3 |
| E — Site de vendas + planos/créditos + onboarding | `modulos/04-site-planos.md` | 2 |

Ordem de junção: A define os tipos e o layout → B, C, D, E plugam como abas. Enquanto A não existe no repositório,
as outras sessões criam o próprio código dentro de `app/(app)/<modulo>/` e `lib/<modulo>/` usando os tipos de
`docs/modulos/00-base.md` (contrato) — a junção acerta os detalhes.

## Depois (no Mac, com o Lincoln)
Firebase novo, Vercel nova, domínio, número de WhatsApp de teste, chaves da Anthropic/Gemini, testes ao vivo, 1ºs clientes piloto (barbearia Topetes e clínica Mira Luz para o Atendimento; time comercial da LB para o Coach — só como cliente de teste, dados separados).
