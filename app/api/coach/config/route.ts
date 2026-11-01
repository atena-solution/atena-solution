// Configuração do Coach (mover etapa do funil pelo resultado).
import { autenticar, repositorio, responder } from '@/lib/coach/servidor';
import { obterConfig, salvarConfig } from '@/lib/coach/servico';

export async function GET(req: Request) {
  return responder(async () => ({ config: await obterConfig(await autenticar(req), await repositorio()) }));
}

export async function PUT(req: Request) {
  return responder(async () => ({ config: await salvarConfig(await autenticar(req), await repositorio(), await req.json()) }));
}
