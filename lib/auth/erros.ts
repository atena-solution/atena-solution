/** Erro com status HTTP, convertido em resposta JSON pelas rotas. */
export class ErroHttp extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof ErroHttp) return Response.json({ erro: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ erro: 'Algo deu errado. Tente de novo.' }, { status: 500 });
}
