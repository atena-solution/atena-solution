import * as api from '@/lib/estudio/api';
import { corpoJson, rota } from '../_contexto';

export async function GET(req: Request) {
  const mes = new URL(req.url).searchParams.get('mes') ?? '';
  return rota(req, (c) => api.listarCalendario(c.d, c.quem, mes));
}
export async function POST(req: Request) {
  const corpo = await corpoJson(req);
  return rota(req, (c) => api.sugerirCalendario(c.d, c.quem, c.empresa, corpo));
}
