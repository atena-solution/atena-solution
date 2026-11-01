import { crudSimples } from '@/lib/api/crud';
import { validarProfissional } from '@/lib/base/validar';
import type { Profissional } from '@/lib/tipos';

export const crud = crudSimples<Profissional>({
  colecao: 'profissionais',
  chaveLista: 'profissionais',
  validar: validarProfissional,
  escrita: ['dono', 'gestor'],
  prefixoId: 'pf_',
  ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
});
