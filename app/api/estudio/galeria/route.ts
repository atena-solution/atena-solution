import * as api from '@/lib/estudio/api';
import { rota } from '../_contexto';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return rota(req, (c) => api.listarGaleria(c.d, c.quem, params));
}
