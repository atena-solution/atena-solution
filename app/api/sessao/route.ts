import { banco, simulando } from '@/lib/dados';
import { juntar } from '@/lib/dados/banco';
import { obterSessao, identificar } from '@/lib/auth/servidor';
import { respostaDeErro } from '@/lib/auth/erros';
import { aceitarConvitePendente } from '@/lib/base/empresas';
import type { Empresa, Membro } from '@/lib/tipos';

/** Sessão do usuário logado: empresa atual, papel e lista de empresas. Sem empresa → onboarding. */
export async function GET(req: Request) {
  try {
    const ctx = { banco: await banco(), simulado: simulando() };
    let r = await obterSessao(req, ctx);
    if (!r.sessao && !r.usuario?.empresaAtual) {
      const aceitou = await aceitarConvitePendente(ctx.banco, await identificar(req, ctx));
      if (aceitou) r = await obterSessao(req, ctx);
    }
    if (!r.sessao) return Response.json({ sessao: null, identidade: r.id });
    const empresa = await ctx.banco.obter<Empresa>(juntar('empresas', r.sessao.empresaId));
    const membro = await ctx.banco.obter<Membro>(juntar('empresas', r.sessao.empresaId, 'membros', r.sessao.uid));
    const empresas = await Promise.all(
      (r.usuario?.empresas ?? []).map(async (id) => {
        const e = await ctx.banco.obter<Empresa>(juntar('empresas', id));
        return e ? { id, nome: e.nome } : null;
      }),
    );
    return Response.json({ sessao: r.sessao, empresa, membro, empresas: empresas.filter(Boolean) });
  } catch (e) {
    return respostaDeErro(e);
  }
}
