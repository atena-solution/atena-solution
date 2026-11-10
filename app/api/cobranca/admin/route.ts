import { banco, simulando } from '@/lib/dados';
import { juntar } from '@/lib/dados/banco';
import { identificar, lerBearer } from '@/lib/auth/servidor';
import { ErroHttp, respostaDeErro } from '@/lib/auth/erros';
import { depsCobranca } from '@/lib/cobranca';
import { ehEquipeAtena, custoEstimado, margem, semaforo } from '@/lib/planos/admin';
import { situacaoAcesso } from '@/lib/planos/acesso';
import { calcularPreco } from '@/lib/planos/preco';
import { lerUsoDoMes, mesDe } from '@/lib/planos/uso';
import type { Empresa } from '@/lib/tipos';

/** Só e-mail verificado e listado em ATENA_ADMIN_EMAILS. */
async function exigirEquipeAtena(req: Request) {
  const id = await identificar(req);
  let verificado = true;
  if (!simulando()) {
    const { authAdmin } = await import('@/lib/integracoes/firebase-admin');
    const d = await authAdmin().verifyIdToken(lerBearer(req) ?? '');
    verificado = d.email_verified === true;
  }
  if (!ehEquipeAtena({ email: id.email, emailVerificado: verificado })) throw new ErroHttp(403, 'Área restrita à equipe Atena.');
  return id;
}

/** Visão de todas as empresas: plano, situação, receita, uso de IA, créditos e saúde. */
export async function GET(req: Request) {
  try {
    await exigirEquipeAtena(req);
    const agora = new Date().toISOString();
    const mes = mesDe(agora);
    const b = await banco();
    const d = await depsCobranca();
    const empresas = (await b.listar<Empresa>('empresas')).filter((e) => e?.id);
    const linhas = await Promise.all(empresas.map(async (e) => {
      const [assinatura, uso, conexao, membros] = await Promise.all([
        d.repo.obterAssinatura(e.id),
        lerUsoDoMes(b, e.id, mes),
        b.obter<{ phoneNumberId?: string }>(juntar('empresas', e.id, 'atendimento', 'conexao')),
        b.listar(juntar('empresas', e.id, 'membros')),
      ]);
      const sit = situacaoAcesso(assinatura, agora);
      const receita = assinatura?.pagoAte && sit.fase !== 'somente_leitura'
        ? calcularPreco({ planoId: assinatura.planoId, vendedores: assinatura.vendedores, ciclo: assinatura.ciclo }).equivalenteMensal : 0;
      const custo = custoEstimado(uso);
      return {
        id: e.id, nome: e.nome, segmento: e.segmento, criadoEm: e.criadoEm, membros: membros.length,
        planoId: assinatura?.planoId ?? null, fase: sit.fase, liberadoAte: sit.liberadoAte ?? null, abas: sit.abas,
        creditos: e.plano?.creditos ?? 0, receitaMensal: receita, custoIA: custo.centavos, modelosSemPreco: custo.semPreco,
        margem: margem(receita, custo.centavos), uso,
        saude: semaforo({ whatsappConectado: !!conexao?.phoneNumberId, errosUltimas24h: 0 }, sit.abas.includes('atendimento'), agora),
      };
    }));
    const alertas = await d.repo.alertas(30);
    const dia = Date.parse(agora) - 86400000;
    for (const l of linhas) {
      const n = alertas.filter((a) => a.empresaId === l.id && Date.parse(a.quando) > dia).length;
      if (n) l.saude = semaforo({ whatsappConectado: !l.saude.motivos.includes('WhatsApp desconectado'), errosUltimas24h: n }, l.abas.includes('atendimento'), agora);
    }
    const totais = {
      empresas: linhas.length,
      pagantes: linhas.filter((l) => l.receitaMensal > 0).length,
      emTeste: linhas.filter((l) => l.fase === 'teste').length,
      vencidas: linhas.filter((l) => l.fase === 'carencia' || l.fase === 'somente_leitura').length,
      mrr: linhas.reduce((s, l) => s + l.receitaMensal, 0),
      custoIA: linhas.reduce((s, l) => s + l.custoIA, 0),
    };
    return Response.json({ mes, totais, empresas: linhas.sort((a, b2) => b2.receitaMensal - a.receitaMensal || a.nome.localeCompare(b2.nome)), alertas });
  } catch (e) {
    return respostaDeErro(e);
  }
}
