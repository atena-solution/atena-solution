// Repositório do Estúdio em cima do `Banco` da Base (memória no modo simulado; serve também de referência).
// Mesmos caminhos do Firestore (repositorio-firestore.ts):
//   empresas/{id}                 marca (kit) e plano.creditos (saldo ÚNICO, o mesmo da cobrança)
//   empresas/{id}/criacoes/{id}   galeria
//   empresas/{id}/pautas/{id}     calendário
//   empresas/{id}/creditos/{id}   extrato (formato MovimentoCredito de lib/planos/creditos.ts)
// Em produção a Atena usa o RepositorioFirestore (transação de verdade); aqui a atomicidade é por fila no processo.
import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import type { Empresa } from '../tipos';
import type { Pauta } from './calendario';
import { exigirMesmaEmpresa, type OperacaoCredito, type RepositorioEstudio } from './repositorio';
import { deMovimento, paraMovimento, type MovimentoCredito } from './repositorio-firestore';
import type { Criacao, KitMarca } from './tipos';

export class RepositorioBanco implements RepositorioEstudio {
  private fila: Promise<unknown> = Promise.resolve();
  constructor(private b: Banco) {}

  private emp(empresaId: string, ...resto: string[]) {
    if (!empresaId) throw new Error('empresaId obrigatório.');
    return juntar('empresas', empresaId, ...resto);
  }

  async lerKit(empresaId: string) {
    const e = await this.b.obter<{ marca?: Partial<KitMarca> }>(this.emp(empresaId));
    return e?.marca?.fontes ? (e.marca as KitMarca) : null;
  }
  async salvarKit(empresaId: string, kit: KitMarca) {
    await this.b.mesclar(this.emp(empresaId), { marca: kit });
  }

  async salvarCriacao(c: Criacao) {
    await this.b.gravar(this.emp(c.empresaId, 'criacoes', c.id), JSON.parse(JSON.stringify(c)));
  }
  async obterCriacao(empresaId: string, id: string) {
    return exigirMesmaEmpresa(await this.b.obter<Criacao>(this.emp(empresaId, 'criacoes', id)), empresaId);
  }
  async listarCriacoes(empresaId: string) {
    const l = await this.b.listar<Criacao>(this.emp(empresaId, 'criacoes'));
    return l.filter((c) => c.empresaId === empresaId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  }
  async apagarCriacao(empresaId: string, id: string) {
    const c = await this.obterCriacao(empresaId, id);
    if (!c) return false;
    await this.b.apagar(this.emp(empresaId, 'criacoes', id));
    return true;
  }

  async salvarPautas(empresaId: string, pautas: Pauta[]) {
    for (const p of pautas) {
      exigirMesmaEmpresa(p, empresaId);
      await this.b.gravar(this.emp(empresaId, 'pautas', p.id), JSON.parse(JSON.stringify(p)));
    }
  }
  async listarPautas(empresaId: string, mes: string) {
    const l = await this.b.listar<Pauta>(this.emp(empresaId, 'pautas'));
    return l.filter((p) => p.empresaId === empresaId && p.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data));
  }
  async obterPauta(empresaId: string, id: string) {
    return exigirMesmaEmpresa(await this.b.obter<Pauta>(this.emp(empresaId, 'pautas', id)), empresaId);
  }
  async apagarPauta(empresaId: string, id: string) {
    const p = await this.obterPauta(empresaId, id);
    if (!p) return false;
    await this.b.apagar(this.emp(empresaId, 'pautas', id));
    return true;
  }

  async transacaoCreditos<T>(empresaId: string, op: OperacaoCredito<T>): Promise<T> {
    const rodar = async () => {
      const saldo = await this.saldo(empresaId);
      const movs = await this.b.listar<MovimentoCredito>(this.emp(empresaId, 'creditos'));
      const extrato = movs.filter((m) => m.origem === 'uso' || m.origem === 'devolucao').map(deMovimento).sort((a, b) => a.quando.localeCompare(b.quando));
      const r = op({ saldo, extrato });
      if (r.lancamento) {
        exigirMesmaEmpresa(r.lancamento, empresaId);
        const e = await this.b.obter<Empresa>(this.emp(empresaId));
        await this.b.mesclar(this.emp(empresaId), { plano: { ...(e?.plano ?? { abas: [] }), creditos: r.saldo } });
        await this.b.gravar(this.emp(empresaId, 'creditos', r.lancamento.id), JSON.parse(JSON.stringify(paraMovimento(r.lancamento))));
      }
      return r.resultado;
    };
    const p = this.fila.then(rodar, rodar);
    this.fila = p.catch(() => undefined);
    return p;
  }
  async extrato(empresaId: string) {
    const movs = await this.b.listar<MovimentoCredito>(this.emp(empresaId, 'creditos'));
    return movs.filter((m) => m.empresaId === empresaId).map(deMovimento).sort((a, b) => b.quando.localeCompare(a.quando));
  }
  async saldo(empresaId: string) {
    const e = await this.b.obter<Empresa>(this.emp(empresaId));
    return Number(e?.plano?.creditos ?? 0);
  }
}
