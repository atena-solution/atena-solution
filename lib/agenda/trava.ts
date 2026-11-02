// Uma regra só para "horário ocupado" + uma trava só para marcar/remarcar.
// - A REGRA é `temConflito` (lib/agenda/horarios.ts), usada por verificarHorario e pelo Atendimento.
// - A TRAVA é por profissional: empresas/{id}/agenda_travas/{profissionalId}. Equipe (lib/agenda/operacoes.ts)
//   e IA (lib/atendimento/repo-banco.ts) usam o MESMO caminho, então duas pessoas (ou a IA e a recepção)
//   nunca pegam o mesmo horário ao mesmo tempo.
//   Processo único (simulado/testes): fila em memória compartilhada. Firestore: documento-trava com create().
import { juntar } from '../dados/banco';

export interface TravaAgenda {
  comTrava<T>(caminho: string, fn: () => Promise<T>): Promise<T>;
}

const seguro = (s: string) => s.replace(/[^A-Za-z0-9_.@+-]/g, '_').slice(0, 200) || '_';

export function caminhoTravaAgenda(empresaId: string, profissionalId: string): string {
  return juntar('empresas', empresaId, 'agenda_travas', seguro(profissionalId));
}

const g = globalThis as unknown as { __atenaTravasAgenda?: Map<string, Promise<unknown>> };

/** Trava do processo (memória). Compartilhada por todo o servidor: Base e Atendimento esperam na mesma fila. */
export const travaLocal: TravaAgenda = {
  async comTrava(caminho, fn) {
    const travas = (g.__atenaTravasAgenda ??= new Map());
    const anterior = travas.get(caminho) ?? Promise.resolve();
    const atual = anterior.catch(() => undefined).then(fn);
    travas.set(caminho, atual);
    try {
      return await atual;
    } finally {
      if (travas.get(caminho) === atual) travas.delete(caminho);
    }
  },
};

/** Trava certa para o ambiente: memória no simulado, Firestore no real. */
export async function travaAgenda(): Promise<TravaAgenda> {
  const { simulando } = await import('../dados');
  if (simulando()) return travaLocal;
  const { travaFirestore } = await import('../dados/trava-firestore');
  return travaFirestore();
}
