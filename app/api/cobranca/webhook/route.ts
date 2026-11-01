import { depsCobranca } from '@/lib/cobranca';
import { processarWebhook } from '@/lib/cobranca/servico';

/**
 * Webhook do Asaas (cadastrar no painel do Asaas → Integrações → Webhooks, apontando para
 * https://<domínio>/api/cobranca/webhook com o token igual a ASAAS_WEBHOOK_TOKEN). // CONFIRMAR AO VIVO
 * É só GATILHO: o pagamento é relido na API antes de liberar qualquer coisa.
 */
export async function POST(req: Request) {
  try {
    const corpo = await req.json().catch(() => null);
    const r = await processarWebhook(await depsCobranca(), {
      token: req.headers.get('asaas-access-token'),
      corpo,
      tokenEsperado: process.env.ASAAS_WEBHOOK_TOKEN,
    });
    if (r.status !== 200) return Response.json({ erro: 'Não autorizado.' }, { status: r.status });
    return Response.json({ recebido: true });
  } catch (e) {
    console.error('webhook asaas', e);
    // 500 faz o Asaas tentar de novo depois (fila de reenvio). // CONFIRMAR AO VIVO
    return Response.json({ erro: 'Falha ao processar.' }, { status: 500 });
  }
}
