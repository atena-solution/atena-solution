// Cola entre as rotas (app/api/coach) e as regras (servico.ts). Só servidor.
// Ponto ÚNICO a ajustar na junção com a Base (sessão A): `autenticar` → exigirEmpresa de lib/auth/servidor.ts.
import type { RepositorioCoach } from './repositorio';
import { repositorioEmMemoria } from './repositorio';
import type { Armazenamento } from './armazenamento';
import { armazenamentoEmMemoria } from './armazenamento';
import type { Sessao } from './tipos';
import { ErroCoach } from './servico';

export function simulandoServidor(): boolean {
  return process.env.SIMULAR === '1';
}

// ---------- Autenticação ----------

const PAPEIS = ['dono', 'gestor', 'atendente', 'vendedor'] as const;

/**
 * Quem está chamando.
 * - SIMULAR=1: sessão de demonstração (pode trocar por cabeçalhos x-sim-uid/x-sim-empresa/x-sim-papel pra testar papéis).
 * - Real: usa o exigirEmpresa da Base (ligar na junção).
 */
export async function autenticar(req: Request): Promise<Sessao> {
  if (simulandoServidor()) {
    const papel = req.headers.get('x-sim-papel') as Sessao['papel'] | null;
    return {
      uid: req.headers.get('x-sim-uid') || 'demo-dono',
      empresaId: req.headers.get('x-sim-empresa') || 'demo',
      papel: papel && (PAPEIS as readonly string[]).includes(papel) ? papel : 'dono',
      nome: req.headers.get('x-sim-nome') || 'Você (demo)',
    };
  }
  // JUNÇÃO: trocar por `const s = await exigirEmpresa(req, ['dono','gestor','vendedor'])` (lib/auth/servidor.ts)
  throw new ErroCoach(501, 'Login ainda não ligado nesta versão. Rode com SIMULAR=1.');
}

// ---------- Dados ----------

type Global = { __coachRepo?: RepositorioCoach; __coachArm?: Armazenamento };
const g = globalThis as Global;

export async function repositorio(): Promise<RepositorioCoach> {
  if (simulandoServidor()) return (g.__coachRepo ??= repositorioEmMemoria());
  const [{ repositorioFirestore }, { getFirestore }] = await Promise.all([import('./repositorio-firestore'), import('firebase-admin/firestore')]);
  await garantirFirebase();
  return repositorioFirestore(getFirestore());
}

export async function armazenamento(): Promise<Armazenamento> {
  if (simulandoServidor()) return (g.__coachArm ??= armazenamentoEmMemoria());
  const [{ armazenamentoFirebase }, { getStorage }] = await Promise.all([import('./armazenamento'), import('firebase-admin/storage')]);
  await garantirFirebase();
  return armazenamentoFirebase(getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET));
}

/** JUNÇÃO: a Base deve ter o próprio init do Admin SDK; aqui é só um reserva. */
async function garantirFirebase() {
  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  if (getApps().length) return;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  initializeApp(json ? { credential: cert(JSON.parse(json)), storageBucket: process.env.FIREBASE_STORAGE_BUCKET } : undefined);
}

// ---------- Resposta ----------

/** Roda o handler e transforma ErroCoach em JSON { erro } com o status certo. */
export async function responder(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const dados = await fn();
    if (dados instanceof Response) return dados;
    return Response.json(dados ?? { ok: true });
  } catch (e) {
    if (e instanceof ErroCoach) return Response.json({ erro: e.message }, { status: e.status });
    const st = (e as { status?: number }).status;
    if (typeof st === 'number' && st >= 400 && st < 500) return Response.json({ erro: (e as Error).message }, { status: st });
    console.error('[coach]', e);
    return Response.json({ erro: 'Algo deu errado. Tente de novo.' }, { status: 500 });
  }
}

export function novoId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

/** Dados da empresa que o Coach usa (segmento, nome, abas, WhatsApp). JUNÇÃO: ler de empresas/{id}. */
export async function dadosEmpresa(empresaId: string): Promise<{ nome?: string; segmento?: string; abas: string[]; whatsappConectado: boolean }> {
  if (simulandoServidor()) return { nome: 'Empresa Demo', segmento: 'generico', abas: ['coach'], whatsappConectado: false };
  const { getFirestore } = await import('firebase-admin/firestore');
  await garantirFirebase();
  const s = await getFirestore().doc(`empresas/${empresaId}`).get();
  const e = (s.data() ?? {}) as { nome?: string; segmento?: string; plano?: { abas?: string[] }; whatsapp?: { phoneNumberId?: string } };
  return { nome: e.nome, segmento: e.segmento, abas: e.plano?.abas ?? [], whatsappConectado: !!e.whatsapp?.phoneNumberId };
}

/**
 * Ganchos com Contatos (contrato da Base): atividade na linha do tempo e etapa do funil.
 * Simulado: não grava nada (só a reunião guarda o resultado).
 */
export async function ganchosContatos() {
  if (simulandoServidor()) return undefined;
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  await garantirFirebase();
  const db = getFirestore();
  return {
    async registrarAtividade(empresaId: string, a: { contatoId: string; tipo: 'reuniao'; resumo: string; quando: string; porUid: string; reuniaoId: string }) {
      // id fixo por reunião: reanalisar atualiza a mesma atividade em vez de duplicar
      await db.doc(`empresas/${empresaId}/atividades/reuniao-${a.reuniaoId}`).set({ id: `reuniao-${a.reuniaoId}`, empresaId, ...a });
      await db.doc(`empresas/${empresaId}/contatos/${a.contatoId}`).set({ ultimaInteracaoEm: a.quando }, { merge: true });
    },
    async etapaAtual(empresaId: string, contatoId: string) {
      const s = await db.doc(`empresas/${empresaId}/contatos/${contatoId}`).get();
      return (s.data()?.etapa as string | undefined) ?? undefined;
    },
    async moverEtapa(empresaId: string, contatoId: string, etapa: string) {
      await db.doc(`empresas/${empresaId}/contatos/${contatoId}`).set({ etapa }, { merge: true });
      await db.collection(`empresas/${empresaId}/atividades`).add({
        empresaId, contatoId, tipo: 'etapa', resumo: `Etapa → ${etapa} (pelo resultado da reunião)`, quando: new Date().toISOString(), porIA: true,
        criadoEm: FieldValue.serverTimestamp(),
      });
    },
  };
}
