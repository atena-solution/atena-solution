// Painel interno da Atena (/admin) — funções puras.

// ---------------------------------------------------------------- quem é da equipe Atena
/** `ATENA_ADMIN_EMAILS="lincoln@atena.com.br, fulano@atena.com.br"` (vírgula ou espaço). */
export function emailsEquipeAtena(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set((env.ATENA_ADMIN_EMAILS ?? '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean));
}

/** Só e-mail VERIFICADO e presente na lista. Lista vazia = ninguém entra. */
export function ehEquipeAtena(
  usuario: { email?: string | null; emailVerificado?: boolean } | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!usuario?.email || usuario.emailVerificado === false) return false;
  return emailsEquipeAtena(env).has(usuario.email.trim().toLowerCase());
}

// ---------------------------------------------------------------- uso de IA e custo estimado
// Cada aba registra o uso em `empresas/{empresaId}/uso/{AAAA-MM}` somando contadores por modelo:
//   { modelos: { 'claude-sonnet-5-5': { entrada, saida, cacheLeitura }, 'gemini-...': { segundosAudio, imagens, segundosVideo } } }
// Use `somarUso` para montar o incremento.

export interface UsoModelo {
  entrada?: number; // tokens de entrada
  saida?: number; // tokens de saída
  cacheLeitura?: number; // tokens lidos do cache
  segundosAudio?: number;
  imagens?: number;
  segundosVideo?: number;
}

export type UsoMes = Record<string, UsoModelo>;

/** Preços em US$ (editáveis). Claude: tabela oficial em 06/10/2026. Gemini: CONFIRMAR AO VIVO na página de preços. */
export const PRECOS_IA: Record<string, { entradaMTok?: number; saidaMTok?: number; cacheMTok?: number; porMinutoAudio?: number; porImagem?: number; porSegundoVideo?: number }> = {
  'claude-sonnet-5-5': { entradaMTok: 2, saidaMTok: 10, cacheMTok: 0.2 },
  'claude-haiku-5-5': { entradaMTok: 0.1, saidaMTok: 0.5, cacheMTok: 0.01 }, // cache do Haiku: CONFIRMAR AO VIVO
  'gemini-transcricao': { porMinutoAudio: 0.006 }, // CONFIRMAR AO VIVO
  'gemini-imagem': { porImagem: 0.04 }, // CONFIRMAR AO VIVO
  'gemini-video': { porSegundoVideo: 0.4 }, // CONFIRMAR AO VIVO
};

/** Cotação usada só para estimativa no painel. */
export const DOLAR_EM_REAIS = 5.6;

export function somarUso(a: UsoMes, b: UsoMes): UsoMes {
  const out: UsoMes = { ...a };
  for (const [modelo, u] of Object.entries(b)) {
    const atual = { ...(out[modelo] ?? {}) };
    for (const [k, v] of Object.entries(u) as [keyof UsoModelo, number][]) atual[k] = (atual[k] ?? 0) + (v ?? 0);
    out[modelo] = atual;
  }
  return out;
}

/** Custo estimado em centavos de real. Modelo sem preço conhecido entra em `semPreco`. */
export function custoEstimado(uso: UsoMes, precos = PRECOS_IA, dolar = DOLAR_EM_REAIS): { centavos: number; semPreco: string[] } {
  let usd = 0;
  const semPreco: string[] = [];
  for (const [modelo, u] of Object.entries(uso)) {
    const p = precos[modelo];
    if (!p) { semPreco.push(modelo); continue; }
    usd += ((u.entrada ?? 0) * (p.entradaMTok ?? 0)) / 1e6;
    usd += ((u.saida ?? 0) * (p.saidaMTok ?? 0)) / 1e6;
    usd += ((u.cacheLeitura ?? 0) * (p.cacheMTok ?? 0)) / 1e6;
    usd += ((u.segundosAudio ?? 0) / 60) * (p.porMinutoAudio ?? 0);
    usd += (u.imagens ?? 0) * (p.porImagem ?? 0);
    usd += (u.segundosVideo ?? 0) * (p.porSegundoVideo ?? 0);
  }
  return { centavos: Math.round(usd * dolar * 100), semPreco };
}

// ---------------------------------------------------------------- saúde e linha do painel

export interface SaudeEmpresa {
  whatsappConectado: boolean;
  errosUltimas24h: number;
  ultimaAtividadeEm?: string;
}

export type Semaforo = 'ok' | 'atencao' | 'problema';

export function semaforo(s: SaudeEmpresa, temAtendimento: boolean, agoraIso: string): { cor: Semaforo; motivos: string[] } {
  const motivos: string[] = [];
  if (temAtendimento && !s.whatsappConectado) motivos.push('WhatsApp desconectado');
  if (s.errosUltimas24h >= 20) motivos.push(`${s.errosUltimas24h} erros em 24h`);
  else if (s.errosUltimas24h > 0) motivos.push(`${s.errosUltimas24h} erro(s) em 24h`);
  if (s.ultimaAtividadeEm && Date.parse(agoraIso) - Date.parse(s.ultimaAtividadeEm) > 7 * 86400000) motivos.push('Sem uso há mais de 7 dias');
  const grave = (temAtendimento && !s.whatsappConectado) || s.errosUltimas24h >= 20;
  return { cor: grave ? 'problema' : motivos.length ? 'atencao' : 'ok', motivos };
}

/** Margem do mês: receita do plano − custo de IA (centavos). */
export function margem(receitaMensal: number, custoIA: number): { valor: number; pct: number } {
  const valor = receitaMensal - custoIA;
  return { valor, pct: receitaMensal > 0 ? Math.round((valor / receitaMensal) * 100) : 0 };
}
