import icons from '@/lib/brand-icons.json';

export type BrandIconName = keyof typeof icons;

export function BrandIcon({ name }: Readonly<{ name: BrandIconName }>) {
  const icon = icons[name];
  return <svg className="jbBrandIcon" viewBox={icon.viewBox} aria-hidden="true" focusable="false">
    <path d={icon.path} fill="currentColor" fillRule="evenodd" />
  </svg>;
}
