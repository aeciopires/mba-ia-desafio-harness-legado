/**
 * Erro de regra de negócio. Os serviços lançam este erro; a camada HTTP
 * (api/src/http/errors.ts) traduz para a resposta {"error", "message"} com o status.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
