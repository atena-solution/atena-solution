import { rota } from '@/lib/api/rota';
import { banco } from '@/lib/dados';
import { juntar } from '@/lib/dados/banco';
import type { ConviteIndice } from '@/lib/base/empresas';

/** Cancela um convite pendente. */
export const DELETE = rota<{ email: string }>(['dono', 'gestor'], async (_req, { dados, sessao, params }) => {
  const email = decodeURIComponent(params.email).toLowerCase();
  await dados.apagar('convites', email);
  const b = await banco();
  const indice = await b.obter<ConviteIndice>(juntar('convites', email));
  if (indice?.empresaId === sessao.empresaId) await b.apagar(juntar('convites', email));
  return Response.json({ ok: true });
});
