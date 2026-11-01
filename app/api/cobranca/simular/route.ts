import { depsCobranca } from '@/lib/cobranca';
import { asaasSimulado, modoSimulado } from '@/lib/cobranca/asaas';
import { processarPagamento } from '@/lib/cobranca/servico';
import { formatarReais } from '@/lib/planos/preco';

/** SÓ NO MODO SIMULADO: "fatura" falsa do Asaas para testar o fluxo de pagamento de ponta a ponta. */
function bloqueado() {
  return Response.json({ erro: 'Disponível só no modo simulado.' }, { status: 404 });
}

export async function GET(req: Request) {
  if (!modoSimulado()) return bloqueado();
  const id = new URL(req.url).searchParams.get('pagamento') ?? '';
  const p = await asaasSimulado()!.buscarPagamento(id);
  if (!p) return new Response('Cobrança não encontrada.', { status: 404 });
  const pago = ['CONFIRMED', 'RECEIVED'].includes(p.status);
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fatura simulada</title>
<body style="font-family:system-ui;background:#F7F5F0;color:#12151b;display:grid;place-items:center;min-height:100vh;margin:0">
<main style="background:#fff;border:1px solid #e4e0d6;border-radius:14px;padding:28px;max-width:380px;width:calc(100% - 32px)">
<p style="font-size:12px;letter-spacing:.12em;color:#7a808c;margin:0">FATURA SIMULADA · ASAAS</p>
<h1 style="font-size:22px;margin:8px 0">${(p.description ?? 'Cobrança').replace(/[<>&]/g, '')}</h1>
<p style="font-size:32px;font-weight:600;margin:16px 0">${formatarReais(Math.round(p.value * 100))}</p>
<p style="color:#4a505c">Vencimento: ${p.dueDate} · Status: <b>${p.status}</b></p>
${pago ? '<p style="color:#1f9a66;font-weight:600">Pago. Pode voltar para a Atena.</p>' : `<form method="post"><input type="hidden" name="pagamento" value="${p.id}"><button style="margin-top:12px;width:100%;height:46px;border:0;border-radius:12px;color:#fff;font-weight:600;background:linear-gradient(135deg,#3B5BDB,#7048E8);cursor:pointer">Pagar (simulado)</button></form>`}
<p style="margin-top:20px"><a href="/plano" style="color:#3b4fc4">Voltar para a Atena</a></p>
</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function POST(req: Request) {
  if (!modoSimulado()) return bloqueado();
  const form = await req.formData();
  const id = String(form.get('pagamento') ?? '');
  const sim = asaasSimulado()!;
  if (!(await sim.buscarPagamento(id))) return new Response('Cobrança não encontrada.', { status: 404 });
  sim.definirStatus(id, 'CONFIRMED');
  // Igual à produção: o "webhook" só dispara; quem libera é a leitura do pagamento.
  await processarPagamento(await depsCobranca(), id);
  return Response.redirect(new URL(`/api/cobranca/simular?pagamento=${encodeURIComponent(id)}`, req.url), 303);
}
