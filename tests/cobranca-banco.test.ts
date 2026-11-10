import { describe, expect, it } from 'vitest';
import { BancoMemoria } from '../lib/dados/banco';
import { criarAsaasSimulado } from '../lib/cobranca/asaas';
import { RepositorioCobrancaBanco } from '../lib/cobranca/repositorio-banco';
import { assinar, comprarCreditos, iniciarTeste, processarPagamento, type Deps } from '../lib/cobranca/servico';
import { registrarUsoIA, lerUsoDoMes, mesDe } from '../lib/planos/uso';

const PAGADOR = { nome: 'Clínica Mira Luz', cpfCnpj: '529.982.247-25' };

function montar() {
  const b = new BancoMemoria();
  const asaas = criarAsaasSimulado();
  const d: Deps = { repo: new RepositorioCobrancaBanco(b), asaas, agora: () => '2026-11-01T12:00:00.000Z' };
  return { b, asaas, d };
}

describe('cobrança sobre o banco da Base', () => {
  it('plano pago atualiza Empresa.plano (abas e créditos) do contrato', async () => {
    const { b, asaas, d } = montar();
    await b.gravar('empresas/emp1', { id: 'emp1', nome: 'Mira Luz', plano: { abas: [], creditos: 20 } });
    await iniciarTeste(d, 'emp1');
    expect((await b.obter<{ plano: { abas: string[] } }>('empresas/emp1'))!.plano.abas).toEqual(['atendimento', 'coach', 'estudio']);
    await assinar(d, { empresaId: 'emp1', planoId: 'estudio', pagador: PAGADOR });
    const p = (await asaas.listarPagamentosDaAssinatura((await d.repo.obterAssinatura('emp1'))!.asaasAssinaturaId!))[0];
    asaas.definirStatus(p.id, 'CONFIRMED');
    await processarPagamento(d, p.id);
    const emp = await b.obter<{ nome: string; plano: { abas: string[]; creditos: number } }>('empresas/emp1');
    expect(emp!.plano).toEqual({ abas: ['estudio'], creditos: 120 });
    expect(emp!.nome).toBe('Mira Luz'); // não apaga o resto da empresa
    expect((await d.repo.extrato('emp1'))[0].quantidade).toBe(100);
  });

  it('nada de uma empresa aparece na outra', async () => {
    const { b, asaas, d } = montar();
    for (const id of ['empA', 'empB']) await b.gravar(`empresas/${id}`, { id, nome: id, plano: { abas: [], creditos: 0 } });
    await iniciarTeste(d, 'empA');
    await iniciarTeste(d, 'empB');
    const c = await comprarCreditos(d, 'empA', 'creditos-50', PAGADOR);
    asaas.definirStatus(c.pagamentoId, 'RECEIVED');
    await processarPagamento(d, c.pagamentoId);
    expect(await d.repo.obterSaldo('empA')).toBe(50);
    expect(await d.repo.obterSaldo('empB')).toBe(0);
    expect(await d.repo.extrato('empB')).toEqual([]);
    expect(await d.repo.pagamentos('empB')).toEqual([]);
    expect((await d.repo.obterAssinatura('empB'))!.asaasClienteId).toBeUndefined();
    expect(await d.repo.empresaDoClienteAsaas((await d.repo.obterAssinatura('empA'))!.asaasClienteId!)).toBe('empA');
  });

  it('registra uso de IA por mês', async () => {
    const { b } = montar();
    const agora = '2026-11-15T12:00:00.000Z';
    await registrarUsoIA(b, 'emp1', 'claude-haiku-5-5', { entrada: 100, saida: 10 }, agora);
    await registrarUsoIA(b, 'emp1', 'claude-haiku-5-5', { entrada: 50 }, agora);
    expect(await lerUsoDoMes(b, 'emp1', mesDe(agora))).toEqual({ 'claude-haiku-5-5': { entrada: 150, saida: 10 } });
    expect(await lerUsoDoMes(b, 'emp2', mesDe(agora))).toEqual({});
    expect(mesDe('2026-12-01T01:00:00.000Z')).toBe('2026-11'); // ainda 30/11 em São Paulo
  });
});
