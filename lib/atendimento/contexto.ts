// Monta o que a IA sabe: dados da empresa, serviços, regras e o cliente (puro).
// Ordem pensada pro cache de prompt: parte fixa da empresa primeiro, parte que muda (hora, cliente) no fim.

import type { BetaMessageParam, BetaTextBlockParam } from '@/lib/integracoes/claude'
import type { Agendamento, Contato, Empresa, Mensagem, Profissional, Servico, Treino } from './tipos'
import { descreverInstante, diaLocal, horaLocal, nomeDiaSemana, partesLocais } from './tempo'

function preco(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function montarSistema(p: {
  empresa: Empresa
  treino: Treino
  servicos: Servico[]
  profissionais: Profissional[]
  contato: Contato | null
  agendamentosContato: Agendamento[]
  agora: Date
}): BetaTextBlockParam[] {
  const { empresa: e, treino: t } = p
  const horarios = [0, 1, 2, 3, 4, 5, 6]
    .map((d) => {
      const faixas = e.horarios.filter((h) => h.dia === d)
      return `${nomeDiaSemana(d)}: ${faixas.length ? faixas.map((f) => `${f.abre}–${f.fecha}`).join(', ') : 'fechado'}`
    })
    .join('; ')

  const fixo = [
    `Você é ${t.nomeAssistente}, assistente virtual da empresa "${e.nome}" (${e.segmento}). Você atende clientes pelo WhatsApp em português do Brasil.`,
    '',
    '# Como responder',
    '- Respostas curtas, como uma pessoa simpática no WhatsApp: 1 ou 2 balões (separe balões com uma linha em branco). Nada de listas longas nem títulos.',
    '- Uma pergunta por vez. Use o nome do cliente quando souber.',
    `- Tom: ${t.tom}`,
    '- NUNCA invente preço, serviço, horário, endereço ou política. Use só o que está aqui ou o que as ferramentas devolverem. Se não souber, diga que vai confirmar com a equipe e use passar_para_humano.',
    '- Se perguntarem se você é robô/humano/IA: diga com naturalidade que é a assistente virtual da empresa. Nunca diga que é humana.',
    '- Para horários: SEMPRE use ver_horarios_livres antes de oferecer, e marcar_horario só depois que o cliente escolher. Ofereça no máximo 3 ou 4 opções.',
    '- Antes de marcar, saiba o nome do cliente (se ainda não souber, pergunte) e salve com salvar_dado_do_contato.',
    '- Para remarcar/cancelar, use os ids da seção "Agendamentos deste cliente".',
    '- Reclamação, cobrança indevida, assunto jurídico, saúde/urgência, pedido de falar com pessoa, ou qualquer coisa que você não consiga resolver: use passar_para_humano e avise o cliente que alguém da equipe já vai responder.',
    '- Use *negrito* do WhatsApp com moderação. Emojis com moderação (no máximo 1 por mensagem).',
    t.nuncaDizer.length ? `- NUNCA fale sobre / NUNCA diga: ${t.nuncaDizer.join('; ')}.` : '',
    t.quandoChamarHumano.length ? `- Chame humano também quando: ${t.quandoChamarHumano.join('; ')}.` : '',
    '',
    '# Empresa',
    `Nome: ${e.nome}`,
    e.endereco ? `Endereço: ${e.endereco}` : '',
    e.telefone ? `Telefone: ${e.telefone}` : '',
    `Horário de funcionamento: ${horarios}`,
    '',
    '# Serviços (id entre colchetes — use o id nas ferramentas)',
    ...(p.servicos.length
      ? p.servicos.map((s) => `- [${s.id}] ${s.nome} — R$ ${preco(s.preco)} — ${s.duracaoMin} min${s.descricao ? ` — ${s.descricao}` : ''}`)
      : ['(nenhum serviço cadastrado: não marque horários, chame a equipe)']),
    p.profissionais.length ? `\nProfissionais: ${p.profissionais.map((x) => `[${x.id}] ${x.nome}`).join(', ')}` : '',
    '',
    '# Perguntas e respostas da empresa',
    ...(t.perguntas.length ? t.perguntas.map((q) => `P: ${q.pergunta}\nR: ${q.resposta}`) : ['(nenhuma cadastrada)']),
    t.regrasExtras ? `\n# Regras extras da empresa\n${t.regrasExtras}` : '',
  ]
    .filter((l) => l !== '')
    .join('\n')

  const c = p.contato
  const futuros = p.agendamentosContato
    .filter((a) => (a.status === 'marcado' || a.status === 'confirmado') && Date.parse(a.fim) > p.agora.getTime())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  const nomeServico = (id: string) => p.servicos.find((s) => s.id === id)?.nome ?? id
  const pl = partesLocais(p.agora, e.fuso)
  const variavel = [
    '# Agora',
    `Hoje é ${diaLocal(p.agora, e.fuso)} (${nomeDiaSemana(pl.diaSemana)}), ${horaLocal(p.agora, e.fuso)} no horário da empresa (${e.fuso}).`,
    '',
    '# Cliente',
    c
      ? [
          `Nome: ${c.nome || '(não sabemos ainda)'}`,
          `Telefone: ${c.telefone}`,
          `Etapa no funil: ${c.etapa}`,
          ...Object.entries(c.campos ?? {}).map(([k, v]) => `${k}: ${v}`),
        ].join('\n')
      : '(cliente novo)',
    '',
    '# Agendamentos deste cliente',
    futuros.length
      ? futuros
          .map((a) => `- id ${a.id}: ${nomeServico(a.servicoId)}, ${descreverInstante(new Date(a.inicio), e.fuso)} (${a.status})`)
          .join('\n')
      : '(nenhum agendamento futuro)',
  ].join('\n')

  return [
    { type: 'text', text: fixo, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: variavel },
  ]
}

const ROTULO_MIDIA: Record<string, string> = { audio: '[áudio]', imagem: '[imagem]' }

/**
 * Converte o histórico em mensagens da API: cliente → user; IA/equipe → assistant.
 * Junta mensagens seguidas do mesmo lado (rajada) e garante começar com o cliente.
 */
export function montarMensagens(historico: Mensagem[], limite = 30): BetaMessageParam[] {
  const msgs: { role: 'user' | 'assistant'; partes: string[] }[] = []
  for (const m of historico.slice(-limite)) {
    if (m.de === 'sistema') continue
    const role = m.de === 'cliente' ? 'user' : 'assistant'
    let txt = m.texto?.trim() ?? ''
    if (m.tipo === 'audio' || m.tipo === 'imagem') txt = [ROTULO_MIDIA[m.tipo], txt].filter(Boolean).join(' ')
    if (m.de === 'equipe') txt = `(resposta da equipe) ${txt}`
    if (!txt) continue
    const ultimo = msgs.at(-1)
    if (ultimo && ultimo.role === role) ultimo.partes.push(txt)
    else msgs.push({ role, partes: [txt] })
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift()
  return msgs.map((m) => ({ role: m.role, content: m.partes.join('\n') }))
}
