import * as api from '@/lib/estudio/api';
import { corpoJson, rota } from '../_contexto';

export async function POST(req: Request) {
  const corpo = await corpoJson(req);
  return rota(req, (c) => api.salvarSlideshow(c.d, c.quem, corpo));
}
