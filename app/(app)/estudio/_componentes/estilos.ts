// Tokens do Estúdio: apelidos dos tokens da Base (app/globals.css) — claro/escuro seguem o tema do app.
export const CSS_ESTUDIO = `
.estudio{--e-fundo:var(--fundo);--e-cartao:var(--superficie);--e-cartao-2:var(--superficie-2);--e-borda:var(--borda);--e-texto:var(--texto);--e-suave:var(--texto-2);--e-acento:var(--aba-estudio);--e-acento-fraco:color-mix(in srgb,var(--aba-estudio) 14%,transparent);--e-primaria-1:var(--acento-1);--e-primaria-2:var(--acento-2);--e-ok:var(--sucesso);--e-erro:var(--erro);--e-foco:var(--foco);color:var(--e-texto)}
.estudio .e-serif{font-family:var(--font-serif);font-style:italic;font-weight:400}
.estudio .e-mono{font-family:var(--font-mono);font-weight:300;font-variant-numeric:tabular-nums}
@keyframes e-brilho{0%{background-position:-200% 0}100%{background-position:200% 0}}
.estudio .e-esqueleto{background:linear-gradient(90deg,var(--e-cartao-2) 25%,var(--e-borda) 50%,var(--e-cartao-2) 75%);background-size:200% 100%;animation:e-brilho 1.4s infinite}
@media (prefers-reduced-motion:reduce){.estudio .e-esqueleto{animation:none}}
`;
