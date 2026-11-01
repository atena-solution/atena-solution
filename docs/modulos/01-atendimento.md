# Módulo 01 — Atendimento (sessão B)

A estrela do produto: o cliente novo chama no WhatsApp e é atendido **na hora**, com qualidade de gente.

## Entregas
1. **Webhook do WhatsApp** (`app/api/whatsapp/webhook/route.ts`): verificação (GET hub.challenge), recebimento (POST) de texto, áudio, imagem, botão; roteia pela `phone_number_id` → empresa; ignora repetição pelo `wamid`; responde 200 rápido e processa (fila simples no Firestore).
2. **Conexão do número** (Configurações → WhatsApp): empresa informa phone_number_id, WABA id e token (v1 manual, com passo a passo); depois evolui pro Embedded Signup da Meta. Token guardado criptografado (chave em env).
3. **Cérebro da IA** (`lib/atendimento/`): monta o contexto (dados da empresa, serviços, preços, horários livres da Agenda, histórico do contato, regras da empresa) e chama a Claude. Ferramentas que a IA pode usar (tool use): `ver_horarios_livres`, `marcar_horario`, `remarcar`, `cancelar`, `passar_para_humano`, `salvar_dado_do_contato`. Regras: respostas curtas (1–2 balões), humana, uma pergunta por vez, nunca inventar preço/serviço, nunca dizer que é humana se perguntarem (dizer que é a assistente da empresa), passar pra humano em reclamação/assunto sensível.
4. **Rajada**: várias mensagens seguidas do cliente = 1 resposta (espera ~8s e confere se ainda é a última).
5. **Caixa de entrada ao vivo** (`/atendimento`): lista de conversas (Firestore em tempo real) com filtros Abertas / Precisa de humano / Minhas / Resolvidas, selo de tempo sem resposta; conversa com balões, "IA digitando…", botão **Assumir** (pausa a IA nessa conversa) e **Devolver pra IA**; ficha do contato ao lado (etapa, agendamentos, notas); mensagens rápidas; envio de áudio/foto; janela de 24h da Meta respeitada (fora dela só modelo aprovado).
6. **Treinar a IA** (`/atendimento/treinar`): perguntas e respostas da empresa, tom de voz, o que NUNCA dizer, quando chamar humano; **simulador** para conversar com a IA antes de ligar (sem WhatsApp).
7. **Automação de agenda**: lembrete na véspera e 1h antes (texto livre se janela aberta; modelo aprovado se fechada), confirmação por resposta ("SIM"), recuperação de quem faltou (mensagem no mesmo dia), pedido de avaliação no Google depois do atendimento. Função pura que decide o que mandar e quando + cron (Vercel Cron) a cada 5 min.
8. **Avisos pra equipe**: cliente esperando humano há X min → notificação (web push) pro responsável.
9. Métricas pro cartão do Início: conversas hoje, tempo médio da 1ª resposta, agendamentos feitos pela IA, % resolvido sem humano.

## Testes obrigatórios
Roteamento por phone_number_id, deduplicação, rajada, isolamento entre empresas, decisão de lembretes, ferramentas da IA (marcar não deixa marcar horário ocupado), janela de 24h. Integração com Meta e Claude atrás de `lib/integracoes/{whatsapp,claude}.ts` com modo `SIMULAR=1`.
