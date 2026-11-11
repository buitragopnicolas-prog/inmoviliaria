'use client';

import Link from 'next/link';
import styles from '@/components/AdminWorkspace.module.css';

export default function AdminError({ retry }: Readonly<{ retry: () => void }>) {
  return <div className={styles.errorState} role="alert"><span className="eyebrow">Información no disponible</span><h1>No pudimos cargar esta sección</h1><p>Intenta de nuevo en unos momentos. Puedes seguir navegando por las otras secciones del administrador.</p><div><button className="button" type="button" onClick={retry}>Volver a intentar</button><Link className="button outline" href="/admin">Ir al resumen</Link></div></div>;
}
