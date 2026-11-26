'use client';

import { useEffect, useRef, useState } from 'react';

export function EditorialImageField({name,value,label}:Readonly<{name:string;value:string;label:string}>) {
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
  return <><img className="editorPreview" src={preview || value} alt={preview?'Vista previa de la imagen seleccionada':label}/>
    <input type="hidden" name={name} value={value}/>
    <input ref={input} type="file" name={'photo-'+name} accept="image/jpeg,image/png,image/webp" onChange={event=>setSelection(event.target.files?.[0])}/></>;
}
