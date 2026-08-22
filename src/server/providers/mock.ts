import 'server-only';
import { randomUUID } from 'node:crypto';
import type {
  BookingProvider,
  ChargeRequest,
  ChargeResult,
  DeviceCommandRequest,
  DeviceCommandResult,
  DeviceProvider,
  ExternalBooking,
  NotificationChannelProvider,
  NotificationMessage,
  PaymentProvider,
  ProviderResult,
  RefundRequest,
  RefundResult,
  StorageProvider,
} from './types';

/**
 * ספקים מדומים.
 *
 * הם מדמים התנהגות אמיתית — כולל כשלים אקראיים ו־latency — כדי שנתיבי
 * הכשל במערכת ייבדקו באמת. כל תוצאה מסומנת isMock: true, וה־UI מציג זאת.
 *
 * ⚠ אף אחד מהם אינו מבצע פעולה חיצונית אמיתית. אין חיוב כרטיס אשראי,
 * אין פקודה למכונה ואין שליחת הודעה.
 */

function ok<T>(name: string, data: T, latencyMs: number): ProviderResult<T> {
  return { ok: true, data, providerName: name, isMock: true, latencyMs };
}

function fail<T>(
  name: string,
  errorCode: string,
  errorMessage: string,
  latencyMs: number,
): ProviderResult<T> {
  return { ok: false, errorCode, errorMessage, providerName: name, isMock: true, latencyMs };
}

/** דטרמיניסטי לפי מפתח — כך שאותה בקשה תיתן תמיד אותה תוצאה */
function pseudoRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1000) / 1000;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock-payments';
  readonly isMock = true;

  /** שיעור כשל מדומה. 0 בסביבת בדיקות כדי שהבדיקות יהיו דטרמיניסטיות. */
  constructor(private readonly failureRate = 0) {}

  async charge(request: ChargeRequest): Promise<ProviderResult<ChargeResult>> {
    const latency = 120 + Math.round(pseudoRandom(request.idempotencyKey) * 400);
    if (request.amountGross <= 0) {
      return fail(this.name, 'invalid_amount', 'סכום החיוב חייב להיות חיובי', latency);
    }
    if (this.failureRate > 0 && pseudoRandom(request.idempotencyKey) < this.failureRate) {
      return fail(this.name, 'card_declined', 'הכרטיס נדחה על ידי המנפיק (מדומה)', latency);
    }
    const brands = ['Visa', 'Mastercard', 'Isracard'] as const;
    const brandIndex = Math.floor(pseudoRandom(request.idempotencyKey + 'b') * brands.length);
    return ok(
      this.name,
      {
        transactionId: `mock_tx_${randomUUID().slice(0, 12)}`,
        authorizationCode: String(Math.floor(pseudoRandom(request.idempotencyKey) * 900000) + 100000),
        cardLast4: String(Math.floor(pseudoRandom(request.idempotencyKey + 'c') * 9000) + 1000),
        cardBrand: brands[brandIndex] ?? 'Visa',
        capturedAt: new Date(),
      },
      latency,
    );
  }

  async refund(request: RefundRequest): Promise<ProviderResult<RefundResult>> {
    const latency = 80 + Math.round(pseudoRandom(request.idempotencyKey) * 300);
    if (request.amountGross <= 0) {
      return fail(this.name, 'invalid_amount', 'סכום הזיכוי חייב להיות חיובי', latency);
    }
    return ok(
      this.name,
      { refundId: `mock_rf_${randomUUID().slice(0, 12)}`, processedAt: new Date() },
      latency,
    );
  }
}

export class MockDeviceProvider implements DeviceProvider {
  readonly name = 'mock-ble-gateway';
  readonly isMock = true;

  async sendCommand(request: DeviceCommandRequest): Promise<ProviderResult<DeviceCommandResult>> {
    const latency = 200 + Math.round(pseudoRandom(request.deviceId + request.command) * 600);
    const stateMap: Record<string, string> = {
      start: 'running',
      resume: 'running',
      pause: 'paused',
      stop: 'idle',
      force_stop: 'idle',
      lock: 'locked',
      unlock: 'idle',
      firmware_update: 'updating',
      firmware_rollback: 'updating',
      ping: 'idle',
    };
    return ok(
      this.name,
      {
        acknowledged: true,
        deviceState: stateMap[request.command] ?? 'unknown',
        batteryPct: 40 + Math.round(pseudoRandom(request.deviceId) * 55),
        firmwareVersion: '1.4.2',
      },
      latency,
    );
  }

  async fetchTelemetry(deviceId: string): Promise<ProviderResult<Record<string, unknown>>> {
    const r = pseudoRandom(deviceId);
    return ok(
      this.name,
      {
        batteryPct: 30 + Math.round(r * 65),
        rssi: -40 - Math.round(r * 45),
        motorTempC: 28 + Math.round(r * 18),
        ballsFired: Math.round(r * 400),
      },
      90,
    );
  }
}

export class MockBookingProvider implements BookingProvider {
  readonly name = 'mock-court-booking';
  readonly isMock = true;

  async fetchBookings(): Promise<ProviderResult<ExternalBooking[]>> {
    // מחזיר רשימה ריקה במכוון: הזמנות הדגמה נוצרות ב־Seed ומסומנות is_demo,
    // ולא "מגיעות" ממערכת חיצונית מדומה כאילו היא אמיתית.
    return ok(this.name, [], 50);
  }
}

export class MockNotificationProvider implements NotificationChannelProvider {
  readonly isMock = true;
  readonly name: string;

  constructor(readonly channel: 'email' | 'sms' | 'whatsapp' | 'slack') {
    this.name = `mock-${channel}`;
  }

  async send(_message: NotificationMessage): Promise<ProviderResult<{ messageId: string }>> {
    // לא נשלחת הודעה. ההתראה נשמרת ב־DB עם delivery_provider = mock.
    return ok(this.name, { messageId: `mock_${this.channel}_${randomUUID().slice(0, 10)}` }, 30);
  }
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local-fs';
  readonly isMock = false;

  constructor(private readonly basePath = process.env.STORAGE_LOCAL_PATH ?? './storage') {}

  async put(path: string, data: Buffer): Promise<ProviderResult<{ path: string }>> {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { dirname, join } = await import('node:path');
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return { ok: true, data: { path }, providerName: this.name, isMock: false, latencyMs: 5 };
  }

  async getUrl(path: string): Promise<string> {
    return `/api/files/${encodeURIComponent(path)}`;
  }

  async delete(path: string): Promise<ProviderResult<null>> {
    const { unlink } = await import('node:fs/promises');
    const { join } = await import('node:path');
    try {
      await unlink(join(this.basePath, path));
      return { ok: true, data: null, providerName: this.name, isMock: false, latencyMs: 3 };
    } catch {
      return {
        ok: false,
        errorCode: 'not_found',
        errorMessage: 'הקובץ לא נמצא',
        providerName: this.name,
        isMock: false,
        latencyMs: 3,
      };
    }
  }
}
