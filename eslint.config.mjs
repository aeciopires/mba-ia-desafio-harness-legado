// Configuração do ESLint usada pelos gates (G2, G5 e G11).
// As mensagens das regras restritivas começam com o ID do gate ("G5:", "G11:"),
// e o orquestrador (scripts/gates.mjs) usa esse prefixo para montar a lista final.
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// G11: endereço fixo (host local ou pasta temporária) fora de config/.
const ENDERECO_FIXO = '/localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\/tmp\\//'
const MSG_G11 = 'G11: endereço fixo (host, porta ou pasta) só pode ser definido em config/.'
const MSG_G5_API = 'G5: process.env só pode ser lido em api/src/config/.'
const MSG_G5_WEB = 'G5: import.meta.env só pode ser lido em web/src/config/.'

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },
  {
    // Comentários de configuração inline (eslint-disable etc.) não têm efeito.
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      // G2: variável/import sem uso e any explícito são erro.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'all', ignoreRestSiblings: false },
      ],
    },
  },
  {
    files: ['api/**/*.{ts,mts,cts,js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // G5 (API) e G11: valem em api/src, exceto api/src/config/ (exceção da própria regra).
    files: ['api/src/**/*.{ts,mts,cts,js,mjs,cjs}'],
    ignores: ['api/src/config/**'],
    rules: {
      'no-restricted-properties': ['error', { object: 'process', property: 'env', message: MSG_G5_API }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'process', importNames: ['env'], message: MSG_G5_API },
            { name: 'node:process', importNames: ['env'], message: MSG_G5_API },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[property.name='env'][object.property.name='process']", message: MSG_G5_API },
        { selector: "MemberExpression[property.value='env'][object.property.name='process']", message: MSG_G5_API },
        { selector: `Literal[value=${ENDERECO_FIXO}]`, message: MSG_G11 },
        { selector: `TemplateElement[value.raw=${ENDERECO_FIXO}]`, message: MSG_G11 },
      ],
    },
  },
  {
    // G5 (front) e G11: valem em web/src, exceto web/src/config/.
    files: ['web/src/**/*.{ts,tsx}'],
    ignores: ['web/src/config/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "MemberExpression[object.type='MetaProperty'][property.name='env']", message: MSG_G5_WEB },
        { selector: "MemberExpression[object.type='MetaProperty'][property.value='env']", message: MSG_G5_WEB },
        { selector: "VariableDeclarator[init.type='MetaProperty'][id.type='ObjectPattern']", message: MSG_G5_WEB },
        { selector: `Literal[value=${ENDERECO_FIXO}]`, message: MSG_G11 },
        { selector: `TemplateElement[value.raw=${ENDERECO_FIXO}]`, message: MSG_G11 },
      ],
    },
  },
)
