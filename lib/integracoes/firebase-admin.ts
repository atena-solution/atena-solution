import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

/**
 * Firebase Admin do projeto NOVO `atena-solution`.
 * Credencial: env FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço numa linha). Nunca em arquivo versionado.
 * Doc: https://firebase.google.com/docs/admin/setup (consultada em 01/11/2026). // CONFIRMAR AO VIVO
 */
function app(): App {
  const existente = getApps()[0];
  if (existente) return existente;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT não definido (ou use SIMULAR=1).');
  const conta = JSON.parse(json);
  return initializeApp({ credential: cert(conta), projectId: conta.project_id });
}

export function firestoreAdmin() {
  return getFirestore(app());
}

export function authAdmin() {
  return getAuth(app());
}

/** Bucket do Storage (env FIREBASE_STORAGE_BUCKET, ex.: atena-solution.firebasestorage.app). // CONFIRMAR AO VIVO */
export function bucketAdmin() {
  return getStorage(app()).bucket(process.env.FIREBASE_STORAGE_BUCKET);
}
