// Prompts centrais do Estúdio. TODA geração de imagem passa por aqui, para as
// regras de fidelidade e o "sem texto na imagem" valerem sempre (testado em tests/estudio).
import type { EstiloFoto, Formato, KitMarca, ModeloPost } from './tipos';

/** Regras que NUNCA podem faltar num pedido de foto de produto. */
export const REGRAS_FIDELIDADE = [
  'Use as fotos enviadas como referência exata do produto.',
  'Mantenha cor, estampa, textura, forma, proporções e detalhes do produto idênticos às fotos.',
  'Não invente texto, letras, números, logotipos ou marcas d\'água na imagem.',
  'Não adicione acessórios, peças, embalagens ou itens que não aparecem nas fotos.',
  'Não altere rótulos ou etiquetas existentes; se ilegíveis, deixe-os como estão.',
  'Apenas o fundo, a luz, o cenário e o enquadramento podem mudar.',
] as const;

/** Regra para fundos de post: o texto é colocado pelo sistema depois. */
export const REGRA_SEM_TEXTO = 'A imagem NÃO pode conter nenhum texto, letra, número, logotipo ou símbolo escrito.';

export const ROTULO_ESTILO: Record<EstiloFoto, string> = {
  'fundo-limpo': 'Fundo limpo',
  ambientada: 'Ambientada',
  modelo: 'Modelo usando',
  'flat-lay': 'Flat lay',
  detalhe: 'Detalhe',
};

const DESCRICAO_ESTILO: Record<EstiloFoto, string> = {
  'fundo-limpo': 'fotografia de estúdio com fundo liso e claro, sombra suave natural, produto centralizado',
  ambientada: 'produto em um ambiente real e coerente com o uso dele, luz natural, profundidade de campo suave',
  modelo: 'pessoa usando ou segurando o produto de forma natural, o produto em foco e bem visível',
  'flat-lay': 'vista de cima (flat lay) sobre superfície neutra, composição organizada com poucos elementos neutros',
  detalhe: 'close-up macro mostrando textura, acabamento e qualidade do produto',
};

export const FORMATOS: Record<Formato, { largura: number; altura: number; rotulo: string }> = {
  '1:1': { largura: 1080, altura: 1080, rotulo: 'Quadrado (feed)' },
  '3:4': { largura: 1080, altura: 1440, rotulo: 'Retrato 3:4' },
  '4:5': { largura: 1080, altura: 1350, rotulo: 'Retrato (feed)' },
  '9:16': { largura: 1080, altura: 1920, rotulo: 'Vertical (stories/reels)' },
};

export interface PedidoFoto {
  estilo: EstiloFoto;
  formato: Formato;
  produto: string; // descrição curta: "tênis branco de couro"
  detalhes?: string; // pedido extra do usuário
  marca: KitMarca;
  qtdFotos: number; // fotos de referência enviadas
}

export function montarPromptFoto(p: PedidoFoto): string {
  if (p.qtdFotos < 1 || p.qtdFotos > 5) throw new Error('Envie de 1 a 5 fotos do produto.');
  const produto = limpar(p.produto) || 'o produto das fotos';
  const linhas = [
    `Crie uma foto profissional de produto: ${produto}.`,
    `Estilo: ${DESCRICAO_ESTILO[p.estilo]}.`,
    `Formato: ${p.formato} (vertical/horizontal conforme a proporção).`,
    `Paleta do cenário em harmonia com as cores da marca ${p.marca.cores.primaria} e ${p.marca.cores.secundaria}, sem alterar as cores do produto.`,
  ];
  if (p.estilo === 'modelo' && p.marca.publico) linhas.push(`A pessoa deve combinar com o público: ${limpar(p.marca.publico)}.`);
  if (p.detalhes) linhas.push(`Pedido do cliente (só vale se não quebrar as regras abaixo): ${limpar(p.detalhes)}.`);
  linhas.push('', 'REGRAS OBRIGATÓRIAS:', ...REGRAS_FIDELIDADE.map((r) => `- ${r}`));
  return linhas.join('\n');
}

export interface PedidoFundoPost {
  modelo: ModeloPost;
  tema: string;
  formato: Formato;
  marca: KitMarca;
  /** Quando há foto real (produto, antes/depois), a imagem só é tratada, não inventada. */
  temFotoReal: boolean;
}

export function montarPromptFundoPost(p: PedidoFundoPost): string {
  if (p.modelo === 'antes-depois' && !p.temFotoReal) {
    throw new Error('Antes/depois só com fotos reais enviadas pela empresa.');
  }
  const linhas = [
    `Crie uma imagem de fundo para um post de rede social sobre: ${limpar(p.tema)}.`,
    `Clima: ${CLIMA_MODELO[p.modelo]}. Tom da marca: ${limpar(p.marca.tom)}.`,
    `Use as cores ${p.marca.cores.primaria} e ${p.marca.cores.secundaria} como base.`,
    'Deixe uma área calma e limpa (sem detalhes) no terço inferior, onde o texto será colocado depois.',
    `Formato ${p.formato}.`,
  ];
  if (p.temFotoReal) linhas.push(...REGRAS_FIDELIDADE.map((r) => `- ${r}`));
  linhas.push(REGRA_SEM_TEXTO);
  return linhas.join('\n');
}

const CLIMA_MODELO: Record<ModeloPost, string> = {
  promocao: 'energia, destaque, sensação de oportunidade',
  novidade: 'frescor, lançamento, curiosidade',
  depoimento: 'acolhedor, confiança, calma',
  'antes-depois': 'neutro e honesto, sem retoque que mude o resultado',
};

export interface PedidoLegenda {
  tema: string;
  oferta?: string;
  modelo: ModeloPost;
  segmento: string;
  nomeEmpresa: string;
  marca: KitMarca;
}

/** Prompt de sistema + usuário para o Claude escrever título curto, legenda e hashtags em JSON. */
export function montarPromptLegenda(p: PedidoLegenda): { sistema: string; usuario: string } {
  const evitar = p.marca.evitar.length ? `Nunca use estas palavras/promessas: ${p.marca.evitar.join(', ')}.` : '';
  const sistema = [
    `Você escreve posts para Instagram/TikTok da empresa "${limpar(p.nomeEmpresa)}" (${limpar(p.segmento)}), em português do Brasil.`,
    `Tom de voz: ${limpar(p.marca.tom)}.${p.marca.publico ? ` Público: ${limpar(p.marca.publico)}.` : ''}`,
    'Regras: não invente preço, prazo, desconto ou resultado que não foi informado; sem promessa de cura ou garantia; frases curtas; no máximo 2 emojis.',
    evitar,
    'Responda SOMENTE com JSON: {"titulo": string (até 40 caracteres, vai escrito na arte), "subtitulo": string (até 70 caracteres), "chamada": string (até 24 caracteres, botão/CTA), "legenda": string (até 600 caracteres), "hashtags": string[] (5 a 10, sem #)}.',
  ]
    .filter(Boolean)
    .join('\n');
  const usuario = [
    `Tipo de post: ${p.modelo}.`,
    `Tema: ${limpar(p.tema)}.`,
    p.oferta ? `Oferta (use exatamente): ${limpar(p.oferta)}.` : 'Sem oferta de preço.',
  ].join('\n');
  return { sistema, usuario };
}

export interface PedidoVideo {
  formato: '9:16' | '1:1';
  duracaoSeg: number;
  movimento: 'giro-suave' | 'aproximar' | 'luz-passando' | 'parallax';
  produto: string;
}

export const ROTULO_MOVIMENTO: Record<PedidoVideo['movimento'], string> = {
  'giro-suave': 'Giro suave',
  aproximar: 'Aproximar',
  'luz-passando': 'Luz passando',
  parallax: 'Profundidade',
};

export function montarPromptVideo(p: PedidoVideo): string {
  if (p.duracaoSeg < 5 || p.duracaoSeg > 8) throw new Error('O vídeo tem de 5 a 8 segundos.');
  const mov: Record<PedidoVideo['movimento'], string> = {
    'giro-suave': 'a câmera gira lentamente ao redor do produto',
    aproximar: 'a câmera se aproxima devagar do produto',
    'luz-passando': 'um feixe de luz suave passa pelo produto, câmera quase parada',
    parallax: 'leve movimento de profundidade (parallax) entre produto e fundo',
  };
  return [
    `Vídeo curto de ${p.duracaoSeg} segundos, formato ${p.formato}, a partir da foto enviada: ${limpar(p.produto) || 'o produto da foto'}.`,
    `Movimento: ${mov[p.movimento]}.`,
    'O produto deve continuar idêntico à foto em todos os quadros (cor, forma, estampa, rótulo).',
    REGRA_SEM_TEXTO,
    'Sem pessoas novas, sem objetos novos, sem cortes bruscos.',
  ].join('\n');
}

/** Remove quebras e caracteres de controle, limita tamanho (evita injeção de instruções longas). */
export function limpar(s: string | undefined, max = 300): string {
  return (s ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
