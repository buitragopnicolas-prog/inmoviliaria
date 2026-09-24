const paths = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M18 6 6 18',
  home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  document: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  folder: 'M3 7V4h6l2 3h10v13H3z',
  check: 'm5 12 4 4L19 6M4 3h16v18H4z',
  message: 'M21 15a2 2 0 0 1-2 2H7l-5 5V4a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2z',
  area: 'M4 4h16v16H4zM4 10h4M10 4v4M16 4v4M4 16h4',
  bed: 'M3 18V7M21 18v-7H3M3 15h18M6 11V6h6v5',
  bath: 'M3 12h18M5 12V5a2 2 0 0 1 4 0M4 12v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4M7 20v2M17 20v2',
  parking: 'M6 21V3h7a5 5 0 0 1 0 10H6',
} as const;

export type IconName = keyof typeof paths;

export function UiIcon({ name }: { name: IconName }) {
  return <svg className="uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
