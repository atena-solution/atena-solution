// Contexto das rotas do Estúdio: login da Base (exigirEmpresa), dados da empresa e dependências.
import { NextResponse } from 'next/server';
import type { EmpresaResumo, Resposta } from '@/lib/estudio/api';
import { dependencias } from '@/lib/estudio/dependencias';
import type { Dependencias, Quem } from '@/lib/estudio/servico';
import { exigirEmpresa } from '@/lib/auth/servidor';
import { ErroHttp } from '@/lib/auth/erros';
import { banco } from '@/lib/dados';
import { daEmpresa } from '@/lib/dados/empresa';
import type { Sessao } from '@/lib/tipos';
import { ForaDoPlano, exigirAba, usoDaEmpresa } from '@/lib/planos/portao';
import { gerarTextoPost } from '@/lib/estudio/texto-ia';

export interface Contexto {
  quem: Quem;
  sessao: Sessao;
  empresa: EmpresaResumo;
  d: Dependencias;
}

export async function contexto(req: Request, opcoes: { gera?: boolean } = {}): Promise<Contexto> {
  const sessao = await exigirEmpresa(req);
  const e = await daEmpresa(await banco(), sessao.empresaId).obterEmpresa();
  if (!e) throw new ErroHttp(404, 'Empresa não encontrada.');
  // Gerar = escrever: precisa do Estúdio no plano e da conta em dia (o saldo de créditos é checado depois).
  if (opcoes.gera) await exigirAba(sessao.empresaId, 'estudio', 'escrever');
  return {
    quem: { empresaId: sessao.empresaId, uid: sessao.uid },
    sessao,
    empresa: { nome: e.nome, segmento: e.segmento, marca: e.marca },
    d: medirUso(await dependencias(), usoDaEmpresa(sessao.empresaId)),
  };
}

/** Registra o uso de IA (custo no /admin) de cada geração. */
export function medirUso(d: Dependencias, usar: ReturnType<typeof usoDaEmpresa>): Dependencias {
  return {
    ...d,
    async gerarImagens(p) {
      const r = await d.gerarImagens(p);
      if (r.imagens.length) await usar('gemini-imagem', { imagens: r.imagens.length });
      return r;
    },
    async iniciarVideo(p) {
      const r = await d.iniciarVideo(p);
      await usar('gemini-video', { segundosVideo: p.duracaoSeg });
      return r;
    },
    gerarTextoPost: d.gerarTextoPost === gerarTextoPost ? (p) => gerarTextoPost(p, (m, u) => usar(m, u)) : d.gerarTextoPost,
  };
}

export function responder(r: Resposta) {
  return NextResponse.json(r.corpo, { status: r.status });
}

export async function rota(req: Request, fn: (c: Contexto) => Promise<Resposta>, opcoes: { gera?: boolean } = {}) {
  try {
    return responder(await fn(await contexto(req, opcoes)));
  } catch (e) {
    if (e instanceof ForaDoPlano) return NextResponse.json({ erro: e.message, motivo: e.decisao.motivo }, { status: 402 });
    if (e instanceof ErroHttp) return NextResponse.json({ erro: e.message }, { status: e.status });
    console.error('[estudio]', e);
    return NextResponse.json({ erro: 'Erro inesperado. Tente de novo.' }, { status: 500 });
  }
}

export async function corpoJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
