import { rota, corpo } from '@/lib/api/rota';
import { ErroHttp } from '@/lib/auth/erros';
import { validarStatus } from '@/lib/base/validar';
import { mudarStatusAgendamento, remarcarAgendamento } from '@/lib/agenda/operacoes';

/** Remarcar (inicio/profissionalId/servicoId) e/ou mudar status (marcado, confirmado, compareceu, faltou, cancelado). */
export const PATCH = rota<{ id: string }>(undefined, async (req, { dados, params, sessao }) => {
  const e = await corpo(req);
  const quem = { uid: sessao.uid };
  let agendamento;
  if (e.inicio !== undefined || e.profissionalId !== undefined || e.servicoId !== undefined || e.observacao !== undefined) {
    agendamento = await remarcarAgendamento(
      dados,
      params.id,
      {
        inicio: typeof e.inicio === 'string' ? e.inicio : undefined,
        profissionalId: typeof e.profissionalId === 'string' ? e.profissionalId : undefined,
        servicoId: typeof e.servicoId === 'string' ? e.servicoId : undefined,
        observacao: typeof e.observacao === 'string' ? e.observacao.slice(0, 500) : undefined,
      },
      quem,
    );
  }
  if (e.status !== undefined) {
    if (!validarStatus(e.status)) throw new ErroHttp(400, 'Status inválido.');
    agendamento = await mudarStatusAgendamento(dados, params.id, e.status, quem);
  }
  if (!agendamento) throw new ErroHttp(400, 'Nada para mudar.');
  return Response.json({ agendamento });
});
