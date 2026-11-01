import { describe, expect, it } from 'vitest';
import { RepositorioMemoria, ErroEmpresa } from '../../lib/estudio/repositorio';
import { gerarFotos, gerarPost, iniciarGeracaoVideo, atualizarVideo, registrarSlideshow, editarTextosPost, SemCreditos, type Dependencias } from '../../lib/estudio/servico';
import { simularImagens, videoSimulado } from '../../lib/integracoes/imagem';
import { CUSTO_CREDITOS } from '../../lib/estudio/creditos';
import { KIT_PADRAO } from '../../lib/estudio/marca';
import { lerRespostaLegenda } from '../../lib/estudio/legenda';
import { simularResposta } from '../../lib/estudio/texto-ia';

const FOTO = 'data:image/jpeg;base64,AAAA';

function deps(saldos: Record<string, number>, over: Partial<Dependencias> = {}): Dependencias {
  let n = 0;
  return {
    repo: new RepositorioMemoria(saldos),
    gerarImagens: async (p) => simularImagens(p),
    iniciarVideo: async () => ({ operacao: 'op-1' }),
    consultarVideo: async () => ({ pronto: true, url: videoSimulado('9:16') }),
    gerarTextoPost: async (p) => lerRespostaLegenda(simularResposta(p), p.marca.evitar),
    agora: () => '2026-11-01T12:00:00Z',
    novoId: () => `id${++n}`,
    ...over,
  };
}
const q = { empresaId: 'e1', uid: 'u1' };
const fotoBase = { estilo: 'fundo-limpo' as const, formato: '1:1' as const, produto: 'tênis', fotos: [FOTO], quantidade: 3 };

describe('fotos', () => {
  it('debita, gera e salva na galeria da empresa', async () => {
    const d = deps({ e1: 20 });
    const c = await gerarFotos(d, q, KIT_PADRAO, fotoBase);
    expect(c.status).toBe('pronta');
    expect(c.arquivos).toHaveLength(3);
    expect(await d.repo.saldo('e1')).toBe(20 - CUSTO_CREDITOS.foto * 3);
    expect((await d.repo.listarCriacoes('e1')).map((x) => x.id)).toEqual([c.id]);
    expect(c.prompt).toContain('idênticos');
  });

  it('sem crédito não gera nada', async () => {
    let chamou = false;
    const d = deps({ e1: 1 }, { gerarImagens: async (p) => ((chamou = true), simularImagens(p)) });
    await expect(gerarFotos(d, q, KIT_PADRAO, fotoBase)).rejects.toBeInstanceOf(SemCreditos);
    expect(chamou).toBe(false);
    expect(await d.repo.saldo('e1')).toBe(1);
  });

  it('falha total devolve tudo', async () => {
    const d = deps({ e1: 20 }, { gerarImagens: async () => { throw new Error('fora do ar'); } });
    const c = await gerarFotos(d, q, KIT_PADRAO, fotoBase);
    expect(c.status).toBe('falhou');
    expect(c.creditos).toBe(0);
    expect(await d.repo.saldo('e1')).toBe(20);
    const ext = await d.repo.extrato('e1');
    expect(ext.map((l) => l.tipo)).toEqual(['debito', 'devolucao']);
  });

  it('falha parcial devolve só o que faltou', async () => {
    const d = deps({ e1: 20 }, { gerarImagens: async (p) => ({ imagens: simularImagens(p).imagens.slice(0, 2), falhas: 1, erros: ['x'] }) });
    const c = await gerarFotos(d, q, KIT_PADRAO, fotoBase);
    expect(c.status).toBe('pronta');
    expect(c.creditos).toBe(CUSTO_CREDITOS.foto * 2);
    expect(await d.repo.saldo('e1')).toBe(20 - CUSTO_CREDITOS.foto * 2);
  });
});

describe('post', () => {
  const base = { modelo: 'promocao' as const, formato: '4:5' as const, tema: 'Black Friday', oferta: '20% off', nomeEmpresa: 'Topetes', segmento: 'barbearia' };
  it('gera fundo + texto separado (texto não vai para a IA de imagem)', async () => {
    let promptImagem = '';
    const d = deps({ e1: 10 }, { gerarImagens: async (p) => ((promptImagem = p.prompt), simularImagens(p)) });
    const c = await gerarPost(d, q, KIT_PADRAO, base);
    expect(c.status).toBe('pronta');
    expect(c.arte?.textos.titulo).toBeTruthy();
    expect(c.legenda).toContain('20% off');
    expect(promptImagem).toContain('NÃO pode conter nenhum texto');
    const ed = await editarTextosPost(d, q, c.id, { titulo: 'Novo título' });
    expect(ed.arte?.textos.titulo).toBe('Novo título');
    expect(await d.repo.saldo('e1')).toBe(10 - CUSTO_CREDITOS.post);
  });
  it('antes/depois exige 2 fotos reais e não chama IA de imagem', async () => {
    let chamou = false;
    const d = deps({ e1: 10 }, { gerarImagens: async (p) => ((chamou = true), simularImagens(p)) });
    await expect(gerarPost(d, q, KIT_PADRAO, { ...base, modelo: 'antes-depois' })).rejects.toThrow();
    const c = await gerarPost(d, q, KIT_PADRAO, { ...base, modelo: 'antes-depois', fotosReais: [FOTO, FOTO] });
    expect(c.status).toBe('pronta');
    expect(chamou).toBe(false);
  });
  it('falha no texto devolve créditos', async () => {
    const d = deps({ e1: 10 }, { gerarTextoPost: async () => { throw new Error('x'); } });
    const c = await gerarPost(d, q, KIT_PADRAO, base);
    expect(c.status).toBe('falhou');
    expect(await d.repo.saldo('e1')).toBe(10);
  });
});

describe('vídeo', () => {
  const v = { formato: '9:16' as const, duracaoSeg: 6, movimento: 'giro-suave' as const, produto: 'perfume', foto: FOTO };
  it('inicia, consulta e fica pronto', async () => {
    const d = deps({ e1: 30 });
    const c = await iniciarGeracaoVideo(d, q, v);
    expect(c.status).toBe('gerando');
    expect(await d.repo.saldo('e1')).toBe(30 - CUSTO_CREDITOS.video);
    const f = await atualizarVideo(d, q, c.id);
    expect(f.status).toBe('pronta');
    expect(f.operacao).toBeUndefined();
  });
  it('erro no vídeo devolve créditos uma vez só', async () => {
    const d = deps({ e1: 30 }, { consultarVideo: async () => ({ pronto: true, erro: 'bloqueado' }) });
    const c = await iniciarGeracaoVideo(d, q, v);
    const f = await atualizarVideo(d, q, c.id);
    expect(f.status).toBe('falhou');
    await atualizarVideo(d, q, c.id);
    expect(await d.repo.saldo('e1')).toBe(30);
  });
  it('ainda processando continua gerando', async () => {
    const d = deps({ e1: 30 }, { consultarVideo: async () => ({ pronto: false }) });
    const c = await iniciarGeracaoVideo(d, q, v);
    expect((await atualizarVideo(d, q, c.id)).status).toBe('gerando');
  });
  it('slideshow é grátis', async () => {
    const d = deps({ e1: 0 });
    const c = await registrarSlideshow(d, q, 'Coleção', 'blob', '9:16', [FOTO]);
    expect(c.creditos).toBe(0);
    expect(await d.repo.extrato('e1')).toEqual([]);
  });
});

describe('isolamento por empresa', () => {
  it('outra empresa não vê, não edita e não gasta crédito alheio', async () => {
    const d = deps({ e1: 20, e2: 5 });
    const c = await gerarFotos(d, q, KIT_PADRAO, { ...fotoBase, quantidade: 1 });
    expect(await d.repo.listarCriacoes('e2')).toEqual([]);
    expect(await d.repo.obterCriacao('e2', c.id)).toBeNull();
    await expect(atualizarVideo(d, { empresaId: 'e2', uid: 'x' }, c.id)).rejects.toThrow();
    expect(await d.repo.saldo('e2')).toBe(5);
    expect(await d.repo.extrato('e2')).toEqual([]);
  });
  it('repositório recusa gravar pauta de outra empresa', async () => {
    const r = new RepositorioMemoria();
    await expect(r.salvarPautas('e1', [{ id: 'p', empresaId: 'e2', data: '2026-11-01', tema: 't', modelo: 'novidade', motivo: 'm', status: 'rascunho' }])).rejects.toBeInstanceOf(ErroEmpresa);
  });
  it('débitos concorrentes não deixam saldo negativo', async () => {
    const d = deps({ e1: CUSTO_CREDITOS.foto * 2 });
    const r = await Promise.allSettled([1, 2, 3].map(() => gerarFotos(d, q, KIT_PADRAO, { ...fotoBase, quantidade: 1 })));
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(2);
    expect(await d.repo.saldo('e1')).toBe(0);
  });
});
