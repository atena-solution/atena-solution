// Integração com a Claude API (Anthropic) para o Atendimento.
//
// Doc oficial (consultada em 01/11/2026 via referência do SDK @anthropic-ai/sdk 1.3):
// - POST /v1/messages via SDK oficial; modelo de conversa `claude-sonnet-5-5`, respostas rápidas `claude-haiku-5-5`.
// - NÃO mandar temperature/top_p/top_k (a API recusa com 400 desde a versão 2026-10-21).
// - Ferramentas (tool use) com `strict: true` e `additionalProperties: false`; `tool_choice` forçado (any/tool)
//   dá 400 no Sonnet 5.5 — usamos o padrão `auto` e orientamos pelo prompt.
// - Profundidade de raciocínio por `output_config.effort` ('low' é o indicado para chat).
// - Recusa de segurança volta como stop_reason 'refusal'; com o beta `server-side-fallback-2026-07-01` e
//   `fallbacks: 'default'` a própria API refaz com outro modelo. Ligado por padrão no Sonnet 5.5.
// - Devolver o `content` da resposta da IA sem alterar dentro do mesmo laço de ferramentas.
// CONFIRMAR AO VIVO: tudo acima com a chave real (ANTHROPIC_API_KEY) no Mac.

import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaStopReason,
  BetaTextBlockParam,
  BetaTool,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'

export const MODELO_CONVERSA = 'claude-sonnet-5-5'
export const MODELO_RAPIDO = 'claude-haiku-5-5'

export type { BetaContentBlock, BetaMessageParam, BetaTextBlockParam, BetaTool }

export interface PedidoIA {
  sistema: BetaTextBlockParam[]
  mensagens: BetaMessageParam[]
  ferramentas: BetaTool[]
  rapido?: boolean
}

export interface RespostaIA {
  content: BetaContentBlock[]
  stop_reason: BetaStopReason | null
  modelo?: string
  /** Tokens gastos (para o custo estimado no /admin). */
  uso?: { entrada: number; saida: number; cacheLeitura?: number }
}

/** Embrulha o cliente para avisar o uso de cada chamada (registrarUsoIA). Nunca derruba a resposta. */
export function medirIA(ia: ClienteIA, aoUsar: (modelo: string, uso: NonNullable<RespostaIA['uso']>) => unknown): ClienteIA {
  return {
    async criar(p) {
      const r = await ia.criar(p)
      if (r.uso) {
        try {
          await aoUsar(r.modelo ?? (p.rapido ? MODELO_RAPIDO : MODELO_CONVERSA), r.uso)
        } catch {
          /* registro de uso nunca atrapalha o atendimento */
        }
      }
      return r
    },
  }
}

export interface ClienteIA {
  criar(p: PedidoIA): Promise<RespostaIA>
}

export function clienteIA(): ClienteIA {
  if (process.env.SIMULAR === '1' || !process.env.ANTHROPIC_API_KEY) return iaSimulada()
  return iaReal()
}

// ---------- Real ----------

let sdk: Anthropic | null = null

export function iaReal(): ClienteIA {
  sdk ??= new Anthropic()
  const client = sdk
  return {
    async criar(p) {
      const modelo = p.rapido ? MODELO_RAPIDO : MODELO_CONVERSA
      const r = await client.beta.messages.create({
        model: modelo,
        max_tokens: 16000,
        system: p.sistema,
        messages: p.mensagens,
        tools: p.ferramentas,
        output_config: { effort: 'low' },
        cache_control: { type: 'ephemeral' },
        // Server-side fallback: só no Sonnet 5.5 e só na Claude API.
        ...(modelo === MODELO_CONVERSA ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      })
      const u = r.usage
      return {
        content: r.content,
        stop_reason: r.stop_reason,
        modelo: r.model,
        uso: { entrada: u.input_tokens ?? 0, saida: u.output_tokens ?? 0, cacheLeitura: u.cache_read_input_tokens ?? 0 },
      }
    },
  }
}

// ---------- Roteirizada (testes) ----------

/** Devolve as respostas na ordem dada e guarda os pedidos recebidos. */
export function iaRoteirizada(respostas: RespostaIA[]): ClienteIA & { pedidos: PedidoIA[] } {
  const fila = [...respostas]
  const pedidos: PedidoIA[] = []
  return {
    pedidos,
    async criar(p) {
      pedidos.push(structuredClone(p))
      const r = fila.shift()
      if (!r) throw new Error('iaRoteirizada: acabaram as respostas')
      return r
    },
  }
}

export function texto(t: string): RespostaIA {
  return { content: [{ type: 'text', text: t, citations: null } as BetaContentBlock], stop_reason: 'end_turn' }
}

export function usarFerramenta(nome: string, input: Record<string, unknown>, id = `toolu_${nome}_${Math.random().toString(36).slice(2, 7)}`): RespostaIA {
  return {
    content: [{ type: 'tool_use', id, name: nome, input, caller: { type: 'direct' } } as unknown as BetaContentBlock],
    stop_reason: 'tool_use',
  }
}

// ---------- Simulada (SIMULAR=1) ----------
// Imita a IA com regras simples, lendo o próprio prompt montado em lib/atendimento/contexto.ts
// (linhas "P:"/"R:", "- [id] Serviço — R$ … — N min", "Hoje é YYYY-MM-DD", "Você é X, assistente …").
// Serve pra demonstrar o fluxo e o simulador sem chave nem internet.

function normal(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const PALAVRAS_VAZIAS = new Set('a o os as de da do das dos e em no na nos nas um uma pra para com que voces vcs voce tem ter qual quais como se eu me meu minha e é ou por favor oi ola'.split(' '))

function palavras(t: string): string[] {
  return normal(t)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !PALAVRAS_VAZIAS.has(w))
}

function textoDe(m: BetaMessageParam): string {
  if (!m.content) return ''
  if (typeof m.content === 'string') return m.content
  return (m.content as { type: string; text?: string }[])
    .map((b) => (b.type === 'text' ? (b.text ?? '') : ''))
    .join(' ')
    .trim()
}

const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

function somar(dia: string, n: number) {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

function adivinharData(t: string, hoje: string): string {
  const n = normal(t)
  if (/depois de amanha/.test(n)) return somar(hoje, 2)
  if (/amanha/.test(n)) return somar(hoje, 1)
  if (/\bhoje\b/.test(n)) return hoje
  const dm = n.match(/\b(\d{1,2})\/(\d{1,2})\b/)
  if (dm) return `${hoje.slice(0, 4)}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`
  const ds = new Date(hoje + 'T12:00:00Z').getUTCDay()
  for (let i = 0; i < 7; i++) if (n.includes(DIAS[i])) return somar(hoje, ((i - ds + 7) % 7) || 7)
  return somar(hoje, 1)
}

function adivinharHora(t: string): string | null {
  const m = normal(t).match(/\b(\d{1,2})(?:[:h](\d{2})?)\b/)
  if (!m || !/(:|h)/.test(m[0])) return null
  const h = Number(m[1])
  if (h > 23) return null
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`
}

interface Bloco {
  type: string
  name?: string
  text?: string
  content?: string | { text?: string }[]
}

export function iaSimulada(): ClienteIA {
  return {
    async criar(p) {
      const sistema = p.sistema.map((b) => b.text).join('\n')
      const nomeAssistente = sistema.match(/Você é (.+?), assistente/)?.[1] ?? 'assistente'
      const empresa = sistema.match(/assistente virtual da empresa "(.+?)"/)?.[1] ?? 'empresa'
      const hoje = sistema.match(/Hoje é (\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10)
      const servicos = [...sistema.matchAll(/^- \[(.+?)\] (.+?) — R\$ ?([\d.,]+) — (\d+) min/gm)].map((m) => ({ id: m[1], nome: m[2], preco: m[3] }))
      const faq = [...sistema.matchAll(/^P: (.+)\nR: (.+)$/gm)].map((m) => ({ p: m[1], r: m[2] }))

      const ultima = p.mensagens.at(-1)!
      const blocos = (typeof ultima.content === 'string' || !ultima.content ? [] : ultima.content) as unknown as Bloco[]
      const resultados = blocos.filter((b) => b.type === 'tool_result')
      // texto do cliente: última mensagem de usuário com texto
      const msgsCliente = p.mensagens.filter((m) => m.role === 'user' && textoDe(m))
      const falaCliente = msgsCliente.length ? textoDe(msgsCliente.at(-1)!) : ''
      const servicoCitado = servicos.find((s) => palavras(falaCliente).some((w) => normal(s.nome).includes(w))) ?? servicos[0]

      if (resultados.length) {
        const anterior = p.mensagens.at(-2)
        const uso = anterior && anterior.content && typeof anterior.content !== 'string' ? (anterior.content as unknown as Bloco[]).find((b) => b.type === 'tool_use') : undefined
        const bruto = resultados[0].content
        const conteudo = typeof bruto === 'string' ? bruto : (bruto ?? []).map((b) => b.text ?? '').join('')
        let r: Record<string, unknown> = {}
        try {
          r = JSON.parse(conteudo)
        } catch {
          /* texto puro */
        }
        const nome = uso?.name ?? ''
        if (nome === 'ver_horarios_livres') {
          const horarios = (r.horarios as { hora: string; inicio: string; profissional_id: string }[]) ?? []
          const quer = adivinharHora(falaCliente)
          if (quer) {
            const achou = horarios.find((h) => h.hora === quer)
            if (achou) return usarFerramenta('marcar_horario', { servico_id: r.servico_id, inicio: achou.inicio, profissional_id: achou.profissional_id })
            if (horarios.length) return texto(`Às ${quer} não tenho, mas tenho ${horarios.slice(0, 3).map((h) => h.hora).join(', ')}. Algum desses serve?`)
          }
          if (!horarios.length) return texto(`Nesse dia não tenho horário livre 😕 Quer que eu veja outro dia?`)
          return texto(`Tenho ${horarios.slice(0, 4).map((h) => h.hora).join(', ')} (${r.dia_descrito ?? 'nesse dia'}). Qual fica melhor pra você?`)
        }
        if (nome === 'marcar_horario' || nome === 'remarcar') {
          if (r.ok) return texto(`Prontinho! ${r.resumo ?? 'Horário marcado'} ✅\n\nAté lá! Qualquer coisa é só chamar.`)
          return texto(`Esse horário acabou de ser ocupado 😕 ${r.erro ?? ''} Quer que eu veja outro?`)
        }
        if (nome === 'cancelar') return texto(r.ok ? 'Cancelado! Quando quiser remarcar é só me chamar.' : 'Não consegui cancelar, vou chamar alguém da equipe.')
        if (nome === 'passar_para_humano') return texto('Vou chamar alguém da equipe pra te ajudar, só um instante 🙏')
        return texto('Anotado! Posso ajudar em mais alguma coisa?')
      }

      const n = normal(falaCliente)
      if (/\b(robo|bot|humano|pessoa de verdade|maquina|inteligencia artificial|\bia\b)/.test(n))
        return texto(`Sou a ${nomeAssistente}, assistente virtual da ${empresa} 😊 Se preferir falar com alguém da equipe, é só me dizer.`)
      if (/(horario|agendar|agenda|marcar|vaga|disponivel|encaixe)/.test(n) || adivinharHora(falaCliente))
        return usarFerramenta('ver_horarios_livres', { servico_id: servicoCitado?.id ?? '', data: adivinharData(falaCliente, hoje) })
      if (/(quanto|preco|valor|custa)/.test(n) && servicoCitado)
        return texto(`${servicoCitado.nome} sai por R$ ${servicoCitado.preco}. Quer que eu veja um horário pra você?`)
      const ps = palavras(falaCliente)
      const melhor = faq
        .map((f) => ({ f, pontos: palavras(f.p).filter((w) => ps.includes(w)).length }))
        .sort((a, b) => b.pontos - a.pontos)[0]
      if (melhor && melhor.pontos >= 1) return texto(melhor.f.r)
      if (/^(oi|ola|bom dia|boa tarde|boa noite|eai|e ai|opa)\b/.test(n.trim()))
        return texto(`Oi! Aqui é a ${nomeAssistente}, da ${empresa} 😊 Como posso te ajudar?`)
      return texto('Entendi! Você quer marcar um horário ou tirar alguma dúvida?')
    },
  }
}
