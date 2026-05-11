import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const meritopClient = require('../../../src/services/meritop/meritopClient');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sypagoClient = require('../../../src/services/sypago/sypagoClient');

// ── Idempotency store para OTP confirm ────────────────────────────────────────
// Previene débitos duplicados cuando el usuario presiona "Confirmar" varias
// veces o hay reintentos de red. TTL: 120 s (el OTP expira mucho antes).
const OTP_IDEM_TTL_MS = 120_000;
const _otpIdemStore = new Map<string, { expiresAt: number; response: any }>();

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  // ── Meritop ───────────────────────────────────────────────────────────────

  async verifyMobilePayment(params: {
    sourcePhoneNumber: string;
    bankCode: string;
    amount: number;
    paidOn: string;
  }) {
    return meritopClient.verifyMobilePayment(params);
  }

  // ── SyPago ────────────────────────────────────────────────────────────────

  async requestOtp(params: {
    documentType: string;
    documentNumber: string;
    debtorBankCode: string;
    debtorPhone: string;
    amount: number;
  }) {
    return sypagoClient.requestOtp(params);
  }

  async confirmOtp(params: {
    documentType: string;
    documentNumber: string;
    debtorBankCode: string;
    debtorPhone: string;
    debtorName: string;
    amount: number;
    otp: string;
    concept?: string;
  }): Promise<{ responseBody: any; duplicate: boolean }> {
    const idemKey = this._otpIdemKey(params);
    const cached = this._otpIdemGet(idemKey);
    if (cached) {
      this.logger.warn(
        `[SyPago] Solicitud duplicada ignorada (idempotency hit). key=${idemKey.slice(0, 12)}...`,
      );
      return { responseBody: cached, duplicate: true };
    }

    const result = await sypagoClient.confirmOtp(params);
    const responseBody = {
      success: true,
      message: 'Transacción iniciada.',
      transaction_id: result.transaction_id,
      operation_secret: result.operation_secret,
      mock: result.mock || false,
    };

    this._otpIdemSet(idemKey, responseBody);
    return { responseBody, duplicate: false };
  }

  async getOtpStatus(transactionId: string) {
    return sypagoClient.getTransactionStatus(transactionId);
  }

  // ── Helpers idempotency ──────────────────────────────────────────────────

  private _otpIdemKey(p: {
    documentType: string;
    documentNumber: string;
    debtorBankCode: string;
    debtorPhone: string;
    amount: number;
    otp: string;
  }): string {
    return crypto
      .createHash('sha256')
      .update(
        `${p.documentType}|${p.documentNumber}|${p.debtorBankCode}|${p.debtorPhone}|${p.amount}|${p.otp}`,
      )
      .digest('hex');
  }

  private _otpIdemGet(key: string): any | null {
    const entry = _otpIdemStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      _otpIdemStore.delete(key);
      return null;
    }
    return entry.response;
  }

  private _otpIdemSet(key: string, response: any): void {
    _otpIdemStore.set(key, { expiresAt: Date.now() + OTP_IDEM_TTL_MS, response });
    // Purga lazy cuando supera 200 entradas
    if (_otpIdemStore.size > 200) {
      const now = Date.now();
      for (const [k, v] of _otpIdemStore) {
        if (now > v.expiresAt) _otpIdemStore.delete(k);
      }
    }
  }
}
