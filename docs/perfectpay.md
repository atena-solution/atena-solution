# Perfect Pay — produto Atena Solution (criado em 04/11/2026)

Conta Perfect Pay da LB (a mesma do ERP e do LB Precifica). Produto **Atena Solution — código PPPBFM11**
(assinatura, Administração e Negócios, garantia 7 dias, suporte solutionatena@gmail.com / WhatsApp LB 11 92720-9188,
página de vendas https://www.atenasolution.com.br, entrega "área de membros externa" = o site libera pelo webhook).

| Plano | Código do plano | Cobrança | Preço | Checkout |
|---|---|---|---|---|
| Atendimento — mensal | PPLQQQTPP | assinatura mensal | R$ 297,00 | https://go.perfectpay.com.br/PPU38CQHGGU |
| Coach de Vendas — mensal (1 vendedor) | PPLQQQTPQ | assinatura mensal | R$ 97,00 | https://go.perfectpay.com.br/PPU38CQHGH0 |
| Estúdio — mensal | PPLQQQTPR | assinatura mensal | R$ 97,00 | https://go.perfectpay.com.br/PPU38CQHGH1 |
| Pacote completo — mensal (3 vendedores, 150 créditos) | PPLQQQTPS | assinatura mensal | R$ 447,00 | https://go.perfectpay.com.br/PPU38CQHGH2 |
| Atendimento — anual | PPLQQQTPT | assinatura anual | R$ 3.029,40 | https://go.perfectpay.com.br/PPU38CQHGH3 |
| Coach de Vendas — anual (1 vendedor) | PPLQQQTPU | assinatura anual | R$ 989,40 | https://go.perfectpay.com.br/PPU38CQHGH4 |
| Estúdio — anual | PPLQQQTPV | assinatura anual | R$ 989,40 | https://go.perfectpay.com.br/PPU38CQHGH5 |
| Pacote completo — anual (3 vendedores, 150 créditos) | PPLQQQTQ0 | assinatura anual | R$ 4.559,40 | https://go.perfectpay.com.br/PPU38CQHGH7 |
| 50 créditos do Estúdio | PPLQQQTQ1 | único | R$ 49,00 | https://go.perfectpay.com.br/PPU38CQHGH8 |
| 150 créditos do Estúdio | PPLQQQTQ2 | único | R$ 129,00 | https://go.perfectpay.com.br/PPU38CQHGH9 |
| 400 créditos do Estúdio | PPLQQQTQ3 | único | R$ 297,00 | https://go.perfectpay.com.br/PPU38CQHGHA |

"Valor da primeira cobrança" = o próprio preço (não deixar 0). Vendedor extra do Coach (R$ 97) ainda não tem plano:
por enquanto é combinado à parte.

## Falta (código)
- Trocar a cobrança do Asaas pela Perfect Pay, igual o ERP (`lb-erp/lib/perfectpay.js`): link do checkout com `?src=<pedido>`,
  webhook `/api/perfectpay/webhook` que SEMPRE confere a venda na API (`POST https://app.perfectpay.com.br/api/v1/sales/get`)
  antes de liberar, renovação soma o período, créditos somam no saldo.
- Envs na Vercel da Atena: `PERFECTPAY_API_KEY` e `PERFECTPAY_TOKEN` (os mesmos da conta LB).
- Cadastrar o webhook na Perfect Pay pro produto PPPBFM11 (todos os eventos).
