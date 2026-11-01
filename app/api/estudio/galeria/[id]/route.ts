import * as api from '@/lib/estudio/api';
import { rota } from '../../_contexto';

type P = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: P) {
  const { id } = await params;
  return rota(req, (c) => api.obterCriacao(c.d, c.quem, id));
}
export async function DELETE(req: Request, { params }: P) {
  const { id } = await params;
  return rota(req, (c) => api.apagarCriacao(c.d, c.quem, id));
}
