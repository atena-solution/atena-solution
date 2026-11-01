import type { Atividade, Contato, EtapaFunil } from '../tipos';
import { normalizarBusca } from '../ui/formato';

export const ETAPAS_PADRAO: EtapaFunil[] = [
  { id: 'novo', nome: 'Novo', cor: '#3B5BDB' },
  { id: 'em-conversa', nome: 'Em conversa', cor: '#0F9B8E' },
  { id: 'agendado', nome: 'Agendado', cor: '#7048E8' },
  { id: 'compareceu', nome: 'Compareceu', cor: '#1F9A66' },
  { id: 'cliente', nome: 'Cliente', cor: '#D08A1F' },
  { id: 'perdido', nome: 'Perdido', cor: '#868C97' },
];

export const ORIGENS_COMUNS = ['WhatsApp', 'Instagram', 'Indicação', 'Google', 'Site', 'Importação', 'Balcão'];

export function etapasDaEmpresa(etapas?: EtapaFunil[]): EtapaFunil[] {
  return etapas && etapas.length > 0 ? etapas : ETAPAS_PADRAO;
}

/** Transforma um nome em id de etapa ("Em conversa" → "em-conversa"). */
export function idDeEtapa(nome: string): string {
  return normalizarBusca(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Valida a lista de etapas configurada pela empresa. */
export function validarEtapas(etapas: EtapaFunil[]): string | null {
  if (etapas.length < 2) return 'O funil precisa de pelo menos 2 etapas.';
  if (etapas.length > 12) return 'Use no máximo 12 etapas.';
  const ids = new Set<string>();
  for (const e of etapas) {
    if (!e.nome.trim()) return 'Toda etapa precisa de nome.';
    if (!/^[a-z0-9-]{1,40}$/.test(e.id)) return `Id de etapa inválido: ${e.id}`;
    if (ids.has(e.id)) return `Etapa repetida: ${e.nome}`;
    ids.add(e.id);
  }
  return null;
}

/** Agrupa contatos por etapa, na ordem das etapas; etapa desconhecida cai na primeira. */
export function agruparPorEtapa(contatos: Contato[], etapas: EtapaFunil[]): Record<string, Contato[]> {
  const r: Record<string, Contato[]> = Object.fromEntries(etapas.map((e) => [e.id, []]));
  const primeira = etapas[0]?.id;
  for (const c of contatos) (r[c.etapa] ?? r[primeira]).push(c);
  for (const k of Object.keys(r)) r[k].sort((a, b) => b.ultimaInteracaoEm.localeCompare(a.ultimaInteracaoEm));
  return r;
}

/** Move o contato de etapa e gera a atividade da linha do tempo. */
export function moverEtapa(
  contato: Contato,
  etapaId: string,
  etapas: EtapaFunil[],
  quem: { uid?: string; ia?: boolean },
  agora: Date,
  gerarId: () => string,
): { contato: Contato; atividade: Atividade | null } {
  const destino = etapas.find((e) => e.id === etapaId);
  if (!destino) throw new Error('Etapa não existe.');
  if (contato.etapa === etapaId) return { contato, atividade: null };
  const origem = etapas.find((e) => e.id === contato.etapa);
  const quando = agora.toISOString();
  return {
    contato: { ...contato, etapa: etapaId, ultimaInteracaoEm: quando },
    atividade: {
      id: gerarId(),
      contatoId: contato.id,
      tipo: 'etapa',
      resumo: `Etapa: ${origem?.nome ?? contato.etapa} → ${destino.nome}`,
      quando,
      ...(quem.uid ? { porUid: quem.uid } : {}),
      ...(quem.ia ? { porIA: true } : {}),
    },
  };
}

export interface FiltroContatos {
  busca?: string;
  etapa?: string;
  etiqueta?: string;
  origem?: string;
  responsavelUid?: string;
}

export function filtrarContatos(contatos: Contato[], f: FiltroContatos): Contato[] {
  const termo = f.busca ? normalizarBusca(f.busca) : '';
  const digitos = termo.replace(/\D/g, '');
  return contatos.filter((c) => {
    if (f.etapa && c.etapa !== f.etapa) return false;
    if (f.etiqueta && !c.etiquetas.includes(f.etiqueta)) return false;
    if (f.origem && c.origem !== f.origem) return false;
    if (f.responsavelUid && c.responsavelUid !== f.responsavelUid) return false;
    if (termo) {
      const alvo = normalizarBusca(`${c.nome} ${c.email ?? ''} ${c.etiquetas.join(' ')}`);
      const bateTexto = alvo.includes(termo);
      const bateTelefone = digitos.length >= 3 && c.telefone.includes(digitos);
      if (!bateTexto && !bateTelefone) return false;
    }
    return true;
  });
}

/** Todas as etiquetas usadas, ordenadas. */
export function etiquetasUsadas(contatos: Contato[]): string[] {
  return [...new Set(contatos.flatMap((c) => c.etiquetas))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Linha do tempo: mais recente primeiro. */
export function linhaDoTempo(atividades: Atividade[], contatoId: string): Atividade[] {
  return atividades.filter((a) => a.contatoId === contatoId).sort((a, b) => b.quando.localeCompare(a.quando));
}
