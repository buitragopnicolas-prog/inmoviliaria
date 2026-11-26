'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { aiTools, validateAiInput, type AiToolId } from '@/lib/ai-tools';
import type { AiResult } from '@/lib/run-ai-tool';
import { aiProgress, type AiProgress } from '@/lib/ai-progress';
import { StatusNotice } from './StatusNotice';
import styles from './AiTools.module.css';

export function AiTools() {
  const [id, setId] = useState<AiToolId>('ocr');
  const [text, setText] = useState('');
  const [secondText, setSecondText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState<'es' | 'en'>('es');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AiProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [url, setUrl] = useState('');
  const [captionUrl, setCaptionUrl] = useState('');
  const mounted = useRef(true);
  const running = useRef(false);
  const tool = aiTools.find((item) => item.id === id)!;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!result?.blob) { setUrl(''); setCaptionUrl(''); return; }
    const next = URL.createObjectURL(result.blob);
    let captions = '';
    if (result.media === 'audio' && result.text) {
      const transcript = result.text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(/\s+/g, ' ');
      captions = URL.createObjectURL(new Blob([`WEBVTT\n\n00:00:00.000 --> 24:00:00.000\n${transcript}\n`], { type: 'text/vtt' }));
    }
    setUrl(next);
    setCaptionUrl(captions);
    return () => { URL.revokeObjectURL(next); if (captions) URL.revokeObjectURL(captions); };
  }, [result]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    setError('');
    const issue = validateAiInput(id, text, secondText, file);
    if (issue) { setError(issue); return; }
    running.current = true;
    let listening = true;
    setBusy(true); setResult(null); setProgress({ label: 'Preparando el modelo', bars: {} });
    try {
      const { runAiTool } = await import('@/lib/run-ai-tool');
      const output = await runAiTool(id, { text, secondText, file, from }, (event) => {
        if (!mounted.current || !listening) return;
        setProgress(previous => aiProgress(id, event, previous));
      });
      if (mounted.current) setResult(output);
    } catch (cause) {
      console.error('No se pudo ejecutar la herramienta IA', cause);
      if (mounted.current) setError('No se pudo completar el proceso. Comprueba tu conexión, el formato del archivo y la memoria disponible. Para crear imágenes, necesitas WebGPU. Puedes volver a intentarlo.');
    } finally {
      listening = false;
      running.current = false;
      if (mounted.current) { setBusy(false); setProgress(null); }
    }
  }

  return <div className={styles.root}>
    <p className={styles.privacy}>Tus archivos y textos se procesan en este navegador. La primera ejecución descarga un modelo desde Hugging Face y los recursos necesarios desde jsDelivr. El navegador puede guardarlos para futuras visitas.</p>
    <div className={styles.workspace}>
      <aside className={styles.tools} aria-label="Elegir herramienta">
        {aiTools.map((item) => <button key={item.id} type="button" aria-pressed={id === item.id} disabled={busy} className={styles.tool} onClick={() => { setId(item.id); setFile(null); setResult(null); setError(''); }}><span>{item.title}</span><small>{item.size}</small></button>)}
      </aside>
      <div className={`card ${styles.panel}`}>
        <div key={id} className={styles.toolHeading}><span className="eyebrow">{{ image: 'Imágenes', audio: 'Audio', text: 'Texto' }[tool.kind]}</span><h2>{tool.title}</h2><p className="muted">{tool.description}</p></div>
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
          <button className="button" type="submit" aria-busy={busy} aria-disabled={busy}>{busy ? 'Procesando…' : 'Procesar'}</button>
        </form>
        {progress && <div className={styles.progress}>
          <StatusNotice message={progress.label} />
          {Object.entries(progress.bars).map(([label, percent]) => <label key={label}>
            <span>{label}</span><progress aria-label={label} max={100} value={percent} /><span>{percent} %</span>
          </label>)}
        </div>}
        {error && <StatusNotice message={error} tone="error" />}
        {result && <StatusNotice message="Proceso completado." tone="success" />}
        {result && <section className={styles.result} aria-label="Resultado"><h3>Resultado</h3>
          {result.text !== undefined && <label className="form">Texto generado<textarea aria-label="Texto del resultado" rows={8} readOnly value={result.text || 'El modelo no devolvió texto. Prueba con otro archivo o contenido.'} /></label>}
          {url && result.media === 'image' && <img src={url} alt="Resultado generado por la herramienta IA" />}
          {url && result.media === 'audio' && <audio src={url} controls aria-label="Escuchar narración generada"><track kind="captions" src={captionUrl} srcLang="es" label="Texto de la narración" default /></audio>}
          {url && <a className="button outline" href={url} download={result.media === 'audio' ? 'jb-narracion.wav' : 'jb-imagen-ia.png'}>Descargar resultado</a>}
          <p className="hint">Revisa el resultado antes de utilizarlo. No se guarda en el catálogo ni en tus documentos.</p>
        </section>}
        <details className={styles.credits}><summary>Modelo y licencia</summary><p>{tool.model}</p><a className="textLink" href="https://runonweb.ai/models" target="_blank" rel="noreferrer">Ver modelos y condiciones de uso</a></details>
      </div>
    </div>
    <p className={styles.credit}>Desarrollado con <a className="textLink" href="https://github.com/midudev/runonweb.ai" target="_blank" rel="noreferrer">runonweb.ai</a>. Algunas herramientas ofrecen mejores resultados en inglés, según el modelo.</p>
  </div>;
}
