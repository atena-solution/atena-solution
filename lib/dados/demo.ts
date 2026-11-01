import type { Banco } from './banco';
import { juntar } from './banco';
import type { Agendamento, Atividade, Contato, Empresa, Membro, Profissional, Servico } from '../tipos';
import { montarEmpresa } from '../base/empresas';
import { dataLocal, instanteLocal, somarDias } from '../agenda/fuso';

/**
 * Dados de demonstração para o modo simulado (SIMULAR=1). Empresa fictícia.
 * Logins simulados: dono@demo.atena (dono), ana@demo.atena (atendente), outro@demo.atena (dono de OUTRA empresa).
 */
export const DEMO = {
  empresaId: 'demo',
  outraEmpresaId: 'demo-outra',
  usuarios: [
    { uid: 'demo-dono', email: 'dono@demo.atena', nome: 'Lucas Prado', papel: 'dono' as const, empresa: 'demo' },
    { uid: 'demo-ana', email: 'ana@demo.atena', nome: 'Ana Ribeiro', papel: 'atendente' as const, empresa: 'demo' },
    { uid: 'demo-bruno', email: 'bruno@demo.atena', nome: 'Bruno Lima', papel: 'vendedor' as const, empresa: 'demo' },
    { uid: 'demo-outro', email: 'outro@demo.atena', nome: 'Rita Campos', papel: 'dono' as const, empresa: 'demo-outra' },
  ],
};

export async function semearDemo(b: Banco, agora = new Date()) {
  const fuso = 'America/Sao_Paulo';
  const hoje = dataLocal(agora, fuso);
  const base = montarEmpresa(DEMO.empresaId, {}, new Date(agora.getTime() - 30 * 86400000));
  const empresa: Empresa = {
    ...base,
    nome: 'Studio Aurora',
    segmento: 'Estética',
    telefone: '5511987654321',
    endereco: 'Rua das Acácias, 120 — Pinheiros, São Paulo',
    marca: { logoUrl: '', cores: { primaria: '#7048E8', secundaria: '#0F9B8E' }, tom: 'acolhedor, leve e direto' },
    plano: { ...base.plano, creditos: 120 }, // dá pra testar o Estúdio à vontade
    onboardingConcluido: true,
  };
  await b.gravar(juntar('empresas', empresa.id), empresa);
  const outra = { ...montarEmpresa(DEMO.outraEmpresaId, { nome: 'Barbearia Outra (teste)', segmento: 'Barbearia' }, agora), onboardingConcluido: true };
  await b.gravar(juntar('empresas', outra.id), outra);

  for (const u of DEMO.usuarios) {
    const m: Membro = { uid: u.uid, email: u.email, nome: u.nome, papel: u.papel, ativo: true };
    await b.gravar(juntar('empresas', u.empresa, 'membros', u.uid), m);
    await b.gravar(juntar('usuarios', u.uid), { uid: u.uid, email: u.email, nome: u.nome, empresaAtual: u.empresa, empresas: [u.empresa] });
  }

  const servicos: Servico[] = [
    { id: 'sv-limpeza', nome: 'Limpeza de pele', duracaoMin: 60, preco: 180, descricao: 'Limpeza profunda com extração e máscara calmante.' },
    { id: 'sv-design', nome: 'Design de sobrancelha', duracaoMin: 30, preco: 60, descricao: 'Desenho com pinça e linha.' },
    { id: 'sv-massagem', nome: 'Massagem relaxante', duracaoMin: 50, preco: 150, descricao: 'Massagem corporal com óleos.' },
    { id: 'sv-peeling', nome: 'Peeling de diamante', duracaoMin: 45, preco: 220, descricao: 'Renovação da pele.' },
  ];
  for (const s of servicos) await b.gravar(juntar('empresas', 'demo', 'servicos', s.id), s);

  const profissionais: Profissional[] = [
    { id: 'pf-julia', nome: 'Júlia Mendes', servicosIds: ['sv-limpeza', 'sv-peeling', 'sv-design'], horarios: [] },
    {
      id: 'pf-caio',
      nome: 'Caio Duarte',
      servicosIds: ['sv-massagem', 'sv-limpeza'],
      horarios: [1, 2, 3, 4, 5].flatMap((dia) => [
        { dia, abre: '10:00', fecha: '13:00' },
        { dia, abre: '14:00', fecha: '18:00' },
      ]),
    },
  ];
  for (const p of profissionais) await b.gravar(juntar('empresas', 'demo', 'profissionais', p.id), p);

  const nomes: [string, string, string, string[], string][] = [
    ['Mariana Lopes', '5511991234001', 'agendado', ['VIP'], 'WhatsApp'],
    ['Fernanda Costa', '5511991234002', 'novo', [], 'Instagram'],
    ['Patrícia Almeida', '5511991234003', 'em-conversa', ['Pacote'], 'WhatsApp'],
    ['Juliana Rocha', '5511991234004', 'cliente', ['VIP', 'Indicou'], 'Indicação'],
    ['Camila Martins', '5511991234005', 'compareceu', [], 'Google'],
    ['Beatriz Souza', '5511991234006', 'perdido', [], 'Instagram'],
    ['Renata Carvalho', '5511991234007', 'agendado', [], 'WhatsApp'],
    ['Larissa Gomes', '5511991234008', 'novo', [], 'WhatsApp'],
  ];
  const contatos: Contato[] = nomes.map(([nome, telefone, etapa, etiquetas, origem], i) => ({
    id: `ct-${i + 1}`,
    empresaId: 'demo',
    nome,
    telefone,
    origem,
    etapa,
    etiquetas,
    responsavelUid: i % 2 ? 'demo-ana' : 'demo-dono',
    ultimaInteracaoEm: new Date(agora.getTime() - i * 3_600_000 * 5).toISOString(),
    criadoEm: new Date(agora.getTime() - (i < 2 ? i * 3_600_000 : i * 86_400_000 * 3)).toISOString(),
    campos: {},
  }));
  for (const c of contatos) await b.gravar(juntar('empresas', 'demo', 'contatos', c.id), c);
  // contato da OUTRA empresa (para ver o isolamento)
  await b.gravar(juntar('empresas', 'demo-outra', 'contatos', 'ct-x'), {
    ...contatos[0],
    id: 'ct-x',
    empresaId: 'demo-outra',
    nome: 'Cliente da Outra Empresa',
  });

  const ag = (id: string, contatoId: string, servicoId: string, profissionalId: string, dia: string, hhmm: string, status: Agendamento['status']): Agendamento => {
    const s = servicos.find((x) => x.id === servicoId)!;
    const [h, m] = hhmm.split(':').map(Number);
    const ini = instanteLocal(dia, h * 60 + m, fuso);
    return {
      id,
      contatoId,
      servicoId,
      profissionalId,
      inicio: ini.toISOString(),
      fim: new Date(ini.getTime() + s.duracaoMin * 60000).toISOString(),
      status,
      criadoPor: id.endsWith('ia') ? 'ia' : 'demo-dono',
      lembretes: {},
    };
  };
  const agendamentos = [
    ag('ag-1', 'ct-1', 'sv-limpeza', 'pf-julia', hoje, '10:00', 'compareceu'),
    ag('ag-2-ia', 'ct-7', 'sv-design', 'pf-julia', hoje, '14:30', 'confirmado'),
    ag('ag-3', 'ct-3', 'sv-massagem', 'pf-caio', hoje, '16:00', 'marcado'),
    ag('ag-4', 'ct-5', 'sv-peeling', 'pf-julia', hoje, '09:00', 'faltou'),
    ag('ag-5-ia', 'ct-4', 'sv-limpeza', 'pf-julia', somarDias(hoje, 1), '11:00', 'marcado'),
    ag('ag-6', 'ct-2', 'sv-massagem', 'pf-caio', somarDias(hoje, 2), '15:00', 'marcado'),
  ];
  for (const a of agendamentos) await b.gravar(juntar('empresas', 'demo', 'agendamentos', a.id), a);

  const atividades: Atividade[] = [
    { id: 'at-1', contatoId: 'ct-1', tipo: 'mensagem', resumo: 'Perguntou preço da limpeza de pele', quando: new Date(agora.getTime() - 2 * 86400000).toISOString(), porIA: true },
    { id: 'at-2', contatoId: 'ct-1', tipo: 'agendamento', resumo: 'Limpeza de pele marcada com Júlia', quando: new Date(agora.getTime() - 2 * 86400000 + 600000).toISOString(), porIA: true },
    { id: 'at-3', contatoId: 'ct-1', tipo: 'nota', resumo: 'Pele sensível — usar linha calmante.', quando: new Date(agora.getTime() - 86400000).toISOString(), porUid: 'demo-dono' },
    { id: 'at-4', contatoId: 'ct-4', tipo: 'etapa', resumo: 'Etapa: Compareceu → Cliente', quando: new Date(agora.getTime() - 5 * 86400000).toISOString(), porUid: 'demo-ana' },
  ];
  for (const a of atividades) await b.gravar(juntar('empresas', 'demo', 'atividades', a.id), a);

  // conversas mínimas para o cartão do Início (a sessão B substitui pelas reais)
  await b.gravar(juntar('empresas', 'demo', 'conversas', 'cv-1'), { id: 'cv-1', contatoId: 'ct-2', status: 'aberta' });
  await b.gravar(juntar('empresas', 'demo', 'conversas', 'cv-2'), { id: 'cv-2', contatoId: 'ct-8', status: 'humano', precisaHumano: true });
  await b.gravar(juntar('empresas', 'demo', 'conversas', 'cv-3'), { id: 'cv-3', contatoId: 'ct-3', status: 'resolvida' });
}
