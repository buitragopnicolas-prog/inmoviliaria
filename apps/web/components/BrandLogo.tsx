import { EditorialPhoto } from './EditorialPhoto';
import mark from '@/lib/brand-mark.json';
import styles from './BrandLogo.module.css';

type BrandLogoProps = {
  name?: string;
  stacked?: boolean;
  image?: string;
  tone?: 'gold' | 'white' | 'navy';
};

export function BrandLogo({ name = mark.name, stacked = false, image, tone = 'gold' }: Readonly<BrandLogoProps>) {
  const fallback=stacked ? '/brand/logo-mono-white.svg' : '/brand/logo-dark.svg';
  if (image && image !== fallback) return <EditorialPhoto src={image} alt={name} fallback={fallback} fallbackAlt={name}
    className={stacked?styles.signature:styles.customHeader} width={700} height={524}/>;
  if (stacked) {
    const variant = { gold: 'dark', white: 'mono-white', navy: 'light' }[tone];
    return <img className={styles.signature} src={'/brand/logo-' + variant + '.svg'}
      width={700} height={524} alt={name} />;
  }

  return <span className={styles.lockup} data-tone={tone} role="img" aria-label={name}>
    <svg viewBox={mark.symbol.viewBox} className={styles.symbol} aria-hidden="true" focusable="false">
      <path d={mark.symbol.path} fill="currentColor" fillRule="evenodd" />
    </svg>
    <span className={styles.wordmark} aria-hidden="true">
      <span>Asesoría</span><span>Inmobiliaria</span>
      <svg viewBox={mark.skyline.viewBox} focusable="false">
        <path d={mark.skyline.path} fill="currentColor" stroke="currentColor" strokeWidth=".35" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  </span>;
}
