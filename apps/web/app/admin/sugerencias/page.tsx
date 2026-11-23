import { apiFetch } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { fecha } from '@/lib/format';

export default async function SuggestionsInbox(){
  await requireUser('ADMIN');
  const messages=await apiFetch<{id:string;message:string;createdAt:string}[]>('/admin/suggestions',{},true);
  return <><div className="pageHeading compact"><h1>Buzón de sugerencias</h1></div>
    {messages.length?messages.map(item=><article className="card formPanel" key={item.id}><time dateTime={item.createdAt}>{fecha(item.createdAt)}</time><p className="formattedCopy">{item.message}</p></article>):<p className="card empty">Todavía no hay sugerencias.</p>}</>;
}
