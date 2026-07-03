import type { NextConfig } from "next";

// CSP is intentionally Report-Only (not enforcing) so it cannot break the live
// app while operators observe violation reports.  Once reports confirm no
// violations, promote to enforcing by renaming the header to
// "Content-Security-Policy".
//
// 'unsafe-inline' is required by Next.js inline styles and Tailwind v4.
// 'unsafe-eval' is kept for Next.js dev/runtime safety; tighten it to a
// nonce-based policy after CSP is promoted to enforcing.
//
// connect-src covers all external providers (AI gateway, AllTick/iTick market
// data, Supabase, Resend, WeChat Pay) without hardcoding individual domains —
// all are HTTPS origins, so `https:` is sufficient at this stage.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https:",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP,
          },
          {
            // Only meaningful over HTTPS; harmless over HTTP.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
