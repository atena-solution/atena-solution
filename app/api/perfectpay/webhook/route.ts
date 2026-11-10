import { depsCobranca } from '@/lib/cobranca';
import { postbackValido } from '@/lib/cobranca/perfectpay';
import { processarVendaPP } from '@/lib/cobranca/servico';

/**
 * PostBack da Perfect Pay (produto PPPBFM11 → Ferramentas > Webhook - Vendas, todos os eventos), apontando para
 * https://www.atenasolution.com.br/api/perfectpay/webhook. Confere o token fixo da conta (PERFECTPAY_TOKEN).
 * É só GATILHO: a venda é relida na API da Perfect Pay antes de liberar qualquer coisa.
 */
export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => null)) as { token?: string; code?: string; sale_status_enum?: number | string } | null;
  if (!postbackValido(corpo)) return Response.json({ erro: 'Token inválido.' }, { status: 401 });
  const code = String(corpo?.code ?? '');
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(code)) return Response.json({ recebido: true, ignorado: 'sem code' });
  try {
    const r = await processarVendaPP(await depsCobranca(), code);
    return Response.json({ recebido: true, resultado: r.resultado });
  } catch (e) {
    console.error('webhook perfectpay', e);
    return Response.json({ erro: 'Falha ao processar.' }, { status: 500 }); // a Perfect Pay tenta de novo
  }
}
