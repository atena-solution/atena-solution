import { rota, corpo } from '@/lib/api/rota';
import { ErroHttp } from '@/lib/auth/erros';
import { podeAlterarMembro } from '@/lib/auth/permissoes';
import { validarPapel } from '@/lib/base/validar';
import type { Membro } from '@/lib/tipos';

/** Muda papel ou ativa/desativa alguém da equipe. */
export const PATCH = rota<{ uid: string }>(['dono', 'gestor'], async (req, { dados, sessao, params }) => {
  const alvo = await dados.obter<Membro>('membros', params.uid);
  if (!alvo) throw new ErroHttp(404, 'Pessoa não encontrada.');
  const e = await corpo(req);
  const novoPapel = e.papel === undefined ? alvo.papel : e.papel;
  if (!validarPapel(novoPapel)) throw new ErroHttp(400, 'Papel inválido.');
  const ativo = typeof e.ativo === 'boolean' ? e.ativo : alvo.ativo;
  const todos = await dados.listar<Membro>('membros');
  // desativar o último dono também é proibido
  const papelEfetivo = ativo ? novoPapel : 'atendente';
  const ok = podeAlterarMembro(sessao.papel, alvo, todos, papelEfetivo);
  if (!ok.ok) throw new ErroHttp(403, ok.motivo);
  const nome = typeof e.nome === 'string' && e.nome.trim() ? e.nome.trim().slice(0, 80) : alvo.nome;
  const novo: Membro = { ...alvo, papel: novoPapel, ativo, nome };
  await dados.gravar('membros', alvo.uid, novo);
  return Response.json({ membro: novo });
});

export const DELETE = rota<{ uid: string }>(['dono', 'gestor'], async (_req, { dados, sessao, params }) => {
  const alvo = await dados.obter<Membro>('membros', params.uid);
  if (!alvo) throw new ErroHttp(404, 'Pessoa não encontrada.');
  const ok = podeAlterarMembro(sessao.papel, alvo, await dados.listar<Membro>('membros'), 'atendente');
  if (!ok.ok) throw new ErroHttp(403, ok.motivo);
  await dados.apagar('membros', alvo.uid);
  return Response.json({ ok: true });
});
