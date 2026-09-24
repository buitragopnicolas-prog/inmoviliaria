'use client';

export function DataUnavailable({ label }: { label: string }) {
  return (
    <div className="card dataUnavailable">
      <p role="status">No pudimos cargar {label}. Intenta de nuevo en unos momentos.</p>
      <button className="button outline" type="button" onClick={() => window.location.reload()}>Volver a intentar</button>
    </div>
  );
}
