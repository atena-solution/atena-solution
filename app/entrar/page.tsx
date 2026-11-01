'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User } from 'lucide-react';
import { Botao, Campo, Logo } from '@/app/ui';
import {
  criarContaComEmail,
  entrarComEmail,
  entrarComGoogle,
  enviarRedefinicaoSenha,
  loginSimulado,
  mensagemErroAuth,
  observarUsuario,
} from '@/lib/auth/cliente';

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const voltar = params.get('voltar') || '/inicio';
  const [modo, setModo] = useState<'entrar' | 'criar'>(params.get('criar') ? 'criar' : 'entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState<'email' | 'google' | null>(null);
  const simulado = loginSimulado();

  useEffect(() => observarUsuario((u) => u && router.replace(voltar.startsWith('/') ? voltar : '/inicio')), [router, voltar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setOcupado('email');
    try {
      if (modo === 'criar') await criarContaComEmail(email, senha, nome);
      else await entrarComEmail(email, senha);
    } catch (x) {
      setErro(mensagemErroAuth(x));
    } finally {
      setOcupado(null);
    }
  }

  async function google() {
    setErro('');
    setOcupado('google');
    try {
      await entrarComGoogle();
    } catch (x) {
      setErro(mensagemErroAuth(x));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <Logo className="mb-10" />
      <h1 className="titulo-serif text-4xl text-texto">{modo === 'entrar' ? 'Bem-vindo de volta.' : 'Comece agora.'}</h1>
      <p className="mt-2 text-sm text-texto-2">
        {modo === 'entrar' ? 'Entre para ver seus atendimentos, agenda e equipe.' : 'Crie sua conta e configure sua empresa em poucos minutos.'}
      </p>

      {simulado && (
        <div className="mt-6 rounded-xl border border-atencao/30 bg-atencao/10 px-3.5 py-3 text-[13px] text-texto-2">
          <strong className="text-atencao">Modo simulado.</strong> Qualquer e-mail entra. Use <code>dono@demo.atena</code> para ver a empresa de
          demonstração (<code>ana@demo.atena</code> = atendente, <code>bruno@demo.atena</code> = vendedor), ou um e-mail novo para testar o cadastro.
        </div>
      )}

      <Botao variante="secundario" larguraTotal className="mt-6" onClick={google} carregando={ocupado === 'google'} icone={<IconeGoogle />}>
        Continuar com Google
      </Botao>

      <div className="my-6 flex items-center gap-3 text-xs text-texto-3">
        <span className="h-px flex-1 bg-borda" /> ou com e-mail <span className="h-px flex-1 bg-borda" />
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-4">
        {modo === 'criar' && <Campo rotulo="Seu nome" icone={<User />} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />}
        <Campo rotulo="E-mail" type="email" icone={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <Campo
          rotulo="Senha"
          type="password"
          icone={<Lock />}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
          required={!simulado}
          minLength={simulado ? undefined : 6}
        />
        {erro && (
          <p role="alert" className="text-sm text-erro">
            {erro}
          </p>
        )}
        {aviso && <p className="text-sm text-sucesso">{aviso}</p>}
        <Botao type="submit" tamanho="g" larguraTotal carregando={ocupado === 'email'}>
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Botao>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <button className="text-texto-2 hover:text-texto" onClick={() => setModo(modo === 'entrar' ? 'criar' : 'entrar')}>
          {modo === 'entrar' ? 'Criar conta' : 'Já tenho conta'}
        </button>
        {modo === 'entrar' && (
          <button
            className="text-texto-3 hover:text-texto"
            onClick={async () => {
              if (!email) return setErro('Digite seu e-mail acima para receber o link.');
              await enviarRedefinicaoSenha(email).catch(() => {});
              setAviso('Se o e-mail existir, enviamos um link para criar nova senha.');
            }}
          >
            Esqueci a senha
          </button>
        )}
      </div>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.1 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12Z" />
    </svg>
  );
}

export default function PaginaEntrar() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-6 py-12">
        <Suspense>
          <Formulario />
        </Suspense>
      </div>
      <div className="relative hidden overflow-hidden border-l border-borda bg-[#0E1116] lg:block">
        <div className="absolute inset-0 opacity-60" style={{ background: 'radial-gradient(60% 50% at 70% 30%, rgba(112,72,232,.35), transparent 70%), radial-gradient(50% 40% at 20% 80%, rgba(59,91,219,.3), transparent 70%)' }} />
        <div className="relative flex h-full flex-col justify-end p-14 text-[#EEF0F3]">
          <p className="titulo-serif max-w-md text-5xl leading-[1.05]">Seu cliente atendido na hora. Sua equipe vendendo melhor.</p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm text-[#A8AFBB]">
            <div>
              <p className="numero text-2xl text-white">24h</p>Atendimento no WhatsApp
            </div>
            <div>
              <p className="numero text-2xl text-white">1 tela</p>Contatos, agenda e equipe
            </div>
            <div>
              <p className="numero text-2xl text-white">3 abas</p>Atendimento, Coach e Estúdio
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
