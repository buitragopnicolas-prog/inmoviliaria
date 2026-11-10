import styles from '@/components/AdminWorkspace.module.css';

export default function AdminLoading() {
  return <div className={styles.loading} role="status" aria-live="polite"><p>Cargando administración…</p><div aria-hidden="true"><span /><span /><span /></div></div>;
}
