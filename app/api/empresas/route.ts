import { banco, simulando } from '@/lib/dados';
import { identificar } from '@/lib/auth/servidor';
import { ErroHttp, respostaDeErro } from '@/lib/auth/erros';
import { criarEmpresa } from '@/lib/base/empresas';
import { validarEmpresa } from '@/lib/base/validar';
import { corpo } from '@/lib/api/rota';

/** Cria uma empresa nova (onboarding). Quem cria vira dono. */
export async function POST(req: Request) {
  try {
    const b = await banco();
    const id = await identificar(req, { banco: b, simulado: simulando() });
    const v = validarEmpresa(await corpo(req), true);
    if (!v.ok) return Response.json({ erros: v.erros }, { status: 400 });
    if (!v.valor.nome) throw new ErroHttp(400, 'Informe o nome da empresa.');
    const empresa = await criarEmpresa(b, id, v.valor);
    return Response.json({ empresa }, { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
