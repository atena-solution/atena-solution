// Modelos de roteiro prontos por segmento, pra empresa começar sem página em branco.
import type { EtapaRoteiro, ObjecaoRoteiro, Roteiro } from './tipos';

const ETAPAS_BASE: EtapaRoteiro[] = [
  { id: 'conexao', nome: 'Conexão', objetivo: 'Quebrar o gelo e criar confiança.', perguntasChave: ['Como você conheceu a gente?'] },
  { id: 'diagnostico', nome: 'Diagnóstico', objetivo: 'Entender a dor, o objetivo, o prazo e quem decide.', perguntasChave: ['O que fez você procurar isso agora?', 'O que acontece se não resolver?', 'Quem mais participa da decisão?'] },
  { id: 'apresentacao', nome: 'Apresentação', objetivo: 'Mostrar a solução ligada às dores que o cliente falou.', perguntasChave: ['Faz sentido pra você?'] },
  { id: 'preco', nome: 'Preço', objetivo: 'Apresentar o investimento com segurança, depois do valor.', perguntasChave: ['Cabe no que você planejou?'] },
  { id: 'objecoes', nome: 'Objeções', objetivo: 'Ouvir, entender a objeção real e responder.', perguntasChave: ['Além disso, tem mais alguma coisa que te impede?'] },
  { id: 'fechamento', nome: 'Fechamento', objetivo: 'Pedir o fechamento e combinar o próximo passo com data.', perguntasChave: ['Vamos começar?', 'Qual o melhor dia pra gente começar?'] },
];

const OBJECOES_BASE: ObjecaoRoteiro[] = [
  { id: 'caro', objecao: 'Está caro', respostaIdeal: 'Concordar que é um investimento, comparar com o custo de não resolver e mostrar opções de pagamento.' },
  { id: 'pensar', objecao: 'Vou pensar', respostaIdeal: 'Perguntar o que falta pra decidir hoje e combinar data e hora do retorno.' },
  { id: 'socio', objecao: 'Preciso falar com meu sócio/esposa', respostaIdeal: 'Oferecer uma conversa rápida com a pessoa junto e mandar um resumo por escrito.' },
  { id: 'concorrente', objecao: 'Achei mais barato', respostaIdeal: 'Perguntar o que está incluso na outra proposta e reforçar o diferencial que importa pro cliente.' },
];

type Extra = { etapas?: Partial<Record<string, string[]>>; objecoes: ObjecaoRoteiro[] };

const EXTRAS: Record<string, Extra> = {
  clinica: {
    etapas: { diagnostico: ['Há quanto tempo sente isso?', 'Já tentou algum tratamento?'] },
    objecoes: [
      { id: 'convenio', objecao: 'Não aceita meu convênio?', respostaIdeal: 'Explicar o reembolso e o valor do atendimento particular, com parcelamento.' },
      { id: 'medo', objecao: 'Tenho medo do procedimento', respostaIdeal: 'Acolher, explicar passo a passo, mostrar casos e a segurança da equipe.' },
    ],
  },
  barbearia: {
    etapas: { fechamento: ['Já deixo seu próximo horário marcado?'] },
    objecoes: [{ id: 'tempo', objecao: 'Não tenho tempo', respostaIdeal: 'Oferecer horários de encaixe e lembrar que o atendimento é rápido e com hora marcada.' }],
  },
  estetica: {
    etapas: { diagnostico: ['Qual resultado você quer ver no espelho?'] },
    objecoes: [{ id: 'resultado', objecao: 'Será que funciona pra mim?', respostaIdeal: 'Mostrar antes e depois de casos parecidos e explicar o número de sessões.' }],
  },
  imobiliaria: {
    etapas: { diagnostico: ['Quantos quartos e qual região?', 'Vai financiar ou à vista?'] },
    objecoes: [
      { id: 'financiamento', objecao: 'Não sei se consigo financiar', respostaIdeal: 'Oferecer simulação na hora com o correspondente bancário.' },
      { id: 'visitar', objecao: 'Quero ver outros imóveis', respostaIdeal: 'Marcar a visita deste e de mais duas opções no mesmo dia.' },
    ],
  },
  escola: {
    etapas: { diagnostico: ['Qual o objetivo do aluno?', 'Qual turno funciona melhor?'] },
    objecoes: [{ id: 'matricula', objecao: 'Vou esperar o próximo semestre', respostaIdeal: 'Mostrar o que o aluno perde esperando e a condição de matrícula de agora.' }],
  },
  loja: {
    objecoes: [{ id: 'frete', objecao: 'O frete está caro', respostaIdeal: 'Oferecer retirada, frete grátis acima de um valor ou um item a mais no pedido.' }],
  },
  agencia: {
    etapas: { diagnostico: ['Quanto fatura hoje e quanto quer faturar?', 'Já investiu em anúncio?'] },
    objecoes: [{ id: 'resultado', objecao: 'Já contratei agência e não deu certo', respostaIdeal: 'Perguntar o que deu errado e mostrar como será o acompanhamento e as metas.' }],
  },
};

export const SEGMENTOS = [
  { id: 'generico', nome: 'Geral' },
  { id: 'clinica', nome: 'Clínica' },
  { id: 'barbearia', nome: 'Barbearia' },
  { id: 'estetica', nome: 'Estética' },
  { id: 'imobiliaria', nome: 'Imobiliária' },
  { id: 'escola', nome: 'Escola' },
  { id: 'loja', nome: 'Loja' },
  { id: 'agencia', nome: 'Agência' },
] as const;

/** Normaliza nomes livres de segmento ("Clínica odontológica" → "clinica"). */
export function idDoSegmento(segmento: string | undefined): string {
  const s = (segmento ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const { id } of SEGMENTOS) if (id !== 'generico' && s.includes(id)) return id;
  if (s.includes('barber')) return 'barbearia';
  if (s.includes('imove') || s.includes('imobil')) return 'imobiliaria';
  if (s.includes('curso')) return 'escola';
  return 'generico';
}

export function modeloDeRoteiro(segmento: string | undefined): Roteiro {
  const id = idDoSegmento(segmento);
  const extra = EXTRAS[id];
  const etapas = ETAPAS_BASE.map((e) => ({
    ...e,
    perguntasChave: [...e.perguntasChave, ...(extra?.etapas?.[e.id] ?? [])],
  }));
  return { segmento: id, etapas, objecoes: [...OBJECOES_BASE, ...(extra?.objecoes ?? [])] };
}
