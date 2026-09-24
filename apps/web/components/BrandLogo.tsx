import mark from '@/lib/brand-mark.json';
import styles from './BrandLogo.module.css';

type BrandLogoProps = {
  className?: string;
  stacked?: boolean;
  showTagline?: boolean;
  compact?: boolean;
  tone?: 'light' | 'dark' | 'monochrome';
};

/** Shared original geometry for the UI and exported brand assets. */
export function BrandLogo({ className = '', stacked = false, showTagline = true, compact = false, tone = 'light' }: BrandLogoProps) {
  const classes = [styles.logo, styles[tone], stacked && styles.stacked, compact && styles.compact, className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={mark.name}>
      <svg className={styles.symbol} viewBox={mark.viewBox} fill="currentColor" aria-hidden="true" focusable="false">
        <path d={mark.j} />
        <path d={mark.b} fillRule="evenodd" />
        <path className={styles.foundation} d={mark.foundation} />
      </svg>
      {!compact && <span className={styles.wordmark} aria-hidden="true">
        <span className={styles.name}>Asesoría</span>
        <strong className={styles.descriptor}>Inmobiliaria JB</strong>
        {showTagline && <span className={styles.tagline}>Espacios para vivir</span>}
      </span>}
    </span>
  );
}
