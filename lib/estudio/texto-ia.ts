// Texto do post (título, legenda, hashtags) via Claude. SIMULAR=1 devolve um texto de exemplo.
// Quando lib/integracoes/claude.ts (sessão B) existir, trocar a chamada direta por ela.
//
// API (doc oficial Anthropic "Messages", 2026-11-01): POST https://api.anthropic.com/v1/messages
// headers: x-api-key, anthropic-version: 2023-06-01, content-type: application/json
// body: { model, max_tokens, system, messages:[{role:'user', content}] } — sem temperature (regra do projeto).
// resposta: { content:[{ type:'text', text }] }
import { montarPromptLegenda, type PedidoLegenda } from './prompts';
import { lerRespostaLegenda, type TextoPost } from './legenda';

const MODELO = 'claude-sonnet-5-5';

type AoUsar = (modelo: string, uso: { entrada: number; saida: number }) => unknown;

export async function gerarTextoPost(p: PedidoLegenda, aoUsar?: AoUsar): Promise<TextoPost> {
  const { sistema, usuario } = montarPromptLegenda(p);
  const bruto = process.env.SIMULAR === '1' ? simularResposta(p) : await chamarClaude(sistema, usuario, aoUsar);
  return lerRespostaLegenda(bruto, p.marca.evitar);
}

async function chamarClaude(system: string, conteudo: string, aoUsar?: AoUsar): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada (ou use SIMULAR=1).');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, max_tokens: 1024, system, messages: [{ role: 'user', content: conteudo }] }),
  });
  if (!resp.ok) throw new Error(`Claude ${resp.status}`);
  const json = (await resp.json()) as { content?: { type: string; text?: string }[]; model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  try {
    await aoUsar?.(json.model || MODELO, { entrada: json.usage?.input_tokens ?? 0, saida: json.usage?.output_tokens ?? 0 });
  } catch {
    /* registro de uso não derruba a geração */
  }
  return (json.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
}

export function simularResposta(p: PedidoLegenda): string {
  const tema = p.tema.trim() || 'novidade da casa';
  // Título curto: parte antes de "—"/":" e corta em palavra inteira.
  const base = tema.split(/\s[—–:-]\s|:\s/)[0];
  const curto = base.length <= 38 ? base : base.slice(0, 38).replace(/\s+\S*$/, '');
  const porModelo = {
    promocao: { sub: p.oferta || 'Condição especial por tempo limitado', cta: 'Garanta o seu' },
    novidade: { sub: `Chegou na ${p.nomeEmpresa}`, cta: 'Saiba mais' },
    depoimento: { sub: 'Quem vem, volta.', cta: 'Agende agora' },
    'antes-depois': { sub: 'Resultado real de cliente', cta: 'Quero o meu' },
  }[p.modelo];
  return JSON.stringify({
    titulo: curto.charAt(0).toUpperCase() + curto.slice(1),
    subtitulo: porModelo.sub,
    chamada: porModelo.cta,
    legenda: `${curto} ✨\n\nNa ${p.nomeEmpresa} a gente cuida de cada detalhe pra você.${p.oferta ? ` ${p.oferta}.` : ''}\n\nChama no WhatsApp e fale com a gente!`,
    hashtags: [p.segmento, p.nomeEmpresa, 'novidade', 'qualidade', 'atendimento'],
  });
}
