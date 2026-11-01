import type { AcessoEmpresa } from '../dados/empresa';
import { novoId } from '../dados/empresa';
import { ErroHttp } from '../auth/erros';
import type { Agendamento, Atividade, Contato, Profissional, Servico, StatusAgendamento } from '../tipos';
import { horariosLivres, podeMudarStatus, verificarHorario, NOME_STATUS } from './horarios';
import { etapaAposAgenda, etapasDaEmpresa, moverEtapa } from '../contatos/funil';
import { horaLocal, dataLocal } from './fuso';

/**
 * Operações da agenda sobre os dados de UMA empresa. Usadas pelas rotas /api/agenda
 * e pelas ferramentas da IA do Atendimento (sessão B): ver_horarios_livres, marcar_horario, remarcar, cancelar.
 * Quem chama: `{ uid }` de alguém da equipe ou `{ ia: true }`.
 */
export type Quem = { uid: string; ia?: false } | { ia: true; uid?: undefined };

async function carregar(dados: AcessoEmpresa) {
  const [empresa, servicos, profissionais, agendamentos] = await Promise.all([
    dados.obterEmpresa(),
    dados.listar<Servico>('servicos'),
    dados.listar<Profissional>('profissionais'),
    dados.listar<Agendamento>('agendamentos'),
  ]);
  if (!empresa) throw new ErroHttp(404, 'Empresa não encontrada.');
  return { empresa, servicos, profissionais, agendamentos };
}

function achar<T extends { id: string }>(lista: T[], id: string, oQue: string): T {
  const x = lista.find((i) => i.id === id);
  if (!x) throw new ErroHttp(400, `${oQue} não encontrado.`);
  return x;
}

function fmtQuando(iso: string, fuso: string) {
  const [, m, d] = dataLocal(iso, fuso).split('-');
  return `${d}/${m} às ${horaLocal(iso, fuso)}`;
}

async function registrar(dados: AcessoEmpresa, contatoId: string, resumo: string, quem: Quem, quando: string) {
  const a: Atividade = { id: novoId('at_'), contatoId, tipo: 'agendamento', resumo, quando, ...(quem.ia ? { porIA: true } : { porUid: quem.uid }) };
  await dados.gravar('atividades', a.id, a);
}

async function andarNoFunil(dados: AcessoEmpresa, contato: Contato, evento: 'marcou' | 'compareceu', quem: Quem, agora: Date) {
  const empresa = await dados.obterEmpresa();
  const etapas = etapasDaEmpresa(empresa?.etapas);
  const alvo = etapaAposAgenda(contato.etapa, evento, etapas);
  if (!alvo) {
    await dados.mesclar<Contato>('contatos', contato.id, { ultimaInteracaoEm: agora.toISOString() });
    return;
  }
  const r = moverEtapa(contato, alvo, etapas, quem.ia ? { ia: true } : { uid: quem.uid }, agora, () => novoId('at_'));
  await dados.gravar('contatos', contato.id, r.contato);
  if (r.atividade) await dados.gravar('atividades', r.atividade.id, r.atividade);
}

/** Horários livres de um serviço num dia (todos os profissionais que fazem o serviço, ou um só). */
export async function listarLivres(
  dados: AcessoEmpresa,
  p: { data: string; servicoId: string; profissionalId?: string; agora?: Date; ignorarId?: string },
) {
  const { empresa, servicos, profissionais, agendamentos } = await carregar(dados);
  const servico = achar(servicos, p.servicoId, 'Serviço');
  const candidatos = profissionais.filter(
    (pf) => (!p.profissionalId || pf.id === p.profissionalId) && (pf.servicosIds.length === 0 || pf.servicosIds.includes(servico.id)),
  );
  return candidatos.map((pf) => ({
    profissionalId: pf.id,
    profissional: pf.nome,
    horarios: horariosLivres({
      data: p.data,
      fuso: empresa.fuso,
      duracaoMin: servico.duracaoMin,
      horariosEmpresa: empresa.horarios,
      profissional: pf,
      agendamentos,
      agora: p.agora ?? new Date(),
      ignorarId: p.ignorarId,
    }),
  }));
}

export async function marcarAgendamento(
  dados: AcessoEmpresa,
  e: { contatoId: string; servicoId: string; profissionalId: string; inicio: string; observacao?: string },
  quem: Quem,
  agora = new Date(),
): Promise<Agendamento> {
  const { empresa, servicos, profissionais, agendamentos } = await carregar(dados);
  const contato = await dados.obter<Contato>('contatos', e.contatoId);
  if (!contato) throw new ErroHttp(400, 'Cliente não encontrado.');
  const servico = achar(servicos, e.servicoId, 'Serviço');
  const profissional = achar(profissionais, e.profissionalId, 'Profissional');
  const v = verificarHorario({
    inicio: e.inicio,
    duracaoMin: servico.duracaoMin,
    fuso: empresa.fuso,
    horariosEmpresa: empresa.horarios,
    profissional,
    servicoId: servico.id,
    agendamentos,
    agora,
  });
  if (!v.ok) throw new ErroHttp(409, v.motivo);
  const inicio = new Date(e.inicio);
  const ag: Agendamento = {
    id: novoId('ag_'),
    contatoId: contato.id,
    servicoId: servico.id,
    profissionalId: profissional.id,
    inicio: inicio.toISOString(),
    fim: new Date(inicio.getTime() + servico.duracaoMin * 60000).toISOString(),
    status: 'marcado',
    criadoPor: quem.ia ? 'ia' : quem.uid,
    lembretes: {},
    ...(e.observacao ? { observacao: e.observacao } : {}),
  };
  await dados.gravar('agendamentos', ag.id, ag);
  await registrar(dados, contato.id, `${servico.nome} marcado com ${profissional.nome} — ${fmtQuando(ag.inicio, empresa.fuso)}`, quem, agora.toISOString());
  await andarNoFunil(dados, contato, 'marcou', quem, agora);
  return ag;
}

export async function remarcarAgendamento(
  dados: AcessoEmpresa,
  id: string,
  e: { inicio?: string; profissionalId?: string; servicoId?: string; observacao?: string },
  quem: Quem,
  agora = new Date(),
): Promise<Agendamento> {
  const { empresa, servicos, profissionais, agendamentos } = await carregar(dados);
  const atual = achar(agendamentos, id, 'Agendamento');
  if (atual.status === 'cancelado') throw new ErroHttp(409, 'Agendamento cancelado. Marque um novo.');
  const servico = achar(servicos, e.servicoId ?? atual.servicoId, 'Serviço');
  const profissional = achar(profissionais, e.profissionalId ?? atual.profissionalId, 'Profissional');
  const inicioIso = e.inicio ?? atual.inicio;
  const v = verificarHorario({
    inicio: inicioIso,
    duracaoMin: servico.duracaoMin,
    fuso: empresa.fuso,
    horariosEmpresa: empresa.horarios,
    profissional,
    servicoId: servico.id,
    agendamentos,
    agora,
    ignorarId: atual.id,
  });
  if (!v.ok) throw new ErroHttp(409, v.motivo);
  const inicio = new Date(inicioIso);
  const mudouHora = inicio.toISOString() !== atual.inicio;
  const novo: Agendamento = {
    ...atual,
    servicoId: servico.id,
    profissionalId: profissional.id,
    inicio: inicio.toISOString(),
    fim: new Date(inicio.getTime() + servico.duracaoMin * 60000).toISOString(),
    // remarcou: volta para "marcado" e zera lembretes já enviados
    status: mudouHora ? 'marcado' : atual.status,
    lembretes: mudouHora ? {} : atual.lembretes,
    ...(e.observacao !== undefined ? { observacao: e.observacao } : {}),
  };
  await dados.gravar('agendamentos', novo.id, novo);
  if (mudouHora) await registrar(dados, atual.contatoId, `Remarcado: ${servico.nome} — ${fmtQuando(novo.inicio, empresa.fuso)}`, quem, agora.toISOString());
  return novo;
}

export async function mudarStatusAgendamento(
  dados: AcessoEmpresa,
  id: string,
  status: StatusAgendamento,
  quem: Quem,
  agora = new Date(),
): Promise<Agendamento> {
  const atual = await dados.obter<Agendamento>('agendamentos', id);
  if (!atual) throw new ErroHttp(404, 'Agendamento não encontrado.');
  if (!podeMudarStatus(atual.status, status)) throw new ErroHttp(409, 'Agendamento cancelado não muda de status. Marque um novo.');
  if (atual.status === status) return atual;
  const novo = { ...atual, status };
  await dados.gravar('agendamentos', id, novo);
  const servico = await dados.obter<Servico>('servicos', atual.servicoId);
  await registrar(dados, atual.contatoId, `${servico?.nome ?? 'Agendamento'}: ${NOME_STATUS[status].toLowerCase()}`, quem, agora.toISOString());
  if (status === 'compareceu') {
    const contato = await dados.obter<Contato>('contatos', atual.contatoId);
    if (contato) await andarNoFunil(dados, contato, 'compareceu', quem, agora);
  }
  return novo;
}
