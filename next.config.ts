import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pg', 'bcryptjs'],
  /**
   * ⚠ קבצי ה־SQL נקראים מהדיסק ב־runtime ולא מיובאים בקוד, ולכן Next אינו
   * מזהה אותם ולא אורז אותם ל־serverless function. בלי זה הכנת המסד נכשלת
   * בפרודקשן עם ENOENT, בעוד שמקומית הכול עובד כי הקבצים על הדיסק.
   */
  outputFileTracingIncludes: {
    // כולל גם את meta/_journal.json — המַגרטור של drizzle קורא אותו כדי לדעת
    // אילו migrations כבר הורצו, ובלעדיו הוא נכשל למרות שקבצי ה־SQL קיימים.
    '/**': ['./drizzle/**/*'],
  },
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
