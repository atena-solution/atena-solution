import next from 'eslint-config-next';

const config = [
  ...next,
  {
    rules: {
      // Carregar dados/ler localStorage em efeitos é intencional aqui (app 100% cliente nas telas logadas).
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
];

export default config;
