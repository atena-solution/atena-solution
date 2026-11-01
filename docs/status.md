# Status

(cada sessão atualiza a sua parte)

## A — Base

## B — Atendimento

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
Transcrição (falas de exemplo), análise (regras simples, marcada "Análise simulada"), banco e Storage em memória do servidor, login (sessão demo; cabeçalhos `x-sim-uid`, `x-sim-empresa`, `x-sim-papel` pra testar papéis).

### Falta na junção com a Base (A) — pontos marcados `JUNÇÃO`
- `lib/coach/servidor.ts → autenticar`: trocar pelo `exigirEmpresa(req, ['dono','gestor','vendedor'])`; `garantirFirebase` pelo init do Admin SDK da Base; `dadosEmpresa` pelo leitor de empresa da Base.
- `app/(app)/coach/_componentes/api.ts → cabecalhosAuth`: mandar o idToken do Firebase.
- `_componentes/ui.tsx` e as variáveis `--coach-*` do `layout.tsx`: trocar pelos componentes/tokens de `app/ui`.
- Ficha do contato: colocar `BotaoGravarReuniao` e `ReunioesDoContato`; Início: `CartaoCoachInicio`.
- `firestore.indexes.json`: `reunioes` (vendedorUid ASC, criadoEm DESC) e (contatoId ASC, criadoEm DESC). Regras: `empresas/{id}/reunioes` e `empresas/{id}/coach` só pra membros da empresa; Storage `empresas/{id}/reunioes/**` idem.
- Follow-up pelo número da empresa: chamar o envio do Atendimento (B) em `app/api/coach/reunioes/[id]/followup/route.ts`.
- Plano/créditos (E): bloquear criar/analisar quando a aba Coach não estiver no plano ou a conta estiver só leitura.

### Testar ao vivo (no Mac)
- Gemini: formato da resposta com `responseSchema`, precisão dos tempos, Files API (upload resumível, estado ACTIVE), janelas de 10 min sem repetir falas na borda — tudo marcado `CONFIRMAR AO VIVO`.
- Claude: análise de reunião de 1 h (tempo de resposta, qualidade da nota), `fallbacks: "default"`.
- Navegador: áudio da aba no Chrome/Edge (Meet, Zoom web, WhatsApp Web), Safari (`audio/mp4`), reunião de 1 h+ (12+ pedaços), fechar a aba no meio.
- Storage: CORS do bucket pro PUT direto, URLs assinadas pro player.
- Cliente piloto: time comercial da LB (dados separados).

## D — Estúdio

## E — Site e planos
