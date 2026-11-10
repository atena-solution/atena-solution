// POST { texto? }: manda o follow-up. Com Atendimento no plano e WhatsApp conectado, envia pelo número da empresa
// (pelo envio do Atendimento, que respeita a janela de 24h); se não der, devolve o link wa.me pra tela abrir.
import { autenticar, dadosEmpresa, repositorio, responder } from '@/lib/coach/servidor';
import { prepararFollowup } from '@/lib/coach/servico';
import { linkWaMe } from '@/lib/coach/contatos';
import { depsAtendimento } from '@/lib/atendimento/servidor';
import { enviarAoContato } from '@/lib/atendimento/processar';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    const corpo = (await req.json().catch(() => ({}))) as { texto?: string };
    const emp = await dadosEmpresa(s.empresaId);
    const repo = await repositorio();
    const f = await prepararFollowup(s, repo, id, { abas: emp.abas, whatsappConectado: emp.whatsappConectado, texto: corpo.texto });
    if (f.canal === 'whatsapp-empresa' && f.contatoId) {
      const r = await enviarAoContato(s.empresaId, f.contatoId, s.uid, f.texto, await depsAtendimento());
      if (r.ok) return { canal: f.canal, enviado: true, texto: f.texto, conversaId: r.conversaId };
      // não deu (janela fechada sem modelo, número recusou…): cai no wa.me com o motivo
      const reuniao = await repo.obterReuniao(s.empresaId, id);
      const link = linkWaMe(reuniao?.contatoTelefone, f.texto) ?? `https://wa.me/?text=${encodeURIComponent(f.texto)}`;
      return { canal: 'wa.me', enviado: false, motivo: r.erro, link, texto: f.texto };
    }
    return { canal: f.canal, link: f.link, texto: f.texto };
  });
}
