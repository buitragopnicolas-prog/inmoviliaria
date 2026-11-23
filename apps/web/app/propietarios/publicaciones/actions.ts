'use server';
import { apiFetch } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
export async function saveListing(_previous:{error:string},form:FormData) {
  const id=String(form.get('id')??'');
  const body=new FormData();
  for (const [key,value] of form) {
    if (key==='id' || key.startsWith('$') || (value instanceof File && !value.size)) continue;
    body.append(key,value);
  }
  try {
    await apiFetch('/owner/listings'+(id?'/'+encodeURIComponent(id):''),{method:id?'PUT':'POST',body},true);
  } catch(e) { return {error:e instanceof Error?e.message:'No se pudo guardar la publicación.'}; }
  for(const path of ['/propietarios/publicaciones','/inmuebles','/comprar','/']) revalidatePath(path);
  redirect('/propietarios/publicaciones?guardado=1');
}
