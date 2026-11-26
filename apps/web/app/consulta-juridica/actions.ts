'use server';

import { apiFetch } from '@/lib/api';
export type Answer={answer:string;sources:{title:string;url:string}[]};
export type Consultation={result?:Answer;error?:string};
export async function askLegal(_previous:Consultation,data:FormData):Promise<Consultation> {
  try {
    if(data.has('topic'))return {result:await apiFetch<Answer>('/consulta-ia/ejemplo',{method:'POST',body:JSON.stringify({topic:data.get('topic')})},true)};
    return {result:await apiFetch<Answer>('/consulta-ia',{method:'POST',body:JSON.stringify({
      question:data.get('question'),policyVersion:data.get('policyVersion'),authorized:data.get('authorized')==='true',
    })},true)};
  } catch(error) {
    return {error:error instanceof Error ? error.message : 'No se pudo completar la consulta. Intenta nuevamente.'};
  }
}
