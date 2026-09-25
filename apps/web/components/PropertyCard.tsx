import Image from 'next/image';
import Link from 'next/link';
import { assetUrl, pesos } from '@/lib/format';
import type { Property } from '@/lib/types';
import { UiIcon } from './UiIcon';

export function PropertyCard({ property }: { property: Property }) {
  const image = property.images[0];
  const isIllustration = /\.svg(?:[?#]|$)/i.test(image?.url ?? '');
  const isSeedIllustration = /\/uploads\/seed\/[^?#]+\.svg(?:[?#]|$)/i.test(image?.url ?? '');

  return (
    <article className="propertyCard">
      <div className="propertyImage">
        <Image
          className={isIllustration ? 'propertyIllustration' : undefined}
          src={assetUrl(image?.url)}
          alt={isSeedIllustration ? `Ilustración de referencia: ${property.title}` : image?.alt ?? property.title}
          fill
          sizes="(max-width: 680px) calc(100vw - 32px), (max-width: 1000px) calc((100vw - 72px) / 2), (max-width: 1288px) calc((100vw - 96px) / 3), 397px"
        />
        <span className="pill">Disponible</span>
        {isSeedIllustration && <span className="propertyImageReference">Imagen de referencia</span>}
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
