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
