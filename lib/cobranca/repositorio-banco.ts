// Repositório da cobrança em cima do `Banco` da Base (lib/dados) — usado no modo simulado,
// assim o plano liberado aparece na hora no app (menu, abas) que lê o mesmo banco em memória.
// Em produção use RepositorioCobrancaFirestore (transação de verdade).

import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import type { Assinatura } from '../planos/acesso';
import type { Aba } from '../planos/config';
import type { MovimentoCredito } from '../planos/creditos';
import type { EstadoCobranca, Mudancas, RegistroPagamento } from './liberacao';
import type { AlertaCobranca, RepositorioCobranca } from './repositorio';

interface EmpresaMin { plano?: { abas?: Aba[]; creditos?: number } }

const filas = new Map<string, Promise<unknown>>();

export class RepositorioCobrancaBanco implements RepositorioCobranca {
  constructor(private b: Banco) {}

  private emp(e: string) { return juntar('empresas', e); }

  async obterAssinatura(e: string) {
    const a = await this.b.obter<Assinatura>(juntar('empresas', e, 'cobranca', 'assinatura'));
    return a && a.empresaId === e ? a : null;
  }
  async salvarAssinatura(a: Assinatura) {
    await this.b.gravar(juntar('empresas', a.empresaId, 'cobranca', 'assinatura'), JSON.parse(JSON.stringify(a)));
  }
  async obterSaldo(e: string) {
    return (await this.b.obter<EmpresaMin>(this.emp(e)))?.plano?.creditos ?? 0;
  }
  async extrato(e: string, limite = 50) {
    const l = await this.b.listar<MovimentoCredito>(juntar('empresas', e, 'creditos'));
    return l.filter((m) => m.empresaId === e).sort((x, y) => y.quando.localeCompare(x.quando)).slice(0, limite);
  }
  async pagamentos(e: string, limite = 50) {
    const l = await this.b.listar<RegistroPagamento>(juntar('empresas', e, 'pagamentos'));
    return l.filter((r) => r.empresaId === e).sort((x, y) => y.quando.localeCompare(x.quando)).slice(0, limite);
  }
  async transacao(empresaId: string, pagamentoId: string, decidir: (estado: EstadoCobranca) => Mudancas | null) {
    const anterior = filas.get(empresaId) ?? Promise.resolve();
    const atual = anterior.then(async () => {
      const empresa = await this.b.obter<EmpresaMin>(this.emp(empresaId));
      const estado: EstadoCobranca = {
        empresaId,
        assinatura: await this.obterAssinatura(empresaId),
        saldoCreditos: empresa?.plano?.creditos ?? 0,
        registro: await this.b.obter<RegistroPagamento>(juntar('empresas', empresaId, 'pagamentos', pagamentoId)),
      };
      const m = decidir(estado);
      if (!m) return null;
      if (m.assinatura) await this.salvarAssinatura(m.assinatura);
      if (m.saldoCreditos !== undefined) {
        const atualEmp = await this.b.obter<EmpresaMin>(this.emp(empresaId));
        await this.b.mesclar(this.emp(empresaId), { plano: { abas: atualEmp?.plano?.abas ?? [], creditos: m.saldoCreditos } });
      }
      if (m.movimento) await this.b.gravar(juntar('empresas', empresaId, 'creditos', m.movimento.id.replace(/:/g, '_')), m.movimento);
      if (m.registro) await this.b.gravar(juntar('empresas', empresaId, 'pagamentos', pagamentoId), JSON.parse(JSON.stringify(m.registro)));
      return m;
    });
    filas.set(empresaId, atual.catch(() => undefined));
    return atual;
  }
  async empresaDoClienteAsaas(c: string) {
    return (await this.listarAssinaturas()).find((a) => a.asaasClienteId === c)?.empresaId ?? null;
  }
  async alertar(a: AlertaCobranca) {
    await this.b.gravar(juntar('atena_alertas', `al_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`), { ...a, origem: 'cobranca' });
  }
  async alertas(limite = 50) {
    const l = await this.b.listar<AlertaCobranca>('atena_alertas');
    return l.sort((x, y) => y.quando.localeCompare(x.quando)).slice(0, limite);
  }
  async listarAssinaturas() {
    const empresas = await this.b.listar<{ id: string }>('empresas');
    const out: Assinatura[] = [];
    for (const e of empresas) {
      const a = e?.id ? await this.obterAssinatura(e.id) : null;
      if (a) out.push(a);
    }
    return out;
  }
  async gravarAbasDaEmpresa(e: string, abas: Aba[]) {
    const atual = await this.b.obter<EmpresaMin>(this.emp(e));
    await this.b.mesclar(this.emp(e), { plano: { abas, creditos: atual?.plano?.creditos ?? 0 } });
  }
  async abasDaEmpresa(e: string) {
    return (await this.b.obter<EmpresaMin>(this.emp(e)))?.plano?.abas ?? [];
  }
}
