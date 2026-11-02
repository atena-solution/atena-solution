// Junção: login único, plano/créditos ligados e isolamento nas rotas do Coach e do Estúdio.
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoMemoria } from '@/lib/dados/banco';
import { definirBanco } from '@/lib/dados';
import { semearDemo } from '@/lib/dados/demo';
import { mesDe } from '@/lib/planos/uso';
import * as foto from '@/app/api/estudio/foto/route';
import * as galeria from '@/app/api/estudio/galeria/route';
import * as creditos from '@/app/api/estudio/creditos/route';
import * as reunioes from '@/app/api/coach/reunioes/route';
import * as analisar from '@/app/api/coach/reunioes/[id]/analisar/route';
import { decidirAba } from '@/lib/planos/portao';

process.env.SIMULAR = '1';

const DONO = 'simulado:demo-dono:dono@demo.atena';
const BRUNO = 'simulado:demo-bruno:bruno@demo.atena';
const OUTRO = 'simulado:demo-outro:outro@demo.atena';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function req(token: string, metodo = 'GET', corpo?: unknown, url = 'http://x/api') {
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(url, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}
const p = <T,>(v: T) => ({ params: Promise.resolve(v) });

let b: BancoMemoria;
beforeEach(async () => {
  b = new BancoMemoria();
  await semearDemo(b);
  definirBanco(b);
});

async function vencerAssinatura(empresaId = 'demo') {
  const a = (await b.obter<Record<string, unknown>>(`empresas/${empresaId}/cobranca/assinatura`))!;
  await b.gravar(`empresas/${empresaId}/cobranca/assinatura`, { ...a, pagoAte: new Date(Date.now() - 30 * 86400000).toISOString(), testeAte: undefined });
}

describe('Estúdio com a Base', () => {
  const pedido = { estilo: 'fundo-limpo', formato: '1:1', fotos: [PNG], quantidade: 1, produto: 'Sérum' };

  it('gera, desconta do plano.creditos da empresa e registra o uso de IA', async () => {
    const antes = (await b.obter<{ plano: { creditos: number } }>('empresas/demo'))!.plano.creditos;
    const r = await foto.POST(req(DONO, 'POST', pedido));
    expect(r.status).toBe(201);
    const depois = (await b.obter<{ plano: { creditos: number } }>('empresas/demo'))!.plano.creditos;
    expect(depois).toBeLessThan(antes);
    expect((await r.json()).saldo).toBe(depois);
    const uso = await b.obter<{ modelos: Record<string, { imagens?: number }> }>(`empresas/demo/uso/${mesDe(new Date().toISOString())}`);
    expect(uso?.modelos['gemini-imagem']?.imagens).toBeGreaterThan(0);
  });

  it('não vaza galeria nem créditos de outra empresa', async () => {
    await foto.POST(req(DONO, 'POST', pedido));
    const g = await (await galeria.GET(req(OUTRO, 'GET', undefined, 'http://x/api/estudio/galeria'))).json();
    expect(g.criacoes ?? g.itens ?? []).toHaveLength(0);
    const c = await (await creditos.GET(req(OUTRO))).json();
    expect(c.extrato).toHaveLength(0);
  });

  it('sem login → 401; plano vencido → 402 (só leitura), e a galeria continua visível', async () => {
    expect((await foto.POST(new Request('http://x', { method: 'POST', body: '{}' }))).status).toBe(401);
    await vencerAssinatura();
    const r = await foto.POST(req(DONO, 'POST', pedido));
    expect(r.status).toBe(402);
    expect((await r.json()).motivo).toBe('somente_leitura');
    expect((await galeria.GET(req(DONO, 'GET', undefined, 'http://x/api/estudio/galeria'))).status).toBe(200);
  });
});

describe('Coach com a Base', () => {
  it('vendedor cria reunião; atendente não usa o Coach', async () => {
    const r = await reunioes.POST(req(BRUNO, 'POST', { modo: 'so-microfone', titulo: 'Teste' }));
    expect(r.status).toBe(200);
    const ana = await reunioes.GET(req('simulado:demo-ana:ana@demo.atena'));
    expect(ana.status).toBe(403);
  });

  it('aba fora do plano → 402 com motivo; reunião de outra empresa → 404', async () => {
    const a = (await b.obter<Record<string, unknown>>('empresas/demo/cobranca/assinatura'))!;
    const criada = await (await reunioes.POST(req(DONO, 'POST', { modo: 'so-microfone' }))).json();
    await b.gravar('empresas/demo/cobranca/assinatura', { ...a, planoId: 'atendimento' });
    const r = await reunioes.POST(req(DONO, 'POST', { modo: 'so-microfone' }));
    expect(r.status).toBe(402);
    expect((await r.json()).motivo).toBe('aba_fora_do_plano');
    const alheia = await analisar.POST(req(OUTRO, 'POST', {}), p({ id: criada.reuniao.id }));
    expect([402, 404]).toContain(alheia.status);
  });
});

describe('portão do plano', () => {
  it('empresa sem assinatura ganha o teste contado da criação', async () => {
    expect(await decidirAba('demo-outra', 'atendimento')).toEqual({ permitido: true });
    expect(await b.obter('empresas/demo-outra/cobranca/assinatura')).toMatchObject({ planoId: 'completo' });
  });
  it('vencida bloqueia escrever mas deixa ler', async () => {
    await vencerAssinatura();
    expect((await decidirAba('demo', 'atendimento', 'escrever')).permitido).toBe(false);
    expect((await decidirAba('demo', 'atendimento', 'ler')).permitido).toBe(true);
  });
});
