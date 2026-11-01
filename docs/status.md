# Status

(cada sessão atualiza a sua parte)

## A — Base

**Pronto (01/11/2026)** — todas as 10 entregas de `docs/modulos/00-base.md`. 84 testes passando (`npm test`), `npm run lint`, `npm run typecheck` e `npm run build` limpos.

Como rodar na nuvem/sem chaves: `SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev` → `/entrar` com `dono@demo.atena` (empresa demo "Studio Aurora"),
`ana@demo.atena` (atendente) ou `outro@demo.atena` (outra empresa, para ver o isolamento). Qualquer outro e-mail cai no onboarding.
Guia para as outras sessões: **`docs/como-encaixar.md`**.

| Entrega | Onde | Situação |
|---|---|---|
| 1. Next.js 16 + TS + Tailwind 4 + ESLint + Vitest | raiz | pronto |
| 2. Design system + `/ui` | `app/ui/` (Botao, Campo, AreaTexto, Select, Cartao, Abas, Tabela, Modal/Folha, Toast, Selo, Avatar, Vazio, Esqueleto, Logo, ícones lucide) | pronto, claro/escuro |
| 3. Layout logado | `app/(app)/layout.tsx` + `Casca.tsx` (barra lateral, topo com empresa/usuário, troca de empresa, Ctrl+K, menu inferior no celular) | pronto |
| 4. Autenticação | `lib/auth/cliente.ts` (Google + e-mail/senha), `lib/auth/servidor.ts` (`exigirEmpresa`, `obterSessao`) | **simulado**; Firebase real escrito, não testado |
| 5. Multi-empresa | `lib/dados/empresa.ts` (`daEmpresa` prende tudo em `empresas/{id}`), `lib/auth/permissoes.ts`, `firestore.rules` | pronto + testes de isolamento nas rotas |
| 6. Onboarding | `/onboarding` (empresa → horários → serviços/quem atende → marca), retoma de onde parou | pronto |
| 7. Contatos e funil | `/contatos` (lista + quadro arrastável), `/contatos/[id]` (ficha, linha do tempo, notas, etiquetas, responsável), importar CSV, etapas configuráveis | pronto |
| 8. Agenda | `/agenda` (dia/semana, marcar/remarcar/cancelar, status), `lib/agenda/horarios.ts` (`horariosLivres`, `verificarHorario`), `lib/agenda/operacoes.ts` | pronto |
| 9. Início | `/inicio` + `/api/inicio`; cartões extras das abas em `app/(app)/inicio/cartoes-das-abas.tsx` | pronto |
| 10. Configurações | `/configuracoes?aba=empresa|servicos|profissionais|funil|equipe|plano|integracoes` | pronto (plano = placeholder da sessão E; WhatsApp → `/configuracoes/whatsapp`, tela da sessão B) |

**Decisões que afetam as outras sessões**
- `/` é do site público (sessão E). O Início logado é **`/inicio`**.
- Datas em ISO UTC; fuso da empresa em `empresa.fuso` (funções em `lib/agenda/fuso.ts`).
- A IA do Atendimento deve marcar/remarcar/cancelar por `lib/agenda/operacoes.ts` com `{ ia: true }` — já valida conflito, horário e avança o funil.
- Plano/créditos não mudam por `PATCH /api/empresa` (nem pelas regras do Firestore): só pelo servidor da cobrança (sessão E).
- Banco: em `SIMULAR=1` (ou sem `FIREBASE_SERVICE_ACCOUNT`) tudo fica em memória com dados demo; reinicia a cada `npm run dev`.

**Simulado / precisa de teste ao vivo (no Mac)**
- Firebase Auth real (Google popup, e-mail/senha, redefinir senha) e `verifyIdToken` — `// CONFIRMAR AO VIVO`.
- Firestore real via Admin SDK (`lib/dados/firestore.ts`) e deploy de `firestore.rules`; rodar as regras no emulador (`firebase emulators:start`).
  Hoje o teste compara `firestore.rules` com `lib/auth/permissoes.ts`, não executa as regras.
- Convite de equipe: cria o convite e entra no 1º login com o e-mail; **o e-mail de convite não é enviado** (falta serviço de e-mail).
- Logo: por enquanto é um link (sem upload de arquivo).
- Listagens leem a coleção inteira e filtram no servidor (ok para PME); trocar por consultas indexadas se crescer.

**Variáveis de ambiente** (ver `.env.example`): `SIMULAR`, `NEXT_PUBLIC_SIMULAR`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`.

## B — Atendimento

## C — Coach

## D — Estúdio

## E — Site e planos
