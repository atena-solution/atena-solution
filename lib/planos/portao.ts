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
import { registrarUsoIA } from './uso';

export async function decidirAba(empresaId: string, aba: Aba, acao: Acao = 'escrever', agora = new Date()): Promise<Decisao> {
  const [{ depsCobranca }, { assinaturaOuTeste }] = await Promise.all([import('../cobranca'), import('../cobranca/servico')]);
  const d = await depsCobranca();
  const empresa = await (await banco()).obter<Empresa>(juntar('empresas', empresaId));
  const assinatura = await assinaturaOuTeste(d, empresaId, empresa?.criadoEm);
  return podeUsarAba(assinatura, aba, acao, agora.toISOString());
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
