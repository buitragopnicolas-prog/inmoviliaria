import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

test('las capas del skyline conservan tamaño, transparencia y composición de la marca',async t=>{
  const output=await mkdtemp(join(tmpdir(),'jb-skyline-'));
  t.after(()=>rm(output,{recursive:true,force:true}));
  execFileSync(process.execPath,['scripts/generate-bogota-skyline.mjs',output],{windowsHide:true});
  for(const name of ['cerros','ciudad','tejados']){
    const generated=sharp(await readFile(join(output,name+'.webp')));
    const {width,height,hasAlpha}=await generated.metadata();
    assert.deepEqual([width,height,hasAlpha],[1920,640,name!=='cerros']);
    const thumbnail=image=>image.resize(48,16).ensureAlpha().raw().toBuffer();
    const reference=await thumbnail(sharp('apps/web/public/images/bogota/'+name+'.webp'));
    const actual=await thumbnail(generated);
    const meanDifference=actual.reduce((sum,value,i)=>sum+Math.abs(value-reference[i]),0)/actual.length;
    assert.ok(meanDifference<3,'Cambió la composición de la capa '+name);
  }
});
