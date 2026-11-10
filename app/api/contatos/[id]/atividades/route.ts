import { rota, corpo } from '@/lib/api/rota';
import { novoId } from '@/lib/dados/empresa';
import { ErroHttp } from '@/lib/auth/erros';
import type { Atividade, Contato } from '@/lib/tipos';

/** Adiciona uma nota à linha do tempo do contato. */
export const POST = rota<{ id: string }>(undefined, async (req, { dados, params, sessao }) => {
  const contato = await dados.obter<Contato>('contatos', params.id);
  if (!contato) throw new ErroHttp(404, 'Contato não encontrado.');
  const e = await corpo(req);
  const resumo = typeof e.resumo === 'string' ? e.resumo.trim().slice(0, 2000) : '';
  if (!resumo) throw new ErroHttp(400, 'Escreva a nota.');
  const quando = new Date().toISOString();
  const atividade: Atividade = { id: novoId('at_'), contatoId: contato.id, tipo: 'nota', resumo, quando, porUid: sessao.uid };
  await dados.gravar('atividades', atividade.id, atividade);
  await dados.mesclar<Contato>('contatos', contato.id, { ultimaInteracaoEm: quando });
  return Response.json({ atividade }, { status: 201 });
});
