import type { Colecao, Membro, Papel } from '../tipos';

/**
 * Regras de permissão (funções puras). As MESMAS regras estão em firestore.rules —
 * se mudar uma, mude a outra (tests/permissoes.test.ts cobre as duas listas).
 */

export type Operacao = 'ler' | 'escrever';

/** Quem pode escrever em cada coleção (ler: qualquer membro ativo). */
export const ESCRITA_POR_COLECAO: Record<Colecao | 'empresa', Papel[]> = {
  empresa: ['dono', 'gestor'],
  membros: ['dono', 'gestor'],
  convites: ['dono', 'gestor'],
  contatos: ['dono', 'gestor', 'atendente', 'vendedor'],
  atividades: ['dono', 'gestor', 'atendente', 'vendedor'],
  servicos: ['dono', 'gestor'],
  profissionais: ['dono', 'gestor'],
  agendamentos: ['dono', 'gestor', 'atendente', 'vendedor'],
  conversas: ['dono', 'gestor', 'atendente'],
  reunioes: ['dono', 'gestor', 'vendedor'],
  criacoes: ['dono', 'gestor', 'atendente', 'vendedor'],
};

export function podeAcessar(membro: Pick<Membro, 'papel' | 'ativo'> | null, alvo: Colecao | 'empresa', op: Operacao) {
  if (!membro || !membro.ativo) return false;
  if (op === 'ler') return true;
  return ESCRITA_POR_COLECAO[alvo].includes(membro.papel);
}

export function papelPermitido(papel: Papel, permitidos?: Papel[]) {
  return !permitidos || permitidos.length === 0 || permitidos.includes(papel);
}

/** Dono não pode ser rebaixado/removido se for o único dono. */
export function podeAlterarMembro(
  quem: Papel,
  alvo: Pick<Membro, 'uid' | 'papel'>,
  todos: Pick<Membro, 'uid' | 'papel' | 'ativo'>[],
  novoPapel?: Papel,
): { ok: true } | { ok: false; motivo: string } {
  if (quem !== 'dono' && quem !== 'gestor') return { ok: false, motivo: 'Só dono ou gestor mexe na equipe.' };
  if (alvo.papel === 'dono' && quem !== 'dono') return { ok: false, motivo: 'Só um dono altera outro dono.' };
  if (novoPapel === 'dono' && quem !== 'dono') return { ok: false, motivo: 'Só um dono promove alguém a dono.' };
  const donosAtivos = todos.filter((m) => m.papel === 'dono' && m.ativo);
  const deixaDeSerDono = alvo.papel === 'dono' && novoPapel !== 'dono';
  if (deixaDeSerDono && donosAtivos.length <= 1 && donosAtivos.some((d) => d.uid === alvo.uid)) {
    return { ok: false, motivo: 'A empresa precisa de pelo menos um dono.' };
  }
  return { ok: true };
}

export const NOME_PAPEL: Record<Papel, string> = {
  dono: 'Dono',
  gestor: 'Gestor',
  atendente: 'Atendente',
  vendedor: 'Vendedor',
};
