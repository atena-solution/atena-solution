// Cálculo de preço — funções puras.
import { CONFIG_PLANOS, type ConfigPlanos, type PacoteCreditos, type Plano, type PlanoId } from './config';

export type Ciclo = 'mensal' | 'anual';

export function listarPlanos(cfg: ConfigPlanos = CONFIG_PLANOS): Plano[] {
  return cfg.planos;
}

export function obterPlano(id: string, cfg: ConfigPlanos = CONFIG_PLANOS): Plano | undefined {
  return cfg.planos.find((p) => p.id === id);
}

export function exigirPlano(id: string, cfg: ConfigPlanos = CONFIG_PLANOS): Plano {
  const p = obterPlano(id, cfg);
  if (!p) throw new Error(`Plano desconhecido: ${id}`);
  return p;
}

export function obterPacote(id: string, cfg: ConfigPlanos = CONFIG_PLANOS): PacoteCreditos | undefined {
  return cfg.pacotesCreditos.find((p) => p.id === id);
}

export function planoTemVendedores(plano: Plano): boolean {
  return plano.abas.includes('coach');
}

/** Normaliza a quantidade de vendedores: nunca menos que os inclusos, nem acima do máximo. */
export function normalizarVendedores(plano: Plano, vendedores: number | undefined, cfg: ConfigPlanos = CONFIG_PLANOS): number {
  if (!planoTemVendedores(plano)) return 0;
  const n = Math.floor(Number.isFinite(vendedores as number) ? (vendedores as number) : 0);
  return Math.min(Math.max(n, plano.vendedoresInclusos, 1), cfg.maxVendedores);
}

export interface Orcamento {
  planoId: PlanoId;
  ciclo: Ciclo;
  vendedores: number;
  mensalBase: number; // centavos
  mensalVendedoresExtras: number; // centavos
  mensalTotal: number; // centavos por mês (sem desconto anual)
  valorCobrado: number; // centavos cobrados por ciclo
  economiaAnual: number; // centavos economizados no anual (0 no mensal)
  equivalenteMensal: number; // centavos/mês já com desconto
}

export function calcularPreco(
  entrada: { planoId: string; vendedores?: number; ciclo?: Ciclo },
  cfg: ConfigPlanos = CONFIG_PLANOS,
): Orcamento {
  const plano = exigirPlano(entrada.planoId, cfg);
  const ciclo: Ciclo = entrada.ciclo === 'anual' && cfg.descontoAnualPct > 0 ? 'anual' : 'mensal';
  const vendedores = normalizarVendedores(plano, entrada.vendedores, cfg);
  const extras = Math.max(0, vendedores - plano.vendedoresInclusos);
  const mensalVendedoresExtras = extras * plano.precoVendedorExtra;
  const mensalTotal = plano.precoMensal + mensalVendedoresExtras;

  if (ciclo === 'mensal') {
    return {
      planoId: plano.id, ciclo, vendedores, mensalBase: plano.precoMensal, mensalVendedoresExtras,
      mensalTotal, valorCobrado: mensalTotal, economiaAnual: 0, equivalenteMensal: mensalTotal,
    };
  }
  const cheio = mensalTotal * 12;
  const valorCobrado = Math.round((cheio * (100 - cfg.descontoAnualPct)) / 100);
  return {
    planoId: plano.id, ciclo, vendedores, mensalBase: plano.precoMensal, mensalVendedoresExtras,
    mensalTotal, valorCobrado, economiaAnual: cheio - valorCobrado, equivalenteMensal: Math.round(valorCobrado / 12),
  };
}

/** Quanto o cliente economiza no Pacote completo comparado a assinar as 3 abas separadas. */
export function economiaDoPacote(vendedores = 3, cfg: ConfigPlanos = CONFIG_PLANOS): number {
  const separado =
    calcularPreco({ planoId: 'atendimento' }, cfg).mensalTotal +
    calcularPreco({ planoId: 'coach', vendedores }, cfg).mensalTotal +
    calcularPreco({ planoId: 'estudio' }, cfg).mensalTotal;
  const pacote = calcularPreco({ planoId: 'completo', vendedores }, cfg).mensalTotal;
  return Math.max(0, separado - pacote);
}

/** "R$ 1.234,56" — ou "R$ 297" quando não há centavos. */
export function formatarReais(centavos: number, opcoes: { semCentavosQuandoInteiro?: boolean } = {}): string {
  const inteiro = centavos % 100 === 0;
  const casas = opcoes.semCentavosQuandoInteiro && inteiro ? 0 : 2;
  const txt = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `R$ ${txt}`;
}

/** Valor em reais (número) para mandar à API do Asaas, que usa decimal. */
export function centavosParaReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Linhas da tabela de comparação do site. */
export interface LinhaComparacao {
  recurso: string;
  valores: Record<PlanoId, string | boolean>;
}

export function tabelaComparacao(cfg: ConfigPlanos = CONFIG_PLANOS): LinhaComparacao[] {
  const p = (id: PlanoId) => exigirPlano(id, cfg);
  const tem = (id: PlanoId, aba: 'atendimento' | 'coach' | 'estudio') => p(id).abas.includes(aba);
  const linha = (recurso: string, f: (id: PlanoId) => string | boolean): LinhaComparacao => ({
    recurso,
    valores: { atendimento: f('atendimento'), coach: f('coach'), estudio: f('estudio'), completo: f('completo') },
  });
  return [
    linha('Atendente de IA no WhatsApp 24h', (id) => tem(id, 'atendimento')),
    linha('Agenda com lembrete e confirmação', (id) => tem(id, 'atendimento')),
    linha('Recuperação de faltas e pedido de avaliação', (id) => tem(id, 'atendimento')),
    linha('Gravação e nota das reuniões de venda', (id) => tem(id, 'coach')),
    linha('Vendedores inclusos', (id) => (tem(id, 'coach') ? String(p(id).vendedoresInclusos) : false)),
    linha('Vendedor extra', (id) =>
      tem(id, 'coach') ? `${formatarReais(p(id).precoVendedorExtra, { semCentavosQuandoInteiro: true })}/mês` : false),
    linha('Fotos, posts e vídeos com a sua marca', (id) => tem(id, 'estudio')),
    linha('Créditos do Estúdio por mês', (id) => (p(id).creditosMensais > 0 ? String(p(id).creditosMensais) : false)),
    linha('Contatos e funil de vendas', () => true),
    linha('Equipe com papéis e permissões', () => true),
    linha(`Teste grátis de ${cfg.testeGratisDias} dias`, () => true),
  ];
}
