'use server';
import { textField } from '@/lib/form-text';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { rentalFormats } from '@/lib/documents';
import type { ActionState } from './actions';

export async function uploadDocument(kind: 'account'|'template', id:string, _previous:ActionState, data:FormData):Promise<ActionState> {
  await requireUser('ADMIN');
  const template = kind === 'template';
  if (template && !Object.hasOwn(rentalFormats,id)) return {error:'Selecciona un formato válido.'};
  const file = data.get('file');
  if (!(file instanceof File) || !file.size || file.size>8_000_000) return {error:'Selecciona un PDF de hasta 8 MB.'};
  try {
    const upload = new FormData();
    upload.set('file', file);
    const serviceType = textField(data, 'serviceType');
    if(!template && serviceType) upload.set('serviceType',serviceType);
    await apiFetch('/admin/documents/'+(template?'templates/':'accounts/')+encodeURIComponent(id),{method:'POST',body:upload},true);
    revalidatePath(template?'/admin/formatos':'/admin/documentos');
    revalidatePath(template?'/solicitud-de-arrendamiento':'/mi-cuenta/documentos');
    return {success: template?'Formato publicado.':'PDF disponible en la cuenta del cliente.'};
  } catch(error) {
    return {error:error instanceof Error?error.message:'No se pudo guardar el documento.'};
  }
}

export async function sendSuggestion(_previous:ActionState & {message?:string}, data: FormData) {
  const message = textField(data,'message').trim();
  try {
    await apiFetch('/suggestions',{method:'POST',body:JSON.stringify({message,authorized:data.get('authorized')==='true',policyVersion:data.get('policyVersion')})});
    revalidatePath('/admin/sugerencias');
    return {success:'Tu sugerencia llegó al buzón de la inmobiliaria.',error:'',message:''};
  } catch(error) {
    return {error:error instanceof Error?error.message:'No se pudo enviar la sugerencia.',success:'',message};
  }
}
