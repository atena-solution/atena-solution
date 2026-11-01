// POST { texto? }: manda o follow-up. Com Atendimento ativo e WhatsApp conectado, envia pelo número da empresa;
// senão devolve o link wa.me pra tela abrir.
import { autenticar, dadosEmpresa, repositorio, responder } from '@/lib/coach/servidor';
import { prepararFollowup } from '@/lib/coach/servico';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    const corpo = (await req.json().catch(() => ({}))) as { texto?: string };
    const emp = await dadosEmpresa(s.empresaId);
    const f = await prepararFollowup(s, await repositorio(), id, { abas: emp.abas, whatsappConectado: emp.whatsappConectado, texto: corpo.texto });
    if (f.canal === 'whatsapp-empresa') {
      // JUNÇÃO (sessão B): chamar o envio do Atendimento, ex.: enviarTextoAoContato(s.empresaId, f.contatoId, f.texto).
      // Fora da janela de 24 h a Meta exige modelo aprovado — o módulo de B decide; se recusar, cair no wa.me.
      return { canal: f.canal, enviado: false, pendente: 'Envio pelo WhatsApp da empresa liga na junção com o Atendimento.', texto: f.texto };
    }
    return { canal: f.canal, link: f.link, texto: f.texto };
  });
}
