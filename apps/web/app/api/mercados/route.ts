import { marketSnapshot } from '@/lib/market-feed';

export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(await marketSnapshot(),{headers:{'Cache-Control':'no-store'}});
}
