'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Search, Moon, Sun, LogOut, ChevronsUpDown, Lock, MoreHorizontal, Check } from 'lucide-react';
import { ProvedorSessao, useSessao } from '@/lib/sessao';
import { itemAtivo, navegacaoDoPlano } from '@/lib/navegacao';
import { sair } from '@/lib/auth/cliente';
import { NOME_PAPEL } from '@/lib/auth/permissoes';
import { Avatar, Logo, ProvedorToast, Esqueleto, cx, ICONES_NAV, Folha } from '@/app/ui';
import { BuscaGlobal } from './BuscaGlobal';

export function Casca({ children }: { children: ReactNode }) {
  return (
    <ProvedorSessao>
      <ProvedorToast>
        <Guardiao>{children}</Guardiao>
      </ProvedorToast>
    </ProvedorSessao>
  );
}

/** Manda para /entrar (sem login) ou /onboarding (sem empresa). */
function Guardiao({ children }: { children: ReactNode }) {
  const { carregando, usuario, sessao } = useSessao();
  const router = useRouter();
  const caminho = usePathname();
  const noOnboarding = caminho.startsWith('/onboarding');

  useEffect(() => {
    if (carregando) return;
    if (!usuario) router.replace(`/entrar?voltar=${encodeURIComponent(caminho)}`);
    else if (!sessao && !noOnboarding) router.replace('/onboarding');
  }, [carregando, usuario, sessao, router, caminho, noOnboarding]);

  if (noOnboarding && usuario) return <>{children}</>;
  if (carregando || !usuario || !sessao) return <TelaCarregando />;
  return <Moldura>{children}</Moldura>;
}

function TelaCarregando() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Carregando">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <Esqueleto className="h-1 w-32 rounded-full" />
      </div>
    </div>
  );
}

function Moldura({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const { empresa } = useSessao();
  const itens = navegacaoDoPlano(empresa?.plano.abas ?? []);
  const ativo = itemAtivo(caminho, itens);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [maisAberto, setMaisAberto] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaAberta((v) => !v);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-superficie focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>

      {/* Barra lateral (tablet: só ícones; desktop: ícone + nome) */}
      <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col border-r border-borda bg-superficie/60 md:flex lg:w-[232px]">
        <div className="flex h-16 items-center px-5">
          <Link href="/inicio" aria-label="Início" className="lg:hidden">
            <Logo compacto />
          </Link>
          <Link href="/inicio" aria-label="Início" className="hidden lg:block">
            <Logo />
          </Link>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {itens.map((i) => {
            const Icone = ICONES_NAV[i.icone];
            const sel = ativo?.id === i.id;
            return (
              <Link
                key={i.id}
                href={i.href}
                aria-current={sel ? 'page' : undefined}
                title={i.rotulo}
                className={cx(
                  'group relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors duration-150',
                  'justify-center lg:justify-start',
                  sel ? 'bg-superficie-2 text-texto' : 'text-texto-2 hover:bg-superficie-2/70 hover:text-texto',
                )}
              >
                {sel && <span aria-hidden className="gradiente-atena absolute left-0 top-2.5 h-5 w-[3px] rounded-r-full" />}
                <Icone
                  className="size-[18px] shrink-0"
                  style={i.cor && sel ? { color: `var(--aba-${i.cor})` } : undefined}
                  aria-hidden
                />
                <span className="hidden flex-1 lg:inline">{i.rotulo}</span>
                {i.bloqueada && <Lock className="hidden size-3.5 text-texto-3 lg:inline" aria-label="Fora do plano" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <BotaoTema />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topo abrirBusca={() => setBuscaAberta(true)} />
        {empresa && !empresa.onboardingConcluido && (
          <Link href="/onboarding" className="flex items-center justify-center gap-2 border-b border-acento-1/20 bg-acento-1/10 px-4 py-2 text-center text-[13px] text-acento">
            Falta pouco para a Atena começar a trabalhar. <strong className="font-semibold">Terminar configuração →</strong>
          </Link>
        )}
        <main id="conteudo" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
          {children}
        </main>
      </div>

      {/* Menu inferior do celular */}
      <nav
        aria-label="Principal (celular)"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-borda bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {itens
          .filter((i) => i.celular)
          .map((i) => {
            const Icone = ICONES_NAV[i.icone];
            const sel = ativo?.id === i.id;
            return (
              <Link
                key={i.id}
                href={i.href}
                aria-current={sel ? 'page' : undefined}
                className={cx('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium', sel ? 'text-texto' : 'text-texto-3')}
              >
                <Icone className="size-5" style={i.cor && sel ? { color: `var(--aba-${i.cor})` } : undefined} aria-hidden />
                {i.rotulo}
              </Link>
            );
          })}
        <button
          onClick={() => setMaisAberto(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-texto-3"
        >
          <MoreHorizontal className="size-5" aria-hidden />
          Mais
        </button>
      </nav>

      <Folha aberto={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais">
        <div className="flex flex-col gap-1">
          {itens
            .filter((i) => !i.celular)
            .map((i) => {
              const Icone = ICONES_NAV[i.icone];
              return (
                <Link
                  key={i.id}
                  href={i.href}
                  onClick={() => setMaisAberto(false)}
                  className="flex h-12 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-superficie-2"
                >
                  <Icone className="size-5 text-texto-2" style={i.cor ? { color: `var(--aba-${i.cor})` } : undefined} aria-hidden />
                  <span className="flex-1">{i.rotulo}</span>
                  {i.bloqueada && <Lock className="size-4 text-texto-3" aria-label="Fora do plano" />}
                </Link>
              );
            })}
          <div className="mt-2 border-t border-borda pt-3">
            <BotaoTema />
          </div>
        </div>
      </Folha>

      <BuscaGlobal aberta={buscaAberta} aoFechar={() => setBuscaAberta(false)} />
    </div>
  );
}

function Topo({ abrirBusca }: { abrirBusca: () => void }) {
  const { empresa, membro, usuario, empresas, trocarEmpresa } = useSessao();
  const router = useRouter();
  const [menu, setMenu] = useState<'empresa' | 'usuario' | null>(null);

  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('click', fechar);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('click', fechar);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-borda bg-fundo/85 px-4 backdrop-blur md:px-8">
      <span className="md:hidden">
        <Logo compacto />
      </span>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenu(menu === 'empresa' ? null : 'empresa')}
          aria-haspopup="menu"
          aria-expanded={menu === 'empresa'}
          className="flex h-9 max-w-[200px] items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium hover:bg-superficie-2 sm:max-w-xs"
        >
          <span
            aria-hidden
            className="size-5 shrink-0 rounded-md"
            style={{ background: `linear-gradient(135deg, ${empresa?.marca.cores.primaria ?? '#3B5BDB'}, ${empresa?.marca.cores.secundaria ?? '#7048E8'})` }}
          />
          <span className="truncate">{empresa?.nome}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-texto-3" aria-hidden />
        </button>
        {menu === 'empresa' && (
          <div role="menu" className="entrar absolute left-0 top-11 z-40 w-64 rounded-xl border border-borda bg-superficie p-1.5 shadow-lg">
            <p className="px-2.5 pb-1.5 pt-1 text-xs text-texto-3">Suas empresas</p>
            {empresas.map((e) => (
              <button
                key={e.id}
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  if (e.id !== empresa?.id) trocarEmpresa(e.id);
                }}
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-superficie-2"
              >
                <span className="flex-1 truncate">{e.nome}</span>
                {e.id === empresa?.id && <Check className="size-4 text-acento" aria-hidden />}
              </button>
            ))}
            <button
              role="menuitem"
              onClick={() => router.push('/onboarding?nova=1')}
              className="mt-1 flex h-9 w-full items-center rounded-lg border-t border-borda px-2.5 pt-1 text-left text-sm text-texto-2 hover:bg-superficie-2"
            >
              + Nova empresa
            </button>
          </div>
        )}
      </div>

      <button
        onClick={abrirBusca}
        className="ml-auto flex h-9 items-center gap-2 rounded-[10px] border border-borda bg-superficie px-3 text-sm text-texto-3 transition-colors hover:border-borda-forte sm:w-64"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Buscar…</span>
        <kbd className="numero hidden rounded border border-borda px-1.5 text-[11px] sm:inline">Ctrl K</kbd>
      </button>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenu(menu === 'usuario' ? null : 'usuario')}
          aria-haspopup="menu"
          aria-expanded={menu === 'usuario'}
          aria-label="Minha conta"
          className="rounded-full"
        >
          <Avatar nome={membro?.nome || usuario?.nome || '?'} fotoUrl={usuario?.fotoUrl} tamanho="p" className="size-8" />
        </button>
        {menu === 'usuario' && (
          <div role="menu" className="entrar absolute right-0 top-11 z-40 w-60 rounded-xl border border-borda bg-superficie p-1.5 shadow-lg">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{membro?.nome}</p>
              <p className="truncate text-xs text-texto-3">{usuario?.email}</p>
              {membro && <p className="mt-1 text-xs text-texto-2">{NOME_PAPEL[membro.papel]}</p>}
            </div>
            <button
              role="menuitem"
              onClick={async () => {
                await sair();
                router.replace('/entrar');
              }}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm text-texto-2 hover:bg-superficie-2 hover:text-texto"
            >
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export function BotaoTema() {
  const [escuro, setEscuro] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.tema;
    setEscuro(t ? t === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  function alternar() {
    const novo = escuro ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem('atena:tema', novo);
    } catch {}
    setEscuro(!escuro);
  }
  const Icone = escuro ? Sun : Moon;
  return (
    <button
      onClick={alternar}
      className="flex h-10 w-full items-center justify-center gap-3 rounded-[10px] px-3 text-sm text-texto-2 hover:bg-superficie-2 hover:text-texto lg:justify-start"
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
    >
      <Icone className="size-[18px]" aria-hidden />
      <span className="md:hidden lg:inline">{escuro ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  );
}

