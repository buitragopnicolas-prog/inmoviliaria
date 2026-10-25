import Image from 'next/image';
import Link from 'next/link';
import { assetUrl, pesos } from '@/lib/format';
import type { Property } from '@/lib/types';
import { UiIcon } from './UiIcon';
import styles from './PropertyCard.module.css';

export function PropertyCard({ property }: { property: Property }) {
  const image = property.images[0];
  const isIllustration = /\.svg(?:[?#]|$)/i.test(image?.url ?? '');
  const isSeedIllustration = /\/uploads\/seed\/[^?#]+\.svg(?:[?#]|$)/i.test(image?.url ?? '');
  const statusLabel = property.status === 'RENTED' ? 'Arrendado' : property.status === 'ARCHIVED' ? 'No disponible' : 'Disponible';

  return (
    <article className={styles.card}>
      <Link className={styles.link} href={`/inmuebles/${property.slug}`} aria-label={`Ver inmueble: ${property.title}`}>
        <div className={styles.image}>
          <Image
            className={isIllustration ? styles.illustration : undefined}
            src={assetUrl(image?.url)}
            alt={isSeedIllustration ? `Ilustración de referencia: ${property.title}` : image?.alt ?? property.title}
            fill
            sizes="(max-width: 680px) calc(100vw - 32px), (max-width: 1000px) calc((100vw - 72px) / 2), (max-width: 1288px) calc((100vw - 96px) / 3), 397px"
          />
          <span className={styles.status}><span aria-hidden="true" className={property.status === 'AVAILABLE' ? styles.availableDot : styles.statusDot} />{statusLabel}</span>
          {property.tour360Url && <span className={styles.tour}>Recorrido 360°</span>}
          {property.images.length > 1 && <span className={styles.photoCount}>{property.images.length} imágenes</span>}
          {(isSeedIllustration || !image) && <span className={styles.reference}>{image ? 'Imagen de referencia' : 'Sin fotografía'}</span>}
        </div>
        <div className={styles.body}>
          <p className={styles.location}><UiIcon name="pin" />{[property.neighborhood, property.city].filter(Boolean).join(', ')}</p>
          <h3>{property.title}</h3>
          <div className={styles.pricing}><p className={styles.rent}>{pesos(property.monthlyRent)} <small>COP / mes</small></p><p className={styles.fee}>{property.administrationFee > 0 ? `+ ${pesos(property.administrationFee)} de administración` : 'Canon mensual de arriendo'}</p></div>
          <dl className={styles.specs}>
            <div><dt><UiIcon name="area" /><span>Área</span></dt><dd>{property.areaM2} m²</dd></div>
            <div><dt><UiIcon name="bed" /><span>Habitaciones</span></dt><dd>{property.bedrooms} hab.</dd></div>
            <div><dt><UiIcon name="bath" /><span>Baños</span></dt><dd>{property.bathrooms} {property.bathrooms === 1 ? 'baño' : 'baños'}</dd></div>
            {property.parking > 0 && <div><dt><UiIcon name="parking" /><span>Parqueaderos</span></dt><dd>{property.parking} parq.</dd></div>}
          </dl>
          <span className={styles.cta}>Conocer este inmueble <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
    </article>
  );
}
