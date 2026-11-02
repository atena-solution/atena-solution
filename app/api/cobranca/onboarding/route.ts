import { rota, corpo } from '@/lib/api/rota';
import { banco } from '@/lib/dados';
import { juntar } from '@/lib/dados/banco';
import { ErroHttp } from '@/lib/auth/erros';
import { ONBOARDING_VAZIO, PASSOS, concluido, marcarFeito, progresso, proximoPasso, pular, treinoDoOnboarding, type EstadoOnboarding, type Passo, type RespostasRapidas } from '@/lib/planos/onboarding';

/**
 * Progresso do onboarding guiado (/comecar). Guardado em `empresas/{id}.onboarding`.
 * (Os dados da empresa e os serviços vão pelas rotas da Base: PATCH /api/empresa e POST /api/servicos.)
 */
export const GET = rota(undefined, async (_req, { dados, sessao }) => {
  const empresa = (await dados.obterEmpresa()) as { onboarding?: EstadoOnboarding; onboardingConcluido?: boolean } | null;
  const estado = { ...ONBOARDING_VAZIO, ...(empresa?.onboarding ?? {}) };
  // Quem chega aqui já tem conta e empresa.
  const quando = estado.atualizadoEm ?? new Date().toISOString();
  let base = marcarFeito(marcarFeito(estado, 'conta', quando), 'empresa', quando);
  // Serviços já cadastrados (ex.: pelo onboarding da Base em /onboarding) contam como passo feito.
  // O onboarding da Base concluído também (já perguntou horários e serviços).
  if (!base.feitos.includes('servicos') && (empresa?.onboardingConcluido || (await dados.listar('servicos')).length > 0)) base = marcarFeito(base, 'servicos', quando);
  // IA já treinada (pela tela do Atendimento) e WhatsApp já conectado também não são perguntados de novo.
  const b = await banco();
  if (!base.feitos.includes('treinar') && (await b.obter(juntar('empresas', sessao.empresaId, 'atendimento', 'treino')))) base = marcarFeito(base, 'treinar', quando);
  if (!base.feitos.includes('whatsapp') && (await b.obter(juntar('empresas', sessao.empresaId, 'atendimento', 'conexao')))) base = marcarFeito(base, 'whatsapp', quando);
  return Response.json({ estado: base, proximo: proximoPasso(base), progresso: progresso(base), concluido: concluido(base) });
});

/** { passo, acao: 'feito' | 'pular', treino?: RespostasRapidas } */
export const POST = rota(['dono', 'gestor'], async (req, { dados, sessao }) => {
  const e = await corpo<{ passo?: string; acao?: string; treino?: RespostasRapidas }>(req);
  const passo = PASSOS.find((p) => p.id === e.passo)?.id as Passo | undefined;
  if (!passo) throw new ErroHttp(400, 'Passo inválido.');
  const agora = new Date().toISOString();
  const empresa = (await dados.obterEmpresa()) as { onboarding?: EstadoOnboarding } | null;
  let estado: EstadoOnboarding = { ...ONBOARDING_VAZIO, ...(empresa?.onboarding ?? {}) };
  estado = marcarFeito(marcarFeito(estado, 'conta', agora), 'empresa', agora);

  if (passo === 'treinar' && e.acao === 'feito' && e.treino) {
    // Formato do Treino da sessão B (lib/atendimento/tipos.ts), em empresas/{id}/atendimento/treino.
    // Padrões espelham treinoPadrao() do Atendimento; a IA continua DESLIGADA até o dono testar.
    const b = await banco();
    const caminho = juntar('empresas', sessao.empresaId, 'atendimento', 'treino');
    const atual = (await b.obter<Record<string, unknown>>(caminho)) ?? {
      empresaId: sessao.empresaId, ligada: false, regrasExtras: '', linkAvaliacao: '',
      mensagensRapidas: [{ atalho: 'oi', texto: 'Oi! Tudo bem? Como posso te ajudar?' }, { atalho: 'end', texto: 'Nosso endereço é {endereco}.' }, { atalho: 'obg', texto: 'Obrigado pelo contato! Qualquer coisa é só chamar 😊' }],
      automacoes: { lembreteVespera: true, lembreteUmaHora: true, recuperarFalta: true, pedirAvaliacao: false },
      avisoHumanoMin: 5,
    };
    await b.gravar(caminho, { ...atual, ...treinoDoOnboarding(e.treino), empresaId: sessao.empresaId, atualizadoEm: agora });
  }

  if (e.acao === 'pular') {
    try { estado = pular(estado, passo, agora); } catch (x) { throw new ErroHttp(400, (x as Error).message); }
  } else estado = marcarFeito(estado, passo, agora);
  const fim = concluido(estado);
  await dados.mesclarEmpresa({ onboarding: estado, ...(fim ? { onboardingConcluido: true } : {}) } as never);
  return Response.json({ estado, proximo: proximoPasso(estado), progresso: progresso(estado), concluido: fim });
});
