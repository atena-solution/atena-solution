import * as api from '@/lib/estudio/api';
import { rota } from '../_contexto';

export async function GET(req: Request) {
  return rota(req, (c) => api.resumoInicio(c.d, c.quem));
}
