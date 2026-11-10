import { rota, corpo } from '@/lib/api/rota';
import { ErroHttp } from '@/lib/auth/erros';
import { validarEmpresa } from '@/lib/base/validar';
import { validarEtapas } from '@/lib/contatos/funil';
import type { Empresa, EtapaFunil } from '@/lib/tipos';

export const GET = rota(undefined, async (_req, { dados }) => {
  const empresa = await dados.obterEmpresa();
  if (!empresa) throw new ErroHttp(404, 'Empresa não encontrada.');
  return Response.json({ empresa });
});

/** Atualiza dados da empresa (onboarding/configurações). Plano e créditos NÃO passam por aqui. */
export const PATCH = rota(['dono', 'gestor'], async (req, { dados }) => {
  const e = await corpo(req);
  const v = validarEmpresa(e, true);
  if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
  const mudancas: Partial<Empresa> = { ...v.valor };
  if ('etapas' in e) {
    const etapas = (Array.isArray(e.etapas) ? e.etapas : []).map((x: Partial<EtapaFunil>) => ({
      id: String(x.id ?? ''),
      nome: String(x.nome ?? '').trim().slice(0, 40),
      ...(x.cor ? { cor: String(x.cor).slice(0, 7) } : {}),
    }));
    const erro = validarEtapas(etapas);
    if (erro) throw new ErroHttp(400, erro);
    mudancas.etapas = etapas;
  }
  if (typeof e.onboardingConcluido === 'boolean') mudancas.onboardingConcluido = e.onboardingConcluido;
  await dados.mesclarEmpresa(mudancas);
  return Response.json({ empresa: await dados.obterEmpresa() });
});
