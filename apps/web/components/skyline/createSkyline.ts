import { createElement } from 'react';
import { createRoot } from '@react-three/fiber';
import { Mesh, OrthographicCamera, PlaneGeometry, ShaderMaterial, TextureLoader, Vector2, WebGLRenderer } from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';
import { Flip } from 'gsap/Flip';
import { fadeIn } from '@/lib/motion';
import { skylineFragment, skylineVertex } from './shaders';
import type { SceneFocus } from './surfaceMotion';

gsap.registerPlugin(ScrollTrigger, Observer, Flip);

type Pose = {x:number; y:number; zoom:number};
export type ExperienceState = {path:string; scroll:number; street:number; camera:Pose};

function viewpoint(path: string): Pose {
  if (/^\/(inmuebles|comprar|vehiculos-y-bienes)\/[^/]+/.test(path)) return {x:.043,y:.008,zoom:1.15};
  if (path === '/') return {x:0,y:0,zoom:1};
  if (/^\/noticias(\/|$)/.test(path)) return {x:-.045,y:.012,zoom:1.09};
  if (path === '/comprar' || path === '/vehiculos-y-bienes') return {x:.039,y:-.008,zoom:1.08};
  if (path === '/contacto' || path === '/sugerencias') return {x:.016,y:-.022,zoom:1.095};
  if (path === '/pinlau') return {x:-.024,y:-.012,zoom:1.06};
  if (/^\/(mi-cuenta|admin|propietarios|clientes|arrendatarios)(\/|$)/.test(path)) return {x:-.036,y:0,zoom:1.07};
  return {x:.022,y:.005,zoom:1.045};
}

// One marker travels between links without moving a focusable element.
function navigationMarker(animate: boolean) {
  const marker = document.querySelector<HTMLElement>('.jbNavMarker');
  const nav = marker?.parentElement;
  if (!marker || !nav) return;
  const link = nav.querySelector<HTMLElement>('[aria-current="page"]');
  const previous = animate && !marker.hidden ? Flip.getState(marker) : null;
  marker.hidden = !link;
  if (!link) return;
  const anchor = link.getBoundingClientRect();
  const group = nav.getBoundingClientRect();
  marker.style.left = anchor.left-group.left+'px';
  marker.style.width = anchor.width+'px';
  if (previous) Flip.from(previous,{duration:.38,ease:'power2.out',scale:true});
}

export async function createSkyline(frame: HTMLElement, canvas: HTMLCanvasElement, state: ExperienceState, signal: AbortSignal) {
  const loader = new TextureLoader();
  const textures = await Promise.all(['cerros','ciudad','tejados'].map(name=>loader.loadAsync('/images/bogota/'+name+'.webp')));
  const freeTextures = () => textures.forEach(texture=>texture.dispose());
  if (signal.aborted) { freeTextures(); return; }
  const gl = canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});
  if (!gl) { freeTextures(); return; }

  const renderer = new WebGLRenderer({canvas,context:gl});
  const camera = Object.assign(new OrthographicCamera(-1,1,1,-1,.1,10),{manual:true});
  const root = createRoot(canvas);
  const bounds = frame.getBoundingClientRect();
  const pixelRatio = () => Math.min(devicePixelRatio || 1,1.5,Math.sqrt(2200000/(frame.clientWidth*frame.clientHeight || 1)));
  await root.configure({camera,gl:renderer,frameloop:'never',dpr:pixelRatio(),size:{width:bounds.width,height:bounds.height,top:0,left:0}});
  if (signal.aborted) { root.unmount(); freeTextures(); return; }
  const uniforms = {
    uHills:{value:textures[0]}, uCity:{value:textures[1]}, uRoofs:{value:textures[2]}, uStreetImage:{value:textures[0]},
    uExtent:{value:new Vector2(1,1)}, uSize:{value:new Vector2()}, uPointer:{value:new Vector2(-3,-3)},
    uHeat:{value:0}, uScroll:{value:0}, uStreet:{value:0}, uPhase:{value:0}, uTravel:{value:0}, uStreetAspect:{value:1.78},
  };
  const material = new ShaderMaterial({uniforms,vertexShader:skylineVertex,fragmentShader:skylineFragment,depthWrite:false,depthTest:false});
  const geometry = new PlaneGeometry(2,2);
  const plane = new Mesh(geometry,material);
  plane.frustumCulled = false;
  const store = root.render(createElement('primitive',{object:plane,dispose:null}));
  let dead = false;
  let motion = true;
  let hasStreet = false;
  let raf = 0;
  let colorTimer = 0;
  let fade: ReturnType<typeof fadeIn>;
  Object.assign(state.camera,viewpoint(state.path));
  let previousX = state.camera.x;
  const focus:SceneFocus={x:0,y:0,zoom:0};
  function onFocus(event:Event) {
    if(motion)gsap.to(focus,{...(event as CustomEvent<SceneFocus>).detail,duration:.4,overwrite:true,onUpdate:invalidate});
  }
  window.addEventListener('jb:scene-focus',onFocus);

  function draw() {
    raf = 0;
    if (dead || !motion || document.hidden || gl!.isContextLost()) return;
    if (!plane.parent) { invalidate(); return; }
    const {x,y,zoom} = state.camera;
    camera.position.set(x+state.street*.038+focus.x, y-state.scroll*.065-state.street*.027+focus.y, 2);
    camera.zoom = zoom+state.scroll*.09+state.street*.17+focus.zoom;
    camera.updateProjectionMatrix();
    uniforms.uScroll.value = state.scroll;
    uniforms.uStreet.value = hasStreet ? state.street : 0;
    uniforms.uTravel.value = gsap.utils.clamp(-.003,.003,(x-previousX)*3);
    previousX = x;
    uniforms.uPhase.value = (performance.now()/52000)%1;
    store.getState().advance(performance.now()/1000,false);
    if (frame.dataset.rendered===undefined) {
      frame.dataset.rendered='';
      fade = fadeIn(canvas);
    }
  }
  function invalidate() {
    if (!raf && motion && !dead && !document.hidden) raf=requestAnimationFrame(draw);
  }
  // The street is independent of the first city frame and shares its GPU context.
  void loader.loadAsync('/images/bogota/calle.webp').then(street=>{
    if (dead) { street.dispose(); return; }
    textures.push(street);
    uniforms.uStreetImage.value=street;
    uniforms.uStreetAspect.value=street.image.width/street.image.height;
    hasStreet=true;
    invalidate();
  }).catch(()=>{ /* The three panoramic layers remain available. */ });

  const toScroll=gsap.quickTo(state,'scroll',{duration:.32,ease:'power2.out',onUpdate:invalidate});
  const toStreet=gsap.quickTo(state,'street',{duration:.48,ease:'power2.out',onUpdate:invalidate});
  let initialScroll=true;
  let targetScroll=-1;
  let targetStreet=-1;
  function syncScroll() {
    const height=frame.clientHeight;
    const max=document.documentElement.scrollHeight-height;
    const scroll=gsap.utils.clamp(0,1,window.scrollY/Math.max(1,max));
    const footer=document.querySelector('.cityFooter')?.getBoundingClientRect();
    const street=footer ? gsap.utils.clamp(0,1,(height-footer.top)/Math.max(1,Math.min(height*.70,footer.height))) : 0;
    if (initialScroll || !motion) {
      state.scroll=scroll; state.street=street; initialScroll=false;
    } else {
      if (scroll!==targetScroll) toScroll(scroll);
      if (street!==targetStreet) toStreet(street);
    }
    targetScroll=scroll; targetStreet=street;
    invalidate();
  }
  function resize() {
    const {width,height}=frame.getBoundingClientRect();
    if (!width || !height) return;
    const aspect=width/height/3;
    uniforms.uSize.value.set(width,height);
    uniforms.uExtent.value.set(Math.min(1,aspect),Math.min(1,1/aspect));
    store.getState().setDpr(pixelRatio());
    store.getState().setSize(width,height,0,0);
    navigationMarker(false);
    syncScroll();
  }
  const context=gsap.context(()=>{},frame);
  let trigger!:ScrollTrigger;
  let input!:Observer;
  context.add(()=>{
    trigger=ScrollTrigger.create({start:0,end:'max',onUpdate:syncScroll,onRefresh:syncScroll});
    // Observe native wheel, scrollbar, touch and keyboard scroll without consuming any input.
    input=Observer.create({target:window,type:'scroll,wheel,touch',preventDefault:false,onChangeY:syncScroll});
  });
  const observer=new ResizeObserver(()=>{ resize(); trigger.refresh(); });
  observer.observe(frame);
  observer.observe(document.body);
  resize();
  const timeline=gsap.timeline({paused:true,onUpdate:invalidate});
  const heat=gsap.quickTo(uniforms.uHeat,'value',{duration:.22,ease:'power2.out',onUpdate:invalidate});
  let lit=false;
  function leave() { if (lit) { lit=false; heat(0); } }
  function pointer(event: PointerEvent) {
    if (!motion || event.pointerType==='touch') { leave(); return; }
    uniforms.uPointer.value.set(event.clientX/frame.clientWidth,1-event.clientY/frame.clientHeight);
    if (!lit) { lit=true; heat(1); }
    invalidate();
  }
  function scheduleColors() {
    clearInterval(colorTimer);
    if (!document.hidden && motion) {
      // Very slow architectural glow. Input and camera updates still use native frame timing.
      colorTimer=window.setInterval(invalidate,280);
      invalidate();
    }
  }
  function lost(event: Event) { event.preventDefault(); delete frame.dataset.rendered; }
  window.addEventListener('pointermove',pointer,{passive:true});
  document.documentElement.addEventListener('pointerleave',leave);
  window.addEventListener('blur',leave);
  document.addEventListener('visibilitychange',scheduleColors);
  canvas.addEventListener('webglcontextlost',lost);
  canvas.addEventListener('webglcontextrestored',invalidate);
  return {
    navigate(path:string) {
      gsap.killTweensOf(focus);Object.assign(focus,{x:0,y:0,zoom:0});
      if (motion) timeline.clear().to(state.camera,{...viewpoint(path),duration:.72,ease:'power2.inOut'},0).restart();
      else Object.assign(state.camera,viewpoint(path));
      navigationMarker(motion);
      trigger.refresh();
      syncScroll();
    },
    setMotion(enabled:boolean) {
      motion=enabled;
      if(!enabled){gsap.killTweensOf(focus);Object.assign(focus,{x:0,y:0,zoom:0});}
      if (enabled) { input.enable(); trigger.enable(); resize(); }
      else {
        input.disable(); trigger.disable();
        toScroll.tween.pause(); toStreet.tween.pause(); initialScroll=true;
        timeline.pause(); fade?.(); lit=false; heat.tween.pause(); uniforms.uHeat.value=0;
        delete frame.dataset.rendered;
      }
      Object.assign(state.camera,viewpoint(state.path));
      scheduleColors();
    },
    dispose() {
      dead=true; clearInterval(colorTimer); cancelAnimationFrame(raf);
      window.removeEventListener('pointermove',pointer); window.removeEventListener('blur',leave);
      document.documentElement.removeEventListener('pointerleave',leave);
      document.removeEventListener('visibilitychange',scheduleColors);
      canvas.removeEventListener('webglcontextlost',lost); canvas.removeEventListener('webglcontextrestored',invalidate);
      observer.disconnect(); context.revert(); timeline.kill(); heat.tween.kill(); toScroll.tween.kill(); toStreet.tween.kill(); fade?.();
      window.removeEventListener('jb:scene-focus',onFocus);gsap.killTweensOf(focus);
      root.unmount(); geometry.dispose(); material.dispose(); freeTextures(); renderer.dispose();
      delete frame.dataset.rendered;
    },
  };
}
