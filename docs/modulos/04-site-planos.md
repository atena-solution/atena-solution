# Módulo 04 — Site de vendas, planos e entrada (sessão E)

## Entregas
1. **Site público** (`app/(site)/`): página inicial premium (ver `docs/design.md`; títulos em serif itálico, demonstração animada de uma conversa da IA marcando horário em tempo real, as 3 abas explicadas, segmentos atendidos, perguntas frequentes, preços), páginas por segmento (clínicas, barbearias/estética, imobiliárias, lojas), termos e privacidade (rascunho, LGPD).
2. **Planos** (valores editáveis em config): Atendimento, Coach (por vendedor), Estúdio (créditos), Pacote completo; teste grátis de 7 dias. Tabela de comparação.
3. **Cadastro → onboarding guiado** (liga no onboarding da Base): criar conta → dados da empresa → serviços/horários → treinar a IA (perguntas rápidas) → conectar WhatsApp (ou pular) → pronto. Barra de progresso; dá pra parar e voltar.
4. **Cobrança** (`lib/cobranca/`): Asaas — criar cliente, assinatura e compra de créditos; liberar plano só depois de LER o pagamento na API do Asaas (webhook só como gatilho); bloqueio suave quando vence (aviso → só leitura). Tudo atrás de `SIMULAR=1` até termos a conta do Asaas da Atena.
5. **Painel interno da Atena** (`/admin`, só e-mails da equipe Atena em env): empresas, plano, uso de IA (custo estimado por empresa), créditos, saúde (WhatsApp conectado? erros?).

## Testes
Regras de plano/acesso por aba, cálculo de validade e bloqueio, liberação só com pagamento confirmado, créditos.
