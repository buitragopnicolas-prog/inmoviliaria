'use client';
import { useState, useTransition } from 'react';
import { saveListing } from '@/app/propietarios/publicaciones/actions';
import { propertyPhotoUrl } from '@/lib/format';
import { ConsentField, usePublishedPolicy } from './ConsentField';
import { StatusNotice } from './StatusNotice';
export type OwnerListing={id:string;operation:'sale'|'rent';title:string;description:string;category:string;city:string;address:string;neighborhood:string;bedrooms:number;features:string[];price:string;images:string[];published:boolean;revision:number;slug?:string;status?:string};
export function OwnerListingForm({item}:{item?:OwnerListing}) {
  const [state,setState]=useState({error:''});
  const [pending,start]=useTransition();
  const policy=usePublishedPolicy();
  return <form className="form card formPanel" onSubmit={e=>{
    e.preventDefault();
    if(pending) return;
    const data=new FormData(e.currentTarget);
    start(async()=>{setState(await saveListing(state,data));});
  }}>
    <h2>{item?'Editar publicación':'Inscribir un inmueble'}</h2>
    {item ? <><input type="hidden" name="id" value={item.id}/><input type="hidden" name="revision" value={item.revision}/><input type="hidden" name="operation" value={item.operation}/></> :
      <label>Operación<select name="operation"><option value="rent">Arriendo</option><option value="sale">Venta</option></select></label>}
    <label>Título del anuncio<input name="title" required minLength={3} maxLength={150} defaultValue={item?.title}/></label>
    <div className="twoCols"><label>Tipo de inmueble<input name="category" required minLength={2} maxLength={80} defaultValue={item?.category} placeholder="Casa, apartamento, local…"/></label>
    <label>Precio en COP<input name="price" type="number" min="1" max="99999999999999" required defaultValue={item?.price}/></label></div>
    <div className="twoCols"><label>Ciudad<input name="city" required minLength={2} maxLength={100} defaultValue={item?.city}/></label>
    <label>Barrio o sector<input name="neighborhood" required minLength={2} maxLength={120} defaultValue={item?.neighborhood}/></label></div>
    <label>Dirección que aparecerá en la ficha<input name="address" required minLength={3} maxLength={200} defaultValue={item?.address}/></label>
    <label>Habitaciones<input name="bedrooms" type="number" min="0" max="99" required defaultValue={item?.bedrooms}/></label>
    <label>Características separadas por comas<input name="features" maxLength={1500} defaultValue={item?.features.join(', ')} placeholder="Balcón, parqueadero, ascensor…"/></label>
    <label>Descripción<textarea name="description" required minLength={10} maxLength={4000} defaultValue={item?.description} rows={5}/></label>
    {item && <div className="ownerPhotos">{item.images.map((src,i)=><img key={src} src={propertyPhotoUrl(src)+'?propia=1'} alt={'Fotografía actual '+(i+1)}/>)}</div>}
    <label>{item?'Reemplazar fotografías':'Fotografías'}<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple/></label>
    <small>Hasta 8 fotos de 5 MB cada una. Para publicar se requiere al menos una.</small>
    <label>Visibilidad<select name="published" defaultValue={String(item?.published??false)}><option value="false">Guardar como borrador</option><option value="true">Publicar en el catálogo</option></select></label>
    <ConsentField purpose="administrar mi anuncio y mostrar la ficha y las fotografías cuando elija publicar"/>{state.error && <StatusNotice message={state.error} tone="error"/>}
    <button className="button" disabled={pending || !policy.version}>{pending?'Guardando…':'Guardar publicación'}</button>
  </form>;
}
