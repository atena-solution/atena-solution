import { crudSimples } from '@/lib/api/crud';
import { validarServico } from '@/lib/base/validar';
import type { Servico } from '@/lib/tipos';

export const crud = crudSimples<Servico>({
  colecao: 'servicos',
  chaveLista: 'servicos',
  validar: validarServico,
  escrita: ['dono', 'gestor'],
  prefixoId: 'sv_',
  ordenar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
});
