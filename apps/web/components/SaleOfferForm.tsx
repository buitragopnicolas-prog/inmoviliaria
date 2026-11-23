'use client';
import { useActionState, useState, useTransition } from 'react';
import Link from 'next/link';
import { saveOffer } from '@/app/admin/publishing-actions';
import { saleCatalogs, type SaleOffer } from '@/lib/sale-offers';
import { StatusNotice } from './StatusNotice';
export function SaleOfferForm({offer}:{offer?:SaleOffer}){
  const [state,action,pending]=useActionState(saveOffer,{});
  const [busy,start]=useTransition();
  const [catalog,setCatalog]=useState(offer?.catalog??'comprar');
  if(state.success) return <div><StatusNotice message={state.success} tone="success"/><Link href="/admin/ofertas">Ver ofertas</Link></div>;
  return <form className="form" onSubmit={event=>{event.preventDefault(); const form=new FormData(event.currentTarget);start(()=>action(form));}}>
    <input type="hidden" name="id" value={offer?.id??''}/><input type="hidden" name="revision" value={offer?.revision??0}/>
    <label>Catálogo<select name="catalog" value={catalog} onChange={e=>setCatalog(e.target.value as SaleOffer['catalog'])}>
      {Object.entries(saleCatalogs).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
    <label>Título<input name="title" required minLength={2} maxLength={150} defaultValue={offer?.title}/></label>
    <div className="twoCols"><label>Tipo de {catalog==='comprar'?'inmueble':'artículo'}<input name="category" required minLength={2} maxLength={80} placeholder={catalog==='comprar'?'Casa, apartamento…':'Carro, estufa…'} defaultValue={offer?.category}/></label>
    <label>Precio de venta (COP)<input name="price" type="number" min="1" max="99999999999999" step="1" required defaultValue={offer?.price}/></label></div>
    {catalog==='comprar'&&<label>Ciudad<input name="city" maxLength={100} defaultValue={offer?.city}/></label>}
    <label>Descripción<textarea name="description" rows={5} required minLength={5} maxLength={12000} defaultValue={offer?.description}/></label>
    {!!offer?.images.length && <fieldset><legend>Fotografías que deseas conservar</legend>{offer.images.map((url,i)=><label key={url}><img className="editorPreview" src={'/fotos'+url} alt={'Foto '+(i+1)}/><input type="checkbox" name="keep" value={url} defaultChecked/>Conservar foto {i+1}</label>)}</fieldset>}
    <label>Añadir fotografías<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"/><span className="hint">Hasta 10 fotos JPG, PNG o WebP de 5 MB. La primera será la portada.</span></label>
    <label><input type="checkbox" name="published" defaultChecked={offer?.published}/>Publicar en el catálogo</label>
    {state.error&&<StatusNotice tone="error" message={state.error}/>}
    <button type="submit" className="button" disabled={pending||busy} aria-busy={pending||busy}>{pending||busy?'Guardando…':'Guardar oferta'}</button>
  </form>;
}
