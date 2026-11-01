import * as api from '@/lib/estudio/api';
import { corpoJson, rota } from '../_contexto';

export async function GET(req: Request) {
  return rota(req, (c) => api.obterKit(c.d, c.quem, c.empresa));
}
export async function PUT(req: Request) {
  const corpo = await corpoJson(req);
  return rota(req, (c) => api.salvarKit(c.d, c.quem, corpo));
}
