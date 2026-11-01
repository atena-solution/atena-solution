// Controladores das rotas /api/estudio/*. Funções puras de entrada → {status, corpo}.
// A rota do Next só autentica (exigirEmpresa da Base), chama aqui e devolve o JSON.
import { mudarStatusPauta, sugerirMes, SEGMENTOS, type Pauta, type Segmento, type StatusPauta } from './calendario';
import { CUSTO_CREDITOS, MAX_VARIACOES, resumoExtrato } from './creditos';
import { filtrarGaleria } from './galeria';
import { kitDaEmpresa, normalizarKit, validarKit, KIT_PADRAO } from './marca';
import { FORMATOS } from './prompts';
import { editarTextosPost, gerarFotos, gerarPost, iniciarGeracaoVideo, atualizarVideo, registrarSlideshow, SemCreditos, type Dependencias, type Quem } from './servico';
import { ErroEmpresa } from './repositorio';
import type { EstiloFoto, Formato, KitMarca, ModeloPost, TipoCriacao } from './tipos';

export type Resposta = { status: number; corpo: unknown };

/** Dados da empresa que o Estúdio precisa (vêm de empresas/{id} pela Base). */
export interface EmpresaResumo {
  nome: string;
  segmento: string;
  marca?: { logoUrl?: string; cores?: { primaria?: string; secundaria?: string }; tom?: string };
}

const ok = (corpo: unknown, status = 200): Resposta => ({ status, corpo });
const erro = (status: number, mensagem: string, extra: object = {}): Resposta => ({ status, corpo: { erro: mensagem, ...extra } });

const ESTILOS: EstiloFoto[] = ['fundo-limpo', 'ambientada', 'modelo', 'flat-lay', 'detalhe'];
const MODELOS: ModeloPost[] = ['promocao', 'novidade', 'depoimento', 'antes-depois'];
const TIPOS: TipoCriacao[] = ['foto', 'post', 'video', 'slideshow'];
const MAX_FOTO_BYTES = 8 * 1024 * 1024;

function texto(v: unknown, max = 300): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function umDe<T extends string>(v: unknown, opcoes: readonly T[]): T | null {
  return typeof v === 'string' && (opcoes as readonly string[]).includes(v) ? (v as T) : null;
}
function fotos(v: unknown, min: number, max: number): string[] | string {
  if (!Array.isArray(v)) return min > 0 ? `Envie de ${min} a ${max} fotos.` : [];
  if (v.length < min || v.length > max) return `Envie de ${min} a ${max} fotos.`;
  for (const f of v) {
    if (typeof f !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(f)) return 'Use fotos JPG, PNG ou WEBP.';
    if (f.length * 0.75 > MAX_FOTO_BYTES) return 'Cada foto pode ter até 8 MB.';
  }
  return v as string[];
}

async function tratar(fn: () => Promise<Resposta>): Promise<Resposta> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SemCreditos) return erro(402, e.message, { falta: e.falta });
    if (e instanceof ErroEmpresa) return erro(404, 'Não encontrado.');
    const msg = e instanceof Error ? e.message : 'Erro inesperado.';
    return erro(400, msg);
  }
}

async function kitAtual(d: Dependencias, q: Quem, emp: EmpresaResumo): Promise<KitMarca> {
  return (await d.repo.lerKit(q.empresaId)) ?? kitDaEmpresa(emp.marca);
}

// ---------- Kit da marca ----------

export const obterKit = (d: Dependencias, q: Quem, emp: EmpresaResumo) => tratar(async () => ok({ kit: await kitAtual(d, q, emp) }));

export const salvarKit = (d: Dependencias, q: Quem, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Partial<KitMarca>;
    const kit: KitMarca = {
      logoUrl: texto(b.logoUrl, 2_000_000),
      cores: { primaria: texto(b.cores?.primaria, 9), secundaria: texto(b.cores?.secundaria, 9) },
      fontes: { titulo: texto(b.fontes?.titulo, 40) || KIT_PADRAO.fontes.titulo, texto: texto(b.fontes?.texto, 40) || KIT_PADRAO.fontes.texto },
      tom: texto(b.tom, 120),
      publico: texto(b.publico, 200),
      evitar: Array.isArray(b.evitar) ? b.evitar.map((x) => texto(x, 40)) : [],
    };
    const erros = validarKit(kit);
    if (Object.keys(erros).length) return erro(422, 'Confira os campos marcados.', { campos: erros });
    const final = normalizarKit(kit);
    await d.repo.salvarKit(q.empresaId, final);
    return ok({ kit: final });
  });

// ---------- Foto ----------

export const criarFoto = (d: Dependencias, q: Quem, emp: EmpresaResumo, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const estilo = umDe(b.estilo, ESTILOS);
    const formato = umDe(b.formato, Object.keys(FORMATOS) as Formato[]);
    const fs = fotos(b.fotos, 1, 5);
    const quantidade = Number(b.quantidade ?? 2);
    if (!estilo) return erro(422, 'Escolha um estilo.');
    if (!formato) return erro(422, 'Escolha um formato.');
    if (typeof fs === 'string') return erro(422, fs);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_VARIACOES) return erro(422, `Escolha de 1 a ${MAX_VARIACOES} variações.`);
    const c = await gerarFotos(d, q, await kitAtual(d, q, emp), { estilo, formato, fotos: fs, quantidade, produto: texto(b.produto, 120), detalhes: texto(b.detalhes, 300) || undefined });
    return ok({ criacao: c, saldo: await d.repo.saldo(q.empresaId) }, 201);
  });

// ---------- Post ----------

export const criarPost = (d: Dependencias, q: Quem, emp: EmpresaResumo, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const modelo = umDe(b.modelo, MODELOS);
    const formato = umDe(b.formato, Object.keys(FORMATOS) as Formato[]);
    const tema = texto(b.tema, 200);
    const fs = fotos(b.fotosReais, 0, 2);
    if (!modelo) return erro(422, 'Escolha um modelo de post.');
    if (!formato) return erro(422, 'Escolha um formato.');
    if (!tema) return erro(422, 'Diga o tema ou a oferta do post.');
    if (typeof fs === 'string') return erro(422, fs);
    if (modelo === 'antes-depois' && fs.length < 2) return erro(422, 'Antes/depois só com 2 fotos reais (antes e depois).');
    let pautaId: string | undefined;
    if (typeof b.pautaId === 'string') {
      const p = await d.repo.obterPauta(q.empresaId, b.pautaId);
      if (!p) return erro(404, 'Pauta não encontrada.');
      pautaId = p.id;
    }
    const c = await gerarPost(d, q, await kitAtual(d, q, emp), {
      modelo, formato, tema, oferta: texto(b.oferta, 120) || undefined, fotosReais: fs.length ? fs : undefined,
      nomeEmpresa: emp.nome, segmento: emp.segmento, pautaId, usarFotoComoFundo: b.usarFotoComoFundo === true && fs.length > 0,
    });
    if (pautaId && c.status === 'pronta') {
      const p = await d.repo.obterPauta(q.empresaId, pautaId);
      if (p) await d.repo.salvarPautas(q.empresaId, [mudarStatusPauta(p, 'arte-gerada', d.agora(), c.id)]);
    }
    return ok({ criacao: c, saldo: await d.repo.saldo(q.empresaId) }, 201);
  });

export const editarPost = (d: Dependencias, q: Quem, id: string, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const t = (b.textos ?? {}) as Record<string, unknown>;
    const titulo = texto(t.titulo, 60);
    if (!titulo) return erro(422, 'O título não pode ficar vazio.');
    const c = await editarTextosPost(d, q, id, { titulo, subtitulo: texto(t.subtitulo, 90) || undefined, chamada: texto(t.chamada, 24) || undefined, autor: texto(t.autor, 40) || undefined }, typeof b.legenda === 'string' ? b.legenda.slice(0, 2200) : undefined);
    return ok({ criacao: c });
  });

// ---------- Vídeo ----------

export const criarVideo = (d: Dependencias, q: Quem, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const fs = fotos(b.foto ? [b.foto] : [], 1, 1);
    const formato = umDe(b.formato, ['9:16', '1:1'] as const);
    const movimento = umDe(b.movimento, ['giro-suave', 'aproximar', 'luz-passando', 'parallax'] as const);
    const duracaoSeg = Number(b.duracaoSeg ?? 6);
    if (typeof fs === 'string') return erro(422, 'Envie 1 foto (JPG, PNG ou WEBP).');
    if (!formato) return erro(422, 'Escolha vertical ou quadrado.');
    if (!movimento) return erro(422, 'Escolha o movimento.');
    if (!Number.isInteger(duracaoSeg) || duracaoSeg < 5 || duracaoSeg > 8) return erro(422, 'Duração de 5 a 8 segundos.');
    const c = await iniciarGeracaoVideo(d, q, { foto: fs[0], formato, movimento, duracaoSeg, produto: texto(b.produto, 120) });
    return ok({ criacao: c, saldo: await d.repo.saldo(q.empresaId) }, 201);
  });

export const consultarVideo = (d: Dependencias, q: Quem, id: string) => tratar(async () => ok({ criacao: await atualizarVideo(d, q, id) }));

export const salvarSlideshow = (d: Dependencias, q: Quem, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const arquivo = texto(b.arquivo, 40_000_000);
    if (!/^data:video\/(webm|mp4)/.test(arquivo)) return erro(422, 'Vídeo inválido.');
    const formato = umDe(b.formato, Object.keys(FORMATOS) as Formato[]) ?? '9:16';
    const c = await registrarSlideshow(d, q, texto(b.titulo, 80), arquivo, formato, []);
    return ok({ criacao: c }, 201);
  });

// ---------- Galeria ----------

export const listarGaleria = (d: Dependencias, q: Quem, params: URLSearchParams) =>
  tratar(async () => {
    const tipo = umDe(params.get('tipo'), TIPOS) ?? 'todos';
    const formato = umDe(params.get('formato'), Object.keys(FORMATOS) as Formato[]) ?? 'todos';
    const lista = filtrarGaleria(await d.repo.listarCriacoes(q.empresaId), q.empresaId, { tipo, formato, busca: params.get('busca') ?? '' });
    return ok({ criacoes: lista });
  });

export const obterCriacao = (d: Dependencias, q: Quem, id: string) =>
  tratar(async () => {
    const c = await d.repo.obterCriacao(q.empresaId, id);
    return c ? ok({ criacao: c }) : erro(404, 'Não encontrado.');
  });

export const apagarCriacao = (d: Dependencias, q: Quem, id: string) =>
  tratar(async () => ((await d.repo.apagarCriacao(q.empresaId, id)) ? ok({ ok: true }) : erro(404, 'Não encontrado.')));

// ---------- Calendário ----------

const MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const listarCalendario = (d: Dependencias, q: Quem, mes: string) =>
  tratar(async () => {
    if (!MES.test(mes)) return erro(422, 'Mês inválido (use AAAA-MM).');
    return ok({ pautas: await d.repo.listarPautas(q.empresaId, mes) });
  });

export const sugerirCalendario = (d: Dependencias, q: Quem, emp: EmpresaResumo, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const m = MES.exec(texto(b.mes, 7));
    if (!m) return erro(422, 'Mês inválido (use AAAA-MM).');
    const segmento = (umDe(b.segmento, Object.keys(SEGMENTOS) as Segmento[]) ?? segmentoDe(emp.segmento));
    const dias = Array.isArray(b.diasDaSemana) ? b.diasDaSemana.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6) : undefined;
    const existentes = await d.repo.listarPautas(q.empresaId, m[0]);
    if (existentes.length && b.substituir !== true) return erro(409, 'Este mês já tem pautas. Confirme para substituir os rascunhos.');
    const manter = existentes.filter((p) => p.status !== 'rascunho');
    const novas = sugerirMes({ ano: Number(m[1]), mes: Number(m[2]), segmento, empresaId: q.empresaId, diasDaSemana: dias?.length ? dias : undefined, gerarId: () => d.novoId() })
      .filter((p) => !manter.some((x) => x.data === p.data));
    for (const p of existentes) if (p.status === 'rascunho') await d.repo.apagarPauta(q.empresaId, p.id);
    await d.repo.salvarPautas(q.empresaId, novas);
    return ok({ pautas: await d.repo.listarPautas(q.empresaId, m[0]) }, 201);
  });

export const editarPauta = (d: Dependencias, q: Quem, id: string, corpo: unknown) =>
  tratar(async () => {
    const b = (corpo ?? {}) as Record<string, unknown>;
    const p = await d.repo.obterPauta(q.empresaId, id);
    if (!p) return erro(404, 'Pauta não encontrada.');
    let nova: Pauta = { ...p };
    const tema = texto(b.tema, 200);
    if (tema) nova.tema = tema;
    const modelo = umDe(b.modelo, MODELOS);
    if (modelo) nova.modelo = modelo;
    if (typeof b.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.data)) nova.data = b.data;
    const status = umDe(b.status, ['rascunho', 'arte-gerada', 'publicado'] as StatusPauta[]);
    if (status) nova = mudarStatusPauta(nova, status, d.agora());
    await d.repo.salvarPautas(q.empresaId, [nova]);
    return ok({ pauta: nova });
  });

// ---------- Créditos ----------

export const creditos = (d: Dependencias, q: Quem) =>
  tratar(async () => {
    const [saldo, extrato] = await Promise.all([d.repo.saldo(q.empresaId), d.repo.extrato(q.empresaId)]);
    const r = resumoExtrato(extrato, q.empresaId);
    return ok({ saldo, custos: CUSTO_CREDITOS, gasto: r.gasto, recarregado: r.recarregado, extrato: r.lancamentos.slice(0, 100) });
  });

export function segmentoDe(s: string): Segmento {
  const t = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/clinic|saude|odonto|dent|medic|fisio|psico/.test(t)) return 'clinica';
  if (/barbe/.test(t)) return 'barbearia';
  if (/estetic|beleza|salao|unha|cabel|spa/.test(t)) return 'estetica';
  if (/imob|corret/.test(t)) return 'imobiliaria';
  if (/escol|curso|educa|idioma/.test(t)) return 'escola';
  if (/restaur|lanch|pizz|cafe|padar|aliment|doce|confeit/.test(t)) return 'restaurante';
  if (/agenc|marketing|servic|consult/.test(t)) return 'agencia';
  if (/loja|varej|moda|roupa|calcad|acessor|ecommerce|e-commerce/.test(t)) return 'loja';
  return 'outro';
}
