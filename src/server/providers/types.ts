/**
 * ממשקי האינטגרציות החיצוניות.
 *
 * ⚠ סעיף 4 בהנחיות: "כאשר אינטגרציה חיצונית עדיין אינה זמינה, בנה Adapter מסודר
 * ו־Mock Provider. אין להציג נתוני Mock כאילו הגיעו ממערכת אמיתית."
 *
 * כל תוצאה נושאת `providerName` ו־`isMock`. ה־UI מציג תג "Mock" ליד כל פעולה
 * שבוצעה מול ספק מדומה, ו־INTEGRATIONS.md מרכז את המצב הנוכחי.
 */

export interface ProviderResult<T> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  providerName: string;
  isMock: boolean;
  latencyMs: number;
}

// ─── סליקה ───

export interface ChargeRequest {
  amountGross: number;
  currency: string;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  transactionId: string;
  authorizationCode?: string;
  cardLast4?: string;
  cardBrand?: string;
  capturedAt: Date;
}

export interface RefundRequest {
  transactionId: string;
  amountGross: number;
  idempotencyKey: string;
  reason: string;
}

export interface RefundResult {
  refundId: string;
  processedAt: Date;
}

export interface PaymentProvider {
  readonly name: string;
  readonly isMock: boolean;
  charge(request: ChargeRequest): Promise<ProviderResult<ChargeResult>>;
  refund(request: RefundRequest): Promise<ProviderResult<RefundResult>>;
}

// ─── בקרת מכשיר (BLE Gateway) ───

export type DeviceCommand =
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'force_stop'
  | 'lock'
  | 'unlock'
  | 'firmware_update'
  | 'firmware_rollback'
  | 'ping';

export interface DeviceCommandRequest {
  deviceId: string;
  command: DeviceCommand;
  /** ה־Session Token החתום. לא נשמר ולא נרשם ביומן. */
  sessionToken?: string;
  params?: Record<string, unknown>;
}

export interface DeviceCommandResult {
  acknowledged: boolean;
  deviceState: string;
  batteryPct?: number;
  firmwareVersion?: string;
}

export interface DeviceProvider {
  readonly name: string;
  readonly isMock: boolean;
  sendCommand(request: DeviceCommandRequest): Promise<ProviderResult<DeviceCommandResult>>;
  fetchTelemetry(deviceId: string): Promise<ProviderResult<Record<string, unknown>>>;
}

// ─── מערכת הזמנת מגרשים ───

export interface ExternalBooking {
  externalId: string;
  courtName: string;
  startsAt: Date;
  endsAt: Date;
  revenueNet: number;
  bookedByPhone?: string;
  isCancelled: boolean;
}

export interface BookingProvider {
  readonly name: string;
  readonly isMock: boolean;
  fetchBookings(
    clubExternalId: string,
    from: Date,
    to: Date,
  ): Promise<ProviderResult<ExternalBooking[]>>;
}

// ─── ערוצי התראה ───

export interface NotificationMessage {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, string>;
}

export interface NotificationChannelProvider {
  readonly name: string;
  readonly channel: 'email' | 'sms' | 'whatsapp' | 'slack';
  readonly isMock: boolean;
  send(message: NotificationMessage): Promise<ProviderResult<{ messageId: string }>>;
}

// ─── אחסון קבצים ───

export interface StorageProvider {
  readonly name: string;
  readonly isMock: boolean;
  put(path: string, data: Buffer, mimeType: string): Promise<ProviderResult<{ path: string }>>;
  getUrl(path: string): Promise<string>;
  delete(path: string): Promise<ProviderResult<null>>;
}
