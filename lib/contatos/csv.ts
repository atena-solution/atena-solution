import type { Contato } from '../tipos';
import { normalizarBusca, normalizarTelefone } from '../ui/formato';

/** Lê CSV (vírgula, ponto e vírgula ou tab; aspas; quebra de linha dentro de aspas; BOM). */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primeiraLinha = t.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].map((s) => ({ s, n: primeiraLinha.split(s).length })).sort((a, b) => b.n - a.n)[0].s;

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ''));
}

type CampoConhecido = 'nome' | 'telefone' | 'email' | 'etiquetas' | 'origem';

const SINONIMOS: Record<CampoConhecido, string[]> = {
  nome: ['nome', 'name', 'cliente', 'nome completo', 'contato'],
  telefone: ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'phone', 'tel', 'numero'],
  email: ['email', 'e-mail', 'mail'],
  etiquetas: ['etiquetas', 'etiqueta', 'tags', 'tag'],
  origem: ['origem', 'fonte', 'source', 'canal'],
};

/** Descobre o que é cada coluna pelo cabeçalho. Colunas desconhecidas viram `campos` extras. */
export function mapearColunas(cabecalho: string[]): (CampoConhecido | { extra: string })[] {
  return cabecalho.map((h) => {
    const n = normalizarBusca(h);
    for (const [campo, nomes] of Object.entries(SINONIMOS) as [CampoConhecido, string[]][]) {
      if (nomes.includes(n)) return campo;
    }
    return { extra: h.trim() || 'coluna' };
  });
}

export interface ResultadoImportacao {
  novos: Contato[];
  erros: { linha: number; motivo: string }[];
  duplicados: number;
}

/**
 * Converte o CSV em contatos novos. Não duplica telefone já existente (nem repetido no arquivo).
 * `linha` nos erros é a linha do arquivo (1 = cabeçalho).
 */
export function importarContatosCsv(
  texto: string,
  opc: {
    empresaId: string;
    existentes: Pick<Contato, 'telefone'>[];
    etapaInicial: string;
    agora: Date;
    gerarId: () => string;
    origemPadrao?: string;
    limite?: number;
  },
): ResultadoImportacao {
  const linhas = lerCsv(texto);
  const r: ResultadoImportacao = { novos: [], erros: [], duplicados: 0 };
  if (linhas.length === 0) {
    r.erros.push({ linha: 1, motivo: 'Arquivo vazio.' });
    return r;
  }
  const mapa = mapearColunas(linhas[0]);
  if (!mapa.includes('telefone')) {
    r.erros.push({ linha: 1, motivo: 'Falta a coluna de telefone (ex.: "telefone" ou "whatsapp").' });
    return r;
  }
  const limite = opc.limite ?? 5000;
  if (linhas.length - 1 > limite) {
    r.erros.push({ linha: 1, motivo: `Arquivo grande demais: máximo de ${limite} contatos por vez.` });
    return r;
  }
  const vistos = new Set(opc.existentes.map((c) => c.telefone));
  const quando = opc.agora.toISOString();

  linhas.slice(1).forEach((cols, i) => {
    const numLinha = i + 2;
    const c: Partial<Record<CampoConhecido, string>> = {};
    const campos: Record<string, string> = {};
    mapa.forEach((m, j) => {
      const v = (cols[j] ?? '').trim();
      if (!v) return;
      if (typeof m === 'string') c[m] = v;
      else campos[m.extra] = v;
    });
    const telefone = c.telefone ? normalizarTelefone(c.telefone) : null;
    if (!telefone) {
      r.erros.push({ linha: numLinha, motivo: `Telefone inválido: "${c.telefone ?? ''}"` });
      return;
    }
    if (vistos.has(telefone)) {
      r.duplicados++;
      return;
    }
    vistos.add(telefone);
    const email = c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) ? c.email.toLowerCase() : undefined;
    r.novos.push({
      id: opc.gerarId(),
      empresaId: opc.empresaId,
      nome: c.nome || telefone,
      telefone,
      ...(email ? { email } : {}),
      origem: c.origem || opc.origemPadrao || 'Importação',
      etapa: opc.etapaInicial,
      etiquetas: c.etiquetas
        ? [...new Set(c.etiquetas.split(/[,|/]/).map((e) => e.trim()).filter(Boolean))]
        : [],
      ultimaInteracaoEm: quando,
      criadoEm: quando,
      campos,
    });
  });
  return r;
}
