// Monta as dependências do Estúdio (só no servidor), em cima da Base:
// - simulado (SIMULAR=1 / sem Firebase): RepositorioBanco no banco em memória da Base (mesmo saldo da cobrança);
// - real: RepositorioFirestore com o Admin SDK da Base e as imagens grandes no Storage.
import { randomUUID } from 'node:crypto';
import * as imagem from '../integracoes/imagem';
import { banco, simulando } from '../dados';
import type { RepositorioEstudio } from './repositorio';
import { RepositorioBanco } from './repositorio-banco';
import type { Dependencias } from './servico';
import { gerarTextoPost } from './texto-ia';

export async function repositorio(): Promise<RepositorioEstudio> {
  if (simulando()) return new RepositorioBanco(await banco());
  const [{ RepositorioFirestore }, fb] = await Promise.all([import('./repositorio-firestore'), import('../integracoes/firebase-admin')]);
  const db = fb.firestoreAdmin() as unknown as import('./repositorio-firestore').FirestoreMinimo;
  return new RepositorioFirestore(db, async (empresaId, caminho, dataUrl) => {
    // Upload com token de download do Firebase (URL estável, sem expirar). // CONFIRMAR AO VIVO
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) return dataUrl;
    const token = randomUUID();
    const nome = `empresas/${empresaId}/${caminho}`;
    const bucket = fb.bucketAdmin();
    await bucket.file(nome).save(Buffer.from(m[2], 'base64'), { contentType: m[1], resumable: false, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(nome)}?alt=media&token=${token}`;
  });
}

export async function dependencias(): Promise<Dependencias> {
  return {
    repo: await repositorio(),
    gerarImagens: imagem.gerarImagens,
    iniciarVideo: imagem.iniciarVideo,
    consultarVideo: imagem.consultarVideo,
    gerarTextoPost,
    agora: () => new Date().toISOString(),
    novoId: () => randomUUID(),
  };
}
