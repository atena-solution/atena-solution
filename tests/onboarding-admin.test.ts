import { describe, expect, it } from 'vitest';
import { ONBOARDING_VAZIO, concluido, marcarFeito, podeAbrir, progresso, proximoPasso, pular, pendencias, validarEmpresa, validarServicos, horariosPadrao, telefoneE164, treinoDoOnboarding, perguntasRapidas, destinoOnboarding } from '../lib/planos/onboarding';
import { ehEquipeAtena, custoEstimado, somarUso, semaforo, margem } from '../lib/planos/admin';

const T = '2026-11-01T12:00:00.000Z';

describe('onboarding', () => {
  it('segue a ordem e não deixa pular na frente', () => {
    let e = ONBOARDING_VAZIO;
    expect(proximoPasso(e)).toBe('conta');
    expect(podeAbrir(e, 'servicos')).toBe(false);
    e = marcarFeito(e, 'conta', T);
    e = marcarFeito(e, 'empresa', T);
    expect(proximoPasso(e)).toBe('servicos');
    expect(podeAbrir(e, 'servicos')).toBe(true);
    expect(podeAbrir(e, 'conta')).toBe(true);
    expect(podeAbrir(e, 'whatsapp')).toBe(false);
    expect(progresso(e)).toBe(40);
  });
  it('WhatsApp pode ser pulado; serviços não', () => {
    let e = ['conta', 'empresa', 'servicos', 'treinar'].reduce((acc, p) => marcarFeito(acc, p as never, T), ONBOARDING_VAZIO);
    expect(() => pular(e, 'servicos', T)).toThrow();
    e = pular(e, 'whatsapp', T);
    expect(concluido(e)).toBe(true);
    expect(progresso(e)).toBe(100);
    expect(pendencias(e).map((p) => p.id)).toEqual(['whatsapp']);
    // fazer depois tira da lista de pulados
    e = marcarFeito(e, 'whatsapp', T);
    expect(pendencias(e)).toEqual([]);
  });
  it('valida empresa', () => {
    expect(validarEmpresa({ nome: 'Mira Luz', segmento: 'clinica', telefone: '(11) 98888-7777' })).toEqual({});
    const e = validarEmpresa({ nome: '', segmento: 'xx', telefone: '123' });
    expect(Object.keys(e).sort()).toEqual(['nome', 'segmento', 'telefone']);
    expect(telefoneE164('+55 (21) 3333-4444')).toBe('552133334444');
  });
  it('valida serviços e horários', () => {
    expect(validarServicos([{ nome: 'Corte', duracaoMin: 30, preco: 5000 }], horariosPadrao())).toEqual({});
    const e = validarServicos([{ nome: '', duracaoMin: 0, preco: -1 }], [{ dia: 1, abre: '18:00', fecha: '09:00' }]);
    expect(Object.keys(e).length).toBe(4);
    expect(validarServicos([], [])).toHaveProperty('servicos');
  });
  it('treino gerado no formato do Atendimento', () => {
    const t = treinoDoOnboarding({ nomeAssistente: ' Lia ', perguntas: [{ pergunta: 'Aceita Pix?', resposta: 'Sim!' }, { pergunta: '', resposta: 'x' }], nuncaDizer: '- dar desconto\n- falar de concorrente' });
    expect(t.nomeAssistente).toBe('Lia');
    expect(t.perguntas).toHaveLength(1);
    expect(t.nuncaDizer).toEqual(['dar desconto', 'falar de concorrente']);
    expect(t.quandoChamarHumano.length).toBeGreaterThan(0);
    expect(perguntasRapidas('barbearia')).toHaveLength(5);
  });
});

describe('admin', () => {
  const env = { ATENA_ADMIN_EMAILS: 'Lincoln@Atena.com.br, outra@atena.com.br' };
  it('só e-mails da equipe, verificados', () => {
    expect(ehEquipeAtena({ email: 'lincoln@atena.com.br', emailVerificado: true }, env)).toBe(true);
    expect(ehEquipeAtena({ email: 'lincoln@atena.com.br', emailVerificado: false }, env)).toBe(false);
    expect(ehEquipeAtena({ email: 'cliente@x.com', emailVerificado: true }, env)).toBe(false);
    expect(ehEquipeAtena({ email: 'lincoln@atena.com.br' }, {})).toBe(false);
    expect(ehEquipeAtena(null, env)).toBe(false);
  });
  it('custo estimado de IA', () => {
    const uso = somarUso({ 'claude-sonnet-5-5': { entrada: 500_000 } }, { 'claude-sonnet-5-5': { entrada: 500_000, saida: 100_000 }, 'modelo-x': { entrada: 1 } });
    expect(uso['claude-sonnet-5-5']).toEqual({ entrada: 1_000_000, saida: 100_000 });
    const c = custoEstimado(uso, undefined, 5);
    expect(c.centavos).toBe(Math.round((2 + 1) * 5 * 100));
    expect(c.semPreco).toEqual(['modelo-x']);
  });
  it('semáforo de saúde', () => {
    expect(semaforo({ whatsappConectado: true, errosUltimas24h: 0, ultimaAtividadeEm: T }, true, T).cor).toBe('ok');
    expect(semaforo({ whatsappConectado: false, errosUltimas24h: 0 }, true, T).cor).toBe('problema');
    expect(semaforo({ whatsappConectado: false, errosUltimas24h: 0 }, false, T).cor).toBe('ok');
    expect(semaforo({ whatsappConectado: true, errosUltimas24h: 2 }, true, T).cor).toBe('atencao');
  });
  it('margem', () => {
    expect(margem(29700, 2970)).toEqual({ valor: 26730, pct: 90 });
    expect(margem(0, 100).pct).toBe(0);
  });
});

describe('um onboarding só (junção)', () => {
  const comAtendimento = { plano: { abas: ['atendimento', 'coach'] } };
  it('sem a parte da Base → /onboarding', () => {
    expect(destinoOnboarding({ ...comAtendimento })).toBe('/onboarding');
    expect(destinoOnboarding({ ...comAtendimento, onboarding: { feitos: ['conta', 'empresa'], pulados: [] } })).toBe('/onboarding');
  });
  it('Base feita (aqui ou no /comecar) → /comecar continua do Treinar a IA', () => {
    expect(destinoOnboarding({ ...comAtendimento, onboardingConcluido: true })).toBe('/comecar');
    expect(destinoOnboarding({ ...comAtendimento, onboarding: { feitos: ['conta', 'empresa', 'servicos'], pulados: [] } })).toBe('/comecar');
  });
  it('treinar e WhatsApp resolvidos (feitos ou pulados), ou sem Atendimento no plano → /inicio', () => {
    expect(destinoOnboarding({ ...comAtendimento, onboardingConcluido: true, onboarding: { feitos: ['treinar'], pulados: ['whatsapp'] } })).toBe('/inicio');
    expect(destinoOnboarding({ plano: { abas: ['estudio'] }, onboardingConcluido: true })).toBe('/inicio');
  });
});
