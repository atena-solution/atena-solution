// Ferramentas que a IA pode usar (tool use) e como cada uma é executada.
// Toda execução recebe a empresa e o contato do contexto: a IA não escolhe empresa nem cliente.

import type { BetaTool } from '@/lib/integracoes/claude'
import type { RepoAtendimento } from './repositorio'
import type { Agendamento, Contato, Conversa, Empresa, Profissional, Servico } from './tipos'
import { calcularHorariosLivres, conferirHorario } from './horarios'
import { DIA, descreverInstante, diaLocal, horaLocal, instanteLocal, somarDias } from './tempo'

const obj = (props: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties: props,
  required,
  additionalProperties: false,
})

export const FERRAMENTAS: BetaTool[] = [
  {
    name: 'ver_horarios_livres',
    description:
      'Lista horários livres de um serviço num dia. Use SEMPRE antes de oferecer horários ao cliente. Devolve até 8 horários com o início exato (ISO) para usar em marcar_horario.',
    input_schema: obj(
      {
        servico_id: { type: 'string', description: 'id do serviço (entre colchetes na lista de serviços)' },
        data: { type: 'string', description: 'dia no formato YYYY-MM-DD (horário da empresa)' },
        profissional_id: { type: ['string', 'null'], description: 'id do profissional, se o cliente pediu alguém' },
      },
      ['servico_id', 'data', 'profissional_id'],
    ),
    strict: true,
  },
  {
    name: 'marcar_horario',
    description:
      'Marca o horário que o cliente escolheu. Só use depois que o cliente confirmar o horário. O início deve vir de ver_horarios_livres.',
    input_schema: obj(
      {
        servico_id: { type: 'string' },
        inicio: { type: 'string', description: 'início em ISO 8601, exatamente como veio de ver_horarios_livres' },
        profissional_id: { type: ['string', 'null'] },
      },
      ['servico_id', 'inicio', 'profissional_id'],
    ),
    strict: true,
  },
  {
    name: 'remarcar',
    description: 'Muda um agendamento deste cliente para outro horário livre (consulte ver_horarios_livres antes).',
    input_schema: obj({ agendamento_id: { type: 'string' }, novo_inicio: { type: 'string', description: 'ISO 8601' } }, [
      'agendamento_id',
      'novo_inicio',
    ]),
    strict: true,
  },
  {
    name: 'cancelar',
    description: 'Cancela um agendamento deste cliente, quando ele pedir.',
    input_schema: obj({ agendamento_id: { type: 'string' }, motivo: { type: 'string' } }, ['agendamento_id', 'motivo']),
    strict: true,
  },
  {
    name: 'passar_para_humano',
    description:
      'Chama alguém da equipe e pausa a IA nesta conversa. Use em reclamação, assunto sensível, pedido do cliente, ou quando não souber responder.',
    input_schema: obj({ motivo: { type: 'string', description: 'motivo curto, para a equipe' } }, ['motivo']),
    strict: true,
  },
  {
    name: 'salvar_dado_do_contato',
    description: 'Guarda um dado que o cliente informou (nome, e-mail, data de nascimento, preferência…).',
    input_schema: obj(
      {
        campo: { type: 'string', description: '"nome", "email" ou outro nome de campo curto' },
        valor: { type: 'string' },
      },
      ['campo', 'valor'],
    ),
    strict: true,
  },
]

export interface ContextoFerramentas {
  repo: RepoAtendimento
  empresa: Empresa
  servicos: Servico[]
  profissionais: Profissional[]
  contato: Contato
  conversa: Conversa | null
  agora: Date
  /** Simulador: não grava nada, só responde como se tivesse feito. */
  seco?: boolean
}

export type Efeito =
  | { tipo: 'humano'; motivo: string }
  | { tipo: 'agendou'; agendamento: Agendamento }
  | { tipo: 'remarcou'; agendamentoId: string; inicio: string }
  | { tipo: 'cancelou'; agendamentoId: string }
  | { tipo: 'dado'; campo: string; valor: string }

export interface ResultadoFerramenta {
  conteudo: Record<string, unknown>
  erro?: boolean
  efeito?: Efeito
}

async function agendamentosDoDia(ctx: ContextoFerramentas, dia: string) {
  const de = instanteLocal(dia, '00:00', ctx.empresa.fuso).toISOString()
  const ate = new Date(Date.parse(de) + DIA).toISOString()
  // pega também o que começou antes da meia-noite e ainda ocupa
  return ctx.repo.agendamentos(ctx.empresa.id, new Date(Date.parse(de) - DIA).toISOString(), ate)
}

function acharServico(ctx: ContextoFerramentas, id: unknown): Servico | undefined {
  return ctx.servicos.find((s) => s.id === id) ?? ctx.servicos.find((s) => s.nome.toLowerCase() === String(id).toLowerCase())
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export async function executarFerramenta(nome: string, input: Record<string, unknown>, ctx: ContextoFerramentas): Promise<ResultadoFerramenta> {
  const fuso = ctx.empresa.fuso
  switch (nome) {
    case 'ver_horarios_livres': {
      const servico = acharServico(ctx, input.servico_id)
      if (!servico) return { erro: true, conteudo: { erro: 'Serviço não encontrado. Use um id da lista de serviços.' } }
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(texto(input.data)) ? texto(input.data) : diaLocal(ctx.agora, fuso)
      if (dia < diaLocal(ctx.agora, fuso)) return { erro: true, conteudo: { erro: 'Essa data já passou.' } }
      if (dia > somarDias(diaLocal(ctx.agora, fuso), 90)) return { erro: true, conteudo: { erro: 'Só agendamos até 90 dias à frente.' } }
      const vagas = calcularHorariosLivres({
        servico,
        profissionais: ctx.profissionais,
        agendamentos: await agendamentosDoDia(ctx, dia),
        horariosEmpresa: ctx.empresa.horarios,
        fuso,
        dia,
        agora: ctx.agora,
        profissionalId: texto(input.profissional_id) || undefined,
      })
      // espalha as opções pelo dia em vez de mandar só as primeiras
      const passo = Math.max(1, Math.floor(vagas.length / 8))
      const escolhidas = vagas.filter((_, i) => i % passo === 0).slice(0, 8)
      return {
        conteudo: {
          servico_id: servico.id,
          servico: servico.nome,
          dia,
          dia_descrito: descreverInstante(instanteLocal(dia, '12:00', fuso), fuso).split(' às ')[0],
          horarios: escolhidas.map((v) => ({
            hora: horaLocal(new Date(v.inicio), fuso),
            inicio: v.inicio,
            profissional_id: v.profissionalId,
            profissional: ctx.profissionais.find((p) => p.id === v.profissionalId)?.nome,
          })),
          total_livres: vagas.length,
        },
      }
    }

    case 'marcar_horario': {
      const servico = acharServico(ctx, input.servico_id)
      if (!servico) return { erro: true, conteudo: { ok: false, erro: 'Serviço não encontrado.' } }
      const inicio = new Date(texto(input.inicio))
      if (Number.isNaN(inicio.getTime())) return { erro: true, conteudo: { ok: false, erro: 'Início inválido; use o ISO de ver_horarios_livres.' } }
      const dia = diaLocal(inicio, fuso)
      const conferido = conferirHorario({
        servico,
        profissionais: ctx.profissionais,
        agendamentos: await agendamentosDoDia(ctx, dia),
        horariosEmpresa: ctx.empresa.horarios,
        fuso,
        dia,
        agora: ctx.agora,
        inicio,
        profissionalId: texto(input.profissional_id) || undefined,
      })
      if (!conferido.ok) return { erro: true, conteudo: { ok: false, erro: conferido.motivo } }
      const novo: Omit<Agendamento, 'id'> = {
        contatoId: ctx.contato.id,
        servicoId: servico.id,
        profissionalId: conferido.profissionalId,
        inicio: inicio.toISOString(),
        fim: conferido.fim.toISOString(),
        status: 'marcado',
        criadoPor: 'ia',
        lembretes: {},
        criadoEm: ctx.agora.toISOString(),
      }
      const criado = ctx.seco ? { ...novo, id: 'simulado' } : await ctx.repo.criarAgendamentoSeLivre(ctx.empresa.id, novo)
      if (!criado) return { erro: true, conteudo: { ok: false, erro: 'Esse horário acabou de ser ocupado.' } }
      const prof = ctx.profissionais.find((p) => p.id === criado.profissionalId)?.nome
      const resumo = `${servico.nome} ${descreverInstante(inicio, fuso)}${prof ? ` com ${prof}` : ''}`
      if (!ctx.seco) {
        await ctx.repo.atualizarContato(ctx.empresa.id, ctx.contato.id, { etapa: 'Agendado' })
        await ctx.repo.registrarAtividade(ctx.empresa.id, {
          contatoId: ctx.contato.id,
          tipo: 'agendamento',
          resumo: `IA marcou: ${resumo}`,
          quando: ctx.agora.toISOString(),
          porIA: true,
        })
      }
      return { conteudo: { ok: true, agendamento_id: criado.id, resumo }, efeito: { tipo: 'agendou', agendamento: criado } }
    }

    case 'remarcar': {
      const ag = await ctx.repo.agendamento(ctx.empresa.id, texto(input.agendamento_id))
      if (!ag || ag.contatoId !== ctx.contato.id) return { erro: true, conteudo: { ok: false, erro: 'Agendamento não encontrado para este cliente.' } }
      if (ag.status === 'cancelado' || ag.status === 'compareceu') return { erro: true, conteudo: { ok: false, erro: 'Esse agendamento não pode mais ser remarcado.' } }
      const servico = acharServico(ctx, ag.servicoId)
      if (!servico) return { erro: true, conteudo: { ok: false, erro: 'Serviço do agendamento não existe mais.' } }
      const inicio = new Date(texto(input.novo_inicio))
      const dia = diaLocal(inicio, fuso)
      const conferido = conferirHorario({
        servico,
        profissionais: ctx.profissionais,
        agendamentos: Number.isNaN(inicio.getTime()) ? [] : await agendamentosDoDia(ctx, dia),
        horariosEmpresa: ctx.empresa.horarios,
        fuso,
        dia: Number.isNaN(inicio.getTime()) ? '' : dia,
        agora: ctx.agora,
        inicio,
        ignorarAgendamentoId: ag.id,
      })
      if (!conferido.ok) return { erro: true, conteudo: { ok: false, erro: conferido.motivo } }
      const resumo = `${servico.nome} ${descreverInstante(inicio, fuso)}`
      if (!ctx.seco) {
        await ctx.repo.atualizarAgendamento(ctx.empresa.id, ag.id, {
          inicio: inicio.toISOString(),
          fim: conferido.fim.toISOString(),
          profissionalId: conferido.profissionalId,
          status: 'marcado',
          lembretes: {},
        })
        await ctx.repo.registrarAtividade(ctx.empresa.id, {
          contatoId: ctx.contato.id,
          tipo: 'agendamento',
          resumo: `IA remarcou para ${resumo}`,
          quando: ctx.agora.toISOString(),
          porIA: true,
        })
      }
      return { conteudo: { ok: true, resumo }, efeito: { tipo: 'remarcou', agendamentoId: ag.id, inicio: inicio.toISOString() } }
    }

    case 'cancelar': {
      const ag = await ctx.repo.agendamento(ctx.empresa.id, texto(input.agendamento_id))
      if (!ag || ag.contatoId !== ctx.contato.id) return { erro: true, conteudo: { ok: false, erro: 'Agendamento não encontrado para este cliente.' } }
      if (!ctx.seco) {
        await ctx.repo.atualizarAgendamento(ctx.empresa.id, ag.id, { status: 'cancelado' })
        await ctx.repo.registrarAtividade(ctx.empresa.id, {
          contatoId: ctx.contato.id,
          tipo: 'agendamento',
          resumo: `IA cancelou a pedido do cliente${input.motivo ? `: ${texto(input.motivo)}` : ''}`,
          quando: ctx.agora.toISOString(),
          porIA: true,
        })
      }
      return { conteudo: { ok: true }, efeito: { tipo: 'cancelou', agendamentoId: ag.id } }
    }

    case 'passar_para_humano': {
      const motivo = texto(input.motivo) || 'A IA pediu ajuda'
      return { conteudo: { ok: true, aviso: 'Equipe avisada. Diga ao cliente que alguém já vai responder.' }, efeito: { tipo: 'humano', motivo } }
    }

    case 'salvar_dado_do_contato': {
      const campo = texto(input.campo).trim().toLowerCase().slice(0, 40)
      const valor = texto(input.valor).trim().slice(0, 200)
      if (!campo || !valor) return { erro: true, conteudo: { ok: false, erro: 'Campo e valor são obrigatórios.' } }
      if (!ctx.seco) {
        if (campo === 'nome') await ctx.repo.atualizarContato(ctx.empresa.id, ctx.contato.id, { nome: valor })
        else if (campo === 'email' || campo === 'e-mail') await ctx.repo.atualizarContato(ctx.empresa.id, ctx.contato.id, { email: valor })
        else {
          ctx.contato.campos = { ...ctx.contato.campos, [campo]: valor }
          await ctx.repo.atualizarContato(ctx.empresa.id, ctx.contato.id, { campos: ctx.contato.campos })
        }
      }
      if (campo === 'nome') ctx.contato.nome = valor
      return { conteudo: { ok: true }, efeito: { tipo: 'dado', campo, valor } }
    }

    default:
      return { erro: true, conteudo: { erro: `Ferramenta desconhecida: ${nome}` } }
  }
}
