'use client'

import { useId } from 'react'
import { cx } from '@/app/ui'

/** Liga/desliga acessível (role="switch"). */
export function Interruptor({ ligado, aoMudar, rotulo, descricao, desativado }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string; descricao?: string; desativado?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-texto">
          {rotulo}
        </label>
        {descricao && <p className="mt-0.5 text-[13px] text-texto-2">{descricao}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={ligado}
        disabled={desativado}
        onClick={() => aoMudar(!ligado)}
        className={cx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          ligado ? 'bg-atendimento' : 'bg-borda-forte',
        )}
      >
        <span className={cx('inline-block size-5 rounded-full bg-white shadow transition-transform duration-200', ligado ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}
