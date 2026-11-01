// Orquestração do Estúdio: debita ANTES, gera, e devolve se falhar.
// Dependências injetadas (repositório, gerador, relógio, ids) para testar sem rede.
import { custoDe, debitar, type ResultadoDebito, devolver, valorDevolucaoParcial, ROTULO_TIPO } from './creditos';
import { montarPromptFoto, montarPromptFundoPost, montarPromptVideo, type PedidoFoto, type PedidoVideo } from './prompts';
import type { RepositorioEstudio } from './repositorio';
import type { Criacao, Formato, KitMarca, ModeloPost, TipoCriacao } from './tipos';
import type { ResultadoImagem, PedidoImagem, PedidoVideo as PedidoVideoIA, EstadoVideo } from '../integracoes/imagem';
import type { PedidoLegenda } from './prompts';
import type { TextoPost } from './legenda';

export interface Dependencias {
  repo: RepositorioEstudio;
  gerarImagens: (p: PedidoImagem) => Promise<ResultadoImagem>;
  iniciarVideo: (p: PedidoVideoIA) => Promise<{ operacao: string }>;
  consultarVideo: (operacao: string) => Promise<EstadoVideo>;
  gerarTextoPost: (p: PedidoLegenda) => Promise<TextoPost>;
  agora: () => string;
  novoId: () => string;
}

export interface Quem {
  empresaId: string;
  uid: string;
}

export class SemCreditos extends Error {
  constructor(public falta: number, mensagem: string) {
    super(mensagem);
  }
}

async function cobrar(d: Dependencias, q: Quem, tipo: TipoCriacao, qtd: number, criacaoId: string) {
  const valor = custoDe(tipo, qtd);
  const r = await d.repo.transacaoCreditos<ResultadoDebito>(q.empresaId, ({ saldo }) => {
    const res = debitar(saldo, valor, `${ROTULO_TIPO[tipo]}${qtd > 1 ? ` (${qtd}x)` : ''}`, { empresaId: q.empresaId, id: d.novoId(), quando: d.agora(), criacaoId });
    if (!res.ok) return { saldo, lancamento: null, resultado: res };
    return { saldo: res.saldo, lancamento: res.lancamento, resultado: res };
  });
  if (!r.ok) throw new SemCreditos(r.falta, r.mensagem);
  return valor;
}

async function estornar(d: Dependencias, q: Quem, criacaoId: string, valor: number, motivo: string) {
  if (valor <= 0) return 0;
  return d.repo.transacaoCreditos(q.empresaId, ({ saldo, extrato }) => {
    const r = devolver(saldo, extrato, criacaoId, valor, motivo, { empresaId: q.empresaId, id: d.novoId(), quando: d.agora() });
    return { saldo: r.saldo, lancamento: r.lancamento, resultado: r.lancamento?.valor ?? 0 };
  });
}

export async function kitOuPadrao(d: Dependencias, empresaId: string, padrao: KitMarca): Promise<KitMarca> {
  return (await d.repo.lerKit(empresaId)) ?? padrao;
}

// ---------- Foto de produto ----------

export interface EntradaFoto extends Omit<PedidoFoto, 'qtdFotos' | 'marca'> {
  fotos: string[]; // data URLs
  quantidade: number;
}

export async function gerarFotos(d: Dependencias, q: Quem, marca: KitMarca, e: EntradaFoto): Promise<Criacao> {
  if (e.fotos.length < 1 || e.fotos.length > 5) throw new Error('Envie de 1 a 5 fotos do produto.');
  const prompt = montarPromptFoto({ ...e, marca, qtdFotos: e.fotos.length });
  const id = d.novoId();
  const creditos = await cobrar(d, q, 'foto', e.quantidade, id);
  const base: Criacao = {
    id, empresaId: q.empresaId, tipo: 'foto', status: 'gerando', titulo: e.produto || 'Foto de produto',
    arquivos: [], formato: e.formato, estilo: e.estilo, prompt, origem: e.fotos, creditos, porUid: q.uid, criadoEm: d.agora(), pedidas: e.quantidade,
  };
  await d.repo.salvarCriacao(base);
  let r: ResultadoImagem;
  try {
    r = await d.gerarImagens({ prompt, referencias: e.fotos, proporcao: e.formato, quantidade: e.quantidade, cores: marca.cores, estilo: e.estilo });
  } catch (err) {
    r = { imagens: [], falhas: e.quantidade, erros: [err instanceof Error ? err.message : String(err)] };
  }
  const devolvido = await estornar(d, q, id, valorDevolucaoParcial('foto', e.quantidade, r.imagens.length), 'Devolução: geração falhou');
  const final: Criacao = {
    ...base,
    arquivos: r.imagens,
    status: r.imagens.length ? 'pronta' : 'falhou',
    creditos: creditos - devolvido,
    erro: r.imagens.length ? (r.falhas ? `${r.falhas} variação(ões) falharam; créditos devolvidos.` : undefined) : 'Não conseguimos gerar agora. Os créditos foram devolvidos.',
  };
  await d.repo.salvarCriacao(limparIndefinidos(final));
  return final;
}

// ---------- Post/arte ----------

export interface EntradaPost {
  modelo: ModeloPost;
  formato: Formato;
  tema: string;
  oferta?: string;
  /** Foto real da empresa (produto) ou [antes, depois]. */
  fotosReais?: string[];
  nomeEmpresa: string;
  segmento: string;
  pautaId?: string;
  /** Usar a foto real como fundo em vez de gerar fundo com IA. */
  usarFotoComoFundo?: boolean;
}

export async function gerarPost(d: Dependencias, q: Quem, marca: KitMarca, e: EntradaPost): Promise<Criacao> {
  const temFotoReal = !!e.fotosReais?.length;
  if (e.modelo === 'antes-depois' && (e.fotosReais?.length ?? 0) < 2) throw new Error('Antes/depois só com 2 fotos reais da empresa (antes e depois).');
  const prompt = montarPromptFundoPost({ modelo: e.modelo, tema: e.tema, formato: e.formato, marca, temFotoReal });
  const id = d.novoId();
  // Antes/depois e "foto como fundo" não usam IA de imagem: só o texto. Mesmo assim cobram a arte.
  const precisaFundoIA = e.modelo !== 'antes-depois' && !e.usarFotoComoFundo;
  const creditos = await cobrar(d, q, 'post', 1, id);
  const base: Criacao = {
    id, empresaId: q.empresaId, tipo: 'post', status: 'gerando', titulo: e.tema || 'Post', arquivos: [], formato: e.formato, modelo: e.modelo,
    prompt, origem: e.fotosReais, creditos, porUid: q.uid, criadoEm: d.agora(), pautaId: e.pautaId, pedidas: 1,
  };
  await d.repo.salvarCriacao(limparIndefinidos(base));
  try {
    const [texto, fundo] = await Promise.all([
      d.gerarTextoPost({ tema: e.tema, oferta: e.oferta, modelo: e.modelo, segmento: e.segmento, nomeEmpresa: e.nomeEmpresa, marca }),
      precisaFundoIA
        ? d.gerarImagens({ prompt, referencias: e.fotosReais ?? [], proporcao: e.formato, quantidade: 1, cores: marca.cores }).then((r) => {
            if (!r.imagens[0]) throw new Error(r.erros[0] || 'Sem imagem');
            return r.imagens[0];
          })
        : Promise.resolve(e.fotosReais?.[e.modelo === 'antes-depois' ? 1 : 0] ?? ''),
    ]);
    const final: Criacao = {
      ...base,
      status: 'pronta',
      arquivos: [fundo],
      legenda: texto.legenda,
      hashtags: texto.hashtags,
      arte: limparIndefinidos({ textos: { titulo: texto.titulo, subtitulo: texto.subtitulo, chamada: texto.chamada }, fundo, fotosReais: e.modelo === 'antes-depois' ? e.fotosReais : undefined }),
    };
    await d.repo.salvarCriacao(limparIndefinidos(final));
    return final;
  } catch (err) {
    const devolvido = await estornar(d, q, id, creditos, 'Devolução: geração falhou');
    const falhou: Criacao = { ...base, status: 'falhou', creditos: creditos - devolvido, erro: 'Não conseguimos gerar a arte agora. Os créditos foram devolvidos.' };
    await d.repo.salvarCriacao(limparIndefinidos(falhou));
    void err;
    return falhou;
  }
}

/** Editar os textos da arte depois de pronta (grátis: o sistema redesenha). */
export async function editarTextosPost(d: Dependencias, q: Quem, id: string, textos: NonNullable<Criacao['arte']>['textos'], legenda?: string, hashtags?: string[]): Promise<Criacao> {
  const c = await d.repo.obterCriacao(q.empresaId, id);
  if (!c || c.tipo !== 'post' || !c.arte) throw new Error('Post não encontrado.');
  const novo: Criacao = limparIndefinidos({ ...c, arte: { ...c.arte, textos: limparIndefinidos(textos) }, legenda: legenda ?? c.legenda, hashtags: hashtags ?? c.hashtags });
  await d.repo.salvarCriacao(novo);
  return novo;
}

// ---------- Vídeo ----------

export interface EntradaVideo extends PedidoVideo {
  foto: string;
}

export async function iniciarGeracaoVideo(d: Dependencias, q: Quem, e: EntradaVideo): Promise<Criacao> {
  const prompt = montarPromptVideo(e);
  const id = d.novoId();
  const creditos = await cobrar(d, q, 'video', 1, id);
  const base: Criacao = {
    id, empresaId: q.empresaId, tipo: 'video', status: 'gerando', titulo: e.produto || 'Vídeo curto', arquivos: [], formato: e.formato,
    prompt, origem: [e.foto], creditos, porUid: q.uid, criadoEm: d.agora(), pedidas: 1,
  };
  try {
    const { operacao } = await d.iniciarVideo({ prompt, foto: e.foto, proporcao: e.formato, duracaoSeg: e.duracaoSeg });
    const c = { ...base, operacao };
    await d.repo.salvarCriacao(c);
    return c;
  } catch {
    const devolvido = await estornar(d, q, id, creditos, 'Devolução: vídeo não iniciou');
    const c: Criacao = { ...base, status: 'falhou', creditos: creditos - devolvido, erro: 'Não conseguimos iniciar o vídeo. Os créditos foram devolvidos.' };
    await d.repo.salvarCriacao(c);
    return c;
  }
}

/** Consulta o andamento; quando termina, grava o arquivo ou devolve os créditos. */
export async function atualizarVideo(d: Dependencias, q: Quem, id: string): Promise<Criacao> {
  const c = await d.repo.obterCriacao(q.empresaId, id);
  if (!c || c.tipo !== 'video') throw new Error('Vídeo não encontrado.');
  if (c.status !== 'gerando' || !c.operacao) return c;
  let estado: EstadoVideo;
  try {
    estado = await d.consultarVideo(c.operacao);
  } catch {
    return c; // tenta de novo na próxima consulta
  }
  if (!estado.pronto) return c;
  let final: Criacao;
  if (estado.url) {
    final = { ...c, status: 'pronta', arquivos: [estado.url] };
  } else {
    const devolvido = await estornar(d, q, id, c.creditos, 'Devolução: vídeo falhou');
    final = { ...c, status: 'falhou', creditos: c.creditos - devolvido, erro: `${estado.erro ?? 'Falha'}. Os créditos foram devolvidos.` };
  }
  delete final.operacao;
  await d.repo.salvarCriacao(final);
  return final;
}

/** Slideshow montado no navegador: só registra na galeria (custo zero). */
export async function registrarSlideshow(d: Dependencias, q: Quem, titulo: string, arquivo: string, formato: Formato, origem: string[]): Promise<Criacao> {
  const c: Criacao = {
    id: d.novoId(), empresaId: q.empresaId, tipo: 'slideshow', status: 'pronta', titulo: titulo || 'Slideshow', arquivos: [arquivo], formato,
    origem, creditos: 0, porUid: q.uid, criadoEm: d.agora(),
  };
  await d.repo.salvarCriacao(c);
  return c;
}

/** Firestore não aceita undefined. */
export function limparIndefinidos<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
