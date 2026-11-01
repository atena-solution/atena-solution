import { rota, corpo } from '@/lib/api/rota';
import { banco } from '@/lib/dados';
import { ErroHttp } from '@/lib/auth/erros';
import { convidar } from '@/lib/base/empresas';
import { validarEmail, validarPapel } from '@/lib/base/validar';
import type { Convite, Membro } from '@/lib/tipos';

export const GET = rota(undefined, async (_req, { dados, sessao }) => {
  const membros = (await dados.listar<Membro>('membros')).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const podeVerConvites = sessao.papel === 'dono' || sessao.papel === 'gestor';
  const convites = podeVerConvites ? await dados.listar<Convite>('convites') : [];
  return Response.json({ membros, convites });
});

/** Convida por e-mail. Quando a pessoa entrar com esse e-mail, vira membro com o papel escolhido. */
export const POST = rota(['dono', 'gestor'], async (req, { dados, sessao }) => {
  const e = await corpo(req);
  const email = validarEmail(e.email);
  if (!email) throw new ErroHttp(400, 'E-mail inválido.');
  if (!validarPapel(e.papel)) throw new ErroHttp(400, 'Escolha o papel.');
  if (e.papel === 'dono' && sessao.papel !== 'dono') throw new ErroHttp(403, 'Só um dono convida outro dono.');
  const membros = await dados.listar<Membro>('membros');
  if (membros.some((m) => m.email === email)) throw new ErroHttp(409, 'Essa pessoa já está na equipe.');
  const convite = await convidar(await banco(), sessao.empresaId, email, e.papel, sessao.uid);
  return Response.json({ convite }, { status: 201 });
});
