// Quem pode usar o quê — funções puras.
//
// Linha do tempo de uma assinatura:
//   teste grátis (7 dias) → pago até X → [carência: tudo funciona + aviso] → só leitura
// Nada é apagado quando vence: o cliente vê os dados, mas não cria nada novo
// (a IA do Atendimento para de responder, o Coach não analisa, o Estúdio não gera).

import { CONFIG_PLANOS, type Aba, type ConfigPlanos, type PlanoId } from './config';
import { diasEntre, maisTarde, somarDias } from './datas';
import { obterPlano } from './preco';
import type { Ciclo } from './preco';

/** Guardado em `empresas/{empresaId}/cobranca/assinatura`. */
export interface Assinatura {
  empresaId: string;
  planoId: PlanoId;
  vendedores: number;
  ciclo: Ciclo;
  /** Fim do teste grátis (ISO). */
  testeAte?: string;
  /** Até quando o acesso está PAGO (ISO). Só é estendido depois de ler o pagamento confirmado na API do Asaas. */
  pagoAte?: string;
  /** Cancelada pelo cliente: vale até `pagoAte` e não renova. */
  canceladaEm?: string;
  asaasClienteId?: string;
  /** Perfect Pay: e-mail de quem assinou (acha a empresa nas renovações) e plano da última venda. */
  ppEmail?: string;
  ppCodigo?: string;
  asaasAssinaturaId?: string;
  /** Link da fatura em aberto (para o botão "Pagar agora"). */
  faturaAbertaUrl?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type Fase = 'sem_plano' | 'teste' | 'ativa' | 'carencia' | 'somente_leitura';

export interface SituacaoAcesso {
  fase: Fase;
  /** Até quando está liberado (teste ou pago). */
  liberadoAte?: string;
  /** Quando entra em só leitura. */
  somenteLeituraEm?: string;
  /** Dias inteiros restantes até o fim do período liberado (pode ser negativo). */
  diasRestantes?: number;
  abas: Aba[];
  podeEscrever: boolean;
  /** Faixa amarela no topo do app. */
  aviso?: { tom: 'info' | 'atencao' | 'erro'; texto: string };
}

export function novaAssinaturaDeTeste(
  empresaId: string,
  agoraIso: string,
  cfg: ConfigPlanos = CONFIG_PLANOS,
  planoEscolhido?: PlanoId,
): Assinatura {
  return {
    empresaId,
    planoId: planoEscolhido ?? cfg.planoDoTeste,
    vendedores: 0,
    ciclo: 'mensal',
    testeAte: somarDias(agoraIso, cfg.testeGratisDias),
    criadoEm: agoraIso,
    atualizadoEm: agoraIso,
  };
}

export function situacaoAcesso(
  a: Assinatura | null | undefined,
  agoraIso: string,
  cfg: ConfigPlanos = CONFIG_PLANOS,
): SituacaoAcesso {
  if (!a) return { fase: 'sem_plano', abas: [], podeEscrever: false, aviso: { tom: 'info', texto: 'Escolha um plano para começar.' } };

  const agora = new Date(agoraIso).getTime();
  const testeVale = a.testeAte && new Date(a.testeAte).getTime() >= agora && !a.pagoAte;
  // Durante o teste o cliente experimenta o plano do teste (todas as abas, por padrão).
  const planoId = testeVale ? cfg.planoDoTeste : a.planoId;
  const abas = obterPlano(planoId, cfg)?.abas ?? [];

  const liberadoAte = maisTarde(a.testeAte, a.pagoAte);
  if (!liberadoAte) return { fase: 'sem_plano', abas: [], podeEscrever: false };

  const fim = new Date(liberadoAte).getTime();
  const somenteLeituraEm = a.canceladaEm ? liberadoAte : somarDias(liberadoAte, cfg.diasCarencia);
  const diasRestantes = Math.ceil(diasEntre(agoraIso, liberadoAte));
  const base = { liberadoAte, somenteLeituraEm, diasRestantes, abas };

  if (agora <= fim) {
    const fase: Fase = testeVale ? 'teste' : 'ativa';
    let aviso: SituacaoAcesso['aviso'];
    if (fase === 'teste') {
      aviso = {
        tom: diasRestantes <= 2 ? 'atencao' : 'info',
        texto: diasRestantes <= 1 ? 'Seu teste grátis termina hoje. Escolha um plano para não parar.' : `Teste grátis: faltam ${diasRestantes} dias.`,
      };
    } else if (a.canceladaEm) {
      aviso = { tom: 'atencao', texto: `Assinatura cancelada. Você usa até ${dataCurta(liberadoAte)}.` };
    }
    return { fase, ...base, podeEscrever: true, aviso };
  }

  if (agora <= new Date(somenteLeituraEm).getTime()) {
    return {
      fase: 'carencia', ...base, podeEscrever: true,
      aviso: { tom: 'atencao', texto: `Pagamento pendente. Pague até ${dataCurta(somenteLeituraEm)} para não ficar só em leitura.` },
    };
  }

  return {
    fase: 'somente_leitura', ...base, podeEscrever: false,
    aviso: { tom: 'erro', texto: 'Seu plano venceu. Você ainda vê seus dados, mas nada novo é criado. Pague para voltar.' },
  };
}

export type Acao = 'ler' | 'escrever';

export interface Decisao { permitido: boolean; motivo?: 'sem_plano' | 'aba_fora_do_plano' | 'somente_leitura' | 'limite'; mensagem?: string }

/**
 * Regra única de acesso às abas. As outras sessões chamam isto antes de agir, por exemplo:
 *   - Atendimento: antes da IA responder → podeUsarAba(a, 'atendimento', 'escrever', agora)
 *   - Coach: antes de analisar uma reunião
 *   - Estúdio: antes de gerar (além do saldo de créditos)
 */
export function podeUsarAba(
  a: Assinatura | null | undefined,
  aba: Aba,
  acao: Acao,
  agoraIso: string,
  cfg: ConfigPlanos = CONFIG_PLANOS,
): Decisao {
  const s = situacaoAcesso(a, agoraIso, cfg);
  if (s.fase === 'sem_plano') return { permitido: false, motivo: 'sem_plano', mensagem: 'Escolha um plano para usar esta aba.' };
  if (!s.abas.includes(aba)) return { permitido: false, motivo: 'aba_fora_do_plano', mensagem: 'Esta aba não está no seu plano. Adicione quando quiser.' };
  if (acao === 'escrever' && !s.podeEscrever)
    return { permitido: false, motivo: 'somente_leitura', mensagem: 'Seu plano venceu. Pague para voltar a usar.' };
  return { permitido: true };
}

/** O que vai em `Empresa.plano` (contrato da Base): abas liberadas agora. */
export function abasLiberadas(a: Assinatura | null | undefined, agoraIso: string, cfg: ConfigPlanos = CONFIG_PLANOS): Aba[] {
  const s = situacaoAcesso(a, agoraIso, cfg);
  return s.fase === 'sem_plano' ? [] : s.abas;
}

function dataCurta(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso));
}
