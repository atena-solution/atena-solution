import { rota, corpo } from '@/lib/api/rota';
import { novoId } from '@/lib/dados/empresa';
import { ErroHttp } from '@/lib/auth/erros';
import { validarContato } from '@/lib/base/validar';
import { etapasDaEmpresa, filtrarContatos } from '@/lib/contatos/funil';
import type { Atividade, Contato } from '@/lib/tipos';

export const GET = rota(undefined, async (req, { dados }) => {
  const u = new URL(req.url);
  const lista = await dados.listar<Contato>('contatos');
  const filtrados = filtrarContatos(lista, {
    busca: u.searchParams.get('busca') ?? undefined,
    etapa: u.searchParams.get('etapa') ?? undefined,
    etiqueta: u.searchParams.get('etiqueta') ?? undefined,
    origem: u.searchParams.get('origem') ?? undefined,
    responsavelUid: u.searchParams.get('responsavel') ?? undefined,
  }).sort((a, b) => b.ultimaInteracaoEm.localeCompare(a.ultimaInteracaoEm));
  const limite = Math.min(Number(u.searchParams.get('limite')) || 2000, 2000);
  return Response.json({ contatos: filtrados.slice(0, limite), total: filtrados.length });
});

export const POST = rota(undefined, async (req, { dados, sessao }) => {
  const v = validarContato(await corpo(req));
  if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
  const existentes = await dados.listar<Contato>('contatos');
  if (existentes.some((c) => c.telefone === v.valor.telefone)) throw new ErroHttp(409, 'Já existe um contato com esse telefone.');
  const empresa = await dados.obterEmpresa();
  const etapas = etapasDaEmpresa(empresa?.etapas);
  const agora = new Date().toISOString();
  const contato: Contato = {
    id: novoId('ct_'),
    empresaId: sessao.empresaId,
    nome: v.valor.nome!,
    telefone: v.valor.telefone!,
    ...(v.valor.email ? { email: v.valor.email } : {}),
    origem: v.valor.origem ?? 'Manual',
    etapa: v.valor.etapa && etapas.some((e) => e.id === v.valor.etapa) ? v.valor.etapa : etapas[0].id,
    etiquetas: v.valor.etiquetas ?? [],
    ...(v.valor.responsavelUid ? { responsavelUid: v.valor.responsavelUid } : {}),
    ultimaInteracaoEm: agora,
    criadoEm: agora,
    campos: v.valor.campos ?? {},
  };
  await dados.gravar('contatos', contato.id, contato);
  const atividade: Atividade = { id: novoId('at_'), contatoId: contato.id, tipo: 'nota', resumo: 'Contato criado', quando: agora, porUid: sessao.uid };
  await dados.gravar('atividades', atividade.id, atividade);
  return Response.json({ contato }, { status: 201 });
});
