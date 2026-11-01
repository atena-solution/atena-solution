// Casos de uso do Coach. As rotas em app/api/coach só autenticam (exigirEmpresa) e chamam estas funções.
// Tudo aqui recebe a Sessao (com empresaId) e o repositório; nada lê dado de outra empresa.
import type { Analise, ConfigCoach, Fala, ModoGravacao, Pedaco, Reuniao, Roteiro, Sessao, Trilha } from './tipos';
import { CONFIG_PADRAO } from './tipos';
import { caminhos, type RepositorioCoach } from './repositorio';
import { modeloDeRoteiro } from './modelos';
import { normalizarRoteiro } from './roteiro';
import { deslocarFalas, duracaoTotal, juntarTrilhas } from './transcricao';
import { janelasDeTranscricao, PEDACO_SEG, registrarPedaco, validarArquivo } from './gravacao';
import { biblioteca, objecoesComuns, placarPorVendedor, tendenciaSemanal } from './placar';
import { atividadeDaReuniao, canalFollowup, etapaSugerida, linkWaMe } from './contatos';

export class ErroCoach extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

const PODE_USAR = ['dono', 'gestor', 'vendedor'] as const;
const PODE_GERIR = ['dono', 'gestor'] as const;

export function podeUsarCoach(s: Sessao) {
  return (PODE_USAR as readonly string[]).includes(s.papel);
}
export function podeGerir(s: Sessao) {
  return (PODE_GERIR as readonly string[]).includes(s.papel);
}

function exigirUso(s: Sessao) {
  if (!s.empresaId) throw new ErroCoach(401, 'Entre na sua conta.');
  if (!podeUsarCoach(s)) throw new ErroCoach(403, 'Seu papel não tem acesso ao Coach.');
}
function exigirGestao(s: Sessao) {
  exigirUso(s);
  if (!podeGerir(s)) throw new ErroCoach(403, 'Só o dono ou o gestor podem fazer isso.');
}

/** Vendedor vê as próprias reuniões e as da biblioteca; dono/gestor veem todas da empresa. */
export function podeVerReuniao(s: Sessao, r: Reuniao) {
  if (r.empresaId !== s.empresaId) return false;
  return podeGerir(s) || r.vendedorUid === s.uid || r.naBiblioteca;
}

async function carregar(s: Sessao, repo: RepositorioCoach, id: string, paraEditar = false): Promise<Reuniao> {
  exigirUso(s);
  const r = await repo.obterReuniao(s.empresaId, id);
  // reunião de outra empresa responde igual a "não existe" (não vaza a existência)
  if (!r || r.empresaId !== s.empresaId || !podeVerReuniao(s, r)) throw new ErroCoach(404, 'Reunião não encontrada.');
  if (paraEditar && !podeGerir(s) && r.vendedorUid !== s.uid) throw new ErroCoach(403, 'Só quem gravou pode mexer nesta reunião.');
  return r;
}

// ---------- Roteiro e config ----------

export async function obterRoteiro(s: Sessao, repo: RepositorioCoach, segmentoEmpresa?: string): Promise<{ roteiro: Roteiro; ehModelo: boolean }> {
  exigirUso(s);
  const r = await repo.obterRoteiro(s.empresaId);
  return r ? { roteiro: r, ehModelo: false } : { roteiro: modeloDeRoteiro(segmentoEmpresa), ehModelo: true };
}

export async function salvarRoteiro(s: Sessao, repo: RepositorioCoach, entrada: unknown, agoraISO = new Date().toISOString()) {
  exigirGestao(s);
  const n = normalizarRoteiro(entrada);
  if (!n.ok) throw new ErroCoach(400, n.erros.join(' '));
  const roteiro = { ...n.roteiro, atualizadoEm: agoraISO };
  await repo.salvarRoteiro(s.empresaId, roteiro);
  return roteiro;
}

export async function obterConfig(s: Sessao, repo: RepositorioCoach): Promise<ConfigCoach> {
  exigirUso(s);
  return { ...CONFIG_PADRAO, ...((await repo.obterConfig(s.empresaId)) ?? {}) };
}

export async function salvarConfig(s: Sessao, repo: RepositorioCoach, entrada: Partial<ConfigCoach>) {
  exigirGestao(s);
  const atual = await obterConfig(s, repo);
  const etapas: ConfigCoach['etapaPorResultado'] = { ...atual.etapaPorResultado };
  for (const k of ['fechou', 'retorno', 'pensando', 'sem_interesse'] as const) {
    const v = entrada.etapaPorResultado?.[k];
    if (typeof v === 'string') etapas[k] = v.trim().slice(0, 60) || undefined;
  }
  const c: ConfigCoach = { moverEtapa: typeof entrada.moverEtapa === 'boolean' ? entrada.moverEtapa : atual.moverEtapa, etapaPorResultado: etapas };
  await repo.salvarConfig(s.empresaId, c);
  return c;
}

// ---------- Reuniões ----------

export interface NovaReuniao {
  titulo?: string;
  modo: ModoGravacao;
  contatoId?: string | null;
  contatoNome?: string;
  contatoTelefone?: string;
  semAudioDaAba?: boolean;
  arquivo?: { nome: string; mime: string; bytes: number; duracaoSeg?: number };
}

export async function criarReuniao(
  s: Sessao, repo: RepositorioCoach, e: NovaReuniao, id: string, agoraISO = new Date().toISOString(),
): Promise<Reuniao> {
  exigirUso(s);
  if (!['duas-trilhas', 'so-microfone', 'arquivo'].includes(e.modo)) throw new ErroCoach(400, 'Modo de gravação inválido.');
  if (e.modo === 'arquivo') {
    if (!e.arquivo) throw new ErroCoach(400, 'Envie o arquivo da reunião.');
    const erro = validarArquivo(e.arquivo);
    if (erro) throw new ErroCoach(400, erro);
  }
  const r: Reuniao = {
    id,
    empresaId: s.empresaId,
    titulo: (e.titulo ?? '').trim().slice(0, 120) || `Reunião${e.contatoNome ? ` com ${e.contatoNome}` : ''}`,
    vendedorUid: s.uid,
    vendedorNome: s.nome ?? 'Vendedor',
    contatoId: e.contatoId ?? null,
    contatoNome: e.contatoNome,
    contatoTelefone: e.contatoTelefone,
    modo: e.modo,
    status: e.modo === 'arquivo' ? 'transcrevendo' : 'gravando',
    semAudioDaAba: e.modo === 'duas-trilhas' ? !!e.semAudioDaAba : false,
    pedacos: [],
    duracaoSeg: 0,
    naBiblioteca: false,
    criadoEm: agoraISO,
    atualizadoEm: agoraISO,
  };
  if (e.arquivo) {
    r.arquivo = {
      caminho: caminhos.audio(s.empresaId, id, `arquivo-${e.arquivo.nome.replace(/[^\w.-]+/g, '_').slice(-80)}`),
      nome: e.arquivo.nome.slice(0, 200),
      mime: e.arquivo.mime.split(';')[0] || 'application/octet-stream',
      bytes: e.arquivo.bytes,
      duracaoSeg: e.arquivo.duracaoSeg && e.arquivo.duracaoSeg > 0 ? Math.round(e.arquivo.duracaoSeg) : undefined,
      janelasFeitas: 0,
    };
    r.duracaoSeg = r.arquivo.duracaoSeg ?? 0;
  }
  await repo.salvarReuniao(r);
  return r;
}

/** Função que transcreve um pedaço (tempos relativos ao pedaço). Vem de lib/integracoes/gemini.ts. */
export type Transcrever = (audio: Uint8Array, mime: string, p: { trilha: Trilha; indice: number; duracaoSeg: number }) => Promise<Fala[]>;

/**
 * Recebe um pedaço de 5 min durante a reunião, guarda o áudio, transcreve e salva o andamento.
 * Se a transcrição falhar, o pedaço fica com status "erro" (a reunião continua e dá pra reenviar).
 */
export async function receberPedaco(
  s: Sessao, repo: RepositorioCoach, reuniaoId: string,
  p: { trilha: Trilha; indice: number; duracaoSeg?: number; inicioSeg?: number; audio: Uint8Array; mime: string },
  transcrever: Transcrever, agoraISO = new Date().toISOString(),
  guardarAudio?: (caminho: string, bytes: Uint8Array, mime: string) => Promise<void>,
) {
  const r = await carregar(s, repo, reuniaoId, true);
  if (r.modo === 'arquivo') throw new ErroCoach(400, 'Esta reunião é de arquivo enviado.');
  if (r.status === 'pronta' || r.status === 'analisando') throw new ErroCoach(409, 'A reunião já foi encerrada.');
  const permitidas: Trilha[] = r.modo === 'duas-trilhas' ? ['vendedor', 'cliente'] : ['misto'];
  if (!permitidas.includes(p.trilha)) throw new ErroCoach(400, 'Trilha não combina com o modo da gravação.');
  if (!Number.isInteger(p.indice) || p.indice < 0 || p.indice > 500) throw new ErroCoach(400, 'Pedaço inválido.');
  if (!p.audio?.byteLength) throw new ErroCoach(400, 'Pedaço de áudio vazio.');
  const duracaoSeg = Math.min(Math.max(1, p.duracaoSeg ?? PEDACO_SEG), PEDACO_SEG * 2);
  const inicioSeg = p.inicioSeg ?? p.indice * PEDACO_SEG;
  const mime = p.mime.split(';')[0] || 'audio/webm';
  const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
  const caminhoAudio = caminhos.audio(s.empresaId, reuniaoId, `${p.trilha}-${String(p.indice).padStart(3, '0')}.${ext}`);

  let pedaco: Pedaco;
  try {
    if (guardarAudio) await guardarAudio(caminhoAudio, p.audio, mime);
    const falas = await transcrever(p.audio, p.mime, { trilha: p.trilha, indice: p.indice, duracaoSeg });
    pedaco = { indice: p.indice, trilha: p.trilha, inicioSeg, duracaoSeg, status: 'transcrito', falas: deslocarFalas(falas, inicioSeg), caminhoAudio: guardarAudio ? caminhoAudio : undefined, mime };
  } catch (err) {
    pedaco = { indice: p.indice, trilha: p.trilha, inicioSeg, duracaoSeg, status: 'erro', falas: [], erro: String((err as Error).message).slice(0, 300) };
  }
  // gravação atômica: as duas trilhas mandam pedaços ao mesmo tempo
  const atual = await repo.atualizarReuniao(s.empresaId, reuniaoId, (x) => {
    x.pedacos = registrarPedaco(x.pedacos, pedaco);
    x.duracaoSeg = duracaoTotal(x.pedacos);
    x.atualizadoEm = agoraISO;
    return x;
  });
  if (!atual) throw new ErroCoach(404, 'Reunião não encontrada.');
  return { pedaco, reuniao: atual };
}

export interface DepsAnalise {
  analisar: (e: { roteiro: Roteiro; falas: Fala[]; vendedorNome?: string; contatoNome?: string; agoraISO: string }) => Promise<Analise>;
  segmentoEmpresa?: string;
  /** Liga com Contatos (Base). Opcional: sem ele, só devolve o que faria. */
  contatos?: {
    registrarAtividade: (empresaId: string, a: NonNullable<ReturnType<typeof atividadeDaReuniao>>) => Promise<void>;
    etapaAtual: (empresaId: string, contatoId: string) => Promise<string | undefined>;
    moverEtapa: (empresaId: string, contatoId: string, etapa: string) => Promise<void>;
  };
}

/** Encerra (se gravando), junta as trilhas e analisa. Pode rodar de novo pra reanalisar. */
export async function analisarReuniao(
  s: Sessao, repo: RepositorioCoach, reuniaoId: string, deps: DepsAnalise, agoraISO = new Date().toISOString(),
) {
  const r = await carregar(s, repo, reuniaoId, true);
  const falas = juntarTrilhas(r.pedacos);
  if (falas.length === 0) throw new ErroCoach(400, 'Ainda não tem fala transcrita pra analisar.');
  r.status = 'analisando';
  await repo.salvarReuniao({ ...r, atualizadoEm: agoraISO });

  const { roteiro } = await obterRoteiro(s, repo, deps.segmentoEmpresa);
  try {
    r.analise = await deps.analisar({ roteiro, falas, vendedorNome: r.vendedorNome, contatoNome: r.contatoNome, agoraISO });
    r.status = 'pronta';
    r.erro = undefined;
  } catch (err) {
    r.status = 'erro';
    r.erro = `Não deu pra analisar agora: ${String((err as Error).message).slice(0, 200)}`;
  }
  r.duracaoSeg = duracaoTotal(r.pedacos);
  r.atualizadoEm = agoraISO;
  await repo.salvarReuniao(r);

  let etapaNova: string | null = null;
  if (r.analise && r.contatoId) {
    const config = await obterConfig(s, repo);
    const atividade = atividadeDaReuniao(r)!;
    if (deps.contatos) {
      await deps.contatos.registrarAtividade(s.empresaId, atividade);
      const atual = await deps.contatos.etapaAtual(s.empresaId, r.contatoId);
      etapaNova = etapaSugerida(r.analise.resultado, config, atual);
      if (etapaNova) await deps.contatos.moverEtapa(s.empresaId, r.contatoId, etapaNova);
    } else etapaNova = etapaSugerida(r.analise.resultado, config);
  }
  return { reuniao: r, falas, etapaNova };
}

export interface DepsArquivo {
  /** Lê os bytes do arquivo no Storage. */
  lerArquivo: (caminho: string) => Promise<Uint8Array>;
  /** Sobe pro Gemini (Files API). Em SIMULAR=1 pode devolver uri falsa. */
  enviarGemini: (bytes: Uint8Array, mime: string, nome: string) => Promise<{ uri: string; mimeType: string }>;
  /** Transcreve uma janela; tempos já no tempo do arquivo. */
  transcreverJanela: (arq: { uri: string; mimeType: string }, janela: { inicioSeg: number; fimSeg: number }, indice: number) => Promise<Fala[]>;
}

/** Arquivo no Gemini vale 48 h; reenviar se passou de 40 h. */
const VALIDADE_GEMINI_MS = 40 * 3600 * 1000;

/**
 * Processa UM passo do arquivo enviado (pra caber no tempo de uma função da Vercel):
 * 1º chamada sobe pro Gemini; as seguintes transcrevem uma janela de 10 min cada.
 * A tela chama de novo até `terminou`.
 */
export async function processarArquivo(
  s: Sessao, repo: RepositorioCoach, reuniaoId: string, deps: DepsArquivo, agoraISO = new Date().toISOString(),
) {
  const r = await carregar(s, repo, reuniaoId, true);
  if (r.modo !== 'arquivo' || !r.arquivo) throw new ErroCoach(400, 'Esta reunião não é de arquivo.');
  const arq = r.arquivo;
  const duracao = arq.duracaoSeg ?? 0;
  if (duracao <= 0) throw new ErroCoach(400, 'Não deu pra ler a duração do arquivo. Tente outro formato (mp3 ou m4a).');
  const janelas = janelasDeTranscricao(duracao);
  const feitas = arq.janelasFeitas ?? 0;
  if (feitas >= janelas.length) return { reuniao: r, feitas, total: janelas.length, terminou: true };

  const geminiVencido = !arq.gemini || new Date(agoraISO).getTime() - new Date(arq.gemini.enviadoEm).getTime() > VALIDADE_GEMINI_MS;
  if (geminiVencido) {
    const bytes = await deps.lerArquivo(arq.caminho);
    const g = await deps.enviarGemini(bytes, arq.mime, arq.nome);
    const salvo = await repo.atualizarReuniao(s.empresaId, reuniaoId, (x) => {
      x.arquivo = { ...x.arquivo!, gemini: { uri: g.uri, mimeType: g.mimeType, enviadoEm: agoraISO } };
      x.status = 'transcrevendo';
      x.atualizadoEm = agoraISO;
      return x;
    });
    return { reuniao: salvo!, feitas, total: janelas.length, terminou: false };
  }

  const j = janelas[feitas];
  let pedaco: Pedaco;
  try {
    const falas = await deps.transcreverJanela(arq.gemini!, j, feitas);
    pedaco = { indice: feitas, trilha: 'misto', inicioSeg: j.inicioSeg, duracaoSeg: j.fimSeg - j.inicioSeg, status: 'transcrito', falas };
  } catch (err) {
    pedaco = { indice: feitas, trilha: 'misto', inicioSeg: j.inicioSeg, duracaoSeg: j.fimSeg - j.inicioSeg, status: 'erro', falas: [], erro: String((err as Error).message).slice(0, 300) };
  }
  const salvo = await repo.atualizarReuniao(s.empresaId, reuniaoId, (x) => {
    x.pedacos = registrarPedaco(x.pedacos, pedaco);
    x.arquivo = { ...x.arquivo!, janelasFeitas: feitas + 1 };
    x.duracaoSeg = Math.max(duracao, duracaoTotal(x.pedacos));
    x.atualizadoEm = agoraISO;
    return x;
  });
  return { reuniao: salvo!, feitas: feitas + 1, total: janelas.length, terminou: feitas + 1 >= janelas.length };
}

export async function obterReuniao(s: Sessao, repo: RepositorioCoach, id: string) {
  const r = await carregar(s, repo, id);
  return { reuniao: r, falas: juntarTrilhas(r.pedacos) };
}

export async function listarReunioes(s: Sessao, repo: RepositorioCoach, filtro: { contatoId?: string; vendedorUid?: string } = {}) {
  exigirUso(s);
  const vendedorUid = podeGerir(s) ? filtro.vendedorUid : s.uid;
  const lista = await repo.listarReunioes(s.empresaId, { vendedorUid, contatoId: filtro.contatoId });
  return lista.filter((r) => podeVerReuniao(s, r));
}

export async function marcarBiblioteca(s: Sessao, repo: RepositorioCoach, id: string, naBiblioteca: boolean) {
  exigirGestao(s);
  const r = await carregar(s, repo, id);
  r.naBiblioteca = naBiblioteca;
  await repo.salvarReuniao(r);
  return r;
}

export async function apagarAnaliseErro(s: Sessao, repo: RepositorioCoach, id: string) {
  const r = await carregar(s, repo, id, true);
  r.status = r.pedacos.length ? 'transcrevendo' : 'gravando';
  r.erro = undefined;
  await repo.salvarReuniao(r);
  return r;
}

/** Placar da empresa. Vendedor vê a própria linha + médias da equipe; dono/gestor veem todos. */
export async function obterPlacar(s: Sessao, repo: RepositorioCoach, agoraISO = new Date().toISOString(), semanas = 8) {
  exigirUso(s);
  const desde = new Date(new Date(agoraISO).getTime() - semanas * 7 * 86400000).toISOString();
  const todas = (await repo.listarReunioes(s.empresaId, { desdeISO: desde, limite: 2000 })).filter((r) => r.empresaId === s.empresaId);
  const visiveis = podeGerir(s) ? todas : todas.filter((r) => r.vendedorUid === s.uid);
  const linhas = placarPorVendedor(visiveis);
  return {
    linhas,
    tendencia: tendenciaSemanal(visiveis, semanas, agoraISO),
    objecoesSemana: objecoesComuns(todas, agoraISO),
    biblioteca: biblioteca(todas).map((r) => ({
      id: r.id, titulo: r.titulo, vendedorNome: r.vendedorNome, nota: r.analise!.nota, resultado: r.analise!.resultado, criadoEm: r.criadoEm,
    })),
  };
}

/** Prepara o envio do follow-up: pelo WhatsApp da empresa (sessão B) ou link wa.me. */
export async function prepararFollowup(
  s: Sessao, repo: RepositorioCoach, id: string, p: { abas: string[]; whatsappConectado: boolean; texto?: string },
) {
  const r = await carregar(s, repo, id, true);
  const texto = (p.texto ?? r.analise?.followup ?? '').trim();
  if (!texto) throw new ErroCoach(400, 'Ainda não tem mensagem de follow-up.');
  const canal = canalFollowup(p);
  if (canal === 'whatsapp-empresa') {
    if (!r.contatoId) throw new ErroCoach(400, 'Ligue esta reunião a um contato pra mandar pelo WhatsApp da empresa.');
    return { canal, contatoId: r.contatoId, texto, link: null };
  }
  const link = linkWaMe(r.contatoTelefone, texto) ?? `https://wa.me/?text=${encodeURIComponent(texto)}`;
  return { canal, contatoId: r.contatoId, texto, link };
}
