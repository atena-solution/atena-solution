import type { Agendamento, Contato, Empresa, HorarioDia, Profissional, Servico, StatusAgendamento } from '../tipos';
import { PAPEIS, STATUS_AGENDAMENTO, type Papel } from '../tipos';
import { normalizarTelefone } from '../ui/formato';

/**
 * Validação das entradas das rotas (funções puras). Devolvem o valor limpo ou os erros por campo,
 * com mensagens prontas para a tela.
 */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; erros: Record<string, string> };

type Entrada = Record<string, unknown>;

const texto = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COR = /^#[0-9a-fA-F]{6}$/;

function fim<T>(erros: Record<string, string>, valor: T): Resultado<T> {
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, valor };
}

export function validarHorarios(v: unknown): Resultado<HorarioDia[]> {
  if (!Array.isArray(v)) return { ok: false, erros: { horarios: 'Informe os horários.' } };
  const erros: Record<string, string> = {};
  const lista: HorarioDia[] = [];
  v.forEach((h: Entrada, i) => {
    const dia = Number(h?.dia);
    const abre = texto(h?.abre, 5);
    const fecha = texto(h?.fecha, 5);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) erros[`horarios.${i}`] = 'Dia inválido.';
    else if (!HHMM.test(abre) || !HHMM.test(fecha)) erros[`horarios.${i}`] = 'Use o formato 09:00.';
    else if (fecha <= abre) erros[`horarios.${i}`] = 'O fechamento precisa ser depois da abertura.';
    else lista.push({ dia, abre, fecha });
  });
  return fim(erros, lista);
}

/** Dados da empresa no onboarding / configurações. `parcial` aceita só alguns campos. */
export function validarEmpresa(e: Entrada, parcial = false): Resultado<Partial<Empresa>> {
  const erros: Record<string, string> = {};
  const v: Partial<Empresa> = {};
  const tem = (k: string) => !parcial || k in e;

  if (tem('nome')) {
    v.nome = texto(e.nome, 80);
    if (v.nome.length < 2) erros.nome = 'Informe o nome da empresa.';
  }
  if (tem('segmento')) {
    v.segmento = texto(e.segmento, 60);
    if (!v.segmento) erros.segmento = 'Escolha o segmento.';
  }
  if (tem('telefone')) {
    const t = normalizarTelefone(texto(e.telefone, 30));
    if (!t) erros.telefone = 'Telefone inválido. Ex.: (11) 99999-8888';
    else v.telefone = t;
  }
  if ('endereco' in e) v.endereco = texto(e.endereco, 200);
  if (tem('horarios')) {
    const h = validarHorarios(e.horarios);
    if (h.ok) v.horarios = h.valor;
    else Object.assign(erros, h.erros);
  }
  if ('marca' in e && e.marca && typeof e.marca === 'object') {
    const m = e.marca as Entrada;
    const cores = (m.cores ?? {}) as Entrada;
    const primaria = texto(cores.primaria, 7) || '#3B5BDB';
    const secundaria = texto(cores.secundaria, 7) || '#7048E8';
    if (!COR.test(primaria) || !COR.test(secundaria)) erros.marca = 'Cor inválida (use #RRGGBB).';
    const logoUrl = texto(m.logoUrl, 2000);
    if (logoUrl && !/^(https:\/\/|data:image\/(png|jpeg|svg\+xml|webp);base64,)/.test(logoUrl)) {
      erros.logo = 'Logo inválida.';
    }
    if (logoUrl.length > 1500 && logoUrl.startsWith('data:')) erros.logo = 'Logo grande demais (use um link).';
    v.marca = { logoUrl, cores: { primaria, secundaria }, tom: texto(m.tom, 200) };
  }
  return fim(erros, v);
}

export function validarServico(e: Entrada): Resultado<Omit<Servico, 'id'>> {
  const erros: Record<string, string> = {};
  const nome = texto(e.nome, 80);
  const duracaoMin = Number(e.duracaoMin);
  const preco = Number(e.preco ?? 0);
  if (!nome) erros.nome = 'Informe o nome do serviço.';
  if (!Number.isInteger(duracaoMin) || duracaoMin < 5 || duracaoMin > 600) erros.duracaoMin = 'Duração entre 5 e 600 minutos.';
  if (!Number.isFinite(preco) || preco < 0) erros.preco = 'Preço inválido.';
  return fim(erros, { nome, duracaoMin, preco: Math.round(preco * 100) / 100, descricao: texto(e.descricao, 500) });
}

export function validarProfissional(e: Entrada): Resultado<Omit<Profissional, 'id'>> {
  const erros: Record<string, string> = {};
  const nome = texto(e.nome, 80);
  if (!nome) erros.nome = 'Informe o nome.';
  const servicosIds = Array.isArray(e.servicosIds) ? e.servicosIds.filter((s): s is string => typeof s === 'string') : [];
  const h = validarHorarios(e.horarios ?? []);
  if (!h.ok) Object.assign(erros, h.erros);
  return fim(erros, { nome, servicosIds, horarios: h.ok ? h.valor : [] });
}

export function validarContato(e: Entrada, parcial = false): Resultado<Partial<Contato>> {
  const erros: Record<string, string> = {};
  const v: Partial<Contato> = {};
  const tem = (k: string) => !parcial || k in e;
  if (tem('nome')) {
    v.nome = texto(e.nome, 120);
    if (!v.nome) erros.nome = 'Informe o nome.';
  }
  if (tem('telefone')) {
    const t = normalizarTelefone(texto(e.telefone, 30));
    if (!t) erros.telefone = 'Telefone inválido. Ex.: (11) 99999-8888';
    else v.telefone = t;
  }
  if ('email' in e) {
    const em = texto(e.email, 120).toLowerCase();
    if (em && !EMAIL.test(em)) erros.email = 'E-mail inválido.';
    v.email = em || undefined;
  }
  if ('origem' in e || !parcial) v.origem = texto(e.origem, 60) || 'Manual';
  if ('etapa' in e) v.etapa = texto(e.etapa, 40);
  if ('etiquetas' in e) {
    v.etiquetas = Array.isArray(e.etiquetas)
      ? [...new Set(e.etiquetas.map((x) => texto(x, 30)).filter(Boolean))].slice(0, 20)
      : [];
  }
  if ('responsavelUid' in e) v.responsavelUid = texto(e.responsavelUid, 128) || undefined;
  if ('campos' in e && e.campos && typeof e.campos === 'object') {
    v.campos = Object.fromEntries(
      Object.entries(e.campos as Entrada)
        .slice(0, 30)
        .map(([k, x]) => [texto(k, 40), texto(x, 500)]),
    );
  }
  return fim(erros, v);
}

export function validarAgendamento(
  e: Entrada,
): Resultado<Pick<Agendamento, 'contatoId' | 'servicoId' | 'profissionalId' | 'inicio'> & { observacao?: string }> {
  const erros: Record<string, string> = {};
  const contatoId = texto(e.contatoId, 128);
  const servicoId = texto(e.servicoId, 128);
  const profissionalId = texto(e.profissionalId, 128);
  const inicio = texto(e.inicio, 40);
  if (!contatoId) erros.contatoId = 'Escolha o cliente.';
  if (!servicoId) erros.servicoId = 'Escolha o serviço.';
  if (!profissionalId) erros.profissionalId = 'Escolha o profissional.';
  if (!inicio || Number.isNaN(Date.parse(inicio))) erros.inicio = 'Escolha o horário.';
  const observacao = texto(e.observacao, 500) || undefined;
  return fim(erros, { contatoId, servicoId, profissionalId, inicio: inicio ? new Date(inicio).toISOString() : '', observacao });
}

export function validarStatus(v: unknown): v is StatusAgendamento {
  return typeof v === 'string' && (STATUS_AGENDAMENTO as string[]).includes(v);
}

export function validarPapel(v: unknown): v is Papel {
  return typeof v === 'string' && (PAPEIS as string[]).includes(v);
}

export function validarEmail(v: unknown): string | null {
  const e = texto(v, 120).toLowerCase();
  return EMAIL.test(e) ? e : null;
}
