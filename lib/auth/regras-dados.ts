// Tabela ÚNICA de quem lê e escreve cada coleção pelo NAVEGADOR (Firestore e Storage).
// `firestore.rules` e `storage.rules` são GERADOS daqui (npm run regras) e o teste confere que estão iguais.
// O servidor usa o Admin SDK e não passa pelas regras; a maioria das telas lê pela API.
// Leitura direta do navegador hoje: só a caixa de entrada do Atendimento (conversas, em tempo real).
import type { Membro, Papel } from '../tipos';
import { ESCRITA_POR_COLECAO } from './permissoes';

export type Acesso = 'ninguem' | 'membros' | Papel[];

export interface RegraColecao {
  ler: Acesso;
  escrever: Acesso;
  /** Inclui subcoleções (ex.: conversas/{id}/mensagens). */
  profundo?: boolean;
  /** Além de `ler`, este papel lê os documentos em que `campo == uid` ou `ouCampo == true`. */
  proprio?: { papel: Papel; campo: string; ouCampo?: string };
  /** Na escrita, o documento precisa ter empresaId igual ao da empresa. */
  exigeEmpresaId?: boolean;
  /** Para que serve (vai como comentário no arquivo gerado). */
  nota: string;
}

const TODOS: Papel[] = ['dono', 'gestor', 'atendente', 'vendedor'];
const GESTAO: Papel[] = ['dono', 'gestor'];

/** Subcoleções de empresas/{empresaId}. */
export const REGRAS_EMPRESA: Record<string, RegraColecao> = {
  // ----- Base
  membros: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.membros, nota: 'equipe' },
  convites: { ler: GESTAO, escrever: ESCRITA_POR_COLECAO.convites, nota: 'convites pendentes' },
  servicos: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.servicos, nota: 'serviços e preços' },
  profissionais: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.profissionais, nota: 'quem atende' },
  contatos: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.contatos, exigeEmpresaId: true, nota: 'contatos e funil' },
  atividades: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.atividades, nota: 'linha do tempo do contato' },
  agendamentos: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.agendamentos, nota: 'agenda' },
  agenda_travas: { ler: 'ninguem', escrever: 'ninguem', nota: 'trava de horário (servidor)' },
  // ----- Atendimento
  conversas: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.conversas, profundo: true, nota: 'caixa de entrada em tempo real (+ mensagens)' },
  atendimento: { ler: 'membros', escrever: 'ninguem', nota: 'conexão (sem token) e treino da IA' },
  atendimento_automacoes: { ler: 'ninguem', escrever: 'ninguem', nota: 'lembretes já enviados' },
  atendimento_enviados: { ler: 'ninguem', escrever: 'ninguem', nota: 'controle de envio' },
  atendimento_push: { ler: 'ninguem', escrever: 'ninguem', nota: 'inscrições de web push' },
  atendimento_recebidos: { ler: 'ninguem', escrever: 'ninguem', nota: 'deduplicação do webhook' },
  atendimento_telefones: { ler: 'ninguem', escrever: 'ninguem', nota: 'índice telefone → contato' },
  // ----- Coach
  reunioes: {
    ler: GESTAO, escrever: ESCRITA_POR_COLECAO.reunioes, profundo: true,
    proprio: { papel: 'vendedor', campo: 'vendedorUid', ouCampo: 'naBiblioteca' },
    nota: 'reuniões: dono/gestor veem todas; vendedor vê as dele e as da biblioteca',
  },
  coach: { ler: ['dono', 'gestor', 'vendedor'], escrever: 'ninguem', nota: 'roteiro e configuração do Coach' },
  // ----- Estúdio
  criacoes: { ler: 'membros', escrever: ESCRITA_POR_COLECAO.criacoes, nota: 'galeria do Estúdio' },
  pautas: { ler: 'membros', escrever: 'ninguem', nota: 'calendário de conteúdo' },
  creditos: { ler: 'membros', escrever: 'ninguem', nota: 'extrato de créditos (só o servidor mexe)' },
  // ----- Cobrança
  cobranca: { ler: GESTAO, escrever: 'ninguem', nota: 'assinatura' },
  pagamentos: { ler: GESTAO, escrever: 'ninguem', nota: 'pagamentos do Asaas' },
  uso: { ler: 'ninguem', escrever: 'ninguem', nota: 'custo de IA (painel interno)' },
};

/** Coleções do topo: tudo só pelo servidor (exceto o próprio usuário). */
export const SO_SERVIDOR_TOPO = ['convites', 'whatsappNumeros', 'segredos', 'filaAtendimento', 'filaAtendimentoPegos', 'atena_alertas'];

// ---------------------------------------------------------------- decisão pura (espelha as regras)

export function podeLerDoc(regra: RegraColecao | undefined, membro: Pick<Membro, 'uid' | 'papel' | 'ativo'> | null, doc?: Record<string, unknown>): boolean {
  if (!regra || !membro?.ativo || regra.ler === 'ninguem') return false;
  if (regra.ler === 'membros' || regra.ler.includes(membro.papel)) return true;
  const p = regra.proprio;
  return !!p && membro.papel === p.papel && !!doc && (doc[p.campo] === membro.uid || (!!p.ouCampo && doc[p.ouCampo] === true));
}

export function podeEscreverDoc(regra: RegraColecao | undefined, membro: Pick<Membro, 'papel' | 'ativo'> | null): boolean {
  if (!regra || !membro?.ativo || regra.escrever === 'ninguem') return false;
  return regra.escrever === 'membros' || regra.escrever.includes(membro.papel);
}

// ---------------------------------------------------------------- geração dos arquivos

const lista = (p: Papel[]) => `[${p.map((x) => `'${x}'`).join(', ')}]`;
function condicao(a: Acesso): string {
  if (a === 'ninguem') return 'false';
  if (a === 'membros') return 'ativo(empresaId)';
  return `papelEm(empresaId, ${lista(a)})`;
}

function blocoColecao(nome: string, r: RegraColecao): string {
  const id = r.profundo ? '{id=**}' : '{id}';
  let ler = condicao(r.ler);
  if (r.proprio) {
    const p = r.proprio;
    const dono = `resource.data.${p.campo} == request.auth.uid${p.ouCampo ? ` || resource.data.${p.ouCampo} == true` : ''}`;
    ler = `${ler}\n          || (papelEm(empresaId, ['${p.papel}']) && (${dono}))`;
  }
  let escrever = condicao(r.escrever);
  if (r.exigeEmpresaId && escrever !== 'false') escrever += '\n          && (request.resource == null || request.resource.data.empresaId == empresaId)';
  const linhas =
    ler === 'false' && escrever === 'false'
      ? [`        allow read, write: if false;`]
      : [`        allow read: if ${ler};`, `        allow write: if ${escrever};`];
  return [`      // ${r.nota}`, `      match /${nome}/${id} {`, ...linhas, `      }`].join('\n');
}

export function gerarFirestoreRules(): string {
  const colecoes = Object.entries(REGRAS_EMPRESA).map(([n, r]) => blocoColecao(n, r)).join('\n');
  const topo = SO_SERVIDOR_TOPO.map((n) => `    match /${n}/{id=**} {\n      allow read, write: if false;\n    }`).join('\n');
  return `rules_version = '2';

// GERADO por lib/auth/regras-dados.ts (npm run regras). Não edite à mão: mude a tabela e gere de novo.
// O servidor usa o Admin SDK (não passa por aqui); estas regras protegem o acesso direto do navegador
// (ex.: caixa de entrada do Atendimento em tempo real). Tudo que não está listado é negado.
service cloud.firestore {
  match /databases/{database}/documents {

    function logado() { return request.auth != null; }
    function membro(empresaId) {
      return get(/databases/$(database)/documents/empresas/$(empresaId)/membros/$(request.auth.uid)).data;
    }
    function ativo(empresaId) {
      return logado()
        && exists(/databases/$(database)/documents/empresas/$(empresaId)/membros/$(request.auth.uid))
        && membro(empresaId).ativo == true;
    }
    function papelEm(empresaId, papeis) {
      return ativo(empresaId) && membro(empresaId).papel in papeis;
    }

    // Usuário só lê o próprio documento; escrita só pelo servidor.
    match /usuarios/{uid} {
      allow read: if logado() && request.auth.uid == uid;
      allow write: if false;
    }

    // Só o servidor (índices, segredos cifrados, filas, alertas).
${topo}

    match /empresas/{empresaId} {
      allow read: if ativo(empresaId);
      allow create, delete: if false; // criação pelo servidor (onboarding)
      allow update: if papelEm(empresaId, ['dono', 'gestor'])
        && request.resource.data.id == resource.data.id
        && request.resource.data.plano == resource.data.plano; // plano/créditos só pelo servidor (cobrança)

${colecoes}
      // Qualquer outra subcoleção: negado (o servidor usa o Admin SDK).
      match /{outra}/{id=**} {
        allow read, write: if false;
      }
    }
  }
}
`;
}

export function gerarStorageRules(): string {
  return `rules_version = '2';

// GERADO por lib/auth/regras-dados.ts (npm run regras). Não edite à mão.
// Arquivos da empresa ficam em empresas/{empresaId}/** (áudios do Coach, imagens do Estúdio).
// Só membros ativos leem pelo navegador; ninguém escreve direto: envio por URL assinada gerada no servidor
// (depois do login e da checagem da empresa) e Admin SDK. CONFIRMAR AO VIVO: deploy e regras entre serviços.
service firebase.storage {
  match /b/{bucket}/o {
    function ativo(empresaId) {
      return request.auth != null
        && firestore.exists(/databases/(default)/documents/empresas/$(empresaId)/membros/$(request.auth.uid))
        && firestore.get(/databases/(default)/documents/empresas/$(empresaId)/membros/$(request.auth.uid)).data.ativo == true;
    }

    match /empresas/{empresaId}/{caminho=**} {
      allow read: if ativo(empresaId);
      allow write: if false;
    }

    match /{caminho=**} {
      allow read, write: if false;
    }
  }
}
`;
}

/** Índices compostos que as consultas do servidor precisam (Coach, Estúdio, Cobrança). */
export function gerarIndices() {
  return {
    indexes: [
      // Coach: placar por vendedor e reuniões do contato (lib/coach/repositorio-firestore.ts)
      { collectionGroup: 'reunioes', queryScope: 'COLLECTION', fields: [{ fieldPath: 'vendedorUid', order: 'ASCENDING' }, { fieldPath: 'criadoEm', order: 'DESCENDING' }] },
      { collectionGroup: 'reunioes', queryScope: 'COLLECTION', fields: [{ fieldPath: 'contatoId', order: 'ASCENDING' }, { fieldPath: 'criadoEm', order: 'DESCENDING' }] },
      { collectionGroup: 'reunioes', queryScope: 'COLLECTION', fields: [{ fieldPath: 'vendedorUid', order: 'ASCENDING' }, { fieldPath: 'contatoId', order: 'ASCENDING' }, { fieldPath: 'criadoEm', order: 'DESCENDING' }] },
      // Estúdio: débitos/devoluções do extrato na transação de créditos (lib/estudio/repositorio-firestore.ts)
      { collectionGroup: 'creditos', queryScope: 'COLLECTION', fields: [{ fieldPath: 'origem', order: 'ASCENDING' }, { fieldPath: 'quando', order: 'DESCENDING' }] },
    ],
    fieldOverrides: [
      // Cobrança: achar a empresa pelo cliente do Asaas (collectionGroup('cobranca'), lib/cobranca/repositorio-firestore.ts)
      { collectionGroup: 'cobranca', fieldPath: 'asaasClienteId', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION' }, { order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }] },
    ],
  };
}
