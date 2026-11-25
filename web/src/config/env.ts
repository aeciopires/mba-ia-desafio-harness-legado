// Único lugar do front que lê import.meta.env (gate G5). O endereço padrão da API
// também só pode aparecer em config/ (gate G11); `make up` gera o VITE_API_URL de cada cópia.
export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:4000'
