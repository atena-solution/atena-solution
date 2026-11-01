import * as api from '@/lib/estudio/api';
import { corpoJson, rota } from '../../_contexto';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const corpo = await corpoJson(req);
  return rota(req, (c) => api.editarPost(c.d, c.quem, id, corpo));
}
