const domains=['suin-juriscol.gov.co','funcionpublica.gov.co','secretariasenado.gov.co','corteconstitucional.gov.co','cortesuprema.gov.co','minvivienda.gov.co','supernotariado.gov.co','sic.gov.co'];
const instructions='Orienta en español claro sobre derecho inmobiliario colombiano. Cubre arrendamientos, propiedad horizontal, compraventa, registro y trámites relacionados. Para otras materias explica brevemente el alcance. Busca fuentes oficiales colombianas y distingue normas vigentes, jurisprudencia y orientación general. Cita y vincula solo fuentes consultadas. Explica qué hechos faltan y cuándo corresponde revisar el caso con un abogado. No inventes normas, términos ni decisiones. Evita pedir nombres, cédulas, contratos o datos de terceros.';
type Annotation={type:string;url?:string;title?:string};
type Content={type:string;text?:string;annotations?:Annotation[]};
type Item={type:string;content?:Content[]};

function source(annotation:Annotation) {
  if (annotation.type!=='url_citation' || !annotation.url) return;
  try {
    const url=new URL(annotation.url);
    if (url.protocol==='https:' && !url.username && !url.password && domains.some(d=>url.hostname===d || url.hostname.endsWith('.'+d))) {
      return {url:url.href,title:annotation.title || url.hostname};
    }
  } catch { return; }
}

export async function consultColombianLaw(key:string,question:string) {
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST', signal:AbortSignal.timeout(60000),
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',store:false,instructions,input:question,
      max_output_tokens:2800,tools:[{type:'web_search',filters:{allowed_domains:domains}}],tool_choice:'required'}),
  });
  if (!response.ok) throw new Error('Proveedor no disponible');
  const body=await response.json() as {status:string;output:Item[]};
  if (body.status!=='completed') throw new Error('Respuesta incompleta');
  const paragraphs=body.output.filter(item=>item.type==='message').flatMap(item=>item.content??[]).filter(block=>block.type==='output_text');
  const answer=paragraphs.map(block=>block.text?.trim()).filter(Boolean).join('\n\n');
  const citations=new Map<string,{url:string;title:string}>();
  for (const annotation of paragraphs.flatMap(block=>block.annotations??[])) {
    const link=source(annotation);
    if(link) citations.set(link.url,link);
  }
  if (!answer || !citations.size) throw new Error('Faltan fuentes verificables');
  return {answer,sources:[...citations.values()]};
}
