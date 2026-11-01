// Registro de uso de IA por empresa (para o custo estimado no /admin).
// AS OUTRAS ABAS CHAMAM ISTO depois de cada chamada de IA, por exemplo:
//   await registrarUsoIA(await banco(), empresaId, 'claude-sonnet-5-5', { entrada: r.usage.input_tokens, saida: r.usage.output_tokens });
// Guarda em empresas/{empresaId}/uso/{AAAA-MM} → { mes, modelos: UsoMes }. Estimativa: não precisa ser atômico.

import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import { somarUso, type UsoMes, type UsoModelo } from './admin';

export interface DocUso { mes: string; modelos: UsoMes; atualizadoEm: string }

export function mesDe(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(iso)).slice(0, 7);
}

export async function registrarUsoIA(b: Banco, empresaId: string, modelo: string, uso: UsoModelo, agoraIso = new Date().toISOString()): Promise<void> {
  try {
    const mes = mesDe(agoraIso);
    const caminho = juntar('empresas', empresaId, 'uso', mes);
    const atual = await b.obter<DocUso>(caminho);
    await b.gravar<DocUso>(caminho, { mes, modelos: somarUso(atual?.modelos ?? {}, { [modelo]: uso }), atualizadoEm: agoraIso });
  } catch (e) {
    console.error('registrarUsoIA', e); // nunca derruba o atendimento por causa do registro de uso
  }
}

export async function lerUsoDoMes(b: Banco, empresaId: string, mes: string): Promise<UsoMes> {
  return (await b.obter<DocUso>(juntar('empresas', empresaId, 'uso', mes)))?.modelos ?? {};
}
