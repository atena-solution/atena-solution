// Calendário de conteúdo: datas comemorativas por segmento + sugestão do mês.
// A base é pura e determinística; a IA (Claude) pode refinar os temas depois.
import type { ModeloPost } from './tipos';

export type Segmento =
  | 'clinica' | 'barbearia' | 'estetica' | 'imobiliaria' | 'escola' | 'loja' | 'agencia' | 'restaurante' | 'outro';

export const SEGMENTOS: Record<Segmento, string> = {
  clinica: 'Clínica / saúde',
  barbearia: 'Barbearia',
  estetica: 'Estética / beleza',
  imobiliaria: 'Imobiliária',
  escola: 'Escola / cursos',
  loja: 'Loja / varejo',
  agencia: 'Agência / serviços',
  restaurante: 'Restaurante / alimentação',
  outro: 'Outro',
};

export interface DataComemorativa {
  nome: string;
  dia: number;
  mes: number; // 1..12
  segmentos: Segmento[] | 'todos';
  ideia: string;
  modelo: ModeloPost;
}

type Regra = Omit<DataComemorativa, 'dia' | 'mes'> & ({ dia: number; mes: number } | { calcular: (ano: number) => Date });

const VAREJO: Segmento[] = ['loja', 'estetica', 'barbearia', 'restaurante'];

const REGRAS: Regra[] = [
  { nome: 'Ano Novo', dia: 1, mes: 1, segmentos: 'todos', ideia: 'Metas e boas-vindas ao ano novo', modelo: 'novidade' },
  { nome: 'Volta às aulas', dia: 2, mes: 2, segmentos: ['escola', 'loja'], ideia: 'Matrículas abertas / kit volta às aulas', modelo: 'promocao' },
  { nome: 'Carnaval', calcular: (a) => somarDias(pascoa(a), -47), segmentos: ['barbearia', 'estetica', 'loja', 'restaurante'], ideia: 'Visual e preparação pro Carnaval', modelo: 'promocao' },
  { nome: 'Dia da Mulher', dia: 8, mes: 3, segmentos: 'todos', ideia: 'Homenagem às clientes', modelo: 'novidade' },
  { nome: 'Dia do Consumidor', dia: 15, mes: 3, segmentos: VAREJO, ideia: 'Condição especial do Dia do Consumidor', modelo: 'promocao' },
  { nome: 'Dia Mundial da Saúde', dia: 7, mes: 4, segmentos: ['clinica', 'estetica'], ideia: 'Dica de saúde e check-up', modelo: 'novidade' },
  { nome: 'Páscoa', calcular: pascoa, segmentos: ['loja', 'restaurante', 'escola'], ideia: 'Mensagem e oferta de Páscoa', modelo: 'promocao' },
  { nome: 'Dia das Mães', calcular: (a) => nesimoDomingo(a, 5, 2), segmentos: 'todos', ideia: 'Presente/homenagem para as mães', modelo: 'promocao' },
  { nome: 'Dia dos Namorados', dia: 12, mes: 6, segmentos: VAREJO, ideia: 'Presente ou programa a dois', modelo: 'promocao' },
  { nome: 'Festa Junina', dia: 24, mes: 6, segmentos: ['escola', 'restaurante', 'loja'], ideia: 'Arraiá da empresa', modelo: 'novidade' },
  { nome: 'Dia dos Avós', dia: 26, mes: 7, segmentos: ['clinica', 'loja'], ideia: 'Cuidado com quem cuidou da gente', modelo: 'depoimento' },
  { nome: 'Dia dos Pais', calcular: (a) => nesimoDomingo(a, 8, 2), segmentos: 'todos', ideia: 'Presente/homenagem para os pais', modelo: 'promocao' },
  { nome: 'Dia do Cliente', dia: 15, mes: 9, segmentos: 'todos', ideia: 'Agradecimento + depoimento de cliente', modelo: 'depoimento' },
  { nome: 'Dia do Corretor de Imóveis', dia: 27, mes: 8, segmentos: ['imobiliaria'], ideia: 'Bastidores da equipe', modelo: 'novidade' },
  { nome: 'Dia das Crianças', dia: 12, mes: 10, segmentos: ['loja', 'escola', 'restaurante', 'clinica'], ideia: 'Diversão e cuidado com os pequenos', modelo: 'promocao' },
  { nome: 'Outubro Rosa', dia: 1, mes: 10, segmentos: ['clinica', 'estetica'], ideia: 'Prevenção do câncer de mama', modelo: 'novidade' },
  { nome: 'Dia do Professor', dia: 15, mes: 10, segmentos: ['escola'], ideia: 'Homenagem aos professores', modelo: 'depoimento' },
  { nome: 'Novembro Azul', dia: 1, mes: 11, segmentos: ['clinica', 'barbearia'], ideia: 'Saúde do homem', modelo: 'novidade' },
  { nome: 'Black Friday', calcular: blackFriday, segmentos: VAREJO.concat(['escola', 'agencia', 'imobiliaria']), ideia: 'A maior oferta do ano', modelo: 'promocao' },
  { nome: 'Natal', dia: 25, mes: 12, segmentos: 'todos', ideia: 'Mensagem de Natal e horários de fim de ano', modelo: 'novidade' },
  { nome: 'Réveillon', dia: 31, mes: 12, segmentos: ['barbearia', 'estetica', 'loja', 'restaurante'], ideia: 'Visual/preparação para a virada', modelo: 'promocao' },
];

export function datasDoMes(ano: number, mes: number, segmento: Segmento): DataComemorativa[] {
  return REGRAS.map((r) => {
    const d = 'calcular' in r ? r.calcular(ano) : new Date(Date.UTC(ano, r.mes - 1, r.dia));
    const { calcular: _c, ...resto } = r as Regra & { calcular?: unknown };
    return { ...resto, dia: d.getUTCDate(), mes: d.getUTCMonth() + 1 } as DataComemorativa;
  })
    .filter((d) => d.mes === mes && (d.segmentos === 'todos' || d.segmentos.includes(segmento)))
    .sort((a, b) => a.dia - b.dia);
}

export type StatusPauta = 'rascunho' | 'arte-gerada' | 'publicado';

export interface Pauta {
  id: string;
  empresaId: string;
  data: string; // AAAA-MM-DD
  tema: string;
  modelo: ModeloPost;
  motivo: string; // por que este dia
  status: StatusPauta;
  criacaoId?: string;
  publicadoEm?: string;
}

/** Ideias "de sempre" por segmento para os dias sem data comemorativa. */
const PAUTAS_FIXAS: Record<Segmento, { tema: string; modelo: ModeloPost }[]> = {
  clinica: [
    { tema: 'Dúvida frequente respondida pelo especialista', modelo: 'novidade' },
    { tema: 'Depoimento de paciente', modelo: 'depoimento' },
    { tema: 'Conheça a equipe / estrutura', modelo: 'novidade' },
    { tema: 'Lembrete de check-up / retorno', modelo: 'promocao' },
  ],
  barbearia: [
    { tema: 'Corte da semana', modelo: 'novidade' },
    { tema: 'Antes e depois de cliente', modelo: 'antes-depois' },
    { tema: 'Horários livres da semana', modelo: 'promocao' },
    { tema: 'Depoimento de cliente', modelo: 'depoimento' },
  ],
  estetica: [
    { tema: 'Procedimento explicado em 3 passos', modelo: 'novidade' },
    { tema: 'Resultado real de cliente', modelo: 'antes-depois' },
    { tema: 'Pacote do mês', modelo: 'promocao' },
    { tema: 'Depoimento de cliente', modelo: 'depoimento' },
  ],
  imobiliaria: [
    { tema: 'Imóvel em destaque', modelo: 'novidade' },
    { tema: 'Dica para comprar/alugar', modelo: 'novidade' },
    { tema: 'Cliente que realizou o sonho', modelo: 'depoimento' },
    { tema: 'Condição especial de lançamento', modelo: 'promocao' },
  ],
  escola: [
    { tema: 'Bastidores das aulas', modelo: 'novidade' },
    { tema: 'Depoimento de aluno/responsável', modelo: 'depoimento' },
    { tema: 'Matrículas / turma nova', modelo: 'promocao' },
    { tema: 'Dica de estudo', modelo: 'novidade' },
  ],
  loja: [
    { tema: 'Produto em destaque', modelo: 'novidade' },
    { tema: 'Oferta da semana', modelo: 'promocao' },
    { tema: 'Avaliação de cliente', modelo: 'depoimento' },
    { tema: 'Chegou novidade', modelo: 'novidade' },
  ],
  agencia: [
    { tema: 'Case de cliente', modelo: 'depoimento' },
    { tema: 'Dica rápida do especialista', modelo: 'novidade' },
    { tema: 'Serviço em destaque', modelo: 'promocao' },
    { tema: 'Bastidores do time', modelo: 'novidade' },
  ],
  restaurante: [
    { tema: 'Prato da semana', modelo: 'novidade' },
    { tema: 'Combo/promoção do dia', modelo: 'promocao' },
    { tema: 'Avaliação de cliente', modelo: 'depoimento' },
    { tema: 'Bastidores da cozinha', modelo: 'novidade' },
  ],
  outro: [
    { tema: 'Produto/serviço em destaque', modelo: 'novidade' },
    { tema: 'Oferta da semana', modelo: 'promocao' },
    { tema: 'Depoimento de cliente', modelo: 'depoimento' },
    { tema: 'Bastidores', modelo: 'novidade' },
  ],
};

/** Dias da semana preferidos para postar (0=dom). Padrão: ter, qui, sáb. */
export function sugerirMes(opts: {
  ano: number;
  mes: number;
  segmento: Segmento;
  empresaId: string;
  diasDaSemana?: number[];
  gerarId?: (i: number) => string;
}): Pauta[] {
  const { ano, mes, segmento, empresaId } = opts;
  const dias = opts.diasDaSemana ?? [2, 4, 6];
  const gerarId = opts.gerarId ?? ((i) => `pauta-${ano}${String(mes).padStart(2, '0')}-${i}`);
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const comemorativas = datasDoMes(ano, mes, segmento);
  const usados = new Set<number>();
  const pautas: Omit<Pauta, 'id'>[] = [];

  for (const c of comemorativas) {
    // post 2 dias antes da data (ou no dia, se for início do mês)
    const dia = Math.max(1, c.modelo === 'promocao' ? c.dia - 2 : c.dia);
    usados.add(dia);
    pautas.push({ empresaId, data: iso(ano, mes, dia), tema: `${c.nome}: ${c.ideia}`, modelo: c.modelo, motivo: `${c.nome} (${String(c.dia).padStart(2, '0')}/${String(mes).padStart(2, '0')})`, status: 'rascunho' });
  }
  const fixas = PAUTAS_FIXAS[segmento];
  let k = 0;
  for (let dia = 1; dia <= total; dia++) {
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    if (!dias.includes(semana)) continue;
    // não grudar em data comemorativa (±1 dia)
    if (usados.has(dia) || usados.has(dia - 1) || usados.has(dia + 1)) continue;
    const f = fixas[k++ % fixas.length];
    pautas.push({ empresaId, data: iso(ano, mes, dia), tema: f.tema, modelo: f.modelo, motivo: 'Constância: post da semana', status: 'rascunho' });
  }
  return pautas.sort((a, b) => a.data.localeCompare(b.data)).map((p, i) => ({ ...p, id: gerarId(i) }));
}

const TRANSICOES: Record<StatusPauta, StatusPauta[]> = {
  rascunho: ['arte-gerada', 'publicado'],
  'arte-gerada': ['publicado', 'rascunho'],
  publicado: ['arte-gerada', 'rascunho'], // rascunho só se ainda não tem arte
};

export function mudarStatusPauta(p: Pauta, novo: StatusPauta, quando: string, criacaoId?: string): Pauta {
  if (p.status === novo) return p;
  if (!TRANSICOES[p.status].includes(novo)) throw new Error(`Não dá para ir de "${p.status}" para "${novo}".`);
  if (novo === 'arte-gerada' && !(criacaoId ?? p.criacaoId)) throw new Error('Gere a arte antes.');
  if (p.status === 'publicado' && novo === 'rascunho' && p.criacaoId) throw new Error('Este post já tem arte: volte para "arte pronta".');
  return {
    ...p,
    status: novo,
    criacaoId: criacaoId ?? p.criacaoId,
    publicadoEm: novo === 'publicado' ? quando : undefined,
  };
}

// ---------- datas móveis ----------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function nesimoDomingo(ano: number, mes: number, n: number): Date {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const ate = (7 - primeiro.getUTCDay()) % 7;
  return new Date(Date.UTC(ano, mes - 1, 1 + ate + (n - 1) * 7));
}

export function blackFriday(ano: number): Date {
  const primeiro = new Date(Date.UTC(ano, 10, 1));
  const ateQuinta = (4 - primeiro.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(ano, 10, 1 + ateQuinta + 21 + 1));
}

function somarDias(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}

function iso(a: number, m: number, d: number) {
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
