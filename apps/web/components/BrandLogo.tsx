import mark from '@/lib/brand-mark.json';
import styles from './BrandLogo.module.css';

type BrandLogoProps = {
  name?: string;
  tagline?: string;
  className?: string;
  stacked?: boolean;
  showTagline?: boolean;
  compact?: boolean;
  tone?: 'light' | 'dark' | 'monochrome';
};

/** Shared original geometry for the UI and exported brand assets. */
export function BrandLogo({ className = '', stacked = false, showTagline = true, compact = false, tone = 'light', name = mark.name, tagline = 'Espacios para vivir' }: Readonly<BrandLogoProps>) {
  const classes = [styles.logo, styles[tone], stacked && styles.stacked, compact && styles.compact, className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={name}>
      <svg className={styles.symbol} viewBox={mark.viewBox} fill="currentColor" aria-hidden="true" focusable="false">
        <path d={mark.j} />
        <path d={mark.b} fillRule="evenodd" />
        <path className={styles.foundation} d={mark.foundation} />
      </svg>
      {!compact && <span className={styles.wordmark} aria-hidden="true">
        <span className={styles.name}>{name.split(' ')[0]}</span>
        <strong className={styles.descriptor}>{name.split(' ').slice(1).join(' ')}</strong>
        {showTagline && <span className={styles.tagline}>{tagline}</span>}
      </span>}
    </span>
  );
}
