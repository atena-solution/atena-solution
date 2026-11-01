'use client';

/**
 * Login no navegador.
 * - Real: Firebase Auth (Google + e-mail/senha) do projeto `atena-solution`.
 *   Doc: https://firebase.google.com/docs/auth/web/start (consultada em 01/11/2026). // CONFIRMAR AO VIVO
 * - Simulado: quando NEXT_PUBLIC_SIMULAR=1 ou sem chaves — guarda o usuário no localStorage
 *   e manda o token "simulado:<uid>:<email>" (o servidor só aceita com SIMULAR=1).
 */
import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';

export interface UsuarioCliente {
  uid: string;
  email: string;
  nome: string;
  fotoUrl?: string;
}

const CHAVE_SIM = 'atena:usuario-simulado';

export function loginSimulado(): boolean {
  return process.env.NEXT_PUBLIC_SIMULAR === '1' || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
}

let auth: Auth | null = null;
async function obterAuth(): Promise<Auth> {
  if (auth) return auth;
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');
  const app: FirebaseApp =
    getApps()[0] ??
    initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  auth = getAuth(app);
  return auth;
}

function paraUsuario(u: User): UsuarioCliente {
  return { uid: u.uid, email: u.email ?? '', nome: u.displayName ?? u.email?.split('@')[0] ?? '', fotoUrl: u.photoURL ?? undefined };
}

function lerSimulado(): UsuarioCliente | null {
  try {
    const v = localStorage.getItem(CHAVE_SIM);
    return v ? (JSON.parse(v) as UsuarioCliente) : null;
  } catch {
    return null;
  }
}

/** Observa o usuário logado. Devolve a função para parar de observar. */
export function observarUsuario(cb: (u: UsuarioCliente | null) => void): () => void {
  if (loginSimulado()) {
    cb(lerSimulado());
    const ouvir = (e: StorageEvent) => e.key === CHAVE_SIM && cb(lerSimulado());
    window.addEventListener('storage', ouvir);
    return () => window.removeEventListener('storage', ouvir);
  }
  let parar = () => {};
  let cancelado = false;
  obterAuth().then(async (a) => {
    const { onIdTokenChanged } = await import('firebase/auth');
    if (!cancelado) parar = onIdTokenChanged(a, (u) => cb(u ? paraUsuario(u) : null));
  });
  return () => {
    cancelado = true;
    parar();
  };
}

export async function tokenAtual(): Promise<string | null> {
  if (loginSimulado()) {
    const u = lerSimulado();
    return u ? `simulado:${u.uid}:${u.email}` : null;
  }
  const a = await obterAuth();
  return a.currentUser ? a.currentUser.getIdToken() : null;
}

/** uid estável a partir do e-mail no modo simulado. */
function uidSimulado(email: string): string {
  const conhecidos: Record<string, string> = {
    'dono@demo.atena': 'demo-dono',
    'ana@demo.atena': 'demo-ana',
    'outro@demo.atena': 'demo-outro',
  };
  if (conhecidos[email]) return conhecidos[email];
  let h = 0;
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `sim-${h.toString(36)}`;
}

export async function entrarComEmail(email: string, senha: string): Promise<void> {
  if (loginSimulado()) {
    const e = email.trim().toLowerCase();
    const u: UsuarioCliente = { uid: uidSimulado(e), email: e, nome: e.split('@')[0] };
    localStorage.setItem(CHAVE_SIM, JSON.stringify(u));
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_SIM }));
    return;
  }
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(await obterAuth(), email, senha);
}

export async function criarContaComEmail(email: string, senha: string, nome: string): Promise<void> {
  if (loginSimulado()) return entrarComEmail(email, senha);
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
  const r = await createUserWithEmailAndPassword(await obterAuth(), email, senha);
  if (nome) await updateProfile(r.user, { displayName: nome });
}

export async function entrarComGoogle(): Promise<void> {
  if (loginSimulado()) return entrarComEmail('dono@demo.atena', '');
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  await signInWithPopup(await obterAuth(), new GoogleAuthProvider());
}

export async function enviarRedefinicaoSenha(email: string): Promise<void> {
  if (loginSimulado()) return;
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(await obterAuth(), email);
}

export async function sair(): Promise<void> {
  if (loginSimulado()) {
    localStorage.removeItem(CHAVE_SIM);
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE_SIM }));
    return;
  }
  const { signOut } = await import('firebase/auth');
  await signOut(await obterAuth());
}

/** Traduz erros do Firebase Auth para o usuário. */
export function mensagemErroAuth(e: unknown): string {
  const codigo = (e as { code?: string })?.code ?? '';
  const mapa: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não achamos uma conta com esse e-mail.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
    'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/popup-closed-by-user': 'A janela do Google foi fechada antes de terminar.',
    'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  };
  return mapa[codigo] ?? 'Não deu para entrar. Tente de novo.';
}
