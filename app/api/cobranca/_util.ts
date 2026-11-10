import { ErroHttp, respostaDeErro } from '@/lib/auth/erros';
import { ErroCobranca } from '@/lib/cobranca/servico';

/** Converte erros da cobrança (validação) em 400 com mensagem pronta. */
export function erroCobranca(e: unknown): Response {
  if (e instanceof ErroCobranca) return Response.json({ erro: e.message, campo: e.codigo }, { status: 400 });
  if (e instanceof ErroHttp) return respostaDeErro(e);
  return respostaDeErro(e);
}

export async function comErros(f: () => Promise<Response>): Promise<Response> {
  try {
    return await f();
  } catch (e) {
    return erroCobranca(e);
  }
}
