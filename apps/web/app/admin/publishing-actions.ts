'use server';
import { textField } from '@/lib/form-text';
import { revalidatePath, updateTag } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { sections, type SectionId } from '@/lib/site-content';
import type { SaleOffer } from '@/lib/sale-offers';

export type PublicationState = { error?: string; success?: string; revision?: number; id?: string; values?: Record<string,string> };
function message(error: unknown) { return {error: error instanceof Error ? error.message : 'No se pudo guardar. Intenta nuevamente.'}; }
async function upload(files: File[]) {
  if (files.length > 10 || files.some(file=>file.size>5000000)) throw new Error('Selecciona hasta diez fotos de 5 MB cada una.');
  const form = new FormData();
  for (const file of files) form.append('photos',file);
  return apiFetch<string[]>('/admin/publishing/images',{method:'POST',body:form},true);
}
export async function saveSection(id: SectionId, previous: PublicationState, form: FormData): Promise<PublicationState> {
  await requireUser('ADMIN');
  try {
    if (!Object.hasOwn(sections,id)) throw new Error('Sección desconocida.');
    const values: Record<string,string> = {};
    for (const [key,field] of Object.entries(sections[id].fields)) {
      values[key] = textField(form,key).trim();
      const file = form.get('photo-'+key);
      if (field.kind==='image' && file instanceof File && file.size) {
        const [url] = await upload([file]);
        values[key]='/fotos'+url;
      }
    }
    const revision = Number(form.get('revision'));
    const saved=await apiFetch<{revision:number}>('/admin/publishing/sections/'+id,{method:'PUT',body:JSON.stringify({values,revision})},true);
    updateTag('site-content');
    revalidatePath('/','layout');
    return {...saved,values,success:'Cambios publicados.'};
  } catch(error){return message(error);}
}
export async function saveOffer(previous: PublicationState, form: FormData): Promise<PublicationState> {
  await requireUser('ADMIN');
  try {
    const files=form.getAll('photos').filter((file):file is File=>file instanceof File && file.size>0);
    const images=form.getAll('keep').map(String);
    if(images.length+files.length>10)throw new Error('La oferta admite hasta diez fotos.');
    if(files.length) images.push(...await upload(files));
    const id=textField(form,'id');
    const data={...Object.fromEntries(['title','description','price','category','city','catalog'].map(key=>[key,textField(form,key).trim()])),
      ...(form.has('latitude') && {latitude:textField(form,'latitude'),longitude:textField(form,'longitude')}),
      ...(form.has('promotion') && {promotion:textField(form,'promotion') || null}),
      ...(form.has('estimatedMonthlyRent') && {estimatedMonthlyRent:textField(form,'estimatedMonthlyRent') || null}),
      images,published:form.get('published')==='on',...(id && {revision:Number(form.get('revision'))})};
    const saved=await apiFetch<Pick<SaleOffer,'id'|'revision'>>('/admin/sales'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body:JSON.stringify(data)},true);
    revalidatePath('/inmuebles');revalidatePath('/');revalidatePath('/admin/ofertas');revalidatePath('/comprar');revalidatePath('/vehiculos-y-bienes');
    return {...saved,success:data.published?'Oferta publicada.':'Borrador guardado.'};
  } catch(error){return message(error);}
}
