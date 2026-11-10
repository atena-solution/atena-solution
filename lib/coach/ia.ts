// Chamada ao Claude pra analisar a reunião.
// Obs.: o módulo geral do Claude (lib/integracoes/claude.ts) é da sessão B. Aqui fica só a chamada
// da análise do Coach; na junção dá pra trocar por um helper comum sem mudar quem usa `analisarComIA`.
//
// API (docs Anthropic, lidas em 01/11/2026): SDK oficial @anthropic-ai/sdk, client.messages.create
// com { model, max_tokens, system, messages }. Sem `temperature` (regra do projeto; rejeitado nos modelos novos).
// Fallback em recusa: beta "server-side-fallback-2026-07-01" + fallbacks: "default" (client.beta.messages).
// CONFIRMAR AO VIVO: fallback e tempo de resposta com transcrições longas (1 h de reunião ≈ 15 mil tokens).
import type { Analise, Fala, Roteiro } from './tipos';
import { analiseSimulada, montarPromptAnalise, normalizarAnalise, SISTEMA_ANALISE } from './analise';

export const MODELO_ANALISE = 'claude-sonnet-5-5';

export function simulandoIA(): boolean {
  return process.env.SIMULAR === '1' || !process.env.ANTHROPIC_API_KEY;
}

export interface EntradaAnalise {
  roteiro: Roteiro;
  falas: Fala[];
  empresaNome?: string;
  vendedorNome?: string;
  contatoNome?: string;
  agoraISO?: string;
  /** Avisa os tokens gastos (registrarUsoIA). */
  aoUsar?: (modelo: string, uso: { entrada: number; saida: number; cacheLeitura?: number }) => unknown;
}

/** Função que recebe (system, prompt) e devolve o texto da IA. Injetável nos testes. */
export type ChamadaIA = (system: string, prompt: string) => Promise<string>;

async function chamarClaude(system: string, prompt: string, aoUsar?: EntradaAnalise['aoUsar']): Promise<string> {
  // import dinâmico: o pacote só é exigido quando há chave (testes e SIMULAR=1 não precisam dele)
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const resp = await client.beta.messages.create({
    model: MODELO_ANALISE,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: prompt }],
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  try {
    await aoUsar?.(resp.model || MODELO_ANALISE, { entrada: resp.usage.input_tokens ?? 0, saida: resp.usage.output_tokens ?? 0, cacheLeitura: resp.usage.cache_read_input_tokens ?? 0 });
  } catch {
    /* registro de uso não derruba a análise */
  }
  if (resp.stop_reason === 'refusal') throw new Error('A IA recusou analisar esta reunião.');
  return resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

export async function analisarComIA(e: EntradaAnalise, chamada?: ChamadaIA): Promise<Analise> {
  const agoraISO = e.agoraISO ?? new Date().toISOString();
  const ctx = { roteiro: e.roteiro, falas: e.falas, agoraISO };
  if (!chamada && simulandoIA()) return analiseSimulada({ ...ctx, contatoNome: e.contatoNome });
  const prompt = montarPromptAnalise({
    roteiro: e.roteiro, falas: e.falas, empresaNome: e.empresaNome, vendedorNome: e.vendedorNome,
    contatoNome: e.contatoNome, hojeISO: agoraISO.slice(0, 10),
  });
  const texto = chamada ? await chamada(SISTEMA_ANALISE, prompt) : await chamarClaude(SISTEMA_ANALISE, prompt, e.aoUsar);
  return normalizarAnalise(texto, ctx);
}
