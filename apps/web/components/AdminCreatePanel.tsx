import styles from './AdminWorkspace.module.css';

export function AdminCreatePanel({ title, description, open = false, children }: Readonly<{
  title: string; description: string; open?: boolean; children: React.ReactNode;
}>) {
  return <details className={styles.createPanel} open={open || undefined}>
    <summary><span className={styles.createSymbol} aria-hidden="true">+</span><span><strong>{title}</strong><small>{description}</small></span><span className={styles.createChevron} aria-hidden="true">⌄</span></summary>
    <div className={styles.createBody}>{children}</div>
  </details>;
}
