export function DataUnavailable({ label, retryHref = '/' }: Readonly<{ label: string; retryHref?: string }>) {
  return (
    <div className="card dataUnavailable">
      <output>No pudimos cargar {label}. Intenta de nuevo en unos momentos.</output>
      <a className="button outline" href={retryHref}>Volver a intentar</a>
    </div>
  );
}
