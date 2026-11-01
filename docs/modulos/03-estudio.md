# Módulo 03 — Estúdio (sessão D)

Fotos, vídeos e posts profissionais a partir da foto do celular, com a marca da empresa. Cobrado por créditos.

## Entregas
1. **Kit da marca** (vem do onboarding): logo, cores, fontes, tom de voz, público. Editável em `/estudio/marca`.
2. **Foto de produto** (`/estudio/foto`): sobe 1–5 fotos reais → escolhe estilo (fundo limpo, ambientada, modelo usando, flat lay, detalhe) e formato (1:1, 3:4, 4:5, 9:16) → gera N variações fiéis ao produto (cor/estampa/forma idênticas, sem texto inventado, sem acessório que não existe). Regras de fidelidade num prompt central testado.
3. **Post/arte** (`/estudio/post`): tema/oferta → arte com a marca (texto renderizado pelo PRÓPRIO sistema em cima da imagem — nunca deixar a IA escrever texto na imagem) + legenda e hashtags (Claude). Modelos de layout (promoção, novidade, depoimento, antes/depois só se a empresa enviar a foto real).
4. **Vídeo curto** (`/estudio/video`): a partir de uma foto → vídeo 5–8 s vertical (Gemini Omni/Veo — CONFIRMAR modelo ao vivo); opção "slideshow animado" montado no navegador (canvas + MediaRecorder) que custa zero crédito.
5. **Calendário de conteúdo** (`/estudio/calendario`): a IA sugere o mês (datas comemorativas do segmento), cada post vira rascunho editável → gerar arte → marcar publicado.
6. **Galeria** da empresa com tudo que foi gerado, filtros, baixar, reaproveitar.
7. **Créditos**: tabela de custo por tipo (foto, post, vídeo), débito antes de gerar e devolução se falhar (função pura testada), extrato.

## Testes
Débito/devolução de créditos, montagem dos prompts (regras de fidelidade presentes), composição do texto na arte (quebra de linha, contraste), isolamento por empresa. Geração atrás de `SIMULAR=1` (devolve imagens de exemplo).
