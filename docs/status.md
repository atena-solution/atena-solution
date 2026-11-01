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
- Horários: usa `horariosLivres`/`verificarHorario` da Agenda da Base (mesmas regras), com trava própria contra dois clientes no mesmo horário. Não usei `lib/agenda/operacoes.ts` por falta dessa trava. Na junção vale unificar.
- Funil: contato novo do WhatsApp entra em `novo`, vai pra `em-conversa` na 1ª resposta e pra `agendado` quando a IA marca (não volta etapa de quem já é cliente).
- Áudio do cliente: `Deps.transcrever` está pronto pra receber a transcrição do Gemini da sessão C (`lib/integracoes/gemini.ts`). Ainda não ligado, então hoje a IA só sabe que veio um áudio.

**Simulado / precisa de teste ao vivo (no Mac)** — tudo marcado `// CONFIRMAR AO VIVO`
- Meta: número de teste, URL do webhook + token de verificação, assinatura, envio de texto/modelo/mídia, indicador "digitando", download de mídia, erro 131047 (janela fechada), versão da Graph API (`WHATSAPP_GRAPH_VERSAO`, padrão v23.0). Criar e aprovar os 4 modelos (lembrete, recuperação, avaliação, retomada) com as variáveis descritas na tela de conexão.
- Claude: chave `ANTHROPIC_API_KEY`; conferir qualidade das respostas e uso das ferramentas com o Studio Aurora / Topetes / Mira Luz; ajustar `effort`.
- Firestore real: `onSnapshot` da caixa de entrada (regras da Base já liberam `conversas/**` para membros), travas com várias funções da Vercel ao mesmo tempo.
- Vercel: `after()` esperando os 8s da rajada (`maxDuration` 60s); cron a cada 5 min precisa do plano Pro (no Hobby o cron só roda 1x por dia).
- Web push: gerar chaves VAPID, testar no celular (Android/Chrome; iPhone só com o app instalado na tela inicial).

**Variáveis de ambiente novas** (em `.env.example`): `ATENA_CHAVE_CRIPTO`, `WHATSAPP_TOKEN_VERIFICACAO`, `WHATSAPP_APP_SECRET`, `WHATSAPP_GRAPH_VERSAO`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_ASSUNTO`.

## C — Coach

## D — Estúdio

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
- **Acesso por aba** (usar antes de agir): `podeUsarAba(assinatura, aba, 'ler'|'escrever', agora)` em `lib/planos/acesso.ts`, ou no servidor `lerAcesso(await depsCobranca(), empresaId)` (`lib/cobranca`). Atendimento: checar `'escrever'` antes da IA responder; Coach: antes de analisar; Estúdio: antes de gerar. Hoje ninguém chama ainda — **B, C e D precisam ligar**.
- `Empresa.plano.abas` = abas do plano contratado (o menu da Base já usa); `Empresa.plano.creditos` = saldo único; extrato em `empresas/{id}/creditos/{movId}` (formato `MovimentoCredito`, já usado pelo Estúdio).
- **Uso de IA**: depois de cada chamada, `registrarUsoIA(banco, empresaId, modelo, { entrada, saida })` (`lib/planos/uso.ts`) → alimenta o custo no /admin. Ninguém registra ainda.
- **Faixa de aviso** do plano: `<AvisoPlano />` em `app/(app)/plano/AvisoPlano.tsx` — **a Base precisa colocar no topo da Moldura** (`app/(app)/Casca.tsx`).
- Empresa sem assinatura (demo, criada por outro caminho) ganha o teste automaticamente, contado da data de criação, na 1ª leitura de `/api/cobranca`.

### Simulado / falta testar ao vivo (no Mac)
- **Asaas** (`lib/cobranca/asaas.ts`): formatos escritos da doc v3 (anotados no arquivo) e marcados `// CONFIRMAR AO VIVO`: URL base, cabeçalho `access_token`, `User-Agent`, campos de `/customers`, `/subscriptions`, `/payments`, status e eventos do webhook, cabeçalho `asaas-access-token`, se cancelar a assinatura cancela as cobranças pendentes, reenvio do webhook em erro 500.
- Em modo simulado a fatura abre `/api/cobranca/simular` (botão "Pagar (simulado)"); essa rota responde 404 fora do modo simulado.
- `lib/cobranca/repositorio-firestore.ts` (produção, com transação) não foi rodado contra Firestore/emulador. Usa `collectionGroup('cobranca')` (pode pedir índice).
- Preços do Gemini em `lib/planos/admin.ts` são chute marcado `CONFIRMAR AO VIVO`; os da Claude vêm da tabela oficial (Sonnet 5.5 US$ 2/10, Haiku 5.5 US$ 0,10/0,50 por milhão de tokens). Cotação do dólar fixa (R$ 5,60) só para estimativa.

### Variáveis de ambiente (adicionar no `.env.local` / Vercel)
`ASAAS_API_KEY` (sem ela = simulado), `ASAAS_BASE_URL` (sandbox: `https://api-sandbox.asaas.com/v3`), `ASAAS_WEBHOOK_TOKEN` (o mesmo cadastrado no webhook do Asaas, apontando para `/api/cobranca/webhook`), `ATENA_ADMIN_EMAILS` (e-mails da equipe Atena, separados por vírgula).

### Pendências / decisões para o Lincoln
- Dois onboardings: o da Base (`/onboarding`, dentro do app, inclui Marca) e o guiado do site (`/comecar`, inclui treinar IA e WhatsApp). Sugestão: no fim do `/onboarding` da Base, mandar para `/comecar` (ele continua do "Treinar a IA").
- Confirmar preços, domínio e e-mail de contato (`contato@atenasolution.com.br` é provisório) e o número comercial no `_conteudo.ts`.
- `/admin` fica dentro do app logado: quem é da equipe Atena precisa ter (ou estar em) uma empresa para passar pelo layout.
- Leitura das coleções de cobrança pelo navegador é permitida a qualquer membro (regra genérica da Base); escrita é só do servidor.
