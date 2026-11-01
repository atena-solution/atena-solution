// Regras de texto do atendimento (puras).

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const SENSIVEIS: { motivo: string; termos: RegExp }[] = [
  { motivo: 'Reclamação', termos: /\b(reclama\w*|absurdo|pessim\w*|horrivel|descaso|insatisfeit\w*|vergonha|falta de respeito)\b/ },
  { motivo: 'Assunto jurídico', termos: /\b(procon|processo|processar|advogad\w*|justica|reclame aqui|danos morais)\b/ },
  { motivo: 'Dinheiro devolvido', termos: /\b(reembolso|estorno|devolu\w* (do|o|meu) dinheiro|cobra(ram|nca) (indevid\w*|errad\w*)|cobrado (a mais|duas vezes))\b/ },
  { motivo: 'Urgência de saúde', termos: /\b(emergencia|urgencia|sangra\w*|desmai\w*|alergia grave|muita dor|infeccao)\b/ },
]

const PEDE_HUMANO = /\b(falar com (um |uma |o |a )?(atendente|humano|pessoa|alguem|gerente|dono|responsavel)|quero (um |uma )?(atendente|humano|pessoa)|atendimento humano|nao quero (falar com )?(robo|maquina|bot))\b/

/** Detecta assunto que deve ir direto pra equipe. Devolve o motivo ou null. */
export function detectarAssuntoSensivel(texto: string, extras: string[] = []): string | null {
  const t = normalizar(texto)
  if (PEDE_HUMANO.test(t)) return 'Cliente pediu pra falar com a equipe'
  for (const s of SENSIVEIS) if (s.termos.test(t)) return s.motivo
  for (const extra of extras) {
    const e = normalizar(extra)
    if (e.length >= 3 && t.includes(e)) return `Regra da empresa: ${extra}`
  }
  return null
}

/** Resposta curta a um lembrete: "SIM" confirma, "NÃO" não confirma. */
export function interpretarConfirmacao(texto: string): 'sim' | 'nao' | null {
  const t = normalizar(texto).replace(/[!.,👍✅🙏]/g, '').trim()
  if (/^(sim|s|confirmo|confirmado|confirma|ok|pode confirmar|sim confirmo|claro|com certeza|vou sim|estarei la|sim sim)$/.test(t)) return 'sim'
  if (/^(nao|n|nao vou|nao posso|cancela|cancelar|nao vou conseguir|preciso remarcar|remarcar)$/.test(t)) return 'nao'
  return null
}

/**
 * Ajusta o texto da IA pro WhatsApp e divide em no máximo 2 balões.
 * WhatsApp usa *negrito* com um asterisco; remove títulos e listas de markdown pesado.
 */
export function quebrarEmBaloes(texto: string, maximo = 2): string[] {
  const limpo = texto
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\r/g, '')
    .trim()
  if (!limpo) return []
  const partes = limpo
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (partes.length <= maximo) return partes
  // junta o excesso no último balão
  return [...partes.slice(0, maximo - 1), partes.slice(maximo - 1).join('\n\n')]
}

/** Primeiro nome, para mensagens. */
export function primeiroNome(nome: string | undefined): string {
  const n = (nome ?? '').trim().split(/\s+/)[0] ?? ''
  if (!n || /^\+?\d+$/.test(n)) return ''
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase()
}

/** Telefone para E.164 sem "+" (assume Brasil se vier sem DDI). */
export function normalizarTelefone(t: string): string {
  let d = t.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d
}
