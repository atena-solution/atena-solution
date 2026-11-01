import { rota, corpo } from '@/lib/api/rota';
import { validarAgendamento } from '@/lib/base/validar';
import { marcarAgendamento } from '@/lib/agenda/operacoes';
import type { Agendamento, Contato, Profissional, Servico } from '@/lib/tipos';

/** Agendamentos de um período (?de=ISO&ate=ISO) + serviços, profissionais e contatos citados. */
export const GET = rota(undefined, async (req, { dados }) => {
  const u = new URL(req.url);
  const de = u.searchParams.get('de');
  const ate = u.searchParams.get('ate');
  const [ags, servicos, profissionais, contatos, empresa] = await Promise.all([
    dados.listar<Agendamento>('agendamentos'),
    dados.listar<Servico>('servicos'),
    dados.listar<Profissional>('profissionais'),
    dados.listar<Contato>('contatos'),
    dados.obterEmpresa(),
  ]);
  const agendamentos = ags
    .filter((a) => (!de || a.fim > de) && (!ate || a.inicio < ate))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const ids = new Set(agendamentos.map((a) => a.contatoId));
  return Response.json({
    agendamentos,
    servicos,
    profissionais,
    contatos: contatos.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, nome: c.nome, telefone: c.telefone })),
    horarios: empresa?.horarios ?? [],
    fuso: empresa?.fuso ?? 'America/Sao_Paulo',
  });
});

export const POST = rota(undefined, async (req, { dados, sessao }) => {
  const v = validarAgendamento(await corpo(req));
  if (!v.ok) return Response.json({ erro: Object.values(v.erros)[0], erros: v.erros }, { status: 400 });
  const agendamento = await marcarAgendamento(dados, v.valor, { uid: sessao.uid });
  return Response.json({ agendamento }, { status: 201 });
});
