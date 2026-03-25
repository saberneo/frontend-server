import { Injectable } from '@nestjs/common';

/**
 * In-memory JWT blacklist (jti-based).
 * In production, replace the Set with a Redis TTL cache.
 */
@Injectable()
export class TokenBlacklistService {
  private readonly blacklisted = new Set<string>();

  revoke(jti: string): void {
    this.blacklisted.add(jti);
  }

  isRevoked(jti: string): boolean {
    return this.blacklisted.has(jti);
  }
}
