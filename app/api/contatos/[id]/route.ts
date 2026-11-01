import { rota, corpo } from '@/lib/api/rota';
import { novoId } from '@/lib/dados/empresa';
import { ErroHttp } from '@/lib/auth/erros';
import { validarContato } from '@/lib/base/validar';
import { etapasDaEmpresa, linhaDoTempo, moverEtapa } from '@/lib/contatos/funil';
import type { Agendamento, Atividade, Contato } from '@/lib/tipos';

/** Ficha do contato: dados, linha do tempo e agendamentos. */
export const GET = rota<{ id: string }>(undefined, async (_req, { dados, params }) => {
  const contato = await dados.obter<Contato>('contatos', params.id);
  if (!contato) throw new ErroHttp(404, 'Contato não encontrado.');
  const atividades = linhaDoTempo(await dados.listar<Atividade>('atividades'), contato.id);
  const agendamentos = (await dados.listar<Agendamento>('agendamentos'))
    .filter((a) => a.contatoId === contato.id)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  return Response.json({ contato, atividades, agendamentos });
});

export const PATCH = rota<{ id: string }>(undefined, async (req, { dados, params, sessao }) => {
  const atual = await dados.obter<Contato>('contatos', params.id);
  if (!atual) throw new ErroHttp(404, 'Contato não encontrado.');
  const v = validarContato(await corpo(req), true);
  if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
  const { etapa, ...resto } = v.valor;
  if (resto.telefone && resto.telefone !== atual.telefone) {
    const outros = await dados.listar<Contato>('contatos');
    if (outros.some((c) => c.id !== atual.id && c.telefone === resto.telefone)) throw new ErroHttp(409, 'Já existe um contato com esse telefone.');
  }
  let contato: Contato = { ...atual, ...resto, id: atual.id, empresaId: atual.empresaId };
  if (etapa && etapa !== atual.etapa) {
    const empresa = await dados.obterEmpresa();
    const etapas = etapasDaEmpresa(empresa?.etapas);
    if (!etapas.some((e) => e.id === etapa)) throw new ErroHttp(400, 'Etapa não existe.');
    const r = moverEtapa(contato, etapa, etapas, { uid: sessao.uid }, new Date(), () => novoId('at_'));
    contato = r.contato;
    if (r.atividade) await dados.gravar('atividades', r.atividade.id, r.atividade);
  }
  await dados.gravar('contatos', contato.id, JSON.parse(JSON.stringify(contato)));
  return Response.json({ contato });
});

export const DELETE = rota<{ id: string }>(['dono', 'gestor'], async (_req, { dados, params }) => {
  await dados.apagar('contatos', params.id);
  return Response.json({ ok: true });
});
