'use client';
import { createContext, useContext } from 'react';
const PolicyContext = createContext({href:'',version:''});
export function PolicyProvider({value,children}:{value:{href:string;version:string};children:React.ReactNode}) {
  return <PolicyContext.Provider value={value}>{children}</PolicyContext.Provider>;
}
export function usePublishedPolicy(){return useContext(PolicyContext);}
export function ConsentField({purpose='atender mi solicitud y contactarme'}:{purpose?:string}) {
  const {href,version}=usePublishedPolicy();
  if (!version) return <output className="consentNotice">La inmobiliaria aún debe publicar su política de tratamiento de datos para habilitar el envío.</output>;
  return <div className="consentField"><input type="hidden" name="policyVersion" value={version}/>
    <label><input type="checkbox" name="authorized" value="true" required/> Autorizo a Asesoría Inmobiliaria JB a tratar mis datos para {purpose}, según su política de tratamiento.</label>
    <a className="textLink" href={href} target="_blank" rel="noopener noreferrer">Leer política de tratamiento de datos (abre otra pestaña)</a>
  </div>;
}
