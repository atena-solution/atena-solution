// Dados de teste do Atendimento.
import type { Agendamento, Empresa, Profissional, Servico, Treino } from '@/lib/atendimento/tipos'

export const FUSO = 'America/Sao_Paulo'

export const horariosSemana = [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: '09:00', fecha: '18:00' }))
  .concat([{ dia: 6, abre: '09:00', fecha: '13:00' }])

export function empresa(id: string, nome = 'Barbearia Topetes'): Empresa {
  return {
    id,
    nome,
    segmento: 'barbearia',
    fuso: FUSO,
    telefone: '5511999990000',
    endereco: 'Rua das Flores, 100',
    horarios: horariosSemana,
    criadoEm: '2026-10-01T12:00:00.000Z',
  }
}

export const corte: Servico = { id: 'corte', nome: 'Corte', duracaoMin: 30, preco: 50, descricao: 'Corte masculino' }
export const barba: Servico = { id: 'barba', nome: 'Barba', duracaoMin: 60, preco: 40, descricao: 'Barba completa' }

export const joao: Profissional = { id: 'joao', nome: 'João', servicosIds: ['corte', 'barba'], horarios: [] }
export const ana: Profissional = { id: 'ana', nome: 'Ana', servicosIds: ['corte'], horarios: [] }

export function ag(p: Partial<Agendamento> & { id: string; inicio: string; fim: string }): Agendamento {
  return {
    contatoId: 'c1',
    servicoId: 'corte',
    profissionalId: 'joao',
    status: 'marcado',
    criadoPor: 'ia',
    lembretes: {},
    ...p,
  }
}

export function treino(empresaId: string, p: Partial<Treino> = {}): Treino {
  return {
    empresaId,
    ligada: true,
    nomeAssistente: 'Atena',
    tom: 'simpático e direto',
    perguntas: [{ pergunta: 'Vocês aceitam pix?', resposta: 'Aceitamos pix, cartão e dinheiro.' }],
    nuncaDizer: ['desconto'],
    quandoChamarHumano: [],
    regrasExtras: '',
    linkAvaliacao: 'https://g.page/r/topetes',
    mensagensRapidas: [],
    automacoes: { lembreteVespera: true, lembreteUmaHora: true, recuperarFalta: true, pedirAvaliacao: true },
    avisoHumanoMin: 5,
    ...p,
  }
}
