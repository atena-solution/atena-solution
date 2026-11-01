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

export interface Contexto {
  quem: Quem;
  sessao: Sessao;
  empresa: EmpresaResumo;
  d: Dependencias;
}

export async function contexto(req: Request): Promise<Contexto> {
  const sessao = await exigirEmpresa(req);
  const e = await daEmpresa(await banco(), sessao.empresaId).obterEmpresa();
  if (!e) throw new ErroHttp(404, 'Empresa não encontrada.');
  return {
    quem: { empresaId: sessao.empresaId, uid: sessao.uid },
    sessao,
    empresa: { nome: e.nome, segmento: e.segmento, marca: e.marca },
    d: await dependencias(),
  };
}

export function responder(r: Resposta) {
  return NextResponse.json(r.corpo, { status: r.status });
}

export async function rota(req: Request, fn: (c: Contexto) => Promise<Resposta>) {
  try {
    return responder(await fn(await contexto(req)));
  } catch (e) {
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
