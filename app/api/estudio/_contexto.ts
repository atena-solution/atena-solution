// Contexto das rotas do Estúdio: quem está chamando (empresa/usuário) + dados da empresa.
// ENQUANTO a Base (sessão A) não está na branch: no modo SIMULAR=1 usa uma empresa de demonstração.
// Na junção: trocar por exigirEmpresa(req, ['dono','gestor']) de lib/auth e ler empresas/{id}.
import { NextResponse } from 'next/server';
import type { EmpresaResumo, Resposta } from '@/lib/estudio/api';
import { dependencias } from '@/lib/estudio/dependencias';
import type { Dependencias, Quem } from '@/lib/estudio/servico';

export interface Contexto {
  quem: Quem;
  empresa: EmpresaResumo;
  d: Dependencias;
}

export class NaoAutorizado extends Error {}

export async function contexto(req: Request): Promise<Contexto> {
  if (process.env.SIMULAR === '1') {
    const empresaId = req.headers.get('x-empresa-demo') || 'demo';
    return {
      quem: { empresaId, uid: 'demo-uid' },
      empresa: { nome: 'Barbearia Demo', segmento: 'Barbearia', marca: { cores: { primaria: '#3B5BDB', secundaria: '#7048E8' }, tom: 'próximo e confiante' } },
      d: dependencias(),
    };
  }
  throw new NaoAutorizado('Login ainda não ligado ao Estúdio.');
}

export function responder(r: Resposta) {
  return NextResponse.json(r.corpo, { status: r.status });
}

export async function rota(req: Request, fn: (c: Contexto) => Promise<Resposta>) {
  try {
    return responder(await fn(await contexto(req)));
  } catch (e) {
    if (e instanceof NaoAutorizado) return NextResponse.json({ erro: 'Entre na sua conta.' }, { status: 401 });
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
