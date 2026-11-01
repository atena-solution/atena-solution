import * as api from '@/lib/estudio/api';
import { rota } from '../../_contexto';

/** A tela consulta a cada poucos segundos até o vídeo ficar pronto. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rota(req, (c) => api.consultarVideo(c.d, c.quem, id));
}
