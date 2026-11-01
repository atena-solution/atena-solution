// Validação do "Treinar a IA" (pura).

import type { Treino } from './tipos'

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const lista = (v: unknown, max: number, tam: number) =>
  (Array.isArray(v) ? v : []).map((x) => texto(x, tam)).filter(Boolean).slice(0, max)

export function validarTreino(t: Treino): { ok: true; treino: Treino } | { ok: false; erros: Record<string, string> } {
  const erros: Record<string, string> = {}
  const perguntas = (Array.isArray(t.perguntas) ? t.perguntas : [])
    .map((q) => ({ pergunta: texto(q?.pergunta, 300), resposta: texto(q?.resposta, 1500) }))
    .filter((q) => q.pergunta || q.resposta)
  perguntas.forEach((q, i) => {
    if (!q.pergunta) erros[`perguntas.${i}`] = 'Escreva a pergunta.'
    else if (!q.resposta) erros[`perguntas.${i}`] = 'Escreva a resposta.'
  })
  if (perguntas.length > 200) erros.perguntas = 'No máximo 200 perguntas.'
  const nomeAssistente = texto(t.nomeAssistente, 40)
  if (!nomeAssistente) erros.nomeAssistente = 'Dê um nome pra assistente (ex.: Atena).'
  const link = texto(t.linkAvaliacao, 300)
  if (link && !/^https:\/\/\S+$/.test(link)) erros.linkAvaliacao = 'Cole o link completo, começando com https://'
  if (t.automacoes?.pedirAvaliacao && !link) erros.linkAvaliacao = 'Para pedir avaliação, cole o link do Google.'
  const avisoHumanoMin = Math.round(Number(t.avisoHumanoMin))
  if (!Number.isFinite(avisoHumanoMin) || avisoHumanoMin < 1 || avisoHumanoMin > 120) erros.avisoHumanoMin = 'Entre 1 e 120 minutos.'
  const mensagensRapidas = (Array.isArray(t.mensagensRapidas) ? t.mensagensRapidas : [])
    .map((m) => ({ atalho: texto(m?.atalho, 20).replace(/^\/+/, '').toLowerCase(), texto: texto(m?.texto, 1000) }))
    .filter((m) => m.atalho && m.texto)
    .slice(0, 50)
  if (Object.keys(erros).length) return { ok: false, erros }
  return {
    ok: true,
    treino: {
      empresaId: t.empresaId,
      ligada: !!t.ligada,
      nomeAssistente,
      tom: texto(t.tom, 300),
      perguntas,
      nuncaDizer: lista(t.nuncaDizer, 30, 200),
      quandoChamarHumano: lista(t.quandoChamarHumano, 30, 200),
      regrasExtras: texto(t.regrasExtras, 3000),
      linkAvaliacao: link,
      mensagensRapidas,
      automacoes: {
        lembreteVespera: !!t.automacoes?.lembreteVespera,
        lembreteUmaHora: !!t.automacoes?.lembreteUmaHora,
        recuperarFalta: !!t.automacoes?.recuperarFalta,
        pedirAvaliacao: !!t.automacoes?.pedirAvaliacao,
      },
      avisoHumanoMin,
      atualizadoEm: t.atualizadoEm,
    },
  }
}

/** Troca {endereco}, {telefone}, {empresa}, {nome} nas mensagens rápidas. */
export function preencherMensagemRapida(texto: string, v: { endereco?: string; telefone?: string; empresa?: string; nome?: string }): string {
  return texto
    .replace(/\{endereco\}/g, v.endereco ?? '')
    .replace(/\{telefone\}/g, v.telefone ?? '')
    .replace(/\{empresa\}/g, v.empresa ?? '')
    .replace(/\{nome\}/g, v.nome ?? '')
}
