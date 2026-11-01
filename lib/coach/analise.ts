// Análise da reunião: prompt pra IA, leitura tolerante do JSON e versão simulada.
import type {
  Analise, AnaliseEtapa, AnaliseObjecao, Diagnostico, Fala, Resultado, Roteiro, StatusEtapa,
} from './tipos';
import { porcentagemFala, transcricaoParaTexto } from './transcricao';
import { roteiroParaTexto } from './roteiro';

export const SISTEMA_ANALISE = `Você é um coach de vendas brasileiro, experiente e direto. Analisa reuniões de venda de pequenas e médias empresas
e compara o que o vendedor fez com o roteiro da empresa. Seja específico: cite trechos e momentos ([mm:ss]).
Escreva em português do Brasil, frases curtas, sem jargão. Responda SOMENTE com um objeto JSON válido, sem texto fora dele.`;

export function montarPromptAnalise(p: {
  roteiro: Roteiro;
  falas: Fala[];
  empresaNome?: string;
  vendedorNome?: string;
  contatoNome?: string;
  hojeISO: string;
}): string {
  const etapasIds = p.roteiro.etapas.map((e) => e.id).join(', ');
  return `Empresa: ${p.empresaNome ?? '—'}
Vendedor: ${p.vendedorNome ?? '—'}
Cliente: ${p.contatoNome ?? '—'}
Data de hoje: ${p.hojeISO}

ROTEIRO DA EMPRESA
${roteiroParaTexto(p.roteiro)}

TRANSCRIÇÃO
${transcricaoParaTexto(p.falas)}

Devolva este JSON (todas as chaves):
{
  "resumo": "3 a 5 frases do que aconteceu",
  "resultado": "fechou" | "retorno" | "pensando" | "sem_interesse",
  "chanceFechar": 0-100,
  "nota": 0-10 (uma casa decimal; nota do vendedor contra o roteiro),
  "etapas": [{"etapaId": um de [${etapasIds}], "status": "feita"|"parcial"|"nao_feita", "comentario": "..."}],
  "diagnostico": {"situacao": "", "dores": [""], "objetivo": "", "decisor": "", "orcamento": "", "urgencia": ""},
  "objecoes": [{"objecao": "", "momentoSeg": segundos desde o início ou null, "bemRespondida": true|false, "comoRespondeu": "", "comoResponderMelhor": ""}],
  "pontosFortes": [""],
  "melhorar": [""],
  "proximoPasso": {"acao": "", "data": "AAAA-MM-DD" ou null},
  "followup": "mensagem curta e pessoal pro WhatsApp do cliente, pronta pra enviar, sem colchetes pra preencher"
}`;
}

// ---------- Leitura tolerante ----------

/** Tira o JSON de dentro da resposta da IA: aceita ```json, texto antes/depois e vírgula sobrando. */
export function extrairJson(texto: string): unknown {
  if (!texto) return null;
  let t = texto.trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) t = cerca[1].trim();
  const ini = t.indexOf('{');
  const fim = t.lastIndexOf('}');
  if (ini === -1 || fim <= ini) return null;
  t = t.slice(ini, fim + 1);
  try {
    return JSON.parse(t);
  } catch {
    // vírgula antes de } ou ], aspas “curvas”
    const limpo = t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
    try {
      return JSON.parse(limpo);
    } catch {
      return null;
    }
  }
}

const SINONIMOS_RESULTADO: Record<string, Resultado> = {
  fechou: 'fechou', fechado: 'fechou', venda: 'fechou', ganhou: 'fechou', ganho: 'fechou', won: 'fechou',
  retorno: 'retorno', followup: 'retorno', 'follow-up': 'retorno', reagendar: 'retorno', reagendou: 'retorno',
  pensando: 'pensando', 'vai pensar': 'pensando', 'vou pensar': 'pensando', avaliando: 'pensando',
  sem_interesse: 'sem_interesse', 'sem interesse': 'sem_interesse', perdido: 'sem_interesse', perdeu: 'sem_interesse', lost: 'sem_interesse',
};

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function normalizarResultado(v: unknown): Resultado {
  const s = semAcento(String(v ?? ''));
  if (SINONIMOS_RESULTADO[s]) return SINONIMOS_RESULTADO[s];
  if (s.includes('fech')) return 'fechou';
  if (s.includes('interesse') || s.includes('perd')) return 'sem_interesse';
  if (s.includes('pens')) return 'pensando';
  return 'retorno';
}

function normalizarStatusEtapa(v: unknown): StatusEtapa {
  const s = semAcento(String(v ?? '')).replace(/[\s-]+/g, '_');
  if (['feita', 'feito', 'sim', 'ok', 'completa', 'concluida', 'done', 'true'].includes(s)) return 'feita';
  if (['parcial', 'parcialmente', 'meio', 'partial'].includes(s)) return 'parcial';
  return 'nao_feita';
}

function num(v: unknown, min: number, max: number, padrao: number): number {
  let n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace('%', '').replace(',', '.'));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, max = 2000): string {
  if (typeof v === 'string') return v.trim().slice(0, max);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function lista(v: unknown, max = 10): string[] {
  if (typeof v === 'string') return v.split(/\n|;/).map((s) => s.replace(/^[-•*\d.\s]+/, '').trim()).filter(Boolean).slice(0, max);
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, 400)).filter(Boolean).slice(0, max);
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = semAcento(String(v ?? ''));
  return ['true', 'sim', 'yes', '1', 'bem'].includes(s);
}

function dataISO(v: unknown): string | null {
  const s = str(v, 40);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function tempoSeg(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  const s = String(v);
  const mmss = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (mmss) return (Number(mmss[1] ?? 0) * 3600) + Number(mmss[2]) * 60 + Number(mmss[3]);
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * Transforma qualquer coisa que a IA devolveu numa Analise válida.
 * Nunca lança erro: o que faltar vira valor neutro. Etapas seguem SEMPRE o roteiro (na ordem dele).
 */
export function normalizarAnalise(bruto: unknown, ctx: { roteiro: Roteiro; falas: Fala[]; agoraISO: string }): Analise {
  const o = (typeof bruto === 'string' ? extrairJson(bruto) : bruto) as Record<string, unknown> | null;
  const a = o && typeof o === 'object' ? o : {};

  const etapasIA = Array.isArray(a.etapas) ? (a.etapas as Record<string, unknown>[]) : [];
  const etapas: AnaliseEtapa[] = ctx.roteiro.etapas.map((e) => {
    const achada = etapasIA.find(
      (x) => x && (semAcento(str(x.etapaId ?? x.id)) === e.id || semAcento(str(x.nome ?? x.etapa)) === semAcento(e.nome)),
    );
    return {
      etapaId: e.id,
      nome: e.nome,
      status: achada ? normalizarStatusEtapa(achada.status ?? achada.feita) : 'nao_feita',
      comentario: achada ? str(achada.comentario ?? achada.observacao, 600) : '',
    };
  });

  const objecoes: AnaliseObjecao[] = (Array.isArray(a.objecoes) ? (a.objecoes as Record<string, unknown>[]) : [])
    .filter((x) => x && str(x.objecao ?? x.texto))
    .slice(0, 15)
    .map((x) => ({
      objecao: str(x.objecao ?? x.texto, 200),
      momentoSeg: tempoSeg(x.momentoSeg ?? x.momento ?? x.tempo),
      bemRespondida: bool(x.bemRespondida),
      comoRespondeu: str(x.comoRespondeu, 600),
      comoResponderMelhor: str(x.comoResponderMelhor ?? x.sugestao, 800),
    }));

  const d = (a.diagnostico && typeof a.diagnostico === 'object' ? a.diagnostico : {}) as Record<string, unknown>;
  const diagnostico: Diagnostico = {
    situacao: str(d.situacao, 600),
    dores: lista(d.dores),
    objetivo: str(d.objetivo, 400),
    decisor: str(d.decisor, 200),
    orcamento: str(d.orcamento, 200),
    urgencia: str(d.urgencia, 200),
  };

  const pp = (a.proximoPasso && typeof a.proximoPasso === 'object' ? a.proximoPasso : { acao: a.proximoPasso }) as Record<string, unknown>;
  let chance = num(a.chanceFechar, 0, 100, 50);
  if (chance > 0 && chance <= 1 && String(a.chanceFechar).includes('.')) chance = chance * 100; // veio 0.7
  const resultado = normalizarResultado(a.resultado);
  if (resultado === 'fechou') chance = 100;

  return {
    resumo: str(a.resumo, 1500),
    resultado,
    chanceFechar: Math.round(chance),
    nota: Math.round(num(a.nota, 0, 10, 0) * 10) / 10,
    etapas,
    diagnostico,
    objecoes,
    pontosFortes: lista(a.pontosFortes),
    melhorar: lista(a.melhorar ?? a.oQueMelhorar),
    proximoPasso: { acao: str(pp.acao, 400), data: dataISO(pp.data) },
    followup: str(a.followup ?? a.mensagemFollowup, 1500),
    fala: porcentagemFala(ctx.falas),
    geradoEm: ctx.agoraISO,
  };
}

// ---------- Simulada (SIMULAR=1) ----------

/** Análise determinística feita por regras simples, pra tela funcionar sem chave de IA. */
export function analiseSimulada(ctx: { roteiro: Roteiro; falas: Fala[]; agoraISO: string; contatoNome?: string }): Analise {
  const texto = semAcento(ctx.falas.map((f) => f.texto).join(' '));
  const etapas = ctx.roteiro.etapas.map((e) => {
    const palavras = [e.nome, ...e.perguntasChave].map(semAcento).flatMap((s) => s.split(/\W+/)).filter((w) => w.length > 4);
    const acertos = palavras.filter((w) => texto.includes(w)).length;
    return { etapaId: e.id, status: acertos >= 2 ? 'feita' : acertos === 1 ? 'parcial' : 'nao_feita', comentario: '(simulado)' };
  });
  const objecoes = ctx.roteiro.objecoes
    .filter((o) => semAcento(o.objecao).split(/\W+/).filter((w) => w.length > 3).some((w) => texto.includes(w)))
    .map((o) => {
      const f = ctx.falas.find((x) => semAcento(o.objecao).split(/\W+/).filter((w) => w.length > 3).some((w) => semAcento(x.texto).includes(w)));
      return { objecao: o.objecao, momentoSeg: f?.inicioSeg ?? null, bemRespondida: false, comoRespondeu: '', comoResponderMelhor: o.respostaIdeal };
    });
  const feitas = etapas.filter((e) => e.status === 'feita').length + etapas.filter((e) => e.status === 'parcial').length * 0.5;
  const nota = ctx.roteiro.etapas.length ? (feitas / ctx.roteiro.etapas.length) * 10 : 0;
  const resultado: Resultado = /fechad|vamos comecar|pode mandar o contrato|fechou/.test(texto)
    ? 'fechou'
    : /vou pensar|pensar/.test(texto) ? 'pensando' : /nao tenho interesse|sem interesse/.test(texto) ? 'sem_interesse' : 'retorno';
  const nome = ctx.contatoNome?.split(' ')[0] ?? '';
  const a = normalizarAnalise(
    {
      resumo: 'Análise simulada (sem IA). Conecte a chave da Anthropic para a análise real.',
      resultado,
      chanceFechar: resultado === 'fechou' ? 100 : Math.round(nota * 8),
      nota,
      etapas,
      diagnostico: { situacao: '', dores: [], objetivo: '', decisor: '', orcamento: '', urgencia: '' },
      objecoes,
      pontosFortes: etapas.filter((e) => e.status === 'feita').map((e) => `Fez a etapa ${ctx.roteiro.etapas.find((x) => x.id === e.etapaId)?.nome}`),
      melhorar: etapas.filter((e) => e.status === 'nao_feita').map((e) => `Faltou: ${ctx.roteiro.etapas.find((x) => x.id === e.etapaId)?.nome}`),
      proximoPasso: { acao: resultado === 'fechou' ? 'Enviar contrato e boas-vindas' : 'Fazer retorno com o cliente', data: null },
      followup: `Oi${nome ? ` ${nome}` : ''}! Obrigado pela conversa de hoje. Fiquei com os pontos que você falou e já te mando o próximo passo. Qualquer dúvida, estou por aqui.`,
    },
    ctx,
  );
  return { ...a, simulado: true };
}
