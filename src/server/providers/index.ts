import 'server-only';
import {
  LocalStorageProvider,
  MockBookingProvider,
  MockDeviceProvider,
  MockNotificationProvider,
  MockPaymentProvider,
} from './mock';
import type {
  BookingProvider,
  DeviceProvider,
  NotificationChannelProvider,
  PaymentProvider,
  StorageProvider,
} from './types';

export * from './types';

/**
 * Registry של ספקים. בחירת הספק נעשית לפי משתני סביבה בלבד.
 *
 * להוספת ספק אמיתי:
 *   1. ממשו את הממשק המתאים מ־types.ts בקובץ חדש (למשל providers/tranzila.ts)
 *   2. הוסיפו ענף ב־switch כאן
 *   3. הגדירו את משתני הסביבה ב־.env
 * שום קוד אחר במערכת לא משתנה.
 */

let paymentProvider: PaymentProvider | null = null;
let deviceProvider: DeviceProvider | null = null;
let bookingProvider: BookingProvider | null = null;
let storageProvider: StorageProvider | null = null;
const notificationProviders = new Map<string, NotificationChannelProvider>();

export function getPaymentProvider(): PaymentProvider {
  if (paymentProvider) return paymentProvider;
  const kind = process.env.PAYMENT_PROVIDER ?? 'mock';
  switch (kind) {
    case 'mock':
    default:
      // 8% כשלים מדומים בפיתוח כדי שנתיבי הכשל ייבדקו; 0 בבדיקות.
      paymentProvider = new MockPaymentProvider(process.env.NODE_ENV === 'test' ? 0 : 0.08);
      return paymentProvider;
  }
}

export function getDeviceProvider(): DeviceProvider {
  if (deviceProvider) return deviceProvider;
  deviceProvider = new MockDeviceProvider();
  return deviceProvider;
}

export function getBookingProvider(): BookingProvider {
  if (bookingProvider) return bookingProvider;
  bookingProvider = new MockBookingProvider();
  return bookingProvider;
}

export function getStorageProvider(): StorageProvider {
  if (storageProvider) return storageProvider;
  storageProvider = new LocalStorageProvider();
  return storageProvider;
}

export function getNotificationProvider(
  channel: 'email' | 'sms' | 'whatsapp' | 'slack',
): NotificationChannelProvider {
  const existing = notificationProviders.get(channel);
  if (existing) return existing;
  const provider = new MockNotificationProvider(channel);
  notificationProviders.set(channel, provider);
  return provider;
}

/** מצב כל האינטגרציות — מוצג במסך ההגדרות ובבאנר נתוני ההדגמה */
export function getIntegrationStatus() {
  return [
    { key: 'payments', nameHe: 'סליקה', provider: getPaymentProvider().name, isMock: getPaymentProvider().isMock },
    { key: 'device', nameHe: 'בקרת מכשיר (BLE)', provider: getDeviceProvider().name, isMock: getDeviceProvider().isMock },
    { key: 'booking', nameHe: 'הזמנת מגרשים', provider: getBookingProvider().name, isMock: getBookingProvider().isMock },
    { key: 'storage', nameHe: 'אחסון קבצים', provider: getStorageProvider().name, isMock: getStorageProvider().isMock },
    { key: 'email', nameHe: 'אימייל', provider: getNotificationProvider('email').name, isMock: true },
    { key: 'sms', nameHe: 'SMS', provider: getNotificationProvider('sms').name, isMock: true },
    { key: 'whatsapp', nameHe: 'WhatsApp', provider: getNotificationProvider('whatsapp').name, isMock: true },
    { key: 'slack', nameHe: 'Slack', provider: getNotificationProvider('slack').name, isMock: true },
  ];
}
