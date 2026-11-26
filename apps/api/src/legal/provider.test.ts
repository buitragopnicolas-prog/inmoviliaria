import {test} from 'node:test';
import assert from 'node:assert/strict';
import { consultColombianLaw } from './provider.js';

test('envía una consulta sin historial y presenta únicamente las fuentes oficiales',async context=>{
  const link='https://www.suin-juriscol.gov.co/viewDocument.asp?id=1';
  context.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const sent=JSON.parse(String(init.body));
    assert.equal(sent.store,false);
    assert.equal(sent.tool_choice,'required');
    assert.equal(sent.input,'Consulta de prueba');
    assert.ok(sent.tools[0].filters.allowed_domains.includes('suin-juriscol.gov.co'));
    return Response.json({status:'completed',output:[{type:'web_search_call'},{type:'message',content:[{
      type:'output_text',text:'Orientación de prueba.',annotations:[
        {type:'url_citation',url:link,title:'Norma'},
        {type:'url_citation',url:link,title:'Norma'},
        {type:'url_citation',url:'https://suin-juriscol.gov.co.example.com/test'},
        {type:'url_citation',url:'bad-link'}]}]}]});
  });
  assert.deepEqual(await consultColombianLaw('test','Consulta de prueba'),{answer:'Orientación de prueba.',sources:[{url:link,title:'Norma'}]});
});
test('los fallos, las respuestas parciales y la ausencia de fuentes permiten reintentar',async context=>{
  const replies=[new Response(null,{status:429}),Response.json({status:'incomplete'}),Response.json({status:'completed',output:[]})];
  context.mock.method(globalThis,'fetch',async()=>replies.shift());
  for(let i=0;i<3;i++)await assert.rejects(consultColombianLaw('test','Consulta de prueba'));
});
