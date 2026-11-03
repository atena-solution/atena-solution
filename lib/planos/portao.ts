// Portão do plano no servidor: as abas chamam isto ANTES de a IA agir, e registram o uso DEPOIS.
//   Atendimento → antes de a IA responder (e das automações)  · Coach → antes de criar/analisar
//   Estúdio → antes de gerar
// A regra em si é pura (podeUsarAba em lib/planos/acesso.ts); aqui só se lê a assinatura.
import { banco } from '../dados';
import { juntar } from '../dados/banco';
import type { Empresa } from '../tipos';
import { podeUsarAba, type Acao, type Decisao } from './acesso';
import type { Aba } from './config';
import type { UsoModelo } from './admin';
import { contarConversa, lerContadores, registrarUsoIA, somarSegundosCoach } from './uso';
import { decidirCoach, decidirConversa, limitesDaAssinatura } from './limites';
import { situacaoAcesso } from './acesso';

async function assinaturaDa(empresaId: string) {
  const [{ depsCobranca }, { assinaturaOuTeste }] = await Promise.all([import('../cobranca'), import('../cobranca/servico')]);
  const d = await depsCobranca();
  const empresa = await (await banco()).obter<Empresa>(juntar('empresas', empresaId));
  return assinaturaOuTeste(d, empresaId, empresa?.criadoEm);
}

export async function decidirAba(empresaId: string, aba: Aba, acao: Acao = 'escrever', agora = new Date()): Promise<Decisao> {
  return podeUsarAba(await assinaturaDa(empresaId), aba, acao, agora.toISOString());
}

/** Atendimento: plano + limite de conversas do mês. Com conversaId, conta a conversa quando libera. */
export async function decidirAtendimento(empresaId: string, conversaId?: string, agora = new Date()): Promise<Decisao> {
  const a = await assinaturaDa(empresaId);
  const iso = agora.toISOString();
  const base = podeUsarAba(a, 'atendimento', 'escrever', iso);
  if (!base.permitido || !conversaId) return base;
  const b = await banco();
  const { conversas } = await lerContadores(b, empresaId, iso);
  const d = decidirConversa(limitesDaAssinatura(a, iso), Object.keys(conversas).length, !!conversas[conversaId], situacaoAcesso(a, iso).fase === 'teste');
  if (d.permitido && !conversas[conversaId]) await contarConversa(b, empresaId, conversaId, iso);
  return d;
}

/** Coach: plano + horas de reunião do mês. */
export async function decidirCoachMes(empresaId: string, agora = new Date()): Promise<Decisao> {
  const a = await assinaturaDa(empresaId);
  const iso = agora.toISOString();
  const base = podeUsarAba(a, 'coach', 'escrever', iso);
  if (!base.permitido) return base;
  const { segundosCoach } = await lerContadores(await banco(), empresaId, iso);
  return decidirCoach(limitesDaAssinatura(a, iso), segundosCoach, situacaoAcesso(a, iso).fase === 'teste');
}

export async function contarSegundosCoach(empresaId: string, segundos: number): Promise<void> {
  await somarSegundosCoach(await banco(), empresaId, segundos);
}

/** Erro "fora do plano" com status 402 e o motivo, para a tela mostrar o convite certo. */
export class ForaDoPlano extends Error {
  status = 402;
  constructor(public decisao: Decisao) {
    super(decisao.mensagem ?? 'Esta aba não está liberada no seu plano.');
  }
}

export async function exigirAba(empresaId: string, aba: Aba, acao: Acao = 'escrever'): Promise<void> {
  const d = await decidirAba(empresaId, aba, acao);
  if (!d.permitido) throw new ForaDoPlano(d);
}

/** Registrador de uso de IA preso a uma empresa. */
export function usoDaEmpresa(empresaId: string) {
  return async (modelo: string, uso: UsoModelo) => registrarUsoIA(await banco(), empresaId, modelo, uso);
}
