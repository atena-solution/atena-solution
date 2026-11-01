# Módulo 02 — Coach de Vendas (sessão C)

Um "Gong brasileiro": melhora o time comercial com a análise de cada reunião.

## Entregas
1. **Roteiro da empresa** (`/coach/roteiro`): etapas da reunião (ex.: conexão, diagnóstico, apresentação, preço, objeções, fechamento), perguntas-chave e objeções comuns com a resposta ideal. Modelo pronto por segmento pra começar.
2. **Gravar** (`/coach/gravar` e botão na ficha do contato): no navegador, duas trilhas — microfone (vendedor) e áudio da aba (cliente, via getDisplayMedia com áudio da guia) — ou só microfone (presencial/ligação no viva-voz). Pedaços de 5 min enviados e transcritos DURANTE a reunião; andamento salvo (se fechar a aba, dá pra analisar o que foi salvo). Aviso claro se veio sem o áudio da aba. Também **enviar arquivo** de áudio/vídeo já gravado (até ~200 MB, upload direto pro Storage e transcrição no servidor em partes).
3. **Transcrição** (`lib/integracoes/gemini.ts`): por trilha (sabe quem falou sem diarização), com tempo de cada fala.
4. **Análise** (Claude): resumo, resultado (fechou/retorno/pensando/sem interesse), chance de fechar, nota 0–10, cada etapa do roteiro feita/parcial/não feita, diagnóstico do cliente, objeções (bem respondida? como responder melhor), pontos fortes, o que melhorar, próximo passo + data, mensagem de follow-up pronta pro WhatsApp. % de fala vendedor × cliente.
5. **Tela da reunião**: player sincronizado com a transcrição (clicar na fala pula pro ponto), marcadores das objeções, análise em cartões; botão "Mandar follow-up" (usa o WhatsApp da empresa se a aba Atendimento estiver ativa, senão abre wa.me).
6. **Placar e evolução** (`/coach`): por vendedor — nº de reuniões, nota média, taxa de fechamento, etapas mais esquecidas, objeções mais comuns da semana; tendência por semana; "biblioteca" das melhores reuniões pra treinar.
7. Liga com Contatos: reunião aparece na linha do tempo do contato; resultado move a etapa (opcional, configurável).

## Testes
Junção das trilhas por tempo, cálculo de % de fala, normalização da análise (JSON da IA tolerante a erro), placar, isolamento por empresa. IA atrás de `SIMULAR=1`.
