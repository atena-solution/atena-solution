import { rota } from '@/lib/api/rota';
import { resumoDoDia, type ConversaResumo } from '@/lib/inicio/resumo';
import type { Agendamento, Contato, Profissional, Servico } from '@/lib/tipos';

/** Números do Início. Cada aba pode acrescentar o seu cartão lendo a própria rota. */
export const GET = rota(undefined, async (_req, { dados }) => {
  const [empresa, agendamentos, contatos, conversas, servicos, profissionais] = await Promise.all([
    dados.obterEmpresa(),
    dados.listar<Agendamento>('agendamentos'),
    dados.listar<Contato>('contatos'),
    dados.listar<ConversaResumo>('conversas'),
    dados.listar<Servico>('servicos'),
    dados.listar<Profissional>('profissionais'),
  ]);
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo';
  const resumo = resumoDoDia({ agora: new Date(), fuso, agendamentos, contatos, conversas });
  const ids = new Set(resumo.proximos.map((a) => a.contatoId));
  return Response.json({
    resumo,
    fuso,
    totalContatos: contatos.length,
    contatos: contatos.filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, nome: c.nome })),
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })),
    profissionais: profissionais.map((p) => ({ id: p.id, nome: p.nome })),
    novosContatos: contatos
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, 5)
      .map((c) => ({ id: c.id, nome: c.nome, origem: c.origem, criadoEm: c.criadoEm })),
    configurado: { servicos: servicos.length > 0, profissionais: profissionais.length > 0, contatos: contatos.length > 0 },
  });
});
