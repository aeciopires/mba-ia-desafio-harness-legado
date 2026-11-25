import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// A porta e o host vêm do ambiente (web/.env gerado por `make up`), para que duas
// cópias do projeto rodem ao mesmo tempo. Os padrões mantêm o comportamento original.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['VITE_', 'WEB_'])
  return {
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      host: env.WEB_HOST || 'localhost',
    },
  }
})
