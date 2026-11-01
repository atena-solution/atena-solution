import { rota, corpo } from './rota';
import { novoId } from '../dados/empresa';
import { ErroHttp } from '../auth/erros';
import type { Colecao, Papel } from '../tipos';
import type { Resultado } from '../base/validar';

/** Rotas de lista/criação e item/edição/remoção para coleções simples (serviços, profissionais). */
export function crudSimples<T extends { id: string }>(opc: {
  colecao: Colecao;
  chaveLista: string;
  validar: (e: Record<string, unknown>) => Resultado<Omit<T, 'id'>>;
  escrita: Papel[];
  prefixoId: string;
  ordenar?: (a: T, b: T) => number;
}) {
  const lista = {
    GET: rota(undefined, async (_req, { dados }) => {
      const itens = await dados.listar<T>(opc.colecao);
      if (opc.ordenar) itens.sort(opc.ordenar);
      return Response.json({ [opc.chaveLista]: itens });
    }),
    POST: rota(opc.escrita, async (req, { dados }) => {
      const v = opc.validar(await corpo(req));
      if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
      const item = { ...v.valor, id: novoId(opc.prefixoId) } as T;
      await dados.gravar(opc.colecao, item.id, item);
      return Response.json({ item }, { status: 201 });
    }),
  };
  const item = {
    PATCH: rota<{ id: string }>(opc.escrita, async (req, { dados, params }) => {
      const atual = await dados.obter<T>(opc.colecao, params.id);
      if (!atual) throw new ErroHttp(404, 'Não encontrado.');
      const v = opc.validar({ ...atual, ...(await corpo(req)) });
      if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
      const novo = { ...v.valor, id: atual.id } as T;
      await dados.gravar(opc.colecao, atual.id, novo);
      return Response.json({ item: novo });
    }),
    DELETE: rota<{ id: string }>(opc.escrita, async (_req, { dados, params }) => {
      await dados.apagar(opc.colecao, params.id);
      return Response.json({ ok: true });
    }),
  };
  return { lista, item };
}
