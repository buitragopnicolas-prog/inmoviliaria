'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { propertyPhotoUrl } from '@/lib/format';
import { fadeIn } from '@/lib/motion';
import type { PropertyImage } from '@/lib/types';
import { UiIcon } from './UiIcon';
import styles from './PropertyGallery.module.css';

export function PropertyGallery({ images: records, title }: Readonly<{ images: PropertyImage[]; title: string }>) {
  const images = records.filter(image => image.url && image.url !== '/property-placeholder.svg');
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const viewerImage = useRef<HTMLImageElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const photo = index === null ? undefined : images[index];
  useEffect(() => fadeIn(viewerImage.current), [photo?.id]);

  function open(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || !dialog.current?.showModal) return;
    event.preventDefault();
    opener.current = event.currentTarget;
    setIndex(0);
    dialog.current.showModal();
  }

  function step(offset: number) {
    setIndex(current => current === null ? null : (current + offset + images.length) % images.length);
  }

  if (!images.length) return <div className="gallery"><div className={styles.cover}>
    <Image fill src="/property-placeholder.svg" alt={`Sin fotografía de ${title}`} sizes="100vw" />
  </div></div>;

  const first = images[0];
  const multiple = images.length > 1;
  const cover = <>
    <Image fill src={propertyPhotoUrl(first.url)} alt={first.alt || title} sizes="100vw" />
    <span className={styles.expand}>{multiple ? `Ver las ${images.length} fotos` : 'Ampliar foto'} <span aria-hidden="true">↗</span></span>
  </>;
  return <>
    <div className="gallery">
      {multiple ? <details>
        <summary className={styles.cover} onClick={open}>{cover}</summary>
        <ol className={styles.originals}>{images.map((image, position) =>
          <li key={image.id}><a href={propertyPhotoUrl(image.url)}>Foto {position + 1} · {image.alt || title}</a></li>
        )}</ol>
      </details> : <a className={styles.cover} href={propertyPhotoUrl(first.url)} onClick={open}>{cover}</a>}
    </div>
    <dialog ref={dialog} className={styles.viewer} aria-label={`Fotografías de ${title}`}
      onClose={() => { setIndex(null); opener.current?.focus({ preventScroll: true }); }}
      onKeyDown={event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        step(event.key === 'ArrowLeft' ? -1 : 1);
      }}>
      <header><strong>{title}</strong><button type="button" aria-label="Cerrar galería" onClick={() => dialog.current?.close()}><UiIcon name="close" /></button></header>
      {photo && <div className={styles.stage}><img ref={viewerImage} key={photo.id} src={propertyPhotoUrl(photo.url)} alt={photo.alt || title} /></div>}
      <footer>
        <span aria-live="polite" aria-atomic="true">{index !== null && `Foto ${index + 1} de ${images.length}`}</span>
        {images.length > 1 && <div><button type="button" aria-label="Foto anterior" onClick={() => step(-1)}>←</button>
          <button type="button" aria-label="Foto siguiente" onClick={() => step(1)}>→</button></div>}
      </footer>
    </dialog>
  </>;
}
