// Tokens do Estúdio. Na junção com a Base, apontar para os tokens de app/ui (mesmos valores de docs/design.md).
export const CSS_ESTUDIO = `
.estudio{--e-fundo:#F7F5F0;--e-cartao:#FFFFFF;--e-cartao-2:#F1EEE7;--e-borda:#E4E0D6;--e-texto:#14171C;--e-suave:#5F6470;--e-acento:#E8A93B;--e-acento-fraco:rgba(232,169,59,.14);--e-primaria-1:#3B5BDB;--e-primaria-2:#7048E8;--e-ok:#2FB37C;--e-erro:#E5484D;--e-foco:#7048E8;color:var(--e-texto);background:var(--e-fundo)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .estudio{--e-fundo:#0E1116;--e-cartao:#151922;--e-cartao-2:#1B202B;--e-borda:#262C38;--e-texto:#ECEDEF;--e-suave:#9AA1AE;--e-acento-fraco:rgba(232,169,59,.16)}}
:root[data-theme="dark"] .estudio{--e-fundo:#0E1116;--e-cartao:#151922;--e-cartao-2:#1B202B;--e-borda:#262C38;--e-texto:#ECEDEF;--e-suave:#9AA1AE;--e-acento-fraco:rgba(232,169,59,.16)}
.estudio :focus-visible{outline:2px solid var(--e-foco);outline-offset:2px}
.estudio .e-serif{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400}
.estudio .e-mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:300}
@keyframes e-brilho{0%{background-position:-200% 0}100%{background-position:200% 0}}
.estudio .e-esqueleto{background:linear-gradient(90deg,var(--e-cartao-2) 25%,var(--e-borda) 50%,var(--e-cartao-2) 75%);background-size:200% 100%;animation:e-brilho 1.4s infinite}
@media (prefers-reduced-motion:reduce){.estudio .e-esqueleto{animation:none}}
`;
