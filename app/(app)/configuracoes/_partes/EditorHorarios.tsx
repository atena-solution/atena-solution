'use client';

import { Plus, X } from 'lucide-react';
import { nomeDia } from '@/lib/agenda/fuso';
import type { HorarioDia } from '@/lib/tipos';
import { cx } from '@/app/ui';

const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const campo = 'numero h-9 w-[84px] rounded-lg border border-borda bg-superficie px-2 text-sm focus:border-acento-1 focus:outline-none';

/** Horário por dia da semana, com mais de um turno por dia (ex.: pausa de almoço). */
export function EditorHorarios({ valor, aoMudar, permitirVazio }: { valor: HorarioDia[]; aoMudar: (h: HorarioDia[]) => void; permitirVazio?: string }) {
  function doDia(d: number) {
    return valor.map((h, i) => ({ ...h, i })).filter((h) => h.dia === d);
  }
  function mudar(i: number, campo: 'abre' | 'fecha', v: string) {
    aoMudar(valor.map((h, j) => (j === i ? { ...h, [campo]: v } : h)));
  }
  function alternar(d: number) {
    const tem = doDia(d).length > 0;
    aoMudar(tem ? valor.filter((h) => h.dia !== d) : [...valor, { dia: d, abre: '09:00', fecha: '18:00' }]);
  }
  return (
    <div className="flex flex-col divide-y divide-borda rounded-cartao border border-borda">
      {permitirVazio && valor.length === 0 && <p className="px-4 py-3 text-sm text-texto-3">{permitirVazio}</p>}
      {ORDEM.map((d) => {
        const turnos = doDia(d);
        const aberto = turnos.length > 0;
        return (
          <div key={d} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <label className="flex w-36 cursor-pointer items-center gap-3 text-sm">
              <button
                type="button"
                role="switch"
                aria-checked={aberto}
                aria-label={`${nomeDia(d)} aberto`}
                onClick={() => alternar(d)}
                className={cx('relative h-5 w-9 rounded-full transition-colors', aberto ? 'gradiente-atena' : 'bg-borda-forte')}
              >
                <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', aberto ? 'left-[18px]' : 'left-0.5')} />
              </button>
              <span className="capitalize">{nomeDia(d)}</span>
            </label>
            {aberto ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {turnos.map((t, k) => (
                  <span key={t.i} className="flex items-center gap-1.5">
                    <input type="time" aria-label={`${nomeDia(d)} abre`} className={campo} value={t.abre} onChange={(e) => mudar(t.i, 'abre', e.target.value)} />
                    <span className="text-texto-3">–</span>
                    <input type="time" aria-label={`${nomeDia(d)} fecha`} className={campo} value={t.fecha} onChange={(e) => mudar(t.i, 'fecha', e.target.value)} />
                    {k > 0 && (
                      <button type="button" aria-label="Tirar turno" onClick={() => aoMudar(valor.filter((_, j) => j !== t.i))} className="p-1 text-texto-3 hover:text-erro">
                        <X className="size-4" />
                      </button>
                    )}
                  </span>
                ))}
                {turnos.length < 3 && (
                  <button type="button" onClick={() => aoMudar([...valor, { dia: d, abre: '14:00', fecha: '18:00' }])} className="flex items-center gap-1 text-xs text-texto-3 hover:text-texto">
                    <Plus className="size-3.5" /> turno
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-texto-3">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
