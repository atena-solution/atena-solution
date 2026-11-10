// Ligação do Coach com Contatos e funil (contrato da Base) e com o follow-up no WhatsApp.
import type { ConfigCoach, Reuniao, Resultado } from './tipos';

const ROTULO_RESULTADO: Record<Resultado, string> = {
  fechou: 'Fechou',
  retorno: 'Retorno combinado',
  pensando: 'Cliente vai pensar',
  sem_interesse: 'Sem interesse',
};

export function rotuloResultado(r: Resultado): string {
  return ROTULO_RESULTADO[r];
}

/** Atividade pra linha do tempo do contato (formato Atividade da Base). */
export function atividadeDaReuniao(r: Reuniao): {
  contatoId: string; tipo: 'reuniao'; resumo: string; quando: string; porUid: string; reuniaoId: string;
} | null {
  if (!r.contatoId) return null;
  const partes = [`Reunião com ${r.vendedorNome}`];
  if (r.analise) partes.push(`${rotuloResultado(r.analise.resultado)} · nota ${r.analise.nota.toFixed(1)}`);
  return { contatoId: r.contatoId, tipo: 'reuniao', resumo: partes.join(' — '), quando: r.criadoEm, porUid: r.vendedorUid, reuniaoId: r.id };
}

/** Para qual etapa do funil mover o contato (null = não mexer). Nunca "rebaixa" um Cliente. */
export function etapaSugerida(resultado: Resultado, config: ConfigCoach, etapaAtual?: string): string | null {
  if (!config.moverEtapa) return null;
  const destino = config.etapaPorResultado[resultado];
  if (!destino) return null;
  if (etapaAtual && etapaAtual === destino) return null;
  if (etapaAtual === 'Cliente' && resultado !== 'fechou') return null;
  return destino;
}

/** Telefone E.164 sem + (contrato). Aceita formatos brasileiros soltos. */
export function normalizarTelefone(t: string | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

export function linkWaMe(telefone: string | undefined, texto: string): string | null {
  const tel = normalizarTelefone(telefone);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

/** Como mandar o follow-up: pelo WhatsApp da empresa (aba Atendimento ativa e número conectado) ou wa.me. */
export function canalFollowup(p: { abas: string[]; whatsappConectado: boolean }): 'whatsapp-empresa' | 'wa.me' {
  return p.abas.includes('atendimento') && p.whatsappConectado ? 'whatsapp-empresa' : 'wa.me';
}
