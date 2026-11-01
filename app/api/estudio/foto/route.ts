import * as api from '@/lib/estudio/api';
import { corpoJson, rota } from '../_contexto';

export const maxDuration = 60;

export async function POST(req: Request) {
  const corpo = await corpoJson(req);
  return rota(req, (c) => api.criarFoto(c.d, c.quem, c.empresa, corpo));
}
