// Cola entre as rotas (app/api/coach) e as regras (servico.ts). Só servidor.
// Login, Admin SDK e leitura da empresa são os da Base (lib/auth, lib/integracoes/firebase-admin, lib/dados).
import type { RepositorioCoach } from './repositorio';
import { repositorioEmMemoria } from './repositorio';
import type { Armazenamento } from './armazenamento';
import { armazenamentoEmMemoria } from './armazenamento';
import type { Sessao } from './tipos';
import { ErroCoach } from './servico';
import { banco, simulando } from '../dados';
import { juntar } from '../dados/banco';
import { exigirEmpresa, type ContextoAuth } from '../auth/servidor';
import type { Empresa, Membro, Papel } from '../tipos';

export function simulandoServidor(): boolean {
  return simulando();
}

// ---------- Autenticação ----------

/** Papéis que usam o Coach (atendente não). */
export const PAPEIS_COACH: Papel[] = ['dono', 'gestor', 'vendedor'];

/** Quem está chamando: o mesmo login da Base (idToken do Firebase ou token simulado). */
export async function autenticar(req: Request, ctx?: ContextoAuth): Promise<Sessao> {
  const s = await exigirEmpresa(req, PAPEIS_COACH, ctx);
  const b = ctx?.banco ?? (await banco());
  const membro = await b.obter<Membro>(juntar('empresas', s.empresaId, 'membros', s.uid));
  return { uid: s.uid, empresaId: s.empresaId, papel: s.papel, nome: membro?.nome || s.email };
}

// ---------- Dados ----------

type Global = { __coachRepo?: RepositorioCoach; __coachArm?: Armazenamento };
const g = globalThis as Global;

export async function repositorio(): Promise<RepositorioCoach> {
  if (simulando()) return (g.__coachRepo ??= repositorioEmMemoria());
  const [{ repositorioFirestore }, { firestoreAdmin }] = await Promise.all([import('./repositorio-firestore'), import('../integracoes/firebase-admin')]);
  return repositorioFirestore(firestoreAdmin());
}

export async function armazenamento(): Promise<Armazenamento> {
  if (simulando()) return (g.__coachArm ??= armazenamentoEmMemoria());
  const [{ armazenamentoFirebase }, { bucketAdmin }] = await Promise.all([import('./armazenamento'), import('../integracoes/firebase-admin')]);
  return armazenamentoFirebase(bucketAdmin());
}

// ---------- Plano ----------

/** Coach no plano e conta não vencida? Senão 402 com a mensagem do plano. */
export async function exigirCoach(empresaId: string) {
  const { exigirAba } = await import('../planos/portao');
  await exigirAba(empresaId, 'coach', 'escrever');
}

export { usoDaEmpresa } from '../planos/portao';

// ---------- Resposta ----------

/** Roda o handler e transforma ErroCoach/ErroHttp em JSON { erro } com o status certo. */
export async function responder(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const dados = await fn();
    if (dados instanceof Response) return dados;
    return Response.json(dados ?? { ok: true });
  } catch (e) {
    if (e instanceof ErroCoach) return Response.json({ erro: e.message }, { status: e.status });
    const st = (e as { status?: number }).status;
    if (typeof st === 'number' && st >= 400 && st < 500) {
      const motivo = (e as { decisao?: { motivo?: string } }).decisao?.motivo;
      return Response.json({ erro: (e as Error).message, ...(motivo ? { motivo } : {}) }, { status: st });
    }
    console.error('[coach]', e);
    return Response.json({ erro: 'Algo deu errado. Tente de novo.' }, { status: 500 });
  }
}

export function novoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

/** Dados da empresa que o Coach usa (segmento, nome, abas, WhatsApp) — lidos de empresas/{id} pelo banco da Base. */
export async function dadosEmpresa(empresaId: string): Promise<{ nome?: string; segmento?: string; abas: string[]; whatsappConectado: boolean }> {
  const b = await banco();
  const e = await b.obter<Empresa>(juntar('empresas', empresaId));
  const conexao = await b.obter<{ phoneNumberId?: string }>(juntar('empresas', empresaId, 'atendimento', 'conexao'));
  return { nome: e?.nome, segmento: e?.segmento, abas: e?.plano?.abas ?? [], whatsappConectado: !!conexao?.phoneNumberId };
}

/** Ganchos com Contatos (contrato da Base): atividade na linha do tempo e etapa do funil. */
export async function ganchosContatos() {
  const b = await banco();
  return {
    async registrarAtividade(empresaId: string, a: { contatoId: string; tipo: 'reuniao'; resumo: string; quando: string; porUid: string; reuniaoId: string }) {
      // id fixo por reunião: reanalisar atualiza a mesma atividade em vez de duplicar
      const id = `reuniao-${a.reuniaoId}`;
      await b.gravar(juntar('empresas', empresaId, 'atividades', id), { id, ...a });
      if (await b.obter(juntar('empresas', empresaId, 'contatos', a.contatoId))) {
        await b.mesclar(juntar('empresas', empresaId, 'contatos', a.contatoId), { ultimaInteracaoEm: a.quando });
      }
    },
    async etapaAtual(empresaId: string, contatoId: string) {
      const c = await b.obter<{ etapa?: string }>(juntar('empresas', empresaId, 'contatos', contatoId));
      return c?.etapa ?? undefined;
    },
    async moverEtapa(empresaId: string, contatoId: string, etapa: string) {
      if (!(await b.obter(juntar('empresas', empresaId, 'contatos', contatoId)))) return;
      await b.mesclar(juntar('empresas', empresaId, 'contatos', contatoId), { etapa });
      const quando = new Date().toISOString();
      const id = `etapa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      await b.gravar(juntar('empresas', empresaId, 'atividades', id), { id, contatoId, tipo: 'etapa', resumo: `Etapa → ${etapa} (pelo resultado da reunião)`, quando, porIA: true });
    },
  };
}
