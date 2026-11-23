import { cookies } from 'next/headers';
import { apiBaseUrl } from '@/lib/api';
import { isPublicPhotoPath } from '@/lib/format';

export async function GET(request: Request, { params }: { params: Promise<{ ruta: string[] }> }) {
  const path = '/' + (await params).ruta.join('/');
  if (!isPublicPhotoPath(path)) return new Response(null, { status: 404 });

  const own=new URL(request.url).searchParams.get('propia')==='1';
  const id=own && /^\/api\/files\/([\w-]+)\/content$/.exec(path)?.[1];
  const token=id ? (await cookies()).get('inmo_token')?.value : undefined;
  if(own && (!id || !token)) return new Response(null,{status:401});
  let upstream;
  try {
    upstream = await fetch(apiBaseUrl() + (id?'/api/owner/listings/photos/'+id:path), { headers:token?{Authorization:'Bearer '+token}:undefined,cache: 'no-store', redirect: 'error' });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok) {
    void upstream.body?.cancel().catch(() => {});
    return new Response(null, { status: upstream.status });
  }

  const type = upstream.headers.get('content-type')?.split(';')[0].trim();
  const allowed = path.startsWith('/uploads/seed/') ? type === 'image/svg+xml' : ['image/jpeg', 'image/png', 'image/webp'].includes(type ?? '');
  if (!type || !allowed) {
    void upstream.body?.cancel().catch(() => {});
    return new Response(null, { status: 415 });
  }
  return new Response(upstream.body, { headers: {
    'Content-Type': type, 'Cache-Control': 'no-store',
    'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
  } });
}
