import { cookies } from 'next/headers';
import { apiBaseUrl } from '@/lib/api';

export async function GET(request: Request, {params}: {params: Promise<{ambito:string; id:string}>}) {
  const {ambito, id} = await params;
  const headers = new Headers({'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff'});
  if (ambito !== 'privados' && ambito !== 'publicos') return new Response(null,{status:404,headers});
  const upstreamHeaders = new Headers();
  if (ambito === 'privados') {
    const token = (await cookies()).get('inmo_token')?.value;
    if (!token) return new Response('Inicia sesión para consultar este PDF.', {status:401,headers});
    upstreamHeaders.set('Authorization','Bearer '+token);
  }
  const scope = ambito === 'privados' ? 'private' : 'public';
  const download = new URL(request.url).searchParams.get('download') === '1' ? '?download=1' : '';
  const upstream = await fetch(apiBaseUrl()+'/api/documents/'+scope+'/'+encodeURIComponent(id)+download, {
    headers:upstreamHeaders, cache:'no-store',
  });
  if (!upstream.ok) return new Response('Documento no disponible.', {status:upstream.status, headers});
  for (const name of ['content-type','content-disposition','content-length']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name,value);
  }
  return new Response(upstream.body, {headers});
}
