// Automação de agenda: decide O QUE mandar e QUANDO (pura). O cron (a cada 5 min) chama isto,
// envia o que voltar e registra a `chave` pra nunca mandar duas vezes.

import type { Agendamento, Contato, ModelosAprovados, Servico, Treino } from './tipos'
import { HORA, MINUTO, descreverInstante, diaLocal, partesLocais } from './tempo'
import { janela24h } from './janela'
import { primeiroNome } from './regras'

export type TipoAutomacao = 'lembrete_vespera' | 'lembrete_1h' | 'recuperar_falta' | 'pedir_avaliacao'

export interface AcaoAutomacao {
  chave: string // `${tipo}:${agendamentoId}`
  tipo: TipoAutomacao
  agendamentoId: string
  contatoId: string
  telefone: string
  /** 'texto' = janela de 24h aberta; 'modelo' = template aprovado. */
  forma: 'texto' | 'modelo'
  texto: string
  modelo?: { nome: string; idioma: string; parametros: string[] }
}

export interface Pulada {
  chave: string
  motivo: string
}

export interface EntradaAutomacoes {
  agora: Date
  fuso: string
  nomeEmpresa: string
  agendamentos: Agendamento[]
  contatos: Map<string, Contato>
  servicos: Map<string, Servico>
  /** Última mensagem do cliente por contatoId (para saber se a janela de 24h está aberta). */
  ultimaMsgClientePorContato: Map<string, string | undefined>
  jaFeitas: Set<string>
  treino: Pick<Treino, 'automacoes' | 'linkAvaliacao'>
  modelos: ModelosAprovados
}

/** Não mandar mensagem "fria" de madrugada (lembrete de 1h é exceção: o horário é logo ali). */
export const SILENCIO = { de: 21, ate: 8 }

function emSilencio(agora: Date, fuso: string): boolean {
  const h = partesLocais(agora, fuso).hora
  return h >= SILENCIO.de || h < SILENCIO.ate
}

export function decidirAutomacoes(e: EntradaAutomacoes): { acoes: AcaoAutomacao[]; puladas: Pulada[] } {
  const acoes: AcaoAutomacao[] = []
  const puladas: Pulada[] = []
  const agora = e.agora.getTime()
  const silencio = emSilencio(e.agora, e.fuso)
  const idioma = e.modelos.idioma ?? 'pt_BR'

  for (const ag of e.agendamentos) {
    const contato = e.contatos.get(ag.contatoId)
    if (!contato?.telefone) continue
    const inicio = Date.parse(ag.inicio)
    const fim = Date.parse(ag.fim)
    const servico = e.servicos.get(ag.servicoId)
    const nome = primeiroNome(contato.nome)
    const ola = nome ? `Oi, ${nome}!` : 'Oi!'
    const quando = descreverInstante(new Date(inicio), e.fuso)
    const oQue = servico?.nome ?? 'seu horário'
    const janelaAberta = janela24h(e.ultimaMsgClientePorContato.get(ag.contatoId), e.agora).aberta

    const propor = (tipo: TipoAutomacao, texto: string, modeloNome: string | undefined, parametros: string[]) => {
      const chave = `${tipo}:${ag.id}`
      if (e.jaFeitas.has(chave)) return
      if (janelaAberta) {
        acoes.push({ chave, tipo, agendamentoId: ag.id, contatoId: ag.contatoId, telefone: contato.telefone, forma: 'texto', texto })
      } else if (modeloNome) {
        acoes.push({
          chave,
          tipo,
          agendamentoId: ag.id,
          contatoId: ag.contatoId,
          telefone: contato.telefone,
          forma: 'modelo',
          texto,
          modelo: { nome: modeloNome, idioma, parametros },
        })
      } else {
        puladas.push({ chave, motivo: 'Janela de 24h fechada e nenhum modelo aprovado configurado.' })
      }
    }

    const ativo = ag.status === 'marcado' || ag.status === 'confirmado'

    // Véspera: a partir de 24h antes, até 3h antes, fora do horário de silêncio.
    if (e.treino.automacoes.lembreteVespera && ativo && !silencio && agora >= inicio - 24 * HORA && agora < inicio - 3 * HORA) {
      const criadoHaPouco = ag.criadoEm && Date.parse(ag.criadoEm) > inicio - 24 * HORA
      if (!criadoHaPouco) {
        const pedeConfirmacao = ag.status === 'marcado'
        propor(
          'lembrete_vespera',
          `${ola} Passando pra lembrar: ${oQue} na ${e.nomeEmpresa}, ${quando}.` +
            (pedeConfirmacao ? ' Responda *SIM* pra confirmar. Se precisar remarcar, é só me dizer.' : ' Até lá!'),
          e.modelos.lembrete,
          [nome || 'cliente', oQue, quando],
        )
      }
    }

    // 1h antes: entre 60 e 15 min antes do início.
    if (e.treino.automacoes.lembreteUmaHora && ativo && agora >= inicio - 60 * MINUTO && agora < inicio - 15 * MINUTO) {
      const criadoHaPouco = ag.criadoEm && Date.parse(ag.criadoEm) > inicio - 2 * HORA
      if (!criadoHaPouco)
        propor('lembrete_1h', `${ola} Seu horário de ${oQue} é daqui a pouco (${quando}). Te esperamos!`, e.modelos.lembrete, [
          nome || 'cliente',
          oQue,
          quando,
        ])
    }

    // Faltou: no mesmo dia, a partir de 30 min depois do início, fora do silêncio.
    if (
      e.treino.automacoes.recuperarFalta &&
      ag.status === 'faltou' &&
      !silencio &&
      agora >= inicio + 30 * MINUTO &&
      diaLocal(e.agora, e.fuso) === diaLocal(new Date(inicio), e.fuso)
    ) {
      propor(
        'recuperar_falta',
        `${ola} Sentimos sua falta hoje no horário de ${oQue}. Aconteceu alguma coisa? Se quiser, já te arrumo um novo horário.`,
        e.modelos.recuperacao,
        [nome || 'cliente', oQue],
      )
    }

    // Avaliação: entre 1h e 48h depois do fim de quem compareceu.
    if (
      e.treino.automacoes.pedirAvaliacao &&
      e.treino.linkAvaliacao &&
      ag.status === 'compareceu' &&
      !silencio &&
      agora >= fim + HORA &&
      agora < fim + 48 * HORA
    ) {
      propor(
        'pedir_avaliacao',
        `${ola} Obrigado pela visita na ${e.nomeEmpresa}! Se puder, deixa sua avaliação aqui, ajuda muito: ${e.treino.linkAvaliacao}`,
        e.modelos.avaliacao,
        [nome || 'cliente', e.treino.linkAvaliacao],
      )
    }
  }
  return { acoes, puladas }
}

/** Agendamento que o "SIM" do cliente confirma: o próximo marcado nas próximas 48h. */
export function agendamentoParaConfirmar(agendamentos: Agendamento[], contatoId: string, agora: Date): Agendamento | null {
  const t = agora.getTime()
  return (
    agendamentos
      .filter((a) => a.contatoId === contatoId && a.status === 'marcado')
      .filter((a) => Date.parse(a.inicio) > t && Date.parse(a.inicio) <= t + 48 * HORA)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null
  )
}
