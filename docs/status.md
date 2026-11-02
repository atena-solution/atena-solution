# Status

(cada sessão atualiza a sua parte)

## A — Base

**Pronto (01/11/2026)** — todas as 10 entregas de `docs/modulos/00-base.md`. 84 testes passando (`npm test`), `npm run lint`, `npm run typecheck` e `npm run build` limpos.

Como rodar na nuvem/sem chaves: `SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev` → `/entrar` com `dono@demo.atena` (empresa demo "Studio Aurora"),
`ana@demo.atena` (atendente) ou `outro@demo.atena` (outra empresa, para ver o isolamento). Qualquer outro e-mail cai no onboarding.
Guia para as outras sessões: **`docs/como-encaixar.md`**.

| Entrega | Onde | Situação |
|---|---|---|
| 1. Next.js 16 + TS + Tailwind 4 + ESLint + Vitest | raiz | pronto |
| 2. Design system + `/ui` | `app/ui/` (Botao, Campo, AreaTexto, Select, Cartao, Abas, Tabela, Modal/Folha, Toast, Selo, Avatar, Vazio, Esqueleto, Logo, ícones lucide) | pronto, claro/escuro |
| 3. Layout logado | `app/(app)/layout.tsx` + `Casca.tsx` (barra lateral, topo com empresa/usuário, troca de empresa, Ctrl+K, menu inferior no celular) | pronto |
| 4. Autenticação | `lib/auth/cliente.ts` (Google + e-mail/senha), `lib/auth/servidor.ts` (`exigirEmpresa`, `obterSessao`) | **simulado**; Firebase real escrito, não testado |
| 5. Multi-empresa | `lib/dados/empresa.ts` (`daEmpresa` prende tudo em `empresas/{id}`), `lib/auth/permissoes.ts`, `firestore.rules` | pronto + testes de isolamento nas rotas |
| 6. Onboarding | `/onboarding` (empresa → horários → serviços/quem atende → marca), retoma de onde parou | pronto |
| 7. Contatos e funil | `/contatos` (lista + quadro arrastável), `/contatos/[id]` (ficha, linha do tempo, notas, etiquetas, responsável), importar CSV, etapas configuráveis | pronto |
| 8. Agenda | `/agenda` (dia/semana, marcar/remarcar/cancelar, status), `lib/agenda/horarios.ts` (`horariosLivres`, `verificarHorario`), `lib/agenda/operacoes.ts` | pronto |
| 9. Início | `/inicio` + `/api/inicio`; cartões extras das abas em `app/(app)/inicio/cartoes-das-abas.tsx` | pronto |
| 10. Configurações | `/configuracoes?aba=empresa|servicos|profissionais|funil|equipe|plano|integracoes` | pronto (plano = placeholder da sessão E; WhatsApp → `/configuracoes/whatsapp`, tela da sessão B) |

**Decisões que afetam as outras sessões**
- `/` é do site público (sessão E). O Início logado é **`/inicio`**.
- Datas em ISO UTC; fuso da empresa em `empresa.fuso` (funções em `lib/agenda/fuso.ts`).
- A IA do Atendimento deve marcar/remarcar/cancelar por `lib/agenda/operacoes.ts` com `{ ia: true }` — já valida conflito, horário e avança o funil.
- Plano/créditos não mudam por `PATCH /api/empresa` (nem pelas regras do Firestore): só pelo servidor da cobrança (sessão E).
- Banco: em `SIMULAR=1` (ou sem `FIREBASE_SERVICE_ACCOUNT`) tudo fica em memória com dados demo; reinicia a cada `npm run dev`.

**Simulado / precisa de teste ao vivo (no Mac)**
- Firebase Auth real (Google popup, e-mail/senha, redefinir senha) e `verifyIdToken` — `// CONFIRMAR AO VIVO`.
- Firestore real via Admin SDK (`lib/dados/firestore.ts`) e deploy de `firestore.rules`; rodar as regras no emulador (`firebase emulators:start`).
  Hoje o teste compara `firestore.rules` com `lib/auth/permissoes.ts`, não executa as regras.
- Convite de equipe: cria o convite e entra no 1º login com o e-mail; **o e-mail de convite não é enviado** (falta serviço de e-mail).
- Logo: por enquanto é um link (sem upload de arquivo).
- Listagens leem a coleção inteira e filtram no servidor (ok para PME); trocar por consultas indexadas se crescer.

**Variáveis de ambiente** (ver `.env.example`): `SIMULAR`, `NEXT_PUBLIC_SIMULAR`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`.

## B — Atendimento

**Pronto (01/11/2026)** — as 9 entregas de `docs/modulos/01-atendimento.md`, com o WhatsApp e a Claude **simulados** (`SIMULAR=1`).
87 testes do Atendimento (`tests/atendimento/*`), junto com os da Base: `npm test` (171), `npm run typecheck` e lint limpos.

Ver funcionando: `SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev` → entrar com `dono@demo.atena` → **/atendimento**.
Já tem 4 conversas de exemplo. O botão **Simular cliente** manda uma mensagem pelo webhook de verdade (formato da Meta), e a IA simulada
responde em ~8s (tira dúvida pelo FAQ, informa preço, consulta a agenda e marca horário). Em **/atendimento/treinar** fica o simulador.

| Entrega | Onde | Situação |
|---|---|---|
| 1. Webhook | `app/api/whatsapp/webhook/route.ts`, `lib/integracoes/whatsapp.ts` (`lerWebhook`, assinatura), `lib/atendimento/processar.ts` (`receberWebhook`) | pronto: GET hub.challenge; POST com texto/áudio/imagem/botão/status; roteia `phone_number_id → empresa` (`whatsappNumeros/{id}`); ignora `wamid` repetido (create atômico); responde 200 e processa no `after()` + fila `filaAtendimento` (o cron pega o que sobrar). Assinatura `X-Hub-Signature-256` com o App Secret da empresa (se tiver app próprio) ou o `WHATSAPP_APP_SECRET` |
| 2. Conexão do número | `/atendimento/conexao` (também em `/configuracoes/whatsapp`), `app/api/whatsapp/conexao` | pronto (v1 manual com passo a passo). Token e App Secret cifrados (AES-256-GCM, `ATENA_CHAVE_CRIPTO`) em `segredos/whatsapp_{empresaId}` — fora da empresa, o navegador não lê. Nomes dos modelos aprovados. Embedded Signup: depois |
| 3. Cérebro da IA | `lib/atendimento/{contexto,ferramentas,cerebro}.ts`, `lib/integracoes/claude.ts` | pronto: prompt com empresa, serviços/preços, horários, FAQ, regras, cliente e agendamentos dele; ferramentas `ver_horarios_livres`, `marcar_horario`, `remarcar`, `cancelar`, `passar_para_humano`, `salvar_dado_do_contato` (strict). `claude-sonnet-5-5`, `effort: low`, sem `temperature`, cache de prompt, fallback do servidor em recusa. Reclamação/jurídico/reembolso/saúde/"quero falar com alguém" vai direto pra equipe sem chamar a IA |
| 4. Rajada | `lib/atendimento/rajada.ts` | pronto: espera 8s; só responde a última mensagem; se chegar outra enquanto a IA pensa, descarta e responde tudo junto |
| 5. Caixa de entrada ao vivo | `/atendimento` (`TelaAtendimento`, `PainelConversa`, `FichaContato`, `_lib/tempoReal.ts`) | pronto: filtros Abertas / Precisa de humano / Minhas / Resolvidas, busca, selo de tempo sem resposta, balões, "IA digitando…", Assumir / Devolver pra IA / Resolver, mensagens rápidas (`/`), foto e áudio (envio e gravação em OGG quando o navegador deixa), janela de 24h (fora dela usa o modelo de retomada ou bloqueia), ficha ao lado. Tempo real: `onSnapshot` do Firestore com Firebase real; no simulado, consulta a cada 2–3s. Funciona no celular (lista → conversa) |
| 6. Treinar a IA | `/atendimento/treinar`, `app/api/whatsapp/treino`, `simulador` | pronto: liga/desliga, nome e tom, perguntas e respostas, nunca dizer, quando chamar humano, regras extras, automações, mensagens rápidas; simulador usa o rascunho sem salvar e sem gravar agendamento |
| 7. Automação da agenda | `lib/atendimento/automacoes.ts` (puro) + `rodarAutomacoes` + `app/api/whatsapp/cron` + `vercel.json` | pronto: véspera (pede SIM; o "SIM" confirma na agenda sem IA), 1h antes, recuperar falta (mesmo dia), avaliação no Google (1h–48h depois). Texto livre com a janela aberta, modelo aprovado com ela fechada. Silêncio das 21h às 8h. Nunca manda duas vezes (`atendimento_automacoes`) |
| 8. Avisos pra equipe | `lib/atendimento/avisos.ts`, `push.ts`, `AtivarAvisos.tsx`, `public/sw-atendimento.js` | pronto: cliente esperando humano há X min (configurável) → web push pro responsável (ou dono/gestor/atendentes), repete no máx. a cada 30 min. Simulado = só log |
| 9. Métricas | `lib/atendimento/metricas.ts`, `/api/whatsapp/metricas`, faixa no topo do Atendimento + `CartaoInicio.tsx` no Início | pronto: conversas hoje, 1ª resposta média, marcados pela IA, % resolvido sem humano, clientes esperando |

**Testes obrigatórios cobertos**: roteamento por `phone_number_id`, deduplicação, rajada, isolamento entre empresas (repositório e rotas com o login simulado de `outro@demo.atena`), decisão de lembretes, ferramentas (não marca horário ocupado, nem com dois clientes ao mesmo tempo; não mexe em agendamento de outro cliente/empresa), janela de 24h, assinatura do webhook por empresa.

**Decisões**
- Dados: repositório único `lib/atendimento/repo-banco.ts` em cima do `Banco` da Base (memória ou Firestore). Conversa = `empresas/{id}/conversas/cv_{contatoId}`, mensagens em `.../mensagens`. Operações atômicas no Firestore em `atomico-firestore.ts` (`create()` + trava por profissional ao marcar).
- Horários: usa `horariosLivres`/`verificarHorario` da Agenda da Base. **Junção (F):** a regra de "horário ocupado" é uma só (`temConflito`) e a trava por profissional é a mesma da Agenda (`lib/agenda/trava.ts`), também ao remarcar.
- Funil: contato novo do WhatsApp entra em `novo`, vai pra `em-conversa` na 1ª resposta e pra `agendado` quando a IA marca (não volta etapa de quem já é cliente).
- Áudio do cliente: **ligado na junção (F)** — baixa o áudio da Meta e transcreve com o Gemini (`transcreverAudioCliente`); a IA responde ao que foi falado.

**Simulado / precisa de teste ao vivo (no Mac)** — tudo marcado `// CONFIRMAR AO VIVO`
- Meta: número de teste, URL do webhook + token de verificação, assinatura, envio de texto/modelo/mídia, indicador "digitando", download de mídia, erro 131047 (janela fechada), versão da Graph API (`WHATSAPP_GRAPH_VERSAO`, padrão v23.0). Criar e aprovar os 4 modelos (lembrete, recuperação, avaliação, retomada) com as variáveis descritas na tela de conexão.
- Claude: chave `ANTHROPIC_API_KEY`; conferir qualidade das respostas e uso das ferramentas com o Studio Aurora / Topetes / Mira Luz; ajustar `effort`.
- Firestore real: `onSnapshot` da caixa de entrada (regras da Base já liberam `conversas/**` para membros), travas com várias funções da Vercel ao mesmo tempo.
- Vercel: `after()` esperando os 8s da rajada (`maxDuration` 60s); cron a cada 5 min precisa do plano Pro (no Hobby o cron só roda 1x por dia).
- Web push: gerar chaves VAPID, testar no celular (Android/Chrome; iPhone só com o app instalado na tela inicial).

**Variáveis de ambiente novas** (em `.env.example`): `ATENA_CHAVE_CRIPTO`, `WHATSAPP_TOKEN_VERIFICACAO`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_VERSAO`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_ASSUNTO`.

## C — Coach

**Branch:** `claude/fervent-turing-ukt06g` · **Testes:** `npx vitest run tests/coach` → 87 passando (lógica pura, isolamento por empresa e papéis, Gemini com fetch falso).
Testado também no navegador (Next de teste, `SIMULAR=1`, Chromium com microfone falso): gravar → pedaço → transcrição → análise → tela da reunião; envio de arquivo; roteiro; placar no celular sem rolagem lateral.

### Pronto
- **Roteiro** (`/coach/roteiro`): etapas (ordem, objetivo, perguntas-chave), objeções com resposta ideal, modelos prontos por segmento (geral, clínica, barbearia, estética, imobiliária, escola, loja, agência) e opção "mover o contato no funil pelo resultado".
- **Gravar** (`/coach/gravar`, aceita `?contatoId=&nome=&telefone=`): duas trilhas (microfone + áudio da aba via `getDisplayMedia`) ou só microfone; aviso claro quando vem sem áudio da aba; pedaços de 5 min (MediaRecorder reiniciado → cada pedaço é arquivo válido) enviados e transcritos durante a reunião; fila com 3 tentativas e "Tentar de novo"; aviso ao fechar a aba; "Analisar o que foi salvo". **Enviar arquivo** até 200 MB: PUT direto no Storage (URL assinada) e transcrição no servidor em janelas de 10 min, um passo por chamada (cabe no limite da Vercel).
- **Transcrição** (`lib/integracoes/gemini.ts`): por trilha (quem falou vem da trilha; na trilha única a IA separa vendedor/cliente), com tempo de cada fala; inline pros pedaços, Files API pros arquivos grandes.
- **Análise** (`lib/coach/ia.ts` + `analise.ts`): Claude `claude-sonnet-5-5`, sem `temperature`, fallback em recusa. JSON lido de forma tolerante (cerca de código, vírgula sobrando, sinônimos, números fora da faixa); etapas sempre seguem o roteiro; % de fala calculado pelas falas (não pela IA).
- **Tela da reunião** (`/coach/reunioes/[id]`): player que junta os pedaços e sincroniza as duas trilhas, clicar na fala pula pro ponto, marcadores das objeções na barra, cartões da análise, follow-up editável com "Mandar follow-up" (wa.me; WhatsApp da empresa quando o Atendimento estiver ligado), reanalisar, biblioteca.
- **Placar** (`/coach`): por vendedor (reuniões, nota média, taxa de fechamento, % de fala, etapa mais esquecida), nota por semana (8 semanas), objeções da semana, biblioteca (nota ≥ 8 ou marcada), últimas reuniões. Vendedor vê só a própria linha; dono/gestor veem todos.
- **Contatos**: atividade `reuniao` na linha do tempo (id fixo por reunião), etapa do funil movida se configurado (nunca rebaixa "Cliente"). Peças prontas pra Base encaixar: `BotaoGravarReuniao`, `ReunioesDoContato`, `CartaoCoachInicio` (`app/(app)/coach/_componentes/contato.tsx`).
- **API** (`app/api/coach/*`): roteiro, config, reunioes (lista/cria), reunioes/[id] (GET/PATCH), pedacos, arquivo, analisar, followup, placar (`?resumo=1` pro Início), audio (só simulado).
- **Multi-empresa**: toda regra recebe a sessão com `empresaId`; reunião de outra empresa responde 404; caminhos do Storage checados (`empresas/{id}/reunioes/...`). Papéis: dono/gestor/vendedor usam; atendente não; só dono/gestor editam roteiro e biblioteca; vendedor vê e mexe só nas próprias (e vê as da biblioteca).

### Simulado (`SIMULAR=1`)
Transcrição (falas de exemplo), análise (regras simples, marcada "Análise simulada"), banco e Storage em memória do servidor (áudio servido por URL assinada simulada). Login: o mesmo da Base (`bruno@demo.atena` = vendedor).

### Junção (sessão F) — feito
Login da Base (`exigirEmpresa` dono/gestor/vendedor), Admin SDK e empresa da Base; componentes de `app/ui`; ficha do contato (Gravar reunião + Reuniões) e cartão no Início; índices e regras (vendedor lê só as próprias e as da biblioteca); follow-up pelo WhatsApp da empresa (envio do Atendimento, janela de 24h, cai no wa.me se recusar); plano exigido para criar/gravar/analisar (402) e uso de IA registrado.

### Testar ao vivo (no Mac)
- Gemini: formato da resposta com `responseSchema`, precisão dos tempos, Files API (upload resumível, estado ACTIVE), janelas de 10 min sem repetir falas na borda — tudo marcado `CONFIRMAR AO VIVO`.
- Claude: análise de reunião de 1 h (tempo de resposta, qualidade da nota), `fallbacks: "default"`.
- Navegador: áudio da aba no Chrome/Edge (Meet, Zoom web, WhatsApp Web), Safari (`audio/mp4`), reunião de 1 h+ (12+ pedaços), fechar a aba no meio.
- Storage: CORS do bucket pro PUT direto, URLs assinadas pro player.
- Cliente piloto: time comercial da LB (dados separados).

## D — Estúdio

**Pronto (01/11/2026, fechado na junção)** — as 7 entregas de `docs/modulos/03-estudio.md`, com a geração **simulada** (`SIMULAR=1` devolve imagens e vídeos de exemplo, sem rede).
91 testes do Estúdio (`tests/estudio/*`): débito/devolução de créditos, prompts com as regras de fidelidade, composição do texto na arte (quebra de linha, contraste), calendário, galeria, isolamento por empresa.

Ver funcionando: `SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev` → entrar com `dono@demo.atena` → **/estudio** (a demo tem 120 créditos).

| Entrega | Onde | Situação |
|---|---|---|
| 1. Kit da marca | `/estudio/marca`, `lib/estudio/marca.ts` (`kitDaEmpresa`, `validarKit`) | pronto: logo, cores, fontes, tom, público, palavras a evitar. Começa da marca do onboarding (`empresas/{id}.marca`) e salva no mesmo campo |
| 2. Foto de produto | `/estudio/foto`, `lib/estudio/prompts.ts` (prompt central de fidelidade) | pronto: 1–5 fotos, 5 estilos, 4 formatos, até 6 variações. Prompt proíbe mudar cor/estampa/forma, inventar texto ou acessório (testado) |
| 3. Post/arte | `/estudio/post`, `_componentes/Arte.tsx`, `lib/estudio/arte.ts`, `legenda.ts` | pronto: a IA faz só o fundo; título/subtítulo/chamada são desenhados pelo sistema (canvas) com quebra de linha e contraste calculados; legenda e hashtags pela Claude. Modelos promoção, novidade, depoimento, antes/depois (só com foto real enviada) |
| 4. Vídeo curto | `/estudio/video`, `app/api/estudio/video` (+ `[id]` consulta o andamento) | pronto: vídeo com IA (Gemini Omni Flash — o Veo saiu do ar em out/2026; 9:16 ou 1:1) **ou** slideshow animado montado no navegador (canvas + MediaRecorder, 0 crédito) |
| 5. Calendário | `/estudio/calendario`, `lib/estudio/calendario.ts` | pronto: sugestão do mês por segmento (datas comemorativas, dias bons de postar), rascunho editável → gerar arte → marcar publicado. A sugestão é regra pura (sem IA, grátis) |
| 6. Galeria | `/estudio/galeria`, `lib/estudio/galeria.ts` | pronto: filtros por tipo/formato/busca, baixar (PNG), copiar legenda, reaproveitar em post/vídeo, apagar |
| 7. Créditos | `/estudio/creditos`, `lib/estudio/creditos.ts` | pronto: foto 2 e post 2 por variação, vídeo 10, slideshow/legenda/calendário 0. Debita ANTES de gerar, devolve na hora se falhar (pura, testada), extrato |

**Ligado na junção (sessão F)**
- Login da Base (`exigirEmpresa`) e empresa lida do banco da Base (`app/api/estudio/_contexto.ts`).
- Saldo **único**: `empresas/{id}.plano.creditos`, o mesmo que a cobrança credita; extrato em `empresas/{id}/creditos` (formato `MovimentoCredito`). No simulado: `RepositorioBanco` em cima do banco em memória da Base; no real: `RepositorioFirestore` com transação.
- Gerar exige o Estúdio no plano e a conta em dia (402 com o motivo); uso de IA registrado (`gemini-imagem`, `gemini-video`, tokens da Claude).
- Visual: componentes de `app/ui` e tokens da Base (tema claro/escuro do app); cartão no Início (`/api/estudio/resumo`).

**Simulado / precisa de teste ao vivo (no Mac)** — marcado `// CONFIRMAR AO VIVO`
- Gemini imagem (`gemini-2.5-flash-image`) e Omni (`gemini-omni-1.1-flash`, mesmo formato já usado ao vivo na LB): nomes dos modelos (dá pra trocar por `GEMINI_MODELO_IMAGEM` / `GEMINI_MODELO_VIDEO`), formato do pedido e da resposta, `aspectRatio`, fidelidade real ao produto.
- Vídeo: baixar o arquivo do Omni com a chave (`urlDownloadVideo`) e guardar no Storage (o `uri` expira); tempo de geração.
- Storage: upload das imagens grandes com token de download (`lib/estudio/dependencias.ts`), CORS para baixar PNG no navegador.
- Claude: legenda/hashtags com a chave real (`lib/estudio/texto-ia.ts`).
- Slideshow: MediaRecorder no Safari/iPhone (formato `video/mp4`).
- Firestore real: transação de créditos com várias gerações ao mesmo tempo; índice `creditos (origem, quando)`.

**Variáveis de ambiente**: `GEMINI_API_KEY`, `GEMINI_MODELO_IMAGEM`, `GEMINI_MODELO_VIDEO`, `ANTHROPIC_API_KEY`, `FIREBASE_STORAGE_BUCKET`.

## E — Site e planos

Atualizado em 01/11/2026. `npm test` (135 testes, todos passando), `npm run typecheck` e `npm run build` ok. Fluxo inteiro testado no navegador em modo simulado: cadastro → onboarding guiado → assinar → fatura → pago → plano ativo → /admin.

| Entrega | Onde | Situação |
|---|---|---|
| 1. Site público | `/` (home com demo animada da IA marcando horário, 3 abas, segmentos, preços, perguntas), `/precos`, `/para/{clinicas,barbearias-estetica,imobiliarias,lojas}`, `/termos`, `/privacidade` | pronto. Texto todo em `app/(site)/_conteudo.ts`. Termos e privacidade são **rascunho** (faltam razão social, CNPJ, encarregado de dados; revisar com advogado) |
| 2. Planos | valores em **`lib/planos/config.ts`** (único lugar para editar preço, créditos, dias de teste, carência, desconto anual) | pronto: Atendimento R$ 297, Coach R$ 97 (1 vendedor) + R$ 79/vendedor, Estúdio R$ 97 (100 créditos), Pacote R$ 447 (3 vendedores, 150 créditos) + R$ 59/vendedor; anual −15%; pacotes de créditos 50/150/400. Tabela de comparação em `/precos`. **Valores são sugestão — Lincoln confirma** |
| 3. Cadastro → onboarding guiado | `/cadastro?plano=x` → `/entrar?criar=1` (Base) → **`/comecar`**: empresa → serviços e horários → treinar a IA (5 perguntas) → WhatsApp (ou pular) → pronto | pronto. Barra de progresso; progresso salvo em `empresas/{id}.onboarding`; para e volta de onde parou. Usa as rotas da Base (`/api/empresas`, `/api/empresa`, `/api/servicos`). O treino vai para `empresas/{id}/atendimento/treino` no formato da sessão B (IA continua desligada). Se a empresa já tem serviços (onboarding da Base em `/onboarding`), o passo é pulado |
| 4. Cobrança Asaas | `lib/cobranca/*`, rotas `app/api/cobranca/*` | pronto **em modo simulado**. Plano só libera depois de LER o pagamento em `GET /payments/{id}` (webhook é só gatilho, corpo ignorado); idempotente; confere se o cliente Asaas é da mesma empresa e se o valor do pacote bate (senão vira alerta no /admin); estorno devolve acesso e créditos. Teste grátis 7 dias → pago até → carência 3 dias (aviso) → só leitura (nada apagado) |
| 5. Painel interno | **`/admin`** (+ `GET /api/cobranca/admin`) | pronto: empresas, plano, situação, receita/mês, custo de IA estimado, margem, créditos, saúde (WhatsApp conectado, alertas), alertas de cobrança. Só e-mail **verificado** listado em `ATENA_ADMIN_EMAILS` |
| Extra | **`/plano`** e Configurações → Plano | tela do cliente: situação, Pagar agora, Já paguei, trocar plano (mensal/anual, vendedores), comprar créditos, extrato, pagamentos, cancelar renovação |

### Para as outras sessões (contrato)
- **Acesso por aba** (usar antes de agir): `podeUsarAba(assinatura, aba, 'ler'|'escrever', agora)` em `lib/planos/acesso.ts`, ou no servidor `lerAcesso(await depsCobranca(), empresaId)` (`lib/cobranca`). Ligado na junção (F) por `decidirAba`/`exigirAba` (`lib/planos/portao.ts`): Atendimento antes da IA responder e das automações; Coach antes de criar/gravar/analisar; Estúdio antes de gerar.
- `Empresa.plano.abas` = abas do plano contratado (o menu da Base já usa); `Empresa.plano.creditos` = saldo único; extrato em `empresas/{id}/creditos/{movId}` (formato `MovimentoCredito`, já usado pelo Estúdio).
- **Uso de IA**: depois de cada chamada, `registrarUsoIA(banco, empresaId, modelo, { entrada, saida })` (`lib/planos/uso.ts`) → alimenta o custo no /admin. Ligado na junção (F) em todas as chamadas de IA (Claude, transcrição, imagem, vídeo).
- **Faixa de aviso** do plano: `<AvisoPlano />` em `app/(app)/plano/AvisoPlano.tsx` — já no topo da moldura (`app/(app)/Casca.tsx`). Aba fora do plano mostra `ConviteAba` (convite, não erro).
- Empresa sem assinatura (demo, criada por outro caminho) ganha o teste automaticamente, contado da data de criação, na 1ª leitura de `/api/cobranca`.

### Simulado / falta testar ao vivo (no Mac)
- **Asaas** (`lib/cobranca/asaas.ts`): formatos escritos da doc v3 (anotados no arquivo) e marcados `// CONFIRMAR AO VIVO`: URL base, cabeçalho `access_token`, `User-Agent`, campos de `/customers`, `/subscriptions`, `/payments`, status e eventos do webhook, cabeçalho `asaas-access-token`, se cancelar a assinatura cancela as cobranças pendentes, reenvio do webhook em erro 500.
- Em modo simulado a fatura abre `/api/cobranca/simular` (botão "Pagar (simulado)"); essa rota responde 404 fora do modo simulado.
- `lib/cobranca/repositorio-firestore.ts` (produção, com transação) não foi rodado contra Firestore/emulador. Usa `collectionGroup('cobranca')` (pode pedir índice).
- Preços do Gemini em `lib/planos/admin.ts` são chute marcado `CONFIRMAR AO VIVO`; os da Claude vêm da tabela oficial (Sonnet 5.5 US$ 2/10, Haiku 5.5 US$ 0,10/0,50 por milhão de tokens). Cotação do dólar fixa (R$ 5,60) só para estimativa.

### Variáveis de ambiente (adicionar no `.env.local` / Vercel)
`ASAAS_API_KEY` (sem ela = simulado), `ASAAS_BASE_URL` (sandbox: `https://api-sandbox.asaas.com/v3`), `ASAAS_WEBHOOK_TOKEN` (o mesmo cadastrado no webhook do Asaas, apontando para `/api/cobranca/webhook`), `ATENA_ADMIN_EMAILS` (e-mails da equipe Atena, separados por vírgula).

### Pendências / decisões para o Lincoln
- ~~Dois onboardings~~ — resolvido na junção (F): `/onboarding` termina no `/comecar`, que continua do "Treinar a IA" (`destinoOnboarding`).
- Confirmar preços, domínio e e-mail de contato (`contato@atenasolution.com.br` é provisório) e o número comercial no `_conteudo.ts`.
- `/admin` fica dentro do app logado: quem é da equipe Atena precisa ter (ou estar em) uma empresa para passar pelo layout.
- Leitura de cobrança/pagamentos pelo navegador: só dono/gestor (regras geradas na junção); escrita só do servidor.

## F — Junção

**Pronto (01/11/2026)** — as 11 entregas de `docs/modulos/05-juncao.md`. `npm test` (423 testes, todas as abas juntas), `npx tsc --noEmit`, `npm run lint` e `npx next build` limpos.

| Entrega | O que mudou | Onde |
|---|---|---|
| 1. Login único | Coach e Estúdio usam `exigirEmpresa`, o Admin SDK (`lib/integracoes/firebase-admin.ts`, agora com `bucketAdmin`) e o banco da Base. No navegador, `cabecalhosLogin()` (`lib/sessao.tsx`) para tudo. Saldo do Estúdio = `empresas/{id}.plano.creditos` (o mesmo da cobrança) | `lib/coach/servidor.ts`, `app/api/estudio/_contexto.ts`, `lib/estudio/repositorio-banco.ts` |
| 2. Visual único | Coach e Estúdio em cima de `app/ui` (Botão, Cartão, Selo, Vazio, Cabeçalho); fim das cores próprias (`--coach-*`; `--e-*` viram apelidos dos tokens da Base, seguindo o tema claro/escuro do app); `SubNav` comum | `app/ui/SubNav.tsx`, `app/(app)/coach/_componentes/ui.tsx`, `app/(app)/estudio/_componentes/ui.tsx` |
| 3. Plano e créditos | `decidirAba`/`exigirAba` antes da IA agir (Atendimento, Coach, Estúdio → 402 com motivo); `registrarUsoIA` depois de toda chamada (Claude, transcrição, imagem, vídeo); `<AvisoPlano />` no topo; aba fora do plano mostra convite | `lib/planos/portao.ts`, `app/(app)/plano/ConviteAba.tsx` |
| 4. Ficha e Início | Ficha: Gravar reunião, Reuniões do Coach, Conversa no WhatsApp. Início: cartões do Atendimento, Coach e Estúdio | `app/(app)/contatos/[id]/FichaContato.tsx`, `app/(app)/inicio/cartoes-das-abas.tsx` |
| 5. Follow-up | Coach manda pelo WhatsApp da empresa com o envio do Atendimento (`enviarAoContato`): janela de 24h aberta = texto; fechada = modelo de retomada; recusou = wa.me com o motivo | `lib/atendimento/processar.ts`, `app/api/coach/reunioes/[id]/followup` |
| 6. Áudio do cliente | `Deps.transcrever` ligado ao Gemini (`transcreverAudioCliente`) | `lib/atendimento/servidor.ts`, `lib/integracoes/gemini.ts` |
| 7. Um onboarding só | `/onboarding` (empresa, horários, serviços, marca) → `/comecar` (treinar IA, WhatsApp). Nada é perguntado duas vezes (`destinoOnboarding`) | `lib/planos/onboarding.ts` |
| 8. Agenda | Uma regra (`temConflito`) e uma trava por profissional para equipe e IA, também ao remarcar | `lib/agenda/trava.ts`, `lib/dados/trava-firestore.ts` |
| 9. Regras e índices | Tabela única gera `firestore.rules`, `storage.rules` e `firestore.indexes.json` (`npm run regras`); o teste confere arquivo = tabela e que toda coleção usada no código tem regra | `lib/auth/regras-dados.ts`, `tests/regras-firestore.test.ts` |
| 10. Status do Estúdio | seção D acima | — |
| 11. Revisão | Todas as telas no modo simulado (desktop 1366 e celular 390), com dono, atendente, vendedor e outra empresa: sem link interno quebrado, sem rolagem lateral, sem erro no console. Teste de ponta a ponta do Coach no navegador (enviar arquivo → transcrição → análise → follow-up pelo WhatsApp da empresa → reunião na ficha). Corrigidos: tabela de preços rolando de lado no celular, 404 na ficha de contato sem conversa, `/comecar` perguntando de novo o que já estava feito, atendente vendo o Coach com erro (agora some do menu e mostra uma explicação), aviso do lint no player | — |

### Como testar (geral, sem chaves)
```bash
npm install
SIMULAR=1 NEXT_PUBLIC_SIMULAR=1 npm run dev
```
Abra `http://localhost:3000/entrar` e entre com um destes e-mails (qualquer senha):

| E-mail | Quem é | O que olhar |
|---|---|---|
| `dono@demo.atena` | dono do Studio Aurora (pacote completo pago, 120 créditos) | tudo: Início com os 3 cartões, Atendimento (botão **Simular cliente**), Contatos → ficha da Mariana (conversa, gravar reunião), Agenda, Coach (gravar com microfone ou enviar arquivo → análise simulada → Mandar follow-up), Estúdio (foto/post/vídeo descontam créditos), Plano, Configurações |
| `ana@demo.atena` | atendente | Atendimento e Agenda; o Coach não aparece no Início e a API recusa |
| `bruno@demo.atena` | vendedor | Coach só com as próprias reuniões |
| `outro@demo.atena` | dona de outra empresa (teste grátis) | não vê nada do Studio Aurora |
| qualquer outro | conta nova | onboarding: `/onboarding` → `/comecar` |

Para ver o bloqueio do plano: em `/plano`, cancele/deixe vencer (ou rode os testes de `tests/juncao/plano.test.ts`). Testes: `npm test` · tipos: `npx tsc --noEmit` · build: `npx next build`.

### Lista única do que precisa de teste ao vivo (no Mac, com as chaves)
Tudo está marcado `// CONFIRMAR AO VIVO` no código. Em ordem sugerida:
1. **Firebase**: criar o projeto `atena-solution`; Auth (Google + e-mail/senha) e `verifyIdToken`; Firestore via Admin SDK; `firebase deploy --only firestore:rules,firestore:indexes,storage` e rodar as regras no emulador (`firebase emulators:start`); Storage: `FIREBASE_STORAGE_BUCKET`, CORS do bucket (PUT direto do Coach, baixar PNG do Estúdio), URLs assinadas e token de download.
2. **Travas no Firestore** com várias funções da Vercel ao mesmo tempo (agenda: equipe × IA; créditos do Estúdio; fila do Atendimento).
3. **WhatsApp (Meta)**: número de teste, webhook + token de verificação, assinatura, envio de texto/modelo/mídia, digitando, download de mídia (áudio do cliente), erro 131047, versão da Graph API; criar e aprovar os 4 modelos (lembrete, recuperação, avaliação, retomada — a retomada também é usada pelo follow-up do Coach).
4. **Claude** (`ANTHROPIC_API_KEY`): atendimento com ferramentas (Studio Aurora / Topetes / Mira Luz), análise de reunião de 1 h, legenda do Estúdio, `fallbacks`, campo `usage` registrado no /admin.
5. **Gemini** (`GEMINI_API_KEY`): transcrição (`responseSchema`, tempos, Files API, janelas de 10 min), áudio OGG do WhatsApp, imagem (`gemini-2.5-flash-image`) e vídeo Omni (1:1 aceito?, nomes dos modelos, formato, baixar o vídeo para o Storage), preços para o custo no /admin.
6. **Asaas** (sandbox): cliente, assinatura, pagamentos, webhook com `asaas-access-token`, estorno; `collectionGroup('cobranca')` com o índice.
7. **Vercel**: projeto `atena-solution`, variáveis do `.env.example`, `after()` com a rajada de 8 s, cron a cada 5 min (plano Pro).
8. **Navegador/celular**: gravação do Coach (áudio da aba no Chrome/Edge, Safari `audio/mp4`, 1 h+), slideshow do Estúdio no iPhone, web push (VAPID; iPhone só com o app na tela inicial).
9. **Textos legais e comerciais**: termos/privacidade com advogado, preços, domínio e contatos em `app/(site)/_conteudo.ts`; serviço de e-mail para convites da equipe.
