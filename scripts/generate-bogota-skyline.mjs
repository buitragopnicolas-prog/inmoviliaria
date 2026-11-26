// Original panoramic artwork. The three transparent registrations share one coordinate system.
// Run from any directory with: node scripts/generate-bogota-skyline.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = process.argv[2] || fileURLToPath(new URL('../apps/web/public/images/bogota/', import.meta.url));
await mkdir(directory, { recursive: true });
let seed = 9413;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const width = 1920;
const height = 640;
const line = (points, color, weight = 1, opacity = 1) =>
  `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${weight}" opacity="${opacity}"/>`;
const polygon = (points, fill) => `<polygon points="${points}" fill="${fill}"/>`;
const rect = (x,y,w,h,fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
async function save(name, parts) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`;
  await sharp(Buffer.from(svg)).webp({quality: 91, alphaQuality: 100, effort: 6}).toFile(`${directory}/${name}.webp`);
}
const sky = [`<defs>
  <linearGradient id="night" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#0a1a2c"/><stop offset=".52" stop-color="#293647"/><stop offset="1" stop-color="#9b856d"/></linearGradient>
  <radialGradient id="haze"><stop stop-color="#c9a77b" stop-opacity=".6"/><stop offset="1" stop-color="#c9a77b" stop-opacity="0"/></radialGradient>
  <filter id="distant"><feGaussianBlur stdDeviation="1.3"/></filter>
</defs>`, rect(0,0,width,height,'url(#night)'),
  '<ellipse cx="1365" cy="305" rx="670" ry="265" fill="url(#haze)"/>'];
for(let i=0;i<190;i++){
  sky.push(`<circle cx="${random()*width}" cy="${random()*308}" r="${.35+random()*.85}" fill="#e9dce2" opacity="${.25+random()*.48}"/>`);
}
function ridge(x, tier) {
  const east = Math.exp(-(((x-1380)/210)**2));
  const guadalupe = Math.exp(-(((x-1700)/125)**2));
  return 310 + tier*45 - east*(146-tier*28) - guadalupe*(93-tier*18) + Math.sin(x/107 + tier)*22 + Math.cos(x/46 + tier)*9
    + Math.sin(x/12)*2 + Math.sin(x*.21+tier)*1.5;
}
for(let tier=0;tier<3;tier++){
  const points=Array.from({length:241},(_,i)=>`${i*8},${ridge(i*8,tier).toFixed(1)}`).join(' ');
  sky.push(`<g filter="url(#distant)">`, polygon(`0,640 ${points} 1920,640`,['#515667','#34465e','#243b52'][tier]),
    line(points,['#bfad97','#708496','#587287'][tier],1.8,.8),'</g>');
  // Folds descend from each ridge in the same direction as the evening light.
  for (let x=-25;x<width;x+=23+random()*46) {
    const y=ridge(x,tier)+2, drop=30+random()*54, dx=28+random()*65;
    sky.push(`<path d="M${x} ${y}q${dx*.3} ${drop*.12} ${dx*.54} ${drop*.58}t${dx*.68} ${drop*.54}q-${dx*.78} -${drop*.28} -${dx*1.22} -${drop*1.12}" fill="#162c46" opacity=".17"/>`);
  }
}
// Monserrate: white basilica, central tower and cross on the eastern ridge.
const chapelX=1400, chapelY=ridge(chapelX,0);
sky.push(`<g transform="translate(${chapelX} ${chapelY})" fill="#eadac5">
  <path d="M-15 0v-5l6-5 6 5v-8l3-5 3 5v8l6-4 8 6v3z"/><path d="M0-17v-6m-2 2h4" fill="none" stroke="#f3dbc3" stroke-width="1.2"/>
  <path d="M-10 0v-3m12 3v-4m5 4v-3" stroke="#545464"/></g>`,
  // The second summit carries the small pale silhouette of the statue on Guadalupe.
  `<g transform="translate(1700 ${ridge(1700,0)})" fill="#cec1ae"><path d="M-5 0h10v-2H2L1-10h-2l-1 8h-3z"/><circle cy="-11" r="1.4"/></g>`);
for(let i=0;i<1000;i++){
  const x=random()*width, y=ridge(x,2)+random()*135;
  sky.push(rect(x,y,1+random()*2,.8,random()<.35?'#e5aa77':'#7d9d9b'));
}
await save('cerros',sky);

const city=[`<defs>
  <linearGradient id="facade" x2="0" y2="1"><stop stop-color="#b87a72" stop-opacity=".45"/><stop offset=".75" stop-color="#1c2439" stop-opacity=".52"/></linearGradient>
  <pattern id="courses" width="13" height="7" patternUnits="userSpaceOnUse"><path d="M0 .4h13m-13 3.5h13M3 0v3.5m7 .1v3.4" stroke="#dcb092" stroke-width=".6" opacity=".32"/></pattern>
</defs>`];
function windowColor(){
  if(random()<.24)return '#dba97c';
  return random()<.32?'#79a5a7':'#25384a';
}
function windows(x,top,base,w,side,rise,glass){
  const step=glass?11:14;
  const pitch=glass?8:12, windowWidth=glass?4:6, windowHeight=glass?3:5;
  for(let y=top+7;y<base-3;y+=step){
    city.push(line(`${x},${y+3} ${x+w},${y+3} ${x+w+side},${y+3-rise}`,glass?'#53808b':'#bb7771',.9,.58));
    for(let offset=4;offset<w-5;offset+=pitch){
      city.push(rect(x+offset,y,windowWidth,windowHeight,windowColor()));
    }
    for(let s=4;s<side-2;s+=8) city.push(rect(x+w+s,y-s*.42,3,3,random()<.2?'#ad8c74':'#4c6471'));
  }
}
function building(x, base, w, h, side, style = 'brick') {
  const top=base-h, rise=side*.42;
  const glass=style==='glass';
  const brick=['#653941','#75464a','#563740','#61414c'][Math.floor(random()*4)];
  const face=glass?'#254455':brick;
  const facade=`${x},${top} ${x+w},${top} ${x+w},${base} ${x},${base}`;
  city.push(polygon(facade,face),polygon(facade,'url(#facade)'),
    polygon(`${x+w},${top} ${x+w+side},${top-rise} ${x+w+side},${base-rise} ${x+w},${base}`,glass?'#193044':'#332d40'),
    polygon(`${x},${top} ${x+side},${top-rise} ${x+w+side},${top-rise} ${x+w},${top}`,glass?'#66848b':'#926366'));
  if (!glass) city.push(polygon(facade,'url(#courses)'));
  if (h<200 && random()<.40) {
    const tank=x+w*.51;
    city.push(rect(tank,top-rise-6,9,7,'#435366'),line(`${tank-2},${top-rise-6} ${tank+10},${top-rise-6}`,'#9babac',1.2));
  }
  windows(x,top,base,w,side,rise,glass);
  const outline=`${x},${base} ${x},${top} ${x+side},${top-rise} ${x+w+side},${top-rise}`;
  city.push(line(outline,'#c9a77b',6,.13),line(outline,'#eed5ae',1.7,.94),
    line(`${x},${top} ${x+w},${top} ${x+w+side},${top-rise}`,'#d9bc92',1.2,.82),
    line(`${x+w},${top} ${x+w},${base}`,'#68cdd7',1.1,.85));
}
for(let x=-35;x<width;x+=32+random()*18) building(x,520,30+random()*33,48+random()*93,10);
// Downtown landmarks anchor the composition at different scales.
building(828,522,35,208,17,'glass');
building(871,523,40,240,17,'glass');
building(878,285,29,14,13,'glass');
building(1024,527,54,285,21);
building(1029,242,42,10,18,'glass');
city.push(line('1051,233 1051,193','#c8e6db',1.8),line('1031,236 1072,236 1090,229','#ed8b87',2.6));
building(1180,537,56,224,20,'glass');
city.push(polygon('1180,313 1217,281 1256,305 1236,313','#396073'),
  line('1180,313 1217,281 1256,305','#94eeea',2));
for(let x=-45;x<width;x+=51+random()*25) building(x,593,48+random()*38,64+random()*95,15+random()*11);
await save('ciudad',city);

const roofs=[polygon('0,585 1920,570 1920,640 0,640','#211e37')];
for(let x=-135;x<width;x+=103+random()*80){
  const w=100+random()*123, y=492+random()*90, depth=23+random()*30, pitch=18+random()*22;
  const crest=x+w*.32;
  roofs.push(polygon(`${x},${y+pitch} ${crest},${y} ${x+w},${y+pitch} ${x+w},640 ${x},640`,'#2c263e'),
    polygon(`${crest},${y} ${crest+depth},${y-12} ${x+w+depth},${y+pitch-12} ${x+w},${y+pitch}`,'#554044'),
    polygon(`${x+w},${y+pitch} ${x+w+depth},${y+pitch-12} ${x+w+depth},640 ${x+w},640`,'#211e33'),
    line(`${x},${y+pitch} ${crest},${y} ${crest+depth},${y-12} ${x+w+depth},${y+pitch-12}`,'#c9a77b',7,.15),
    line(`${x},${y+pitch} ${crest},${y} ${crest+depth},${y-12} ${x+w+depth},${y+pitch-12}`,'#c9a77b',2.3),
    line(`${crest},${y} ${x+w},${y+pitch} ${x+w+depth},${y+pitch-12}`,'#e3c9a4',1.4));
  for(let s=8;s<w*.65;s+=9) roofs.push(line(`${crest+s},${y+s*pitch/(w*.68)} ${crest+depth+s},${y+s*pitch/(w*.68)-12}`,'#9c795f',1,.62));
  for(let s=10;s<w-8;s+=18) roofs.push(rect(x+s,y+pitch+16,7,11,random()<.23?'#c6a17e':'#49374f'));
}
await save('tejados',roofs);
