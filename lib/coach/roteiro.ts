// Validação/normalização do roteiro editado na tela.
import type { EtapaRoteiro, ObjecaoRoteiro, Roteiro } from './tipos';

const MAX_ETAPAS = 12;
const MAX_OBJECOES = 30;

export function slug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

function txt(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function idUnico(base: string, usados: Set<string>): string {
  let id = base;
  let n = 2;
  while (usados.has(id)) id = `${base}-${n++}`;
  usados.add(id);
  return id;
}

/** Recebe o que veio da tela e devolve um roteiro limpo, ou a lista de erros. */
export function normalizarRoteiro(entrada: unknown): { ok: true; roteiro: Roteiro } | { ok: false; erros: string[] } {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const erros: string[] = [];
  const usadosE = new Set<string>();
  const etapas: EtapaRoteiro[] = (Array.isArray(e.etapas) ? e.etapas : [])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => txt(x?.nome))
    .slice(0, MAX_ETAPAS)
    .map((x) => {
      const nome = txt(x.nome, 60);
      return {
        id: idUnico(txt(x.id, 40) ? slug(txt(x.id, 40)) : slug(nome), usadosE),
        nome,
        objetivo: txt(x.objetivo),
        perguntasChave: (Array.isArray(x.perguntasChave) ? x.perguntasChave : []).map((p) => txt(p, 200)).filter(Boolean).slice(0, 10),
      };
    });
  const usadosO = new Set<string>();
  const objecoes: ObjecaoRoteiro[] = (Array.isArray(e.objecoes) ? e.objecoes : [])
    .map((x) => x as Record<string, unknown>)
    .filter((x) => txt(x?.objecao))
    .slice(0, MAX_OBJECOES)
    .map((x) => {
      const objecao = txt(x.objecao, 120);
      return { id: idUnico(txt(x.id, 40) ? slug(txt(x.id, 40)) : slug(objecao), usadosO), objecao, respostaIdeal: txt(x.respostaIdeal, 800) };
    });

  if (etapas.length === 0) erros.push('Coloque pelo menos uma etapa no roteiro.');
  if (erros.length) return { ok: false, erros };
  return { ok: true, roteiro: { segmento: txt(e.segmento, 40) || 'generico', etapas, objecoes } };
}

/** Texto do roteiro pro prompt da IA. */
export function roteiroParaTexto(r: Roteiro): string {
  const etapas = r.etapas
    .map((e, i) => `${i + 1}. [${e.id}] ${e.nome} — ${e.objetivo}${e.perguntasChave.length ? `\n   Perguntas-chave: ${e.perguntasChave.join(' | ')}` : ''}`)
    .join('\n');
  const obj = r.objecoes.map((o) => `- "${o.objecao}" → resposta ideal: ${o.respostaIdeal}`).join('\n');
  return `ETAPAS:\n${etapas}\n\nOBJEÇÕES COMUNS:\n${obj || '(nenhuma cadastrada)'}`;
}
