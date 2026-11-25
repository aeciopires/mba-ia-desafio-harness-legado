import { env } from './config/env'
import { buildServices } from './container'
import { createApp } from './http/app'

createApp(buildServices()).listen(env.PORT, () => {
  console.log(`API rodando na porta ${env.PORT}`)
})
