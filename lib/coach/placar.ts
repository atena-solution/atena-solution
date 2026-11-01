// Placar e evolução da equipe (funções puras sobre a lista de reuniões da empresa).
import type { Reuniao } from './tipos';

export interface LinhaPlacar {
  vendedorUid: string;
  vendedorNome: string;
  reunioes: number;
  analisadas: number;
  notaMedia: number | null;
  /** fechou / analisadas, 0–100 */
  taxaFechamento: number | null;
  falaVendedorMedia: number | null;
  etapasEsquecidas: { etapaId: string; nome: string; vezes: number }[];
}

export interface PontoSemana {
  /** segunda-feira da semana, AAAA-MM-DD */
  semana: string;
  reunioes: number;
  notaMedia: number | null;
  taxaFechamento: number | null;
}

const media = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function analisadas(rs: Reuniao[]) {
  return rs.filter((r) => r.analise);
}

/** Etapas mais esquecidas (não feitas = 1, parcial = 0,5), da mais esquecida pra menos. */
export function etapasMaisEsquecidas(rs: Reuniao[], limite = 3) {
  const cont = new Map<string, { etapaId: string; nome: string; vezes: number }>();
  for (const r of analisadas(rs)) {
    for (const e of r.analise!.etapas) {
      const peso = e.status === 'nao_feita' ? 1 : e.status === 'parcial' ? 0.5 : 0;
      if (!peso) continue;
      const c = cont.get(e.etapaId) ?? { etapaId: e.etapaId, nome: e.nome, vezes: 0 };
      c.vezes += peso;
      cont.set(e.etapaId, c);
    }
  }
  return [...cont.values()].sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome)).slice(0, limite);
}

export function placarPorVendedor(rs: Reuniao[]): LinhaPlacar[] {
  const grupos = new Map<string, Reuniao[]>();
  for (const r of rs) grupos.set(r.vendedorUid, [...(grupos.get(r.vendedorUid) ?? []), r]);
  const linhas: LinhaPlacar[] = [];
  for (const [uid, lista] of grupos) {
    const an = analisadas(lista);
    const fechou = an.filter((r) => r.analise!.resultado === 'fechou').length;
    linhas.push({
      vendedorUid: uid,
      vendedorNome: lista[lista.length - 1].vendedorNome,
      reunioes: lista.length,
      analisadas: an.length,
      notaMedia: media(an.map((r) => r.analise!.nota)),
      taxaFechamento: an.length ? Math.round((fechou / an.length) * 100) : null,
      falaVendedorMedia: media(an.filter((r) => r.analise!.fala.vendedorPct + r.analise!.fala.clientePct > 0).map((r) => r.analise!.fala.vendedorPct)),
      etapasEsquecidas: etapasMaisEsquecidas(lista),
    });
  }
  return linhas.sort((a, b) => (b.notaMedia ?? -1) - (a.notaMedia ?? -1) || b.reunioes - a.reunioes);
}

/** Segunda-feira (AAAA-MM-DD) da semana da data, no fuso de São Paulo (UTC-3, sem horário de verão). */
export function inicioDaSemana(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  const dia = d.getUTCDay(); // 0 = domingo
  const volta = dia === 0 ? 6 : dia - 1;
  d.setUTCDate(d.getUTCDate() - volta);
  return d.toISOString().slice(0, 10);
}

export function tendenciaSemanal(rs: Reuniao[], semanas = 8, agoraISO = new Date().toISOString()): PontoSemana[] {
  const atual = inicioDaSemana(agoraISO);
  const chaves: string[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const d = new Date(`${atual}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    chaves.push(d.toISOString().slice(0, 10));
  }
  return chaves.map((semana) => {
    const da = rs.filter((r) => inicioDaSemana(r.criadoEm) === semana);
    const an = analisadas(da);
    return {
      semana,
      reunioes: da.length,
      notaMedia: media(an.map((r) => r.analise!.nota)),
      taxaFechamento: an.length ? Math.round((an.filter((r) => r.analise!.resultado === 'fechou').length / an.length) * 100) : null,
    };
  });
}

function chaveObjecao(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Objeções mais comuns nos últimos `dias` (padrão 7), com quantas foram bem respondidas. */
export function objecoesComuns(rs: Reuniao[], agoraISO = new Date().toISOString(), dias = 7, limite = 5) {
  const desde = new Date(agoraISO).getTime() - dias * 86400000;
  const cont = new Map<string, { objecao: string; vezes: number; bemRespondidas: number }>();
  for (const r of analisadas(rs)) {
    if (new Date(r.criadoEm).getTime() < desde) continue;
    for (const o of r.analise!.objecoes) {
      const k = chaveObjecao(o.objecao);
      if (!k) continue;
      const c = cont.get(k) ?? { objecao: o.objecao, vezes: 0, bemRespondidas: 0 };
      c.vezes++;
      if (o.bemRespondida) c.bemRespondidas++;
      cont.set(k, c);
    }
  }
  return [...cont.values()].sort((a, b) => b.vezes - a.vezes).slice(0, limite);
}

/** Biblioteca: marcadas pelo gestor primeiro, depois as melhores notas (≥ 8). */
export function biblioteca(rs: Reuniao[], limite = 10): Reuniao[] {
  return analisadas(rs)
    .filter((r) => r.naBiblioteca || r.analise!.nota >= 8)
    .sort((a, b) => Number(b.naBiblioteca) - Number(a.naBiblioteca) || b.analise!.nota - a.analise!.nota)
    .slice(0, limite);
}

/** Cartão do Início: reuniões de hoje e nota média da semana. */
export function resumoInicio(rs: Reuniao[], agoraISO = new Date().toISOString()) {
  const hoje = new Date(new Date(agoraISO).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const deHoje = rs.filter((r) => new Date(new Date(r.criadoEm).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10) === hoje);
  const semana = inicioDaSemana(agoraISO);
  const daSemana = analisadas(rs.filter((r) => inicioDaSemana(r.criadoEm) === semana));
  return {
    reunioesHoje: deHoje.length,
    notaMediaSemana: media(daSemana.map((r) => r.analise!.nota)),
    fechamentosSemana: daSemana.filter((r) => r.analise!.resultado === 'fechou').length,
  };
}
