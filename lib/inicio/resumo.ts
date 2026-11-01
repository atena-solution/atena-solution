import type { Agendamento, Contato } from '../tipos';
import { dataLocal } from '../agenda/fuso';

/** Conversa mínima que o Início precisa (a sessão B define o resto). */
export interface ConversaResumo {
  status?: string; // 'aberta' | 'humano' | 'resolvida' …
  precisaHumano?: boolean;
}

export interface ResumoDoDia {
  agendamentosHoje: number;
  confirmadosHoje: number;
  compareceramHoje: number;
  faltasHoje: number;
  novosContatosHoje: number;
  conversasAbertas: number;
  precisamDeHumano: number;
  proximos: Agendamento[];
}

/** Números do cartão do Início, no dia local da empresa. */
export function resumoDoDia(p: {
  agora: Date;
  fuso: string;
  agendamentos: Agendamento[];
  contatos: Pick<Contato, 'criadoEm'>[];
  conversas: ConversaResumo[];
}): ResumoDoDia {
  const hoje = dataLocal(p.agora, p.fuso);
  const deHoje = p.agendamentos.filter((a) => dataLocal(a.inicio, p.fuso) === hoje && a.status !== 'cancelado');
  const abertas = p.conversas.filter((c) => c.status !== 'resolvida');
  return {
    agendamentosHoje: deHoje.length,
    confirmadosHoje: deHoje.filter((a) => a.status === 'confirmado').length,
    compareceramHoje: deHoje.filter((a) => a.status === 'compareceu').length,
    faltasHoje: deHoje.filter((a) => a.status === 'faltou').length,
    novosContatosHoje: p.contatos.filter((c) => dataLocal(c.criadoEm, p.fuso) === hoje).length,
    conversasAbertas: abertas.length,
    precisamDeHumano: abertas.filter((c) => c.precisaHumano || c.status === 'humano').length,
    proximos: deHoje
      .filter((a) => new Date(a.fim).getTime() >= p.agora.getTime() && (a.status === 'marcado' || a.status === 'confirmado'))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .slice(0, 6),
  };
}

/** Saudação pela hora local. */
export function saudacao(agora: Date, fuso: string): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hour: 'numeric', hourCycle: 'h23' }).format(agora));
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}
