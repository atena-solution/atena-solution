# Módulo 00 — Base (sessão A)

Esqueleto do produto em que as abas se encaixam. Começar por aqui.

## Entregas
1. Projeto Next.js (App Router, TS, Tailwind, ESLint), `npm test` com Vitest (ou node:test) rodando.
2. Design system em `app/ui/` seguindo `docs/design.md`: tokens (claro/escuro), Botão, Campo, Select, Cartão, Abas, Tabela, Modal/Folha, Toast, Selo, Avatar, Vazio, Esqueleto de carregamento, ícones (lucide). Página `/ui` mostrando todos.
3. Layout logado `app/(app)/layout.tsx`: barra lateral (Início, Atendimento, Contatos, Agenda, Coach, Estúdio, Configurações), topo com empresa/usuário, busca Ctrl+K, versão celular com menu inferior.
4. Autenticação Firebase (Google e e-mail/senha) + `lib/auth/servidor.ts` (verifica o idToken no servidor e devolve `{uid, email, empresaId, papel}`).
5. **Multi-empresa**: coleção `empresas/{empresaId}`; membros em `empresas/{id}/membros/{uid}` com papel `dono | gestor | atendente | vendedor`. Helper `exigirEmpresa(req, papeisPermitidos)`. Regras do Firestore (`firestore.rules`) que só deixam ler/escrever dentro da empresa do usuário + teste das regras com o emulador (ou testes das funções puras de permissão).
6. **Onboarding** da empresa: nome, segmento, telefone, endereço, horário de funcionamento, serviços/produtos com preço e duração (usado pelo Atendimento e pela Agenda), logo e cores (usado pelo Estúdio).
7. **Contatos e funil** (`/contatos`): lista + quadro (kanban) com etapas configuráveis (padrão: Novo, Em conversa, Agendado, Compareceu, Cliente, Perdido), ficha do contato com linha do tempo (mensagens, agendamentos, reuniões, notas), etiquetas, origem, responsável, importar CSV.
8. **Agenda** (`/agenda`): profissionais/recursos, serviços com duração, horários livres (função pura `horariosLivres(...)` com testes), criar/remarcar/cancelar, visão dia/semana, status (marcado, confirmado, compareceu, faltou).
9. **Início** (`/`): resumo do dia (conversas abertas, agendamentos de hoje, faltas, novos contatos) — cada aba alimenta o seu cartão.
10. **Configurações**: empresa, equipe (convidar por e-mail), plano/créditos (placeholder), integrações (WhatsApp — tela de conexão fica com a sessão B).

## Contrato de dados (as outras sessões usam)
```ts
Empresa { id, nome, segmento, fuso: 'America/Sao_Paulo', telefone, endereco, horarios: {dia:0..6, abre:'09:00', fecha:'18:00'}[], marca: {logoUrl, cores:{primaria, secundaria}, tom}, plano: {abas: ('atendimento'|'coach'|'estudio')[], creditos:number}, criadoEm }
Membro { uid, email, nome, papel, ativo }
Contato { id, empresaId, nome, telefone (E.164 sem +), email?, origem, etapa, etiquetas[], responsavelUid?, ultimaInteracaoEm, criadoEm, campos: Record<string,string> }
Atividade { id, contatoId, tipo: 'mensagem'|'agendamento'|'reuniao'|'nota'|'etapa', resumo, quando, porUid?|porIA? }
Servico { id, nome, duracaoMin, preco, descricao }
Profissional { id, nome, servicosIds[], horarios[] }
Agendamento { id, contatoId, servicoId, profissionalId, inicio, fim, status: 'marcado'|'confirmado'|'compareceu'|'faltou'|'cancelado', criadoPor: 'ia'|uid, lembretes: {vesperaEm?, umaHoraEm?} }
```
Firestore: `empresas/{empresaId}/{contatos|atividades|servicos|profissionais|agendamentos|conversas|reunioes|criacoes}/{id}`.

## Fora do escopo desta sessão
Lógica do WhatsApp/IA (B), Coach (C), Estúdio (D), site público e cobrança (E).
