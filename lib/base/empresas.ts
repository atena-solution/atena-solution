import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import { novoId } from '../dados/empresa';
import type { Usuario, Identidade } from '../auth/servidor';
import type { Convite, Empresa, Membro, Papel } from '../tipos';
import { ETAPAS_PADRAO } from '../contatos/funil';

export const HORARIOS_PADRAO = [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: '09:00', fecha: '18:00' })).concat([{ dia: 6, abre: '09:00', fecha: '13:00' }]);

/** Monta a empresa nova com valores padrão (função pura). */
export function montarEmpresa(id: string, dados: Partial<Empresa>, agora: Date): Empresa {
  return {
    id,
    nome: dados.nome ?? 'Minha empresa',
    segmento: dados.segmento ?? 'Outro',
    fuso: 'America/Sao_Paulo',
    telefone: dados.telefone ?? '',
    endereco: dados.endereco ?? '',
    horarios: dados.horarios ?? HORARIOS_PADRAO,
    marca: dados.marca ?? { logoUrl: '', cores: { primaria: '#3B5BDB', secundaria: '#7048E8' }, tom: '' },
    // teste: libera as 3 abas; a sessão E (planos) controla isso depois
    plano: { abas: ['atendimento', 'coach', 'estudio'], creditos: 20 },
    etapas: ETAPAS_PADRAO,
    onboardingConcluido: false,
    criadoEm: agora.toISOString(),
  };
}

/** Cria empresa + quem criou vira dono + empresa vira a atual do usuário. */
export async function criarEmpresa(b: Banco, id: Identidade, dados: Partial<Empresa>, agora = new Date()): Promise<Empresa> {
  const empresaId = novoId('emp_');
  const empresa = montarEmpresa(empresaId, dados, agora);
  await b.gravar(juntar('empresas', empresaId), empresa);
  const membro: Membro = { uid: id.uid, email: id.email, nome: id.nome ?? id.email.split('@')[0], papel: 'dono', ativo: true };
  await b.gravar(juntar('empresas', empresaId, 'membros', id.uid), membro);
  const usuario = (await b.obter<Usuario>(juntar('usuarios', id.uid))) ?? { uid: id.uid, email: id.email, nome: membro.nome, empresas: [] };
  await b.gravar(juntar('usuarios', id.uid), {
    ...usuario,
    empresaAtual: empresaId,
    empresas: [...new Set([...usuario.empresas, empresaId])],
  });
  return empresa;
}

/** Índice global de convites: convites/{email} → empresa e papel. */
export interface ConviteIndice {
  email: string;
  empresaId: string;
  papel: Papel;
}

export async function convidar(b: Banco, empresaId: string, email: string, papel: Papel, porUid: string, agora = new Date()) {
  const convite: Convite = { email, papel, convidadoPor: porUid, criadoEm: agora.toISOString() };
  await b.gravar(juntar('empresas', empresaId, 'convites', email), convite);
  await b.gravar<ConviteIndice>(juntar('convites', email), { email, empresaId, papel });
  // O envio do e-mail de convite fica para a integração de e-mail (fase posterior). // CONFIRMAR AO VIVO
  return convite;
}

/** No 1º login, se houver convite para o e-mail, vira membro da empresa. */
export async function aceitarConvitePendente(b: Banco, id: Identidade): Promise<string | null> {
  if (!id.email) return null;
  const indice = await b.obter<ConviteIndice>(juntar('convites', id.email));
  if (!indice) return null;
  const membro: Membro = { uid: id.uid, email: id.email, nome: id.nome ?? id.email.split('@')[0], papel: indice.papel, ativo: true };
  await b.gravar(juntar('empresas', indice.empresaId, 'membros', id.uid), membro);
  await b.apagar(juntar('empresas', indice.empresaId, 'convites', id.email));
  await b.apagar(juntar('convites', id.email));
  const usuario = (await b.obter<Usuario>(juntar('usuarios', id.uid))) ?? { uid: id.uid, email: id.email, nome: membro.nome, empresas: [] };
  await b.gravar(juntar('usuarios', id.uid), {
    ...usuario,
    empresaAtual: usuario.empresaAtual ?? indice.empresaId,
    empresas: [...new Set([...usuario.empresas, indice.empresaId])],
  });
  return indice.empresaId;
}
