import { rota } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { cancelar } from '@/lib/cobranca/servico';
import { comErros } from '../_util';

/** Cancela a renovação. O acesso continua até o fim do período pago. Só o dono. */
export const POST = rota(['dono'], async (_req, { sessao }) =>
  comErros(async () => {
    const a = await cancelar(await depsCobranca(), sessao.empresaId);
    return Response.json({ usaAte: a.pagoAte ?? a.testeAte });
  }),
);
