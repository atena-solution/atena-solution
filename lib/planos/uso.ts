// Registro de uso de IA por empresa (para o custo estimado no /admin).
// AS OUTRAS ABAS CHAMAM ISTO depois de cada chamada de IA, por exemplo:
//   await registrarUsoIA(await banco(), empresaId, 'claude-sonnet-5-5', { entrada: r.usage.input_tokens, saida: r.usage.output_tokens });
// Guarda em empresas/{empresaId}/uso/{AAAA-MM} → { mes, modelos: UsoMes }. Estimativa: não precisa ser atômico.

import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import { somarUso, type UsoMes, type UsoModelo } from './admin';

export interface DocUso {
  mes: string;
  modelos: UsoMes;
  atualizadoEm: string;
  /** Atendimento: conversas que a IA atendeu no mês (id → true), pro limite do plano. */
  conversas?: Record<string, true>;
  /** Coach: segundos de reunião no mês (uma trilha só), pro limite do plano. */
  segundosCoach?: number;
}

export function mesDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7);
}

export async function registrarUsoIA(b: Banco, empresaId: string, modelo: string, uso: UsoModelo, agoraIso = new Date().toISOString()): Promise<void> {
  try {
    const mes = mesDe(agoraIso);
    const caminho = juntar('empresas', empresaId, 'uso', mes);
    const atual = await b.obter<DocUso>(caminho);
    await b.gravar<DocUso>(caminho, { ...atual, mes, modelos: somarUso(atual?.modelos ?? {}, { [modelo]: uso }), atualizadoEm: agoraIso });
  } catch (e) {
    console.error('registrarUsoIA', e); // nunca derruba o atendimento por causa do registro de uso
  }
}

export async function lerUsoDoMes(b: Banco, empresaId: string, mes: string): Promise<UsoMes> {
  return (await b.obter<DocUso>(juntar('empresas', empresaId, 'uso', mes)))?.modelos ?? {};
}

/** Contadores do limite do plano no mês. */
export async function lerContadores(b: Banco, empresaId: string, agoraIso = new Date().toISOString()): Promise<{ conversas: Record<string, true>; segundosCoach: number }> {
  const d = await b.obter<DocUso>(juntar('empresas', empresaId, 'uso', mesDe(agoraIso)));
  return { conversas: d?.conversas ?? {}, segundosCoach: d?.segundosCoach ?? 0 };
}

/** Marca a conversa como atendida pela IA neste mês (idempotente). */
export async function contarConversa(b: Banco, empresaId: string, conversaId: string, agoraIso = new Date().toISOString()): Promise<void> {
  try {
    const mes = mesDe(agoraIso);
    const caminho = juntar('empresas', empresaId, 'uso', mes);
    const atual = await b.obter<DocUso>(caminho);
    if (atual?.conversas?.[conversaId]) return;
    await b.gravar<DocUso>(caminho, { ...atual, mes, modelos: atual?.modelos ?? {}, conversas: { ...(atual?.conversas ?? {}), [conversaId]: true }, atualizadoEm: agoraIso });
  } catch (e) {
    console.error('contarConversa', e);
  }
}

/** Soma segundos de reunião do Coach no mês. */
export async function somarSegundosCoach(b: Banco, empresaId: string, segundos: number, agoraIso = new Date().toISOString()): Promise<void> {
  if (!(segundos > 0)) return;
  try {
    const mes = mesDe(agoraIso);
    const caminho = juntar('empresas', empresaId, 'uso', mes);
    const atual = await b.obter<DocUso>(caminho);
    await b.gravar<DocUso>(caminho, { ...atual, mes, modelos: atual?.modelos ?? {}, segundosCoach: (atual?.segundosCoach ?? 0) + Math.round(segundos), atualizadoEm: agoraIso });
  } catch (e) {
    console.error('somarSegundosCoach', e);
  }
}
