'use client';
// Demonstração animada: a IA atendendo e marcando horário em tempo real.
import { useEffect, useRef, useState } from 'react';
import { DEMO_CONVERSA } from '../_conteudo';
import { Simbolo } from './Logo';
import { IcoCalendario } from './Icones';

type Msg = (typeof DEMO_CONVERSA)[number];

const HORARIOS = [
  { hora: '10:00', nome: 'Pedro · Corte', ocupado: true },
  { hora: '14:30', nome: 'Livre', ocupado: false },
  { hora: '16:00', nome: 'André · Barba', ocupado: true },
  { hora: '18:00', nome: 'Livre', ocupado: false },
];

export function DemoConversa() {
  const [mostradas, setMostradas] = useState<Msg[]>([]);
  const [digitando, setDigitando] = useState(false);
  const [agendado, setAgendado] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduzir = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduzir) {
      setMostradas(DEMO_CONVERSA);
      setAgendado(true);
      return;
    }
    let cancelado = false;
    const agendar = (fn: () => void, ms: number) => timers.current.push(setTimeout(() => !cancelado && fn(), ms));

    function rodar() {
      setMostradas([]);
      setAgendado(false);
      let t = 700;
      DEMO_CONVERSA.forEach((m) => {
        if (m.de === 'ia') {
          agendar(() => setDigitando(true), t);
          t += m.espera ?? 1400;
          agendar(() => { setDigitando(false); setMostradas((x) => [...x, m]); }, t);
          t += 1300;
        } else if (m.de === 'sistema') {
          agendar(() => { setMostradas((x) => [...x, m]); setAgendado(true); }, t);
          t += 900;
        } else {
          agendar(() => setMostradas((x) => [...x, m]), t);
          t += 1100;
        }
      });
      agendar(rodar, t + 4500);
    }
    rodar();
    return () => { cancelado = true; timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  return (
    <div className="relative mx-auto flex w-full max-w-[520px] justify-center md:justify-end" aria-label="Demonstração: a IA da Atena marcando um horário pelo WhatsApp">
      <div className="s-celular">
        <div className="s-tela">
          <div className="s-tela-topo">
            <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: 'var(--s-fundo-2)' }}><Simbolo tamanho={20} /></span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Barbearia Topetes</p>
              <p className="text-xs s-texto-3 flex items-center gap-1.5"><span className="s-ponto-vivo" /> {digitando ? 'digitando…' : 'online agora'}</p>
            </div>
          </div>
          <div className="s-tela-msgs" aria-live="polite">
            {mostradas.map((m, i) => (
              <div key={i} className={`s-bolha ${m.de === 'cliente' ? 's-bolha-cliente' : m.de === 'ia' ? 's-bolha-ia' : 's-bolha-sistema'}`}>
                {m.de === 'sistema' ? <span className="inline-flex items-center gap-1.5"><IcoCalendario tamanho={13} /> {m.texto}</span> : m.texto}
              </div>
            ))}
            {digitando && <div className="s-digitando" aria-label="IA digitando"><i /><i /><i /></div>}
          </div>
        </div>
      </div>

      {/* Agenda ao lado, recebendo o horário em tempo real */}
      <div className="s-card s-card-sombra absolute left-0 bottom-10 hidden w-56 p-4 sm:block" aria-hidden="true">
        <p className="s-sobretitulo mb-3 flex items-center gap-2"><IcoCalendario tamanho={14} /> Agenda · Quinta</p>
        <ul className="grid gap-2 text-sm">
          {HORARIOS.map((h) => {
            const novo = agendado && h.hora === '18:00';
            return (
              <li key={h.hora} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${novo ? 's-agenda-item' : ''}`} style={{ background: novo ? 'color-mix(in srgb, var(--s-verde) 14%, transparent)' : undefined }}>
                <span className="s-mono text-xs s-texto-3 w-10">{h.hora}</span>
                <span className={h.ocupado || novo ? '' : 's-texto-3'}>{novo ? 'Lucas · Corte + barba' : h.nome}</span>
                {novo && <span className="ml-auto text-[10px] font-semibold" style={{ color: 'var(--s-verde)' }}>IA</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
