// Regras de dependência usadas pelos gates (G4, G6, G7, G8, G9 e G12).
// O nome de cada regra começa com o ID do gate; o orquestrador (scripts/gates.mjs) usa esse prefixo.
// tsPreCompilationDeps: true faz o dependency-cruiser enxergar imports só de tipo
// (`import type`, `export type ... from`), que o TypeScript apaga na compilação.

const PRISMA = '(^|/)node_modules/(@prisma/client|\\.prisma/client)(/|$)|^@prisma/client(/|$)'
const EXPRESS_MULTER = '(^|/)node_modules/(@types/)?(express|multer)(/|$)|^(express|multer)(/|$)'
const OPENAI = '(^|/)node_modules/openai(/|$)|^openai(/|$)'

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'G4-http-nao-acessa-banco',
      comment: 'Nada em api/src/http/ importa @prisma/client nem api/src/repositories/. Rotas falam com serviços.',
      severity: 'error',
      from: { path: '^api/src/http/' },
      to: { path: [PRISMA, '^api/src/repositories/'] },
    },
    {
      name: 'G6-servico-nao-conhece-http',
      comment: 'Nada em api/src/services/ importa express, multer ou api/src/http/, inclusive imports só de tipo.',
      severity: 'error',
      from: { path: '^api/src/services/' },
      to: { path: [EXPRESS_MULTER, '^api/src/http/'] },
    },
    {
      name: 'G7-openai-so-em-integrations',
      comment: 'O pacote openai só é importado em api/src/integrations/.',
      severity: 'error',
      from: { pathNot: '^api/src/integrations/' },
      to: { path: OPENAI },
    },
    {
      name: 'G8-front-nao-importa-api',
      comment: 'Nada em web/ importa arquivos de api/, inclusive imports só de tipo.',
      severity: 'error',
      from: { path: '^web/' },
      to: { path: '^api/' },
    },
    {
      name: 'G9-sem-ciclo',
      comment: 'Nenhum import circular em api/src/ nem em web/src/.',
      severity: 'error',
      from: { path: '^(api|web)/src/' },
      to: { circular: true },
    },
    {
      name: 'G12-prisma-so-em-repositories',
      comment:
        'Regra própria: @prisma/client só é importado em api/src/repositories/. ' +
        'O worker criava um PrismaClient próprio e ignorava a configuração central.',
      severity: 'error',
      from: { path: '^api/src/', pathNot: '^api/src/repositories/' },
      to: { path: PRISMA },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    // NÃO use `exclude` com node_modules: isso tira os pacotes do grafo e desliga em silêncio
    // G6 (express/multer), G7 (openai) e G12 (@prisma/client). Ver docs/incidentes.md.
    doNotFollow: { path: 'node_modules' },
    moduleSystems: ['es6', 'cjs', 'tsd'],
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.d.ts', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'types', 'typings', 'module'],
    },
  },
}
