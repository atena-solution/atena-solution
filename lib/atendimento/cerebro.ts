// Cérebro da IA: chama a Claude, executa as ferramentas e devolve os balões a mandar.

import type { BetaContentBlock, BetaMessageParam, ClienteIA } from '@/lib/integracoes/claude'
import type { BetaToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { FERRAMENTAS, executarFerramenta, type ContextoFerramentas, type Efeito } from './ferramentas'
import { montarSistema } from './contexto'
import { quebrarEmBaloes } from './regras'
import type { Agendamento, Treino } from './tipos'

export const MAX_PASSOS = 6

export const FRASE_HUMANO = 'Vou chamar alguém da equipe pra te ajudar, só um instante 🙏'

export interface RespostaCerebro {
  baloes: string[]
  efeitos: Efeito[]
  passos: number
  ferramentasUsadas: string[]
  /** A IA não conseguiu responder (erro, recusa, laço longo): vai pra equipe. */
  falhou?: string
}

export async function responder(p: {
  ia: ClienteIA
  treino: Treino
  mensagens: BetaMessageParam[]
  ctx: ContextoFerramentas
  agendamentosContato: Agendamento[]
}): Promise<RespostaCerebro> {
  const sistema = montarSistema({
    empresa: p.ctx.empresa,
    treino: p.treino,
    servicos: p.ctx.servicos,
    profissionais: p.ctx.profissionais,
    contato: p.ctx.contato,
    agendamentosContato: p.agendamentosContato,
    agora: p.ctx.agora,
  })
  const msgs: BetaMessageParam[] = [...p.mensagens]
  const efeitos: Efeito[] = []
  const usadas: string[] = []

  if (!msgs.length || msgs.at(-1)!.role !== 'user')
    return { baloes: [], efeitos, passos: 0, ferramentasUsadas: usadas, falhou: 'Nada do cliente pra responder' }

  for (let passo = 1; passo <= MAX_PASSOS; passo++) {
    let r
    try {
      r = await p.ia.criar({ sistema, mensagens: msgs, ferramentas: FERRAMENTAS })
    } catch (e) {
      return { baloes: [FRASE_HUMANO], efeitos: [...efeitos, { tipo: 'humano', motivo: 'IA fora do ar' }], passos: passo, ferramentasUsadas: usadas, falhou: (e as Error).message }
    }

    if (r.stop_reason === 'refusal') {
      return { baloes: [FRASE_HUMANO], efeitos: [...efeitos, { tipo: 'humano', motivo: 'A IA preferiu não responder' }], passos: passo, ferramentasUsadas: usadas, falhou: 'refusal' }
    }

    const usos = r.content.filter((b): b is Extract<BetaContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    if (r.stop_reason === 'tool_use' && usos.length) {
      msgs.push({ role: 'assistant', content: r.content } as unknown as BetaMessageParam)
      const resultados: BetaToolResultBlockParam[] = []
      for (const uso of usos) {
        usadas.push(uso.name)
        const res = await executarFerramenta(uso.name, (uso.input ?? {}) as Record<string, unknown>, p.ctx)
        if (res.efeito) efeitos.push(res.efeito)
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(res.conteudo), ...(res.erro ? { is_error: true } : {}) })
      }
      msgs.push({ role: 'user', content: resultados })
      continue
    }

    if (r.stop_reason === 'pause_turn') {
      msgs.push({ role: 'assistant', content: r.content } as unknown as BetaMessageParam)
      continue
    }

    const texto = r.content
      .filter((b): b is Extract<BetaContentBlock, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n\n')
    const baloes = quebrarEmBaloes(texto)
    if (!baloes.length) {
      const humano = efeitos.some((e) => e.tipo === 'humano')
      return { baloes: humano ? [FRASE_HUMANO] : [], efeitos, passos: passo, ferramentasUsadas: usadas, falhou: humano ? undefined : 'resposta vazia' }
    }
    return { baloes, efeitos, passos: passo, ferramentasUsadas: usadas }
  }
  return {
    baloes: [FRASE_HUMANO],
    efeitos: [...efeitos, { tipo: 'humano', motivo: 'A IA se enrolou nesta conversa' }],
    passos: MAX_PASSOS,
    ferramentasUsadas: usadas,
    falhou: 'muitos passos',
  }
}
