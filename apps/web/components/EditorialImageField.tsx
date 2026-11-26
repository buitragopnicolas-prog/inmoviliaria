'use client';

import { useEffect, useRef, useState } from 'react';

export function EditorialImageField({name,value,label,required=false}:Readonly<{name:string;value:string;label:string;required?:boolean}>) {
  const input=useRef<HTMLInputElement>(null);
  const [selection,setSelection]=useState<File>();
  const [preview,setPreview]=useState('');
  useEffect(()=>{
    const chosen=input.current?.files?.[0];
    if(chosen)setSelection(chosen);
  },[]);
  useEffect(()=>{
    if (!selection) {setPreview('');return;}
    const url=URL.createObjectURL(selection);
    setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[selection]);
  return <>{(preview || value) && <img className="editorPreview" src={preview || value} alt={preview?'Vista previa de la imagen seleccionada':label}/>}
    <input type="hidden" name={name} value={value}/>
    <input ref={input} type="file" required={required} name={'photo-'+name} accept="image/jpeg,image/png,image/webp" onChange={event=>setSelection(event.target.files?.[0])}/></>;
}
