import { rota } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { iniciarTeste, lerAcesso } from '@/lib/cobranca/servico';
import { modoSimulado } from '@/lib/cobranca/asaas';
import { CONFIG_PLANOS } from '@/lib/planos/config';
import { calcularPreco } from '@/lib/planos/preco';

/** Situação do plano da empresa logada: fase, aviso, abas, saldo, extrato e pagamentos. */
export const GET = rota(undefined, async (_req, { sessao, dados }) => {
  const d = await depsCobranca();
  // Empresa criada por outro caminho (onboarding da Base, demo): começa o teste contado da data de criação.
  if (!(await d.repo.obterAssinatura(sessao.empresaId))) {
    const empresa = await dados.obterEmpresa();
    if (empresa) await iniciarTeste({ ...d, agora: () => empresa.criadoEm || new Date().toISOString() }, sessao.empresaId);
  }
  const [assinatura, situacao, saldo] = await Promise.all([
    d.repo.obterAssinatura(sessao.empresaId),
    lerAcesso(d, sessao.empresaId),
    d.repo.obterSaldo(sessao.empresaId),
  ]);
  const podeVerFinanceiro = sessao.papel === 'dono' || sessao.papel === 'gestor';
  const [extrato, pagamentos] = podeVerFinanceiro
    ? await Promise.all([d.repo.extrato(sessao.empresaId, 30), d.repo.pagamentos(sessao.empresaId, 30)])
    : [[], []];
  return Response.json({
    situacao,
    saldo,
    assinatura: assinatura && {
      planoId: assinatura.planoId,
      vendedores: assinatura.vendedores,
      ciclo: assinatura.ciclo,
      testeAte: assinatura.testeAte,
      pagoAte: assinatura.pagoAte,
      canceladaEm: assinatura.canceladaEm,
      temCadastroPagador: !!assinatura.asaasClienteId,
      assinaturaAtiva: !!assinatura.asaasAssinaturaId,
      faturaAbertaUrl: podeVerFinanceiro ? assinatura.faturaAbertaUrl : undefined,
      valorAtual: calcularPreco({ planoId: assinatura.planoId, vendedores: assinatura.vendedores, ciclo: assinatura.ciclo }).valorCobrado,
    },
    extrato,
    pagamentos: pagamentos.map((p) => ({ pagamentoId: p.pagamentoId, tipo: p.tipo, efeito: p.efeito, valor: p.valor, status: p.status, quando: p.quando, creditos: p.creditos })),
    planos: CONFIG_PLANOS.planos,
    pacotes: CONFIG_PLANOS.pacotesCreditos,
    simulado: modoSimulado(),
  });
});
