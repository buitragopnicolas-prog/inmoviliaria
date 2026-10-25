import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['runonweb'],
  experimental: {
    serverActions: {
      // El formulario de inmuebles puede enviar hasta ~65 MB entre fotos y tour 360.
      bodySizeLimit: '75mb',
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
      { protocol: 'https', hostname: '**', pathname: '/**' },
    ],
  },
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === 'development' ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    const imagePolicy = process.env.NODE_ENV === 'development' ? "'self' data: blob: https: http:" : "'self' data: blob: https:";
    const upgradePolicy = process.env.NODE_ENV === 'development' ? '' : '; upgrade-insecure-requests';
    const securityHeaders = [
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src ${imagePolicy}; font-src 'self' data:; connect-src 'self'; media-src 'self' https:; frame-src 'self' https://www.youtube.com https://player.vimeo.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'${upgradePolicy}` },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
    ];
    if (process.env.NODE_ENV === 'production') securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
    // AI models run only on this route. Keep the stricter policy elsewhere.
    const aiContentPolicy = securityHeaders.find((header) => header.key === 'Content-Security-Policy')!.value
      .replace(`script-src ${scriptPolicy}`, `script-src ${scriptPolicy} 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net`)
      .replace("connect-src 'self'", "connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net")
      .replace("media-src 'self' https:", "media-src 'self' https: blob:")
      .concat("; worker-src 'self' blob:");
    return [{
      source: '/(.*)',
      headers: securityHeaders,
    }, {
      source: '/herramientas-ia',
      headers: [{ key: 'Content-Security-Policy', value: aiContentPolicy }],
    }];
  },
};

export default nextConfig;
