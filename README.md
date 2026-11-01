# ATENA SOLUTION

SaaS para pequenas e médias empresas: Atendimento com IA no WhatsApp, Coach de Vendas e Estúdio. Ver `CLAUDE.md` e `docs/`.

```bash
npm install
SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev   # sem chaves: banco em memória + login simulado (dono@demo.atena)
npm test                                      # testes (Vitest)
npm run lint && npm run typecheck && npm run build
```

Design system: `/ui`. Como encaixar uma aba: `docs/como-encaixar.md`. Situação de cada parte: `docs/status.md`.
