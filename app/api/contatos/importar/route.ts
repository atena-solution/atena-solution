import { rota, corpo } from '@/lib/api/rota';
import { novoId } from '@/lib/dados/empresa';
import { ErroHttp } from '@/lib/auth/erros';
import { importarContatosCsv } from '@/lib/contatos/csv';
import { etapasDaEmpresa } from '@/lib/contatos/funil';
import type { Contato } from '@/lib/tipos';

/** Importa contatos de um CSV (texto). `simular: true` só mostra o que aconteceria. */
export const POST = rota(['dono', 'gestor'], async (req, { dados, sessao }) => {
  const e = await corpo<{ csv?: string; simular?: boolean; origem?: string }>(req);
  if (typeof e.csv !== 'string' || !e.csv.trim()) throw new ErroHttp(400, 'Envie o arquivo CSV.');
  if (e.csv.length > 2_000_000) throw new ErroHttp(413, 'Arquivo grande demais (máx. 2 MB).');
  const empresa = await dados.obterEmpresa();
  const r = importarContatosCsv(e.csv, {
    empresaId: sessao.empresaId,
    existentes: await dados.listar<Contato>('contatos'),
    etapaInicial: etapasDaEmpresa(empresa?.etapas)[0].id,
    agora: new Date(),
    gerarId: () => novoId('ct_'),
    origemPadrao: e.origem,
  });
  if (!e.simular) for (const c of r.novos) await dados.gravar('contatos', c.id, c);
  return Response.json({ importados: e.simular ? 0 : r.novos.length, novos: r.novos.length, duplicados: r.duplicados, erros: r.erros, amostra: r.novos.slice(0, 5) });
});
