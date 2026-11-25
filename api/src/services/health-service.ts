import { HealthRepository } from '../repositories/health-repository'

export class HealthService {
  constructor(private health: HealthRepository) {}

  /** Lança erro se o banco não responder. */
  async check() {
    await this.health.ping()
    return { status: 'ok', db: 'ok' }
  }
}
