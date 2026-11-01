// Onboarding guiado — funções puras.
// criar conta → dados da empresa → serviços e horários → treinar a IA → conectar WhatsApp (ou pular) → pronto
// Progresso salvo em `empresas/{empresaId}.onboarding` — dá pra parar e voltar de onde parou.

export type Passo = 'conta' | 'empresa' | 'servicos' | 'treinar' | 'whatsapp' | 'pronto';

export interface InfoPasso { id: Passo; titulo: string; descricao: string; pulavel: boolean }

export const PASSOS: InfoPasso[] = [
  { id: 'conta', titulo: 'Sua conta', descricao: 'E-mail e senha, ou entrar com o Google.', pulavel: false },
  { id: 'empresa', titulo: 'Sua empresa', descricao: 'Nome, segmento, telefone e endereço.', pulavel: false },
  { id: 'servicos', titulo: 'Serviços e horários', descricao: 'O que você vende, quanto custa e quando atende.', pulavel: false },
  { id: 'treinar', titulo: 'Treinar a IA', descricao: 'Cinco perguntas rápidas para a IA falar como a sua empresa.', pulavel: true },
  { id: 'whatsapp', titulo: 'Conectar o WhatsApp', descricao: 'Ligue o seu número. Dá pra fazer depois.', pulavel: true },
  { id: 'pronto', titulo: 'Pronto', descricao: 'Tudo certo para começar.', pulavel: false },
];

export interface EstadoOnboarding {
  feitos: Passo[];
  pulados: Passo[];
  atualizadoEm?: string;
}

export const ONBOARDING_VAZIO: EstadoOnboarding = { feitos: [], pulados: [] };

const ordem = (p: Passo) => PASSOS.findIndex((x) => x.id === p);
const resolvido = (e: EstadoOnboarding, p: Passo) => e.feitos.includes(p) || e.pulados.includes(p);

export function proximoPasso(e: EstadoOnboarding): Passo {
  return PASSOS.find((p) => p.id !== 'pronto' && !resolvido(e, p.id))?.id ?? 'pronto';
}

/** Só pode abrir passos já resolvidos ou o próximo (não pula na frente sem preencher). */
export function podeAbrir(e: EstadoOnboarding, p: Passo): boolean {
  return resolvido(e, p) || ordem(p) <= ordem(proximoPasso(e));
}

/** 0–100. Pular conta como resolvido (a barra anda), mas `completo` só olha os obrigatórios. */
export function progresso(e: EstadoOnboarding): number {
  const total = PASSOS.length - 1; // "pronto" não conta
  const n = PASSOS.filter((p) => p.id !== 'pronto' && resolvido(e, p.id)).length;
  return Math.round((n / total) * 100);
}

export function concluido(e: EstadoOnboarding): boolean {
  return proximoPasso(e) === 'pronto';
}

export function marcarFeito(e: EstadoOnboarding, p: Passo, agoraIso: string): EstadoOnboarding {
  if (p === 'pronto') return e;
  return {
    feitos: e.feitos.includes(p) ? e.feitos : [...e.feitos, p],
    pulados: e.pulados.filter((x) => x !== p),
    atualizadoEm: agoraIso,
  };
}

export function pular(e: EstadoOnboarding, p: Passo, agoraIso: string): EstadoOnboarding {
  const info = PASSOS.find((x) => x.id === p);
  if (!info?.pulavel) throw new Error(`O passo "${info?.titulo ?? p}" não pode ser pulado.`);
  if (e.feitos.includes(p)) return e;
  return { feitos: e.feitos, pulados: e.pulados.includes(p) ? e.pulados : [...e.pulados, p], atualizadoEm: agoraIso };
}

/** Pendências que aparecem no Início depois do onboarding (passos pulados). */
export function pendencias(e: EstadoOnboarding): InfoPasso[] {
  return PASSOS.filter((p) => e.pulados.includes(p.id));
}

// ---------------------------------------------------------------- validação dos passos

export type Erros = Record<string, string>;

export const SEGMENTOS = [
  { id: 'clinica', nome: 'Clínica / consultório' },
  { id: 'barbearia', nome: 'Barbearia' },
  { id: 'estetica', nome: 'Estética / salão de beleza' },
  { id: 'imobiliaria', nome: 'Imobiliária' },
  { id: 'escola', nome: 'Escola / cursos' },
  { id: 'loja', nome: 'Loja' },
  { id: 'agencia', nome: 'Agência / serviços' },
  { id: 'outro', nome: 'Outro' },
] as const;

export interface DadosEmpresa { nome: string; segmento: string; telefone: string; endereco?: string }

export function telefoneE164(t: string): string | null {
  let d = (t ?? '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function validarEmpresa(d: Partial<DadosEmpresa>): Erros {
  const e: Erros = {};
  if (!d.nome?.trim() || d.nome.trim().length < 2) e.nome = 'Digite o nome da empresa.';
  if (!SEGMENTOS.some((s) => s.id === d.segmento)) e.segmento = 'Escolha o segmento.';
  if (!telefoneE164(d.telefone ?? '')) e.telefone = 'Telefone com DDD, ex.: (11) 99999-9999.';
  return e;
}

export interface ServicoRascunho { nome: string; duracaoMin: number; preco: number /* centavos */ }
export interface HorarioRascunho { dia: number; abre: string; fecha: string }

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarServicos(servicos: ServicoRascunho[], horarios: HorarioRascunho[]): Erros {
  const e: Erros = {};
  if (!servicos.length) e.servicos = 'Cadastre pelo menos um serviço ou produto.';
  servicos.forEach((s, i) => {
    if (!s.nome?.trim()) e[`servicos.${i}.nome`] = 'Dê um nome.';
    if (!(s.duracaoMin >= 5 && s.duracaoMin <= 600)) e[`servicos.${i}.duracaoMin`] = 'Duração entre 5 e 600 minutos.';
    if (!(Number.isInteger(s.preco) && s.preco >= 0)) e[`servicos.${i}.preco`] = 'Preço inválido.';
  });
  if (!horarios.length) e.horarios = 'Marque pelo menos um dia de atendimento.';
  horarios.forEach((h, i) => {
    if (!(h.dia >= 0 && h.dia <= 6)) e[`horarios.${i}.dia`] = 'Dia inválido.';
    if (!HHMM.test(h.abre) || !HHMM.test(h.fecha) || h.abre >= h.fecha) e[`horarios.${i}`] = 'O horário de abrir deve ser antes do de fechar.';
  });
  return e;
}

/** Horários padrão para começar: seg–sex 09–18, sáb 09–13. */
export function horariosPadrao(): HorarioRascunho[] {
  return [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: '09:00', fecha: '18:00' })).concat([{ dia: 6, abre: '09:00', fecha: '13:00' }]);
}

// ---------------------------------------------------------------- treinar a IA (perguntas rápidas)

export interface PerguntaRapida { id: string; pergunta: string; dica: string; tipo: 'texto' | 'opcoes'; opcoes?: string[] }

export function perguntasRapidas(segmento: string): PerguntaRapida[] {
  const exemplosPergunta: Record<string, string> = {
    clinica: 'Ex.: Aceita convênio? Precisa de pedido médico? Tem estacionamento?',
    barbearia: 'Ex.: Atende sem hora marcada? Aceita Pix? Tem estacionamento?',
    estetica: 'Ex.: Precisa de avaliação antes? Parcela no cartão? Quanto tempo dura?',
    imobiliaria: 'Ex.: Aceita financiamento? Precisa de fiador? Agenda visita no sábado?',
    escola: 'Ex.: Tem aula experimental? Tem material incluso? Qual a idade mínima?',
    loja: 'Ex.: Entrega na cidade? Troca em quantos dias? Tem loja física?',
  };
  return [
    { id: 'nomeAssistente', pergunta: 'Qual o nome da sua assistente?', dica: 'Ex.: Ana, Duda, Lia. Ela sempre diz que é a assistente da empresa.', tipo: 'texto' },
    { id: 'tom', pergunta: 'Como ela deve falar?', dica: 'Escolha o jeito mais parecido com o da sua equipe.', tipo: 'opcoes', opcoes: ['Simpática e próxima', 'Educada e formal', 'Animada e descontraída'] },
    { id: 'perguntas', pergunta: 'Quais as 3 perguntas que mais chegam, e a resposta de cada?', dica: exemplosPergunta[segmento] ?? 'Ex.: Qual o horário? Como pago? Onde fica?', tipo: 'texto' },
    { id: 'nuncaDizer', pergunta: 'O que ela NUNCA deve dizer ou prometer?', dica: 'Ex.: dar desconto, prometer resultado, falar de concorrente.', tipo: 'texto' },
    { id: 'quandoChamarHumano', pergunta: 'Quando ela deve chamar alguém da equipe?', dica: 'Ex.: reclamação, pedido de orçamento grande, assunto de saúde.', tipo: 'texto' },
  ];
}

export interface RespostasRapidas {
  nomeAssistente?: string;
  tom?: string;
  /** Pares pergunta/resposta (o formulário manda em lista). */
  perguntas?: { pergunta: string; resposta: string }[];
  nuncaDizer?: string;
  quandoChamarHumano?: string;
}

const linhas = (t?: string) => (t ?? '').split(/\n|;/).map((s) => s.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);

/**
 * Converte as respostas no formato do Treino do Atendimento (sessão B, `lib/atendimento/tipos.ts`).
 * Só os campos que o onboarding preenche; o resto fica com o padrão do Atendimento.
 * A IA NÃO é ligada aqui: liga quando o WhatsApp estiver conectado e o dono testar no simulador.
 */
export function treinoDoOnboarding(r: RespostasRapidas) {
  return {
    nomeAssistente: r.nomeAssistente?.trim() || 'Assistente',
    tom: r.tom?.trim() || 'Simpática e próxima',
    perguntas: (r.perguntas ?? [])
      .map((p) => ({ pergunta: p.pergunta.trim(), resposta: p.resposta.trim() }))
      .filter((p) => p.pergunta && p.resposta)
      .slice(0, 30),
    nuncaDizer: linhas(r.nuncaDizer),
    quandoChamarHumano: linhas(r.quandoChamarHumano).length ? linhas(r.quandoChamarHumano) : ['Reclamação', 'Assunto sensível ou que a IA não sabe'],
  };
}
