import Link from 'next/link';
import { loadPublicData } from '@/lib/public-data';
import type { Property } from '@/lib/types';
import type { SiteCopy } from '@/lib/site-content';
import { DataUnavailable } from '../DataUnavailable';
import { AssetRail } from '../market/AssetRail';

export async function FeaturedRentals({copy}:Readonly<{copy:SiteCopy['portada']}>) {
  const rows=await loadPublicData<Property[]>('/properties/featured');
  if (rows===null) return <DataUnavailable label="los inmuebles destacados" retryHref="/"/>;
  if (!rows.length) return <p className="portfolioEmpty">{copy.emptyFeatured} <Link href="/inmuebles">{copy.emptyFeaturedLink} →</Link></p>;
  return <AssetRail label={copy.portfolioLabel} kind="rent" items={rows.map(p=>({
    id:p.slug,href:'/inmuebles/'+encodeURIComponent(p.slug),title:p.title,price:p.monthlyRent,image:p.images[0]?.url,
    place:[p.neighborhood,p.city].filter(Boolean).join(' · '),details:p.areaM2+' m² · '+p.bedrooms+' hab.',
    latitude:p.latitude,longitude:p.longitude,
  }))}/>;
}
