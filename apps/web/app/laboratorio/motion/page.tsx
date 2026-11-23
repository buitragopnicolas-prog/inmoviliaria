import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HomeHero } from '@/components/home/HomeSections';
import home from '@/components/home/HomeSections.module.css';
import styles from './preview.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Laboratorio de portada', robots: { index: false, follow: false } };

const directions = [
  { id: 'minimal', label: 'Minimal Real Estate' },
  { id: 'arquitectura', label: 'Architectural Premium' },
  { id: 'proptech', label: 'Modern PropTech' },
];
const intensities = [
  { id: 'sutil', label: 'Sutil' },
  { id: 'premium', label: 'Premium' },
  { id: 'inmersiva', label: 'Inmersiva' },
];

export default async function MotionLabPage({ searchParams }: Readonly<{
  searchParams: Promise<{ diseno?: string | string[]; movimiento?: string | string[] }>;
}>) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const query = await searchParams;
  const direction = directions.find(option => option.id === query.diseno)?.id ?? 'arquitectura';
  const intensity = intensities.find(option => option.id === query.movimiento)?.id ?? 'premium';

  return <>
    <div className={`container ${styles.controls}`}>
      <form className="filters" method="get" aria-label="Comparar la portada local">
        <label>Diseño de portada<select name="diseno" defaultValue={direction}>
          {directions.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <label>Movimiento de las acciones<select name="movimiento" defaultValue={intensity}>
          {intensities.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <button className="button" type="submit">Ver variante</button>
      </form>
    </div>
    <div className={`${home.home} ${styles.preview}`} data-direction={direction} data-intensity={intensity}>
      <HomeHero featuredHref="/#inmuebles-destacados" />
    </div>
  </>;
}
