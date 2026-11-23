export function DataUnavailable({ label }: { label: string }) {
  return (
    <div className="card dataUnavailable">
      <p role="status">No pudimos cargar {label}. Intenta de nuevo en unos momentos.</p>
      <a className="button outline" href="">Volver a intentar</a>
    </div>
  );
}
