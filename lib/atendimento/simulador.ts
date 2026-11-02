// Simulador do "Treinar a IA": conversa com a IA usando os dados da empresa, sem WhatsApp e sem gravar.

import type { Deps } from './processar'
import type { Contato, Treino } from './tipos'
import { responder, FRASE_HUMANO } from './cerebro'
import { detectarAssuntoSensivel } from './regras'
import { validarTreino } from './treino'
import { medirIA, type BetaMessageParam } from '@/lib/integracoes/claude'

export interface FalaSimulador {
  de: 'cliente' | 'ia'
  texto: string
}

export interface RespostaSimulador {
  baloes: string[]
  ferramentas: string[]
  humano?: string
  agendou?: string
}

export function falasParaMensagens(falas: FalaSimulador[]): BetaMessageParam[] {
  const msgs: { role: 'user' | 'assistant'; partes: string[] }[] = []
  for (const f of falas) {
    const role = f.de === 'cliente' ? 'user' : 'assistant'
    const t = f.texto.trim()
    if (!t) continue
    const u = msgs.at(-1)
    if (u && u.role === role) u.partes.push(t)
    else msgs.push({ role, partes: [t] })
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs.map((m) => ({ role: m.role, content: m.partes.join('\n') }))
}

export async function simularConversa(p: { empresaId: string; falas: FalaSimulador[]; rascunho?: Partial<Treino>; deps: Deps }): Promise<RespostaSimulador> {
  const { repo } = p.deps
  const [empresa, atual, servicos, profissionais] = await Promise.all([
    repo.empresa(p.empresaId),
    repo.treino(p.empresaId),
    repo.servicos(p.empresaId),
    repo.profissionais(p.empresaId),
  ])
  if (!empresa) throw new Error('Empresa não encontrada')
  // testa o rascunho da tela (se válido) sem precisar salvar
  const v = p.rascunho ? validarTreino({ ...atual, ...p.rascunho, empresaId: p.empresaId }) : null
  const treino = v?.ok ? v.treino : atual

  const ultimas: string[] = []
  for (let i = p.falas.length - 1; i >= 0 && p.falas[i].de === 'cliente'; i--) ultimas.unshift(p.falas[i].texto)
  const sensivel = detectarAssuntoSensivel(ultimas.join(' '), treino.quandoChamarHumano)
  if (sensivel) return { baloes: [FRASE_HUMANO], ferramentas: [], humano: sensivel }

  const agora = p.deps.agora()
  const contato: Contato = {
    id: 'simulador',
    empresaId: p.empresaId,
    nome: '',
    telefone: '5500000000000',
    origem: 'Simulador',
    etapa: 'novo',
    etiquetas: [],
    ultimaInteracaoEm: agora.toISOString(),
    criadoEm: agora.toISOString(),
    campos: {},
  }
  const r = await responder({
    ia: p.deps.registrarUso ? medirIA(p.deps.ia, (m, u) => p.deps.registrarUso!(p.empresaId, m, u)) : p.deps.ia,
    treino,
    mensagens: falasParaMensagens(p.falas),
    ctx: { repo, empresa, servicos, profissionais, contato, conversa: null, agora, seco: true },
    agendamentosContato: [],
  })
  const humano = r.efeitos.find((e) => e.tipo === 'humano')
  const agendou = r.efeitos.find((e) => e.tipo === 'agendou')
  return {
    baloes: r.baloes,
    ferramentas: r.ferramentasUsadas,
    humano: humano?.tipo === 'humano' ? humano.motivo : undefined,
    agendou: agendou?.tipo === 'agendou' ? agendou.agendamento.inicio : undefined,
  }
}
