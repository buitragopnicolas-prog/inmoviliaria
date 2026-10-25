'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { aiTools, validateAiInput, type AiToolId } from '@/lib/ai-tools';
import type { AiResult } from '@/lib/run-ai-tool';
import styles from './AiTools.module.css';

export function AiTools() {
  const [id, setId] = useState<AiToolId>('ocr');
  const [text, setText] = useState('');
  const [secondText, setSecondText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState<'es' | 'en'>('es');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [url, setUrl] = useState('');
  const mounted = useRef(true);
  const running = useRef(false);
  const tool = aiTools.find((item) => item.id === id)!;

  useEffect(() => {
    mounted.current = true;
    // A full navigation restores the destination's stricter CSP. Next's client
    // navigation would otherwise keep this document's model-download permissions.
    function navigate(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (destination.origin === location.origin && destination.pathname !== location.pathname) {
        event.preventDefault();
        location.assign(destination.href);
      }
    }
    document.addEventListener('click', navigate, true);
    return () => { mounted.current = false; document.removeEventListener('click', navigate, true); };
  }, []);
  useEffect(() => {
    if (!result?.blob) { setUrl(''); return; }
    const next = URL.createObjectURL(result.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    setError('');
    const issue = validateAiInput(id, text, secondText, file);
    if (issue) { setError(issue); return; }
    running.current = true;
    setBusy(true); setResult(null); setStatus('Preparando el modelo…');
    try {
      const { runAiTool } = await import('@/lib/run-ai-tool');
      const output = await runAiTool(id, { text, secondText, file, from }, (progress) => {
        if (!mounted.current) return;
        const percent = progress.progress;
        setStatus(progress.status === 'ready' || progress.status === 'done' ? 'Procesando…' : `Descargando o preparando el modelo${typeof percent === 'number' ? ` · ${Math.min(100, Math.max(0, percent)).toFixed(0)} % del archivo` : '…'}`);
      });
      if (mounted.current) { setResult(output); setStatus('Proceso completado.'); }
    } catch (cause) {
      console.error('No se pudo ejecutar la herramienta IA', cause);
      if (mounted.current) { setError('No se pudo completar el proceso. Comprueba tu conexión, el formato del archivo y la memoria disponible. Para crear imágenes, necesitas WebGPU. Puedes volver a intentarlo.'); setStatus(''); }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className={styles.root}>
    <p className={styles.privacy}>Tus archivos y textos se procesan en este navegador. La primera ejecución descarga un modelo desde Hugging Face y los recursos necesarios desde jsDelivr. El navegador puede guardarlos para futuras visitas.</p>
    <div className={styles.workspace}>
      <aside className={styles.tools} aria-label="Elegir herramienta">
        {aiTools.map((item) => <button key={item.id} type="button" aria-pressed={id === item.id} disabled={busy} className={styles.tool} onClick={() => { setId(item.id); setFile(null); setResult(null); setError(''); setStatus(''); }}><span>{item.title}</span><small>{item.size}</small></button>)}
      </aside>
      <div className={`card ${styles.panel}`} aria-busy={busy}>
        <div><span className="eyebrow">{tool.kind === 'image' ? 'Imágenes' : tool.kind === 'audio' ? 'Audio' : 'Texto'}</span><h2>{tool.title}</h2><p className="muted">{tool.description}</p></div>
        <form className="form" onSubmit={handleSubmit}>
          <fieldset disabled={busy} className={styles.fields}>
            {tool.kind !== 'text' ? <label key={id}>Seleccionar {tool.kind === 'image' ? 'imagen' : 'audio'}<input type="file" accept={`${tool.kind}/*`} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setResult(null); setError(''); }} /><span className="hint">Máximo 25 MB. {file ? `Seleccionado: ${file.name}` : 'El archivo se utiliza únicamente en tu dispositivo.'}</span></label> : <>
              <label htmlFor="ai-text">{id === 'image' ? 'Describe la imagen que quieres crear' : 'Texto'}<textarea id="ai-text" rows={6} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} placeholder={id === 'image' ? 'Una sala luminosa con muebles de madera y plantas…' : 'Escribe o pega aquí tu texto…'} /><span className="hint">{text.length}/4000 caracteres</span></label>
              {id === 'embed' && <label htmlFor="ai-second-text">Segundo texto<textarea id="ai-second-text" rows={4} maxLength={4000} value={secondText} onChange={(event) => setSecondText(event.target.value)} /></label>}
              {id === 'translate' && <label htmlFor="ai-language">Dirección de la traducción<select id="ai-language" value={from} onChange={(event) => setFrom(event.target.value as 'es' | 'en')}><option value="es">Español → Inglés</option><option value="en">Inglés → Español</option></select></label>}
            </>}
          </fieldset>
          <p className={styles.download}>Descarga inicial aproximada: <strong>{tool.size}</strong>. Puede tardar varios minutos y consumir memoria del dispositivo. Se inicia al pulsar «Procesar».</p>
          {id === 'image' && <p className="hint">Las imágenes son conceptuales: no representan el estado real de un inmueble.</p>}
          <button className="button" type="submit" disabled={busy}>{busy ? 'Procesando…' : 'Procesar'}</button>
        </form>
        <p role="status" aria-live="polite">{status}</p>
        {error && <p className="alert error" role="alert">{error}</p>}
        {result && <section className={styles.result} aria-label="Resultado"><h3>Resultado</h3>
          {result.text !== undefined && <label className="form">Texto generado<textarea aria-label="Texto del resultado" rows={8} readOnly value={result.text || 'El modelo no devolvió texto. Prueba con otro archivo o contenido.'} /></label>}
          {url && result.media === 'image' && <img src={url} alt="Resultado generado por la herramienta IA" />}
          {url && result.media === 'audio' && <audio src={url} controls aria-label="Escuchar narración generada" />}
          {url && <a className="button outline" href={url} download={result.media === 'audio' ? 'jb-narracion.wav' : 'jb-imagen-ia.png'}>Descargar resultado</a>}
          <p className="hint">Revisa el resultado antes de utilizarlo. No se guarda en el catálogo ni en tus documentos.</p>
        </section>}
        <details className={styles.credits}><summary>Modelo y licencia</summary><p>{tool.model}</p><a className="textLink" href="https://runonweb.ai/models" target="_blank" rel="noreferrer">Ver modelos y condiciones de uso</a></details>
      </div>
    </div>
    <p className={styles.credit}>Desarrollado con <a className="textLink" href="https://github.com/midudev/runonweb.ai" target="_blank" rel="noreferrer">runonweb.ai</a>. Algunas herramientas ofrecen mejores resultados en inglés, según el modelo.</p>
  </div>;
}
