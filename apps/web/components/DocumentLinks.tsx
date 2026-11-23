import type { DocumentFile } from '@/lib/documents';

export function DocumentLinks({files,scope}:Readonly<{files:DocumentFile[];scope:'privados'|'publicos'}>) {
  return <ul className="pdfList">{files.map(file=>{
    const path='/documentos/'+scope+'/'+encodeURIComponent(file.id);
    return <li key={file.id}><div>{file.serviceType && <span>Contrato de prestación de servicios · {file.serviceType}<br/></span>}<strong>{file.originalName}</strong><small>PDF · {Math.max(1,Math.round(file.size/1024))} KB</small></div>
      <div className="pdfActions"><a className="button small outline" href={path} target="_blank" rel="noopener" aria-label={'Ver PDF '+file.originalName}>Ver PDF</a>
      <a className="textLink" href={path+'?download=1'} aria-label={'Descargar '+file.originalName}>Descargar</a></div></li>;
  })}</ul>;
}
