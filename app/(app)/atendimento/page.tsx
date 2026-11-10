import { Suspense } from 'react'
import { TelaAtendimento } from './TelaAtendimento'

export const metadata = { title: 'Atendimento' }

export default function PaginaAtendimento() {
  return (
    <Suspense>
      <TelaAtendimento />
    </Suspense>
  )
}
