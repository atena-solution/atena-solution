import * as api from '@/lib/estudio/api';
import { rota } from '../_contexto';

export async function GET(req: Request) {
  return rota(req, (c) => api.creditos(c.d, c.quem));
}
