import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { assetUrl, pesos } from '@/lib/format';
import type { Property } from '@/lib/types';
import { ContactForm } from '@/components/ContactForm';
import { PropertyTour360Viewer } from '@/components/PropertyTour360Viewer';

export const dynamic = 'force-dynamic';

async function getProperty(slug: string): Promise<Property> {
  try {
    return await apiFetch<Property>(`/properties/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  return { title: property.title, description: property.description };
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  const video = property.videoUrl ? resolveVideoSource(property.videoUrl) : null;
  return (
    <section className="section pageTop">
      <div className="container">
        <div className="detailHeading"><div><span className="eyebrow">{property.neighborhood}, {property.city}</span><h1>{property.title}</h1><p>{property.address}</p></div><div className="detailPrice"><strong>{pesos(property.monthlyRent)}</strong><span>/ mes</span><small>Administración: {pesos(property.administrationFee)}</small></div></div>
        <div className="gallery">
          {(property.images.length ? property.images : [{ id: 'fallback', url: '', alt: property.title, sortOrder: 0 }]).map((image, index) => (
            <div className={index === 0 ? 'galleryMain' : 'gallerySmall'} key={image.id}><Image fill src={assetUrl(image.url)} alt={image.alt} sizes="(max-width: 900px) 100vw, 50vw" /></div>
          ))}
        </div>
        <div className="detailGrid">
          <div>
            <div className="detailSpecs"><div><strong>{property.areaM2}</strong><span>m²</span></div><div><strong>{property.bedrooms}</strong><span>habitaciones</span></div><div><strong>{property.bathrooms}</strong><span>baños</span></div><div><strong>{property.parking}</strong><span>parqueaderos</span></div></div>
            <h2>Descripción</h2><p className="longText">{property.description}</p>
            <h2>Características</h2><div className="features">{property.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div>
            {property.tour360Url && (
              <>
                <h2>Recorrido 360</h2>
                <div className="tour360Section card">
                  <PropertyTour360Viewer src={assetUrl(property.tour360Url)} title={property.title} />
                </div>
              </>
            )}
            {video && (
              <>
                <h2>Video del inmueble</h2>
                <div className="embedShell card">
                  {video.type === 'file' ? (
                    <video controls preload="metadata" src={assetUrl(video.src)}>
                      Tu navegador no soporta la reproducción de video.
                    </video>
                  ) : (
                    <iframe
                      src={video.src}
                      title={`Video de ${property.title}`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  )}
                </div>
              </>
            )}
          </div>
          <aside className="card inquiry"><h2>Me interesa este inmueble</h2><p>Déjanos tus datos y coordinaremos la visita.</p><ContactForm propertyTitle={property.title} /></aside>
        </div>
      </div>
    </section>
  );
}

type VideoSource =
  | { type: 'file'; src: string }
  | { type: 'embed'; src: string };

function resolveVideoSource(rawUrl: string): VideoSource {
  const url = rawUrl.trim();
  if (/(\.mp4|\.webm|\.ogg)(\?.*)?$/i.test(url)) {
    return { type: 'file', src: url };
  }

  const parsed = safeParseUrl(url);
  if (!parsed) {
    return { type: 'embed', src: url };
  }

  const youtubeId = getYoutubeId(parsed);
  if (youtubeId) {
    return { type: 'embed', src: `https://www.youtube.com/embed/${youtubeId}` };
  }

  const vimeoId = getVimeoId(parsed);
  if (vimeoId) {
    return { type: 'embed', src: `https://player.vimeo.com/video/${vimeoId}` };
  }

  return { type: 'embed', src: url };
}

function safeParseUrl(url: string): URL | null {
  try {
    return url.startsWith('http://') || url.startsWith('https://') ? new URL(url) : new URL(url, 'http://localhost');
  } catch {
    return null;
  }
}

function getYoutubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (url.hostname.includes('youtube.com')) {
    if (url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/').filter(Boolean)[1] ?? null;
    }
    return url.searchParams.get('v');
  }

  return null;
}

function getVimeoId(url: URL): string | null {
  if (!url.hostname.includes('vimeo.com')) {
    return null;
  }
  const match = url.pathname.match(/\/(\d+)/);
  return match?.[1] ?? null;
}
