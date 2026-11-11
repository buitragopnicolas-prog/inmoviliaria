import styles from '@/components/AdminWorkspace.module.css';

export default function AdminLoading() {
  return <div className={styles.loading}><output>Cargando administración…</output><div aria-hidden="true"><span /><span /><span /></div></div>;
}
