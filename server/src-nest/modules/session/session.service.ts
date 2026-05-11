import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

export const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface SessionEntry {
  createdAt: number;
  ip: string;
  userAgent: string;
}

@Injectable()
export class SessionService {
  private readonly activeSessions = new Map<string, SessionEntry>();

  private getSecret(): string {
    return process.env.SESSION_SECRET ?? 'rcv-dev-secret-change-in-prod';
  }

  generate(ip: string, userAgent: string): string {
    const payload = `${ip}:${Date.now()}:${Math.random()}`;
    const token = crypto
      .createHmac('sha256', this.getSecret())
      .update(payload)
      .digest('hex');

    // Purge expired sessions lazily
    for (const [k, v] of this.activeSessions.entries()) {
      if (Date.now() - v.createdAt > SESSION_TTL_MS) {
        this.activeSessions.delete(k);
      }
    }

    this.activeSessions.set(token, { createdAt: Date.now(), ip, userAgent });
    return token;
  }

  isValid(token: string): boolean {
    const entry = this.activeSessions.get(token);
    if (!entry) return false;
    if (Date.now() - entry.createdAt > SESSION_TTL_MS) {
      this.activeSessions.delete(token);
      return false;
    }
    return true;
  }

  refresh(oldToken: string, ip: string, userAgent: string): string | null {
    if (!this.isValid(oldToken)) return null;
    this.activeSessions.delete(oldToken);
    return this.generate(ip, userAgent);
  }

  getTtl(): number {
    return SESSION_TTL_MS;
  }
}
