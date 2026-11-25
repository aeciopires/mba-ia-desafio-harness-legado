// Testes do gerador de sumário (scripts/toc.mjs). Rodam com: node --test tests/harness/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicarToc } from '../../scripts/toc.mjs'

const doc = '# Título\n\nTexto.\n\n## Primeira seção\n\n### Sub item\n\n```bash\n## não é título\n```\n\n## Segunda é 2ª\n'

test('insere o sumário depois do H1, entre duas tags iguais', () => {
  const saida = aplicarToc(doc)
  assert.match(saida, /^# Título\n\n<!-- TOC -->\n- \[Primeira seção\]\(#primeira-seção\)\n {2}- \[Sub item\]\(#sub-item\)\n- \[Segunda é 2ª\]\(#segunda-é-2ª\)\n<!-- TOC -->\n/)
  assert.ok(!saida.includes('<!-- /TOC -->'))
  assert.ok(!saida.includes('não-é-título'))
})

test('é idempotente', () => {
  const uma = aplicarToc(doc)
  assert.equal(aplicarToc(uma), uma)
})

test('atualiza só o que está entre as tags', () => {
  const antigo = '# T\n\n<!-- TOC -->\n- [velho](#velho)\n<!-- TOC -->\n\n## Novo\n'
  assert.equal(aplicarToc(antigo), '# T\n\n<!-- TOC -->\n- [Novo](#novo)\n<!-- TOC -->\n\n## Novo\n')
})

test('títulos repetidos ganham sufixo na âncora', () => {
  const saida = aplicarToc('# T\n\n## Uso\n\n## Uso\n')
  assert.ok(saida.includes('(#uso)') && saida.includes('(#uso-1)'))
})
