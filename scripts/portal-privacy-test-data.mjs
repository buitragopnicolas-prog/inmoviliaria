import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const schema=JSON.parse(await readFile(new URL('../shared/site-fields.json',import.meta.url),'utf8'));
export function sectionValues(id,rows) {
  return {...Object.fromEntries(Object.entries(schema[id].fields).map(([key,field])=>[key,field.value])),...rows.find(row=>row.id===id)?.values};
}
export function consentFor(values) {
  const text=values.policyText?.trim() || '';
  const href=values.policyHref?.trim() || (text?'/politica-de-datos':'');
  if(!href) throw Error('Publica la política en el entorno de prueba antes de continuar.');
  return {authorized:true,policyVersion:createHash('sha256').update(JSON.stringify([href,text])).digest('hex')};
}
// Only the disposable stack can receive the synthetic policy via this helper.
export async function fixturePolicy(token) {
  const base='http://localhost:14613/api';
  const rows=await (await fetch(base+'/site-content')).json();
  const values=sectionValues('contacto',rows);
  values.policyText='Documento sintético para verificar exclusivamente el entorno desechable JB.';
  values.policyHref='';
  const response=await fetch(base+'/admin/publishing/sections/contacto',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({revision:rows.find(row=>row.id==='contacto')?.revision??0,values})});
  if(!response.ok) throw Error('Política de ensayo HTTP '+response.status);
  return consentFor(values);
}
