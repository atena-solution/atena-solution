import { beforeEach, describe, expect, it } from 'vitest';
import { BancoMemoria } from '@/lib/dados/banco';
import { definirBanco } from '@/lib/dados';
import { semearDemo } from '@/lib/dados/demo';
import { dataLocal, instanteLocal, somarDias, diaDaSemana } from '@/lib/agenda/fuso';
import * as contatos from '@/app/api/contatos/route';
import * as contato from '@/app/api/contatos/[id]/route';
import * as importar from '@/app/api/contatos/importar/route';
import * as agenda from '@/app/api/agenda/route';
import * as agendaItem from '@/app/api/agenda/[id]/route';
import * as livres from '@/app/api/agenda/livres/route';
import * as equipe from '@/app/api/equipe/route';
import * as equipeItem from '@/app/api/equipe/[uid]/route';
import * as empresa from '@/app/api/empresa/route';
import * as servicos from '@/app/api/servicos/route';
import * as inicio from '@/app/api/inicio/route';
import * as sessao from '@/app/api/sessao/route';
import * as empresas from '@/app/api/empresas/route';

process.env.SIMULAR = '1';

const DONO = 'simulado:demo-dono:dono@demo.atena';
const ANA = 'simulado:demo-ana:ana@demo.atena';
const OUTRO = 'simulado:demo-outro:outro@demo.atena';

function req(token: string | null, metodo = 'GET', corpo?: unknown, url = 'http://x/api', extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers.authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(url, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });

/** Próximo dia útil (seg–sex) a partir de amanhã, no fuso de SP. */
function proximoDiaUtil() {
  let d = somarDias(dataLocal(new Date(), 'America/Sao_Paulo'), 1);
  while ([0, 6].includes(diaDaSemana(d))) d = somarDias(d, 1);
  return d;
}

beforeEach(async () => {
  const b = new BancoMemoria();
  await semearDemo(b);
  definirBanco(b);
});

describe('isolamento entre empresas nas rotas', () => {
  it('lista só os contatos da própria empresa', async () => {
    const a = await (await contatos.GET(req(DONO))).json();
    expect(a.contatos.map((c: { id: string }) => c.id)).toContain('ct-1');
    expect(a.contatos.map((c: { id: string }) => c.id)).not.toContain('ct-x');
    const b = await (await contatos.GET(req(OUTRO))).json();
    expect(b.contatos.map((c: { id: string }) => c.id)).toEqual(['ct-x']);
  });

  it('não lê, edita nem apaga contato de outra empresa', async () => {
    expect((await contato.GET(req(OUTRO), p({ id: 'ct-1' }))).status).toBe(404);
    expect((await contato.PATCH(req(OUTRO, 'PATCH', { nome: 'hack' }), p({ id: 'ct-1' }))).status).toBe(404);
    await contato.DELETE(req(OUTRO, 'DELETE'), p({ id: 'ct-1' }));
    expect((await contato.GET(req(DONO), p({ id: 'ct-1' }))).status).toBe(200);
  });

  it('header x-empresa-id de outra empresa → 403', async () => {
    const r = await contatos.GET(req(OUTRO, 'GET', undefined, 'http://x/api', { 'x-empresa-id': 'demo' }));
    expect(r.status).toBe(403);
  });

  it('sem login → 401', async () => {
    expect((await contatos.GET(req(null))).status).toBe(401);
    expect((await agenda.GET(req('simulado:x'))).status).toBe(401);
  });

  it('agenda, equipe e início também são separados', async () => {
    const ag = await (await agenda.GET(req(OUTRO))).json();
    expect(ag.agendamentos).toEqual([]);
    const eq = await (await equipe.GET(req(OUTRO))).json();
    expect(eq.membros.map((m: { uid: string }) => m.uid)).toEqual(['demo-outro']);
    const ini = await (await inicio.GET(req(OUTRO))).json();
    expect(ini.totalContatos).toBe(1);
  });
});

describe('papéis', () => {
  it('atendente não convida nem mexe em serviços/empresa', async () => {
    expect((await equipe.POST(req(ANA, 'POST', { email: 'x@y.com', papel: 'vendedor' }))).status).toBe(403);
    expect((await servicos.POST(req(ANA, 'POST', { nome: 'X', duracaoMin: 30, preco: 10 }))).status).toBe(403);
    expect((await empresa.PATCH(req(ANA, 'PATCH', { nome: 'Hack' }))).status).toBe(403);
  });
  it('dono convida; convidado entra na empresa certa com o papel certo', async () => {
    expect((await equipe.POST(req(DONO, 'POST', { email: 'novo@demo.atena', papel: 'vendedor' }))).status).toBe(201);
    const s = await (await sessao.GET(req('simulado:novo:novo@demo.atena'))).json();
    expect(s.sessao).toMatchObject({ empresaId: 'demo', papel: 'vendedor' });
  });
  it('não deixa remover o único dono', async () => {
    const r = await equipeItem.PATCH(req(DONO, 'PATCH', { papel: 'gestor' }), p({ uid: 'demo-dono' }));
    expect(r.status).toBe(403);
    const r2 = await equipeItem.PATCH(req(DONO, 'PATCH', { ativo: false }), p({ uid: 'demo-dono' }));
    expect(r2.status).toBe(403);
  });
  it('plano não muda pela rota da empresa', async () => {
    await empresa.PATCH(req(DONO, 'PATCH', { nome: 'Novo nome', plano: { abas: [], creditos: 99999 } }));
    const e = (await (await empresa.GET(req(DONO))).json()).empresa;
    expect(e.nome).toBe('Novo nome');
    expect(e.plano.creditos).toBe(120);
  });
});

describe('contatos', () => {
  it('cria, recusa telefone repetido e move de etapa com histórico', async () => {
    const r = await contatos.POST(req(ANA, 'POST', { nome: 'Nova', telefone: '(11) 97777-0000' }));
    expect(r.status).toBe(201);
    const { contato: c } = await r.json();
    expect(c).toMatchObject({ telefone: '5511977770000', etapa: 'novo', empresaId: 'demo' });
    expect((await contatos.POST(req(ANA, 'POST', { nome: 'Dup', telefone: '11977770000' }))).status).toBe(409);
    await contato.PATCH(req(ANA, 'PATCH', { etapa: 'em-conversa', etiquetas: ['VIP'] }), p({ id: c.id }));
    const f = await (await contato.GET(req(ANA), p({ id: c.id }))).json();
    expect(f.contato.etapa).toBe('em-conversa');
    // criação e mudança de etapa podem cair no mesmo milissegundo → não depender da ordem
    expect(f.atividades.find((a: { tipo: string }) => a.tipo === 'etapa')).toMatchObject({ tipo: 'etapa', porUid: 'demo-ana' });
  });
  it('importa CSV (simulação e de verdade)', async () => {
    const csv = 'nome;whatsapp\nAna;11 90000-0001\nBia;11 90000-0002\nRepetida;5511991234001\n';
    const s = await (await importar.POST(req(DONO, 'POST', { csv, simular: true }))).json();
    expect(s).toMatchObject({ importados: 0, novos: 2, duplicados: 1 });
    const r = await (await importar.POST(req(DONO, 'POST', { csv }))).json();
    expect(r.importados).toBe(2);
    const l = await (await contatos.GET(req(DONO, 'GET', undefined, 'http://x/api?busca=90000'))).json();
    expect(l.total).toBe(2);
  });
});

describe('agenda pelas rotas', () => {
  it('lista livres, marca, recusa conflito, confirma e avança o funil', async () => {
    const dia = proximoDiaUtil();
    const l = await (await livres.GET(req(DONO, 'GET', undefined, `http://x/api?data=${dia}&servicoId=sv-design&profissionalId=pf-julia`))).json();
    const opcoes: string[] = l.livres[0].horarios;
    const alvo = instanteLocal(dia, 16 * 60, 'America/Sao_Paulo').toISOString();
    expect(opcoes).toContain(alvo);

    const corpo = { contatoId: 'ct-2', servicoId: 'sv-design', profissionalId: 'pf-julia', inicio: alvo };
    const r = await agenda.POST(req(ANA, 'POST', corpo));
    expect(r.status).toBe(201);
    const { agendamento } = await r.json();
    expect(agendamento).toMatchObject({ status: 'marcado', criadoPor: 'demo-ana' });

    const conflito = await agenda.POST(req(DONO, 'POST', { ...corpo, contatoId: 'ct-8' }));
    expect(conflito.status).toBe(409);

    const c = await (await contato.GET(req(DONO), p({ id: 'ct-2' }))).json();
    expect(c.contato.etapa).toBe('agendado');

    const conf = await agendaItem.PATCH(req(DONO, 'PATCH', { status: 'compareceu' }), p({ id: agendamento.id }));
    expect((await conf.json()).agendamento.status).toBe('compareceu');
    const c2 = await (await contato.GET(req(DONO), p({ id: 'ct-2' }))).json();
    expect(c2.contato.etapa).toBe('compareceu');

    // a outra empresa não remarca nem vê
    expect((await agendaItem.PATCH(req(OUTRO, 'PATCH', { status: 'cancelado' }), p({ id: agendamento.id }))).status).toBe(404);
  });

  it('remarcar volta para "marcado"; cancelado não volta', async () => {
    const dia = proximoDiaUtil();
    const ini = (h: number) => instanteLocal(dia, h * 60, 'America/Sao_Paulo').toISOString();
    const { agendamento } = await (await agenda.POST(req(DONO, 'POST', { contatoId: 'ct-8', servicoId: 'sv-massagem', profissionalId: 'pf-caio', inicio: ini(10) }))).json();
    await agendaItem.PATCH(req(DONO, 'PATCH', { status: 'confirmado' }), p({ id: agendamento.id }));
    const rem = await (await agendaItem.PATCH(req(DONO, 'PATCH', { inicio: ini(15) }), p({ id: agendamento.id }))).json();
    expect(rem.agendamento.status).toBe('marcado');
    // 13:00 é almoço do Caio
    expect((await agendaItem.PATCH(req(DONO, 'PATCH', { inicio: ini(13) }), p({ id: agendamento.id }))).status).toBe(409);
    await agendaItem.PATCH(req(DONO, 'PATCH', { status: 'cancelado' }), p({ id: agendamento.id }));
    expect((await agendaItem.PATCH(req(DONO, 'PATCH', { status: 'marcado' }), p({ id: agendamento.id }))).status).toBe(409);
  });
});

describe('onboarding', () => {
  it('usuário novo não tem sessão, cria empresa e vira dono', async () => {
    const tk = 'simulado:novo1:novo1@x.com';
    expect((await (await sessao.GET(req(tk))).json()).sessao).toBeNull();
    expect((await empresas.POST(req(tk, 'POST', { nome: 'B' }))).status).toBe(400);
    const r = await empresas.POST(req(tk, 'POST', { nome: 'Barbearia Nova', segmento: 'Barbearia' }));
    expect(r.status).toBe(201);
    const s = await (await sessao.GET(req(tk))).json();
    expect(s.sessao.papel).toBe('dono');
    expect(s.empresa.nome).toBe('Barbearia Nova');
    // e não enxerga a demo
    const l = await (await contatos.GET(req(tk))).json();
    expect(l.contatos).toEqual([]);
  });
});
