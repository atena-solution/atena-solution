import { rota } from '@/lib/api/rota';
import { ErroHttp } from '@/lib/auth/erros';
import { listarLivres } from '@/lib/agenda/operacoes';

/** ?data=YYYY-MM-DD&servicoId=…[&profissionalId=…][&ignorar=agId] */
export const GET = rota(undefined, async (req, { dados }) => {
  const u = new URL(req.url);
  const data = u.searchParams.get('data') ?? '';
  const servicoId = u.searchParams.get('servicoId') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !servicoId) throw new ErroHttp(400, 'Informe a data e o serviço.');
  const livres = await listarLivres(dados, {
    data,
    servicoId,
    profissionalId: u.searchParams.get('profissionalId') || undefined,
    ignorarId: u.searchParams.get('ignorar') || undefined,
  });
  return Response.json({ livres });
});
