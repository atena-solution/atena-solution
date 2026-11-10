# Como encaixar uma aba na Base (para as sessões B, C, D, E)

**Rotas**: `/` é do site público (sessão E, `app/(site)/page.tsx`). O Início logado fica em **`/inicio`**.
Telas logadas: `app/(app)/<modulo>/page.tsx` → já ganham barra lateral, topo, busca Ctrl+K, menu do celular e o guardião de login.
Login: `/entrar`. Onboarding da empresa: `/onboarding`.

## Tela (cliente)
```tsx
'use client';
import { Cabecalho, Cartao, Botao, Vazio, useToast } from '@/app/ui';   // design system (ver /ui)
import { useSessao, useDados } from '@/lib/sessao';

export function MinhaTela() {
  const { empresa, sessao, membro, api } = useSessao();      // sessao = { uid, email, empresaId, papel }
  const { dados, carregando, recarregar } = useDados<{ itens: X[] }>('/api/minha-rota');
  await api('/api/minha-rota', { corpo: { ... } });           // POST com token + empresa
}
```
Cores de destaque das abas: `text-atendimento`, `bg-coach/10`, `border-estudio/25`… (tokens Tailwind) ou `var(--aba-atendimento)`.
Utilitários de texto: `@/lib/ui/formato` (telefone, reais, tempo relativo, busca sem acento).

## Rota de API (servidor)
```ts
import { rota, corpo } from '@/lib/api/rota';
export const GET = rota(undefined, async (req, { sessao, dados }) => {
  const contatos = await dados.listar<Contato>('contatos');     // já preso a empresas/{empresaId}
  return Response.json({ contatos });
});
export const POST = rota(['dono', 'gestor'], async (req, { dados }) => { ... });   // papéis permitidos
```
- `exigirEmpresa(req, papeis?)` em `lib/auth/servidor.ts` devolve `{ uid, email, empresaId, papel }` ou lança 401/403.
- Webhooks sem login (ex.: WhatsApp): `banco()` de `@/lib/dados` + `daEmpresa(banco, empresaId)` depois de descobrir a empresa.
- Modo simulado (`SIMULAR=1` ou sem `FIREBASE_SERVICE_ACCOUNT`): banco em memória com a empresa demo `demo` (Studio Aurora).
  Logins: `dono@demo.atena` (dono), `ana@demo.atena` (atendente), `outro@demo.atena` (dono de outra empresa — para testar isolamento).

## Dados compartilhados
Tipos: `lib/tipos.ts` (contrato). Agenda: `lib/agenda/horarios.ts` → `horariosLivres()`, `verificarHorario()`, `temConflito()`.
Funil: `lib/contatos/funil.ts` → `moverEtapa()` (gera a Atividade). Registrar algo na linha do tempo do contato = gravar uma
`Atividade` em `atividades` (`tipo: 'mensagem' | 'agendamento' | 'reuniao' | 'nota' | 'etapa'`).
Permissões de escrita por coleção: `lib/auth/permissoes.ts` (espelhadas em `firestore.rules`).
