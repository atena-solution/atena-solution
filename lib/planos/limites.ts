// Limites de uso por mês (regra pura). Os números moram em lib/planos/config.ts.
//   Atendimento: conversas DIFERENTES que a IA atende no mês. Conversa já atendida no mês continua; só a nova é barrada.
//   Coach: horas de reunião no mês = horas por vendedor × vendedores do plano (mínimo = os inclusos).
//   Teste grátis: limites próprios (CONFIG_PLANOS.limitesTeste).
import { CONFIG_PLANOS, type ConfigPlanos } from './config';
import { situacaoAcesso, type Assinatura, type Decisao } from './acesso';
import { obterPlano } from './preco';

export interface Limites { conversasMes: number; segundosCoachMes: number }

/** 0 = sem essa aba (quem decide se a aba está no plano é o podeUsarAba). */
export function limitesDaAssinatura(a: Assinatura | null | undefined, agoraIso: string, cfg: ConfigPlanos = CONFIG_PLANOS): Limites {
  const s = situacaoAcesso(a, agoraIso, cfg);
  if (s.fase === 'teste') return { conversasMes: cfg.limitesTeste.conversasMes, segundosCoachMes: cfg.limitesTeste.horasCoach * 3600 };
  const p = a ? obterPlano(a.planoId, cfg) : undefined;
  if (!p) return { conversasMes: 0, segundosCoachMes: 0 };
  const vendedores = Math.max(a?.vendedores ?? 0, p.vendedoresInclusos, p.horasCoachPorVendedor ? 1 : 0);
  return { conversasMes: p.conversasMes, segundosCoachMes: p.horasCoachPorVendedor * 3600 * vendedores };
}

/** Atendimento: a IA pode atender esta conversa? (já atendida no mês = sim). */
export function decidirConversa(lim: Limites, jaContadas: number, estaJaFoiContada: boolean, teste: boolean): Decisao {
  if (estaJaFoiContada || jaContadas < lim.conversasMes) return { permitido: true };
  return {
    permitido: false,
    motivo: 'limite',
    mensagem: teste
      ? `O teste grátis atende até ${lim.conversasMes} conversas. Escolha um plano para a IA continuar respondendo.`
      : `Sua IA já atendeu ${lim.conversasMes} conversas este mês (limite do plano). Fale com a gente para aumentar.`,
  };
}

/** Coach: ainda tem horas de reunião no mês? */
export function decidirCoach(lim: Limites, segundosUsados: number, teste: boolean): Decisao {
  if (segundosUsados < lim.segundosCoachMes) return { permitido: true };
  const horas = Math.round(lim.segundosCoachMes / 360) / 10;
  return {
    permitido: false,
    motivo: 'limite',
    mensagem: teste
      ? `O teste grátis analisa até ${horas} h de reunião. Escolha um plano para continuar.`
      : `Sua equipe já usou as ${horas} h de reunião do mês. Adicione vendedores no plano para ganhar mais horas.`,
  };
}
