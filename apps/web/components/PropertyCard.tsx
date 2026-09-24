import Image from 'next/image';
import Link from 'next/link';
import { assetUrl, pesos } from '@/lib/format';
import type { Property } from '@/lib/types';
import { UiIcon } from './UiIcon';

export function PropertyCard({ property }: { property: Property }) {
  return (
    <article className="propertyCard">
      <div className="propertyImage">
        <Image src={assetUrl(property.images[0]?.url)} alt={property.images[0]?.alt ?? property.title} fill sizes="(max-width: 900px) 100vw, 33vw" />
        <span className="pill">Disponible</span>
      </div>
      <div className="propertyBody">
        <p className="location">{property.neighborhood}, {property.city}</p>
        <h3>{property.title}</h3>
        <p className="rent">{pesos(property.monthlyRent)} <small>COP / mes</small></p>
        <div className="specs"><span><UiIcon name="area" />{property.areaM2} m²</span><span><UiIcon name="bed" />{property.bedrooms} hab.</span><span><UiIcon name="bath" />{property.bathrooms} baños</span>{property.parking > 0 && <span><UiIcon name="parking" />{property.parking} parq.</span>}</div>
        <Link className="textLink" href={`/inmuebles/${property.slug}`} aria-label={`Ver inmueble: ${property.title}`}>Ver inmueble <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
