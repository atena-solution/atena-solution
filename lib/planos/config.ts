// Planos, preços e créditos da ATENA SOLUTION.
// ESTE É O ARQUIVO PARA EDITAR VALORES. Todo o resto (site, cobrança, acesso) lê daqui.
// Valores em CENTAVOS de real (R$ 297,00 = 29700) para nunca ter erro de arredondamento.

export type Aba = 'atendimento' | 'coach' | 'estudio';
export type PlanoId = 'atendimento' | 'coach' | 'estudio' | 'completo';

export interface Plano {
  id: PlanoId;
  nome: string;
  chamada: string; // frase curta do cartão de preço
  abas: Aba[];
  precoMensal: number; // centavos — preço base do plano
  vendedoresInclusos: number; // Coach: quantos vendedores já vêm no preço base
  precoVendedorExtra: number; // centavos por vendedor além dos inclusos (0 = não se aplica)
  creditosMensais: number; // créditos do Estúdio somados a cada mês pago
  /** Atendimento: conversas diferentes que a IA atende por mês (0 = não se aplica). */
  conversasMes: number;
  /** Coach: horas de reunião por vendedor por mês (0 = não se aplica). */
  horasCoachPorVendedor: number;
  destaques: string[];
  maisEscolhido?: boolean;
}

export interface PacoteCreditos {
  id: string;
  creditos: number;
  preco: number; // centavos
}

export const CONFIG_PLANOS = {
  moeda: 'BRL',
  testeGratisDias: 7,
  /** Plano liberado durante o teste grátis (o cliente experimenta tudo). */
  planoDoTeste: 'completo' as PlanoId,
  /** Depois de vencer: dias com tudo funcionando + faixa de aviso. */
  diasCarencia: 3,
  /** Limites durante o teste grátis (pra ninguém usar o teste como produto de graça). Créditos do teste: lib/base/empresas.ts (20). */
  limitesTeste: { conversasMes: 50, horasCoach: 2 },
  /** Desconto (%) no pagamento anual. 0 desliga a opção. */
  descontoAnualPct: 15,
  /** Vendedores máximos no Coach (proteção contra digitação errada). */
  maxVendedores: 200,

  planos: [
    {
      id: 'atendimento',
      nome: 'Atendimento',
      chamada: 'Sua atendente de IA no WhatsApp, 24 horas.',
      abas: ['atendimento'],
      precoMensal: 29700,
      vendedoresInclusos: 0,
      precoVendedorExtra: 0,
      creditosMensais: 0,
      conversasMes: 1000,
      horasCoachPorVendedor: 0,
      destaques: [
        'Responde o cliente novo na hora, dia e noite',
        'Até 1.000 conversas por mês',
        'Marca, confirma e lembra horários na agenda',
        'Recupera quem faltou e pede avaliação',
        'Sua equipe assume a conversa quando quiser',
      ],
    },
    {
      id: 'coach',
      nome: 'Coach de Vendas',
      chamada: 'Cada reunião vira nota, dica e follow-up.',
      abas: ['coach'],
      precoMensal: 9700,
      vendedoresInclusos: 1,
      precoVendedorExtra: 9700,
      creditosMensais: 0,
      conversasMes: 0,
      horasCoachPorVendedor: 20,
      destaques: [
        'Grava e transcreve a reunião ou ligação',
        'Até 20 h de reunião por vendedor no mês',
        'Nota do vendedor contra o seu roteiro',
        'Objeções apontadas, com a melhor resposta',
        'Placar da equipe para o dono',
      ],
    },
    {
      id: 'estudio',
      nome: 'Estúdio',
      chamada: 'Foto de celular vira foto de catálogo.',
      abas: ['estudio'],
      precoMensal: 9700,
      vendedoresInclusos: 0,
      precoVendedorExtra: 0,
      creditosMensais: 100,
      conversasMes: 0,
      horasCoachPorVendedor: 0,
      destaques: [
        '100 créditos por mês',
        'Fotos profissionais com a sua marca',
        'Posts e vídeos curtos prontos para postar',
        'Calendário de conteúdo do mês',
      ],
    },
    {
      id: 'completo',
      nome: 'Pacote completo',
      chamada: 'As três abas juntas, com desconto.',
      abas: ['atendimento', 'coach', 'estudio'],
      precoMensal: 44700,
      vendedoresInclusos: 3,
      precoVendedorExtra: 5900,
      creditosMensais: 150,
      conversasMes: 1000,
      horasCoachPorVendedor: 20,
      destaques: [
        'Atendimento + Coach + Estúdio',
        'Coach com 3 vendedores inclusos',
        '150 créditos do Estúdio por mês',
        'Suporte prioritário na implantação',
      ],
      maisEscolhido: true,
    },
  ] satisfies Plano[] as Plano[],

  pacotesCreditos: [
    { id: 'creditos-50', creditos: 50, preco: 4900 },
    { id: 'creditos-150', creditos: 150, preco: 12900 },
    { id: 'creditos-400', creditos: 400, preco: 29700 },
  ] satisfies PacoteCreditos[] as PacoteCreditos[],
};

export type ConfigPlanos = typeof CONFIG_PLANOS;
