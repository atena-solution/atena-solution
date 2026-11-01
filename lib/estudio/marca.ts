// Kit da marca: parte do onboarding (Empresa.marca) e completa com padrões do Estúdio.
import type { KitMarca } from './tipos';

export const FONTES_DISPONIVEIS = ['Inter', 'Instrument Serif', 'Montserrat', 'Playfair Display', 'Poppins', 'DM Sans'] as const;

export const KIT_PADRAO: KitMarca = {
  logoUrl: '',
  cores: { primaria: '#3B5BDB', secundaria: '#7048E8' },
  fontes: { titulo: 'Instrument Serif', texto: 'Inter' },
  tom: 'próximo e profissional',
  publico: '',
  evitar: [],
};

interface MarcaEmpresa {
  logoUrl?: string;
  cores?: { primaria?: string; secundaria?: string };
  tom?: string;
}

/** Monta o kit a partir do que veio do onboarding + o que foi salvo no Estúdio. */
export function kitDaEmpresa(marca: MarcaEmpresa | undefined, extras: Partial<KitMarca> = {}): KitMarca {
  return normalizarKit({
    ...KIT_PADRAO,
    logoUrl: marca?.logoUrl ?? '',
    cores: {
      primaria: marca?.cores?.primaria || KIT_PADRAO.cores.primaria,
      secundaria: marca?.cores?.secundaria || KIT_PADRAO.cores.secundaria,
    },
    tom: marca?.tom || KIT_PADRAO.tom,
    ...extras,
  });
}

export function normalizarHex(cor: string): string | null {
  const c = cor.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(c)) {
    return ('#' + c.split('').map((x) => x + x).join('')).toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(c)) return ('#' + c).toUpperCase();
  return null;
}

export function normalizarKit(k: KitMarca): KitMarca {
  return {
    ...k,
    cores: {
      primaria: normalizarHex(k.cores.primaria) ?? KIT_PADRAO.cores.primaria,
      secundaria: normalizarHex(k.cores.secundaria) ?? KIT_PADRAO.cores.secundaria,
    },
    tom: k.tom.trim().slice(0, 120),
    publico: k.publico.trim().slice(0, 200),
    evitar: Array.from(new Set(k.evitar.map((p) => p.trim().toLowerCase()).filter(Boolean))).slice(0, 30),
  };
}

/** Erros de preenchimento para mostrar no formulário (campo → mensagem). */
export function validarKit(k: Partial<KitMarca>): Record<string, string> {
  const erros: Record<string, string> = {};
  if (k.cores) {
    if (!normalizarHex(k.cores.primaria ?? '')) erros.primaria = 'Use uma cor no formato #RRGGBB.';
    if (!normalizarHex(k.cores.secundaria ?? '')) erros.secundaria = 'Use uma cor no formato #RRGGBB.';
  }
  if (k.fontes) {
    for (const campo of ['titulo', 'texto'] as const) {
      if (!(FONTES_DISPONIVEIS as readonly string[]).includes(k.fontes[campo])) erros[campo] = 'Escolha uma fonte da lista.';
    }
  }
  if (k.tom !== undefined && k.tom.trim().length < 3) erros.tom = 'Descreva o tom em poucas palavras.';
  return erros;
}
