'use strict';
/* ScènePlan: application indépendante, code source original. Aucun SDK ou élément ArrangeUs. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const clone=x=>JSON.parse(JSON.stringify(x));
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=t=>{t=Math.max(0,Math.floor(Number(t)||0));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`};
const fmtDec=t=>{const tenths=Math.round(Math.max(0,Number(t)||0)*10);return `${Math.floor(tenths/600)}:${String(Math.floor(tenths/10)%60).padStart(2,'0')}.${tenths%10}`};
const roundTime=t=>Math.round(t*100)/100;
const COLOR=['#ff477e','#5cc8ff','#ffcb62','#6fe3b1','#ae8aff','#ff986c','#f38bd8','#89e5e4'];
const audio=new Audio();audio.preload='metadata';
const S={db:null,proj:null,active:0,selected:new Set(),selectedProp:null,tab:'selection',view3d:false,ghost:true,paths:false,time:0,playing:false,raf:null,lastFrame:0,musicUrl:null,musicBlob:null,waveSamples:null,undo:[],redo:[],drag:null,dragTime:null,viewport:{x:-6,y:0,w:132,h:96},pointers:new Map(),pinch:null,previewTime:false,timingIndex:0,dragWave:false,ignoreTimelineClick:false,stageTool:"move",posClipboard:null,inspectorOpen:false,layoutMode:'placement',focusReturnMode:'placement',toolsOpen:false,fitBase:null,allProjects:[],sort:'updated',filter:'active',projectSearch:'',volatile:false,openingId:null};
/* Storage migration: never delete or overwrite earlier IndexedDB projects.
   If browser policy disallows IndexedDB (frequent with downloaded HTML on mobile),
   allow manual file import/editing in a TEMPORARY in-memory session. */
const volatileStores={projects:new Map(),media:new Map(),library:new Map()};
function idb(){return new Promise((res,rej)=>{if(typeof indexedDB==='undefined')return rej(Error('IndexedDB non disponible'));let req;try{req=indexedDB.open('sceneplan-web',3)}catch(e){return rej(e)}req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});if(!db.objectStoreNames.contains('media'))db.createObjectStore('media',{keyPath:'id'});if(!db.objectStoreNames.contains('library'))db.createObjectStore('library',{keyPath:'id'})};req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error||Error('IndexedDB inaccessible'));req.onblocked=()=>rej(Error('Un autre onglet bloque la mise à niveau du stockage'))})}
function dbget(store,key){if(S.db?.volatile)return Promise.resolve(volatileStores[store].get(key));return new Promise((res,rej)=>{const tx=S.db.transaction(store,'readonly'),req=tx.objectStore(store).get(key);req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dball(store){if(S.db?.volatile)return Promise.resolve([...volatileStores[store].values()]);return new Promise((res,rej)=>{const tx=S.db.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)})}
function dbput(store,obj){if(S.db?.volatile){volatileStores[store].set(obj.id,obj);return Promise.resolve()}return new Promise((res,rej)=>{const tx=S.db.transaction(store,'readwrite');tx.objectStore(store).put(obj);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
function dbdel(store,key){if(S.db?.volatile){volatileStores[store].delete(key);return Promise.resolve()}return new Promise((res,rej)=>{const tx=S.db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
function getLastProjectId(){try{return localStorage.getItem('sceneplan-active')}catch(e){return null}}
function setLastProjectId(id){try{localStorage.setItem('sceneplan-active',id)}catch(e){console.warn('LocalStorage bloqué, ouverture du projet maintenue',e)}}
function updateStorageStatus(){const el=$('#saveStatus');if(el&&S.volatile){el.textContent='Mode temporaire : exporter pour conserver';el.title='Le navigateur bloque le stockage. Exportez régulièrement votre projet en JSON.'}}
async function flushPendingSave(){if(saveSoon.timer&&S.proj){clearTimeout(saveSoon.timer);saveSoon.timer=null;S.proj.updated=Date.now();await dbput('projects',S.proj)}}
function newProject(name='Nouveau spectacle',n=8){const dancers=Array.from({length:n},(_,i)=>({id:uid(),name:`Artiste ${i+1}`,short:`${i+1}`}));const positions={},appear={};dancers.forEach((d,i)=>{positions[d.id]={x: .15+(i%4)*.235,y:.28+Math.floor(i/4)*.37};appear[d.id]={color:COLOR[i%COLOR.length],shape:'circle'}});return {schema:1,id:uid(),name,description:'',status:'active',tags:[],created:Date.now(),updated:Date.now(),stage:{w:7,d:2.5,grid:0.5,units:'m',physicalVerified:true,snap:true,showGrid:true,wingLeft:.14,wingRight:.14,bg:null,bgFit:'cover'},dancers,forms:[{id:uid(),name:'Départ',color:'#ff477e',hold:6,transition:3,note:'',positions,appear,props:[],curves:{}}]}}
function form(){return S.proj.forms[S.active]}
// Imported ArrangeUs grid coordinates are NOT certified physical metres.
// Keep all normalized coordinates; only a deliberate user setting provides real dimensions.
function normalizeStageUnits(project){
 const s=project?.stage;
 if(!s)return;
 if(project.source?.format==='ArrangeUs .arrus' && (s.units==='cases'||s.approximateMeters===true)){
   s.units='repères';s.approximateMeters=false;s.physicalVerified=false;s.snapMode='center';
   s.grid=Math.max(.01,Number(s.grid)||1);
 }
 if(s.units==='m'&&!project.source?.format) s.physicalVerified=true;
}
function stageUnitLabel(s){return s.units==='m'?'m':'repères ArrangeUs'}
function stageNumber(n){return Number(n).toLocaleString('fr-FR',{maximumFractionDigits:2})}
// All scene primitives share the same coordinate scale in x and y.
// The entire physical rectangle fits inside the existing SVG viewport.
function stageGeometry(s=S.proj.stage){
 const w=Math.max(.25,Number(s.w)||7),d=Math.max(.25,Number(s.d)||2.5);
 const scale=Math.min(100/w,64/d);
 const width=w*scale,height=d*scale;
 return {x:10+(100-width)/2,y:14+(64-height)/2,width,height,scale,w,d};
}
function sceneXY(x,y,g=stageGeometry()){return {x:g.x+x*g.width,y:g.y+y*g.height}}

function lengthOf(p=S.proj){if(!p)return 0;return p.forms.reduce((n,f,i)=>n+(Math.max(0,+f.hold||0))+(i<p.forms.length-1?Math.max(0,+f.transition||0):0),0)}
function audioLength(){return S.musicBlob&&Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:0}
function playbackEnd(){return Math.max(lengthOf(),audioLength(),.01)}
function startOfForm(index){let t=0;for(let i=0;i<index;i++)t+=Math.max(0,+S.proj.forms[i].hold||0)+Math.max(0,+S.proj.forms[i].transition||0);return t}
function timingPhase(t=S.time){const l=locAt(t);return l.next===l.index?'Placement fixe':'Transition vers le tableau '+(l.next+1)}
function quantizedDuration(value){let n=Math.max(0,Number(value)||0);if(S.proj.music?.beatSnap){const beat=60/(+S.proj.music.bpm||120);n=Math.round(n/beat)*beat}return roundTime(n)}
function locAt(t,p=S.proj){let off=0;for(let i=0;i<p.forms.length;i++){let f=p.forms[i],hold=Math.max(0,+f.hold||0),transition=i<p.forms.length-1?Math.max(0,+f.transition||0):0;if(t<=off+hold||i===p.forms.length-1)return {index:i,next:i,fraction:0};off+=hold;if(t<=off+transition)return {index:i,next:i+1,fraction:transition?(t-off)/transition:1};off+=transition}return {index:p.forms.length-1,next:p.forms.length-1,fraction:0}}
function pos(did,index=S.active){const f=S.proj.forms[index];return f.positions[did]||{x:-.08,y:.5}}
function appearance(did,index=S.active){return S.proj.forms[index].appear[did]||{color:'#ff477e',shape:'circle'}}
function atCurve(a,b,ctrl,t){if(!ctrl)return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};const u=1-t;return {x:u*u*a.x+2*u*t*ctrl.x+t*t*b.x,y:u*u*a.y+2*u*t*ctrl.y+t*t*b.y}}
function renderPos(did){if(!S.playing && !S.previewTime)return pos(did);const r=locAt(S.time),a=pos(did,r.index),b=pos(did,r.next);return atCurve(a,b,S.proj.forms[r.index].curves?.[did],r.fraction)}
function saveSoon(){clearTimeout(saveSoon.timer);if(!S.volatile)$('#saveStatus').textContent='Enregistrement…';saveSoon.timer=setTimeout(async()=>{try{if(!S.proj)return;S.proj.updated=Date.now();await dbput('projects',S.proj);$('#saveStatus').textContent=S.volatile?'Mode temporaire : exporter pour conserver':'Enregistré localement'}catch(e){$('#saveStatus').textContent='Erreur de sauvegarde — exporter le projet';console.error(e)}},320)}
function mutate(fn){if(!S.proj)return;const before=JSON.stringify(S.proj);fn();if(JSON.stringify(S.proj)!==before){S.undo.push(before);if(S.undo.length>90)S.undo.shift();S.redo=[];saveSoon()}render()}
function undo(){if(!S.undo.length)return;S.redo.push(JSON.stringify(S.proj));S.proj=JSON.parse(S.undo.pop());S.active=clamp(S.active,0,S.proj.forms.length-1);S.selected.clear();S.selectedProp=null;S.previewTime=false;S.timingIndex=clamp(S.timingIndex,0,S.proj.forms.length-1);saveSoon();render()}
function redo(){if(!S.redo.length)return;S.undo.push(JSON.stringify(S.proj));S.proj=JSON.parse(S.redo.pop());S.active=clamp(S.active,0,S.proj.forms.length-1);S.selected.clear();S.selectedProp=null;S.previewTime=false;S.timingIndex=clamp(S.timingIndex,0,S.proj.forms.length-1);saveSoon();render()}
async function openProject(id){
 try{
  // A pending debounced save must finish before switching projects, otherwise
  // edits can be silently lost when opening a different project.
  await flushPendingSave();
  const p=await dbget('projects',id);
  if(!p)throw Error('Projet introuvable dans le stockage de ce navigateur. Réimporte ton fichier .arrus ou .sceneplan.json.');
  if(!Array.isArray(p.forms)||p.forms.length===0||!Array.isArray(p.dancers)||!p.stage)throw Error('Données de projet incomplètes');
  stopPlay();normalizeStageUnits(p);S.proj=p;S.active=0;S.time=0;S.selected.clear();S.selectedProp=null;S.undo=[];S.redo=[];S.pointers.clear();S.pinch=null;S.previewTime=false;S.dragWave=false;S.timingIndex=0;
  resetZoom();setLastProjectId(id);
  // Lost/missing audio must NEVER prevent opening an otherwise valid project.
  try{await loadStoredAudio()}catch(err){console.warn('Musique indisponible pour ce projet',err);S.musicBlob=null;S.waveSamples=null}
  closeModal();render();fitStage(false);updateStorageStatus();
  return true;
 }catch(e){console.error('Ouverture impossible',e);alert('Ouverture impossible : '+e.message);return false}
}
// Modes d'interface : ne touchent jamais aux données des spectacles.
function setInspector(open){S.inspectorOpen=!!open;const space=$('#workspace');space.classList.toggle('inspector-visible',S.inspectorOpen);$('#inspector').classList.toggle('open',S.inspectorOpen);const button=$('#inspectorToggle');if(button)button.setAttribute('aria-expanded',String(S.inspectorOpen));scheduleStageFit()}
function setTools(open){S.toolsOpen=!!open;$('#workspace').classList.toggle('tools-visible',S.toolsOpen);const button=$('#toolsToggle');if(button)button.setAttribute('aria-expanded',String(S.toolsOpen));scheduleStageFit()}
function setLayoutMode(mode){if(!['placement','sync','focus'].includes(mode))return;
 if(mode!=='focus')S.focusReturnMode=mode;
 if(mode==='focus'){S.focusReturnMode=S.layoutMode==='focus'?S.focusReturnMode:S.layoutMode;setInspector(false);setTools(false)}
 S.layoutMode=mode;
 const space=$('#workspace');space.classList.toggle('layout-placement',mode==='placement');space.classList.toggle('layout-sync',mode==='sync');space.classList.toggle('layout-focus',mode==='focus');
 $('#modePlacement').classList.toggle('active',mode==='placement');$('#modeSync').classList.toggle('active',mode==='sync');
 $('#modePlacement').setAttribute('aria-pressed',String(mode==='placement'));$('#modeSync').setAttribute('aria-pressed',String(mode==='sync'));
 $('#focusToggle').setAttribute('aria-pressed',String(mode==='focus'));
 if(mode==='sync')$('#timingDetails').open=true;
 if(mode==='placement')$('#timingDetails').open=false;
 scheduleStageFit();
}
function toggleFocus(){setLayoutMode(S.layoutMode==='focus'?S.focusReturnMode:'focus')}
let fitFrame=0;
function scheduleStageFit(){cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(()=>{if(!S.proj)return;fitStage(true);if(S.view3d)draw3d();drawWave()})}
function render(){if(!S.proj)return;$('#projectName').textContent=S.proj.name;$('#activeFormationTitle').textContent=form().name;$('#stageInfo').textContent=`${stageNumber(S.proj.stage.w)} × ${stageNumber(S.proj.stage.d)} ${stageUnitLabel(S.proj.stage)}`;
 $('#footerCount').textContent=`${S.proj.dancers.length} artistes · ${S.proj.forms.length} tableaux`;
 updateViewLabel();$('#viewToggle').classList.toggle('active',S.view3d);$('#ghostToggle').classList.toggle('active',S.ghost);$('#pathsToggle').classList.toggle('active',S.paths);
 $('#scene2d').classList.toggle('hidden',S.view3d);$('#scene3d').classList.toggle('hidden',!S.view3d);$('#viewToggle span').textContent=S.view3d?'Vue 2D':'Vue 3D';
 renderStage();renderTimeline();renderInspector();if(S.view3d)draw3d();drawWave()}
function stageMarkup(idx=S.active,print=false){
 const p=S.proj,f=p.forms[idx],s=p.stage,g=stageGeometry(s),a=sceneXY;
 const X=v=>g.x+v*g.width,Y=v=>g.y+v*g.height;
 let str=`<rect x="-6" y="0" width="132" height="96" fill="${print?'#f6f7f9':'#11182a'}"/>`;
 // Wings stay proportional to the stage bounds, not to the viewport.
 const wing=Math.min(10,g.width*.1);
 str+=`<rect x="${g.x-wing}" y="${g.y}" width="${wing}" height="${g.height}" fill="#2c2538" stroke="#52405b" stroke-width=".4"/><rect x="${g.x+g.width}" y="${g.y}" width="${wing}" height="${g.height}" fill="#2c2538" stroke="#52405b" stroke-width=".4"/>`;
 str+=`<rect data-stage-rect="true" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="${print?'#e8ecf4':'#253053'}" stroke="${print?'#111':'#ff477e'}" stroke-width=".7"/>`;
 if(s.bg)str+=`<image href="${safe(s.bg)}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" preserveAspectRatio="${s.bgFit==='contain'?'xMidYMid meet':s.bgFit==='stretch'?'none':'xMidYMid slice'}" opacity=".65" pointer-events="none"/>`;
 const step=Math.max(.01,Number(s.grid)||1);
 if(s.showGrid!==false){
  // Each line is placed at an actual distance (step), no rounding to fit the canvas.
  // This guarantees square cells in displayed world coordinates.
  for(let n=step;n<g.w-1e-6&&n/step<300;n+=step)str+=`<line data-grid="x" x1="${g.x+n*g.scale}" y1="${g.y}" x2="${g.x+n*g.scale}" y2="${g.y+g.height}" stroke="${print?'#9da8bc':'#afc6e5'}" stroke-width=".25" opacity=".37" pointer-events="none"/>`;
  for(let n=step;n<g.d-1e-6&&n/step<300;n+=step)str+=`<line data-grid="y" x1="${g.x}" y1="${g.y+n*g.scale}" x2="${g.x+g.width}" y2="${g.y+n*g.scale}" stroke="${print?'#9da8bc':'#afc6e5'}" stroke-width=".25" opacity=".37" pointer-events="none"/>`;
  if(s.units==='m'){
   const tick=(n)=>n<=10?1:n<=25?2:n<=60?5:10;
   for(let n=0;n<=g.w+1e-5;n+=tick(g.w))str+=`<text x="${g.x+n*g.scale}" y="${g.y-1.5}" text-anchor="middle" font-size="2" fill="#c5d9f2" pointer-events="none">${stageNumber(n)}</text>`;
   for(let n=0;n<=g.d+1e-5;n+=tick(g.d))str+=`<text x="${g.x-1.5}" y="${g.y+n*g.scale+.7}" text-anchor="end" font-size="2" fill="#c5d9f2" pointer-events="none">${stageNumber(n)}</text>`;
  }
 }
 str+=`<text x="${g.x+g.width/2}" y="${g.y-7}" text-anchor="middle" font-size="3" fill="${print?'#444':'#a1acc6'}" letter-spacing="1" pointer-events="none">FOND DE SCÈNE</text><text x="${g.x+g.width/2}" y="${g.y+g.height+9}" text-anchor="middle" font-size="3.2" fill="${print?'#444':'#b6c9e5'}" letter-spacing="1" pointer-events="none">PUBLIC</text>`;
 if(!print&&S.paths&&idx<p.forms.length-1){
  for(const d of p.dancers){const from=pos(d.id,idx),to=pos(d.id,idx+1),ctrl=f.curves?.[d.id];
   str+=`<path d="M${X(from.x)},${Y(from.y)} ${ctrl?`Q${X(ctrl.x)},${Y(ctrl.y)}`:''} ${X(to.x)},${Y(to.y)}" fill="none" stroke="#f9df91" stroke-width=".65" stroke-dasharray="1.7 1.5" opacity=".85" pointer-events="none"/>`;
   if(ctrl)str+=`<circle class="stage-handles" data-handle="${safe(d.id)}" cx="${X(ctrl.x)}" cy="${Y(ctrl.y)}" r="2" fill="#ffd76a" stroke="#15192b" stroke-width=".7"/>`;
  }
 }
 if(!print&&S.ghost&&idx<p.forms.length-1){for(const d of p.dancers){const b=pos(d.id,idx+1),app=appearance(d.id,idx+1);str+=`<circle cx="${X(b.x)}" cy="${Y(b.y)}" r="2.9" stroke="${app.color}" stroke-width=".7" stroke-dasharray="1.2 1.1" fill="none" opacity=".65" pointer-events="none"/>`}}
 for(const o of f.props||[]){
  const x=X(o.x),y=Y(o.y),w=(o.w||.1)*g.width,h=(o.h||.1)*g.height;
  const shape=o.shape==='circle'?`<ellipse cx="0" cy="0" rx="${w/2}" ry="${h/2}"/>`:o.shape==='triangle'?`<polygon points="0,${-h/2} ${w/2},${h/2} ${-w/2},${h/2}"/>`:o.shape==='line'?`<path d="M${-w/2},0 L${w/2},0" fill="none" stroke-width="2"/>`:`<rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="1"/>`;
  str+=`<g class="prop-point" data-prop="${safe(o.id)}" transform="translate(${x} ${y}) rotate(${o.rotation||0})" fill="${o.color||'#ffcf65'}" stroke="${S.selectedProp===o.id?'#fff':'#151724'}" stroke-width="${S.selectedProp===o.id?1.2:.7}" opacity="${o.opacity??.7}">${shape}</g>`;
  if(!print&&S.selectedProp===o.id)str+=`<circle class="prop-grip" data-prop-handle="size" data-prop="${safe(o.id)}" cx="${x+w/2+3}" cy="${y+h/2+3}" r="2.6" fill="#63c8ff" stroke="#111827" stroke-width=".6"/><circle class="prop-grip" data-prop-handle="rotate" data-prop="${safe(o.id)}" cx="${x}" cy="${y-h/2-6}" r="2.6" fill="#ffca63" stroke="#111827" stroke-width=".6"/>`;
 }
 for(const d of p.dancers){
  const pt=(!print&&(S.playing||S.previewTime))?renderPos(d.id):pos(d.id,idx),app=appearance(d.id,(!print&&(S.playing||S.previewTime))?locAt(S.time).index:idx),x=X(pt.x),y=Y(pt.y),sel=!print&&S.selected.has(d.id),r=3;
  const shape=app.shape==='square'?`<rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" rx=".6"/>`:app.shape==='triangle'?`<polygon points="0,-3.8 3.6,2.9 -3.6,2.9"/>`:app.shape==='diamond'?`<polygon points="0,-4 4,0 0,4 -4,0"/>`:`<circle r="${r}"/>`;
  str+=`<g class="dancer-point" data-dancer="${safe(d.id)}" transform="translate(${x} ${y})"><circle r="${sel?5.1:3.7}" fill="${sel?'#fff':'#111627'}" opacity="${sel?'1':'.75'}"/>`+`<g fill="${app.color}" stroke="${sel?'#ffffff':'#0b1121'}" stroke-width="${sel?.8:.55}">${shape}</g>`+`<text y=".9" font-size="${String(d.short).length>2?2.1:2.5}" text-anchor="middle" fill="#0b1220" font-weight="800" pointer-events="none">${safe(d.short)}</text>`+`<text y="7.1" font-size="2.3" text-anchor="middle" fill="${print?'#111':'#f1f5ff'}" stroke="${print?'#f6f7f9':'#182038'}" stroke-width=".4" paint-order="stroke" pointer-events="none">${safe(d.name)}</text></g>`;
 }
 if(!print&&S.drag?.kind==='marquee'&&S.drag.current){const from=S.drag.start,to=S.drag.current,x=X(Math.min(from.x,to.x)),y=Y(Math.min(from.y,to.y)),w=Math.abs(from.x-to.x)*g.width,h=Math.abs(from.y-to.y)*g.height;str+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#5cc8ff" fill-opacity=".16" stroke="#5cc8ff" stroke-width=".65" stroke-dasharray="1.4 1.4" pointer-events="none"/>`}
 return str;
}
function renderStage(){$('#stageContents').innerHTML=stageMarkup();applyViewport();updateSelectionQuickbar()}
function updateSelectionQuickbar(){
 const bar=$('#selectionQuickbar');if(!bar)return;
 const amount=S.selected.size;bar.classList.toggle('hidden',!amount||S.view3d);
 $('#selectionQuickCount').textContent=amount===1?'1 artiste':`${amount} artistes`;
 const align=$('#quickAlign');if(align)align.disabled=amount<2;
}
// Move selected artists one real grid step, not one arbitrary fraction of the screen.
// A single shared delta preserves the formation of a selected group.
function shiftSelection(dir){
 const ids=[...S.selected].filter(id=>form().positions[id]);if(!ids.length)return;
 const s=S.proj.stage,unit=Math.max(.01,Number(s.grid)||.5);
 const dx=dir==='left'?-unit/s.w:dir==='right'?unit/s.w:0;
 const dy=dir==='up'?-unit/s.d:dir==='down'?unit/s.d:0;
 const points=ids.map(id=>pos(id));
 const xdelta=clamp(dx,Math.max(...points.map(p=>-.12-p.x)),Math.min(...points.map(p=>1.12-p.x)));
 const ydelta=clamp(dy,Math.max(...points.map(p=>-p.y)),Math.min(...points.map(p=>1-p.y)));
 if(!xdelta&&!ydelta)return;
 mutate(()=>ids.forEach(id=>{const p=form().positions[id];p.x=+(p.x+xdelta).toFixed(9);p.y=+(p.y+ydelta).toFixed(9)}));
}
function alignSelection(kind){
 const ids=[...S.selected].filter(id=>form().positions[id]);if(ids.length<2)return;
 mutate(()=>{
  const pts=ids.map(id=>({id,p:pos(id)}));
  const xs=pts.map(a=>a.p.x),ys=pts.map(a=>a.p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  if(kind.startsWith('distribute')){
   if(pts.length<3)return;
   const horizontal=kind==='distributeX',key=horizontal?'x':'y';
   pts.sort((a,b)=>a.p[key]-b.p[key]);const first=pts[0].p[key],last=pts[pts.length-1].p[key];
   pts.slice(1,-1).forEach((a,i)=>{form().positions[a.id][key]=first+(last-first)*(i+1)/(pts.length-1)});
  }else{
   const key=['left','right','centerX'].includes(kind)?'x':'y';
   const v=kind==='left'?minX:kind==='right'?maxX:kind==='top'?minY:kind==='bottom'?maxY:kind==='centerX'?(minX+maxX)/2:(minY+maxY)/2;
   ids.forEach(id=>{form().positions[id][key]=v});
  }
 });
}
function showAlignMenu(){
 if(S.selected.size<2)return;
 openModal(`Aligner ${S.selected.size} artistes`,
 '<p class="help-text">Seuls les artistes sélectionnés sont modifiés. Chaque commande peut être annulée.</p><div class="modal-grid">'+
 [['left','À gauche'],['right','À droite'],['top','En haut (fond)'],['bottom','En bas (public)'],['centerX','Centre horizontal'],['centerY','Centre vertical'],['distributeX','Espacement horizontal'],['distributeY','Espacement vertical']]
 .map(([k,l])=>`<button data-align="${k}">${l}</button>`).join('')+'</div>');
}

function applyViewport(){const v=S.viewport;$('#stageSVG').setAttribute('viewBox',`${v.x} ${v.y} ${v.w} ${v.h}`)}
// Ajuster le SVG à la place réelle disponible sans déformer l'échelle scénique.
// Conserver le facteur de zoom personnalisé lorsque la fenêtre ou les panneaux changent.
function fitStage(preserveZoom=true){
 if(!S.proj)return;
 const svg=$('#stageSVG'),b=svg.getBoundingClientRect();
 if(b.width<1||b.height<1)return;
 const g=stageGeometry(),ratio=b.width/b.height,padX=Math.max(7,g.width*.07),padY=Math.max(11,g.height*.22);
 const minW=g.width+2*padX,minH=g.height+2*padY;
 const w=Math.max(minW,minH*ratio),h=w/ratio,cx=g.x+g.width/2,cy=g.y+g.height/2;
 const next={x:cx-w/2,y:cy-h/2,w,h},old=S.fitBase;
 const zoom=preserveZoom&&old?clamp(old.w/S.viewport.w,1,6):1;
 const dx=preserveZoom&&old?(S.viewport.x+S.viewport.w/2-(old.x+old.w/2))/old.w:0;
 const dy=preserveZoom&&old?(S.viewport.y+S.viewport.h/2-(old.y+old.h/2))/old.h:0;
 S.fitBase=next;
 const zw=w/zoom,zh=h/zoom;
 S.viewport={x:cx+w*dx-zw/2,y:cy+h*dy-zh/2,w:zw,h:zh};
 applyViewport();updateViewLabel();
}
function resetZoom(){fitStage(false)}
function updateViewLabel(){const el=$('#zoomValue');if(el)el.textContent=Math.round((S.fitBase?S.fitBase.w:132)/S.viewport.w*100)+' %';$$('[data-stage-tool]').forEach(b=>b.classList.toggle('active',b.dataset.stageTool===S.stageTool))}
function zoomStage(factor,clientX,clientY){const svg=$('#stageSVG'),m=svg.getScreenCTM();if(!m)return;const p=svg.createSVGPoint();p.x=clientX??svg.getBoundingClientRect().left+svg.getBoundingClientRect().width/2;p.y=clientY??svg.getBoundingClientRect().top+svg.getBoundingClientRect().height/2;let point=p.matrixTransform(m.inverse());const v=S.viewport,base=S.fitBase||{w:132,h:96};const z=clamp(base.w/v.w*factor,1,6),w=base.w/z,h=base.h/z;S.viewport={x:point.x-(point.x-v.x)*w/v.w,y:point.y-(point.y-v.y)*h/v.h,w,h};applyViewport();updateViewLabel()}
function clientStagePoint(x,y){const svg=$('#stageSVG'),p=svg.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(svg.getScreenCTM().inverse())}
function draw3d(){const cv=$('#scene3d'),bounds=cv.getBoundingClientRect(),dpr=window.devicePixelRatio||1;if(bounds.width<1||bounds.height<1)return;cv.width=Math.floor(bounds.width*dpr);cv.height=Math.floor(bounds.height*dpr);const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const W=bounds.width,H=bounds.height;ctx.clearRect(0,0,W,H);const project=(x,y,z=0)=>{let k=.71+.26*y;return {x:W/2+(x-.5)*W*.76*k,y:H*.18+y*H*.56-z*H*.055}};
 const corners=[project(0,0),project(1,0),project(1,1),project(0,1)];ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle='#313b65';ctx.fill();ctx.strokeStyle='#f85e98';ctx.lineWidth=2;ctx.stroke();for(let i=0;i<=Math.min(100,S.proj.stage.w);i++){let a=project(i/S.proj.stage.w,0),b=project(i/S.proj.stage.w,1);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#65739488';ctx.lineWidth=.8;ctx.stroke()};
 for(let j=0;j<=Math.min(200,S.proj.stage.d*2);j++){let a=project(0,j/(S.proj.stage.d*2)),b=project(1,j/(S.proj.stage.d*2));ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#65739488';ctx.stroke()};
 for(let d of [...S.proj.dancers].sort((a,b)=>renderPos(a.id).y-renderPos(b.id).y)){const p0=renderPos(d.id),pt=project(p0.x,p0.y),h=Math.max(12,Math.min(34,W/23)),c=appearance(d.id,locAt(S.time).index).color;ctx.fillStyle='#03050a66';ctx.beginPath();ctx.ellipse(pt.x,pt.y+3,11,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=c;ctx.fillRect(pt.x-6,pt.y-h,12,h);ctx.fillStyle='#ffffffe5';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText(d.short,pt.x,pt.y-h/2);ctx.font='10px system-ui';ctx.fillText(d.name,pt.x,pt.y+16)}ctx.textAlign='center';ctx.fillStyle='#c3cce5';ctx.font='12px system-ui';ctx.fillText('PUBLIC',W/2,H*.87)}
// Placement fixe (rose) et transition (pointillés) restent deux segments distincts.
// Les mêmes valeurs alimentent les blocs et l'inspecteur du tableau.
function renderTimeline(){
 const total=lengthOf(),end=playbackEnd();
 $('#timelineTotal').textContent=`Chorégraphie ${fmt(total)}${audioLength()?' · Audio '+fmt(audioLength()):''}`;
 $('#fullTime').textContent=fmt(end);$('#currentTime').textContent=fmtDec(S.time);
 $('#seekBar').value=end?Math.round(S.time/end*1000):0;$('#playBtn').textContent=S.playing?'❚❚':'▶';
 $('#formationStrip').innerHTML=S.proj.forms.map((f,i)=>`<button class="formation-pill ${i===S.active?'active':''}" data-form="${i}" title="Aller au tableau ${i+1}"><strong>${safe(f.name)}</strong><span class="small">${fmtDec(f.hold)} fixe ${i<S.proj.forms.length-1?'· '+fmtDec(f.transition)+' mouv.':''}</span><span class="tinybar" style="background:${safe(f.color)}"></span></button>`).join('')+`<button class="formation-add" data-act="addFormation">＋ Tableau</button>`;
 const editor=$('#timelineEditor'),scroll=editor.scrollLeft,segments=[];
 S.proj.forms.forEach((f,i)=>{
  const start=startOfForm(i);segments.push(`<div class="time-segment ${i===S.timingIndex?'active':''}" data-form="${i}" data-segtype="hold" title="Début ${fmtDec(start)} · maintien ${fmtDec(f.hold)}" style="flex:${Math.max(.25,+f.hold||0)} 0 0;background:${safe(f.color)}2b;border-color:${safe(f.color)}"><span>${safe(f.name)} · ${fmtDec(f.hold)} s</span><b class="duration-handle" data-duration-index="${i}" data-duration-key="hold" role="button" tabindex="0" aria-label="Ajuster la durée du placement ${i+1}">⋮</b></div>`);
  if(i<S.proj.forms.length-1)segments.push(`<div class="time-segment transition-segment ${i===S.timingIndex?'active':''}" data-form="${i}" data-segtype="transition" title="Début ${fmtDec(start+(+f.hold||0))} · déplacement ${fmtDec(f.transition)}" style="flex:${Math.max(.25,+f.transition||0)} 0 0"><span>↝ ${fmtDec(f.transition)} s</span><b class="duration-handle" data-duration-index="${i}" data-duration-key="transition" role="button" tabindex="0" aria-label="Ajuster la transition ${i+1}">⋮</b></div>`);
 });
 editor.innerHTML=segments.join('');editor.scrollLeft=scroll;
 renderTimingPanel();
 const bpm=$('#bpmInput'),snap=$('#beatSnap');if(bpm&&document.activeElement!==bpm)bpm.value=S.proj.music?.bpm||120;if(snap)snap.checked=!!S.proj.music?.beatSnap;
}
function renderTimingPanel(){
 const i=clamp(S.timingIndex,0,S.proj.forms.length-1),f=S.proj.forms[i],start=startOfForm(i),finish=start+(+f.hold||0),last=i===S.proj.forms.length-1;
 const validHold=S.time>start+.04,validTransition=!last&&S.time>finish+.04;
 const input=(key,label,val)=>`<div class="timing-field"><span>${label}</span><button data-timing-step="-1" data-timing-key="${key}" aria-label="Réduire ${label}">−</button><input type="number" min="0" max="9999" step="0.05" data-timing-key="${key}" value="${roundTime(val)}" aria-label="Durée ${label} en secondes"><button data-timing-step="1" data-timing-key="${key}" aria-label="Augmenter ${label}">+</button></div>`;
 $('#timingSummary').textContent=`⏱ Durées et synchronisation · ${f.name}`;
 $('#timingPanel').innerHTML=`<div class="timing-panel-head"><strong>⏱ ${safe(f.name)} · régler le rythme</strong><small>Début ${fmtDec(start)} · fin fixe ${fmtDec(finish)}${!last?' · fin trajet '+fmtDec(finish+(+f.transition||0)):''}</small></div>
 <div class="timing-panel-fields">${input('hold','Fixe',f.hold)}${!last?input('transition','Trajet',f.transition):'<small>Dernier tableau : pas de transition suivante.</small>'}</div>
 <div class="timing-sync-actions"><button data-act="syncHold" ${validHold?'':'disabled'} title="Régler la durée fixe pour finir à la position actuelle du curseur musical">Fin fixe = curseur</button>${!last?`<button data-act="syncTransition" ${validTransition?'':'disabled'} title="Régler la durée de déplacement pour finir à la position actuelle du curseur">Fin trajet = curseur</button>`:''}<button data-act="goFormStart" title="Voir le début de ce tableau">Début du tableau</button><span id="timingReadout" class="timing-readout">Curseur ${fmtDec(S.time)} · ${timingPhase()}</span></div>`;
}
function updatePlayhead(){
 const total=playbackEnd();$('#currentTime').textContent=fmtDec(S.time);$('#seekBar').value=Math.round(clamp(S.time/total,0,1)*1000);
 const read=$('#timingReadout');if(read)read.textContent=`Curseur ${fmtDec(S.time)} · ${timingPhase()}`;
}
function seekTo(time,{controlAudio=true}={}){
 S.time=clamp(Number(time)||0,0,playbackEnd());S.previewTime=true;
 const idx=locAt(S.time).index,change=idx!==S.active;S.active=idx;
 if(controlAudio&&S.musicBlob&&Number.isFinite(audio.duration)){
  try{audio.currentTime=clamp(S.time,0,Math.max(0,audio.duration-.001))}catch(e){console.warn('Déplacement audio indisponible',e)}
 }
 if(change){renderTimeline();renderInspector()}else renderTimingPanel();
 if(S.view3d)draw3d();else renderStage();updatePlayhead();drawWave();
}
function setDuration(idx,key,value,{quantize=false}={}){
 if(idx<0||idx>=S.proj.forms.length||!['hold','transition'].includes(key)||(key==='transition'&&idx===S.proj.forms.length-1))return;
 const n=quantize?quantizedDuration(value):roundTime(clamp(Number(value)||0,0,9999));
 if(Math.abs((+S.proj.forms[idx][key]||0)-n)<.00001)return;
 stopPlay();mutate(()=>{S.proj.forms[idx][key]=n});
 if(S.previewTime){S.active=locAt(S.time).index;renderTimeline();renderInspector();if(S.view3d)draw3d();else renderStage()}
 drawWave();
}
function adjustDuration(idx,key,sign){const snapped=!!S.proj.music?.beatSnap,step=snapped?60/(+S.proj.music.bpm||120):.5;setDuration(idx,key,(+S.proj.forms[idx][key]||0)+sign*step,{quantize:snapped})}
function syncDuration(key){
 const idx=clamp(S.timingIndex,0,S.proj.forms.length-1),start=startOfForm(idx),f=S.proj.forms[idx];if(key==='transition'&&idx===S.proj.forms.length-1)return;
 const target=key==='hold'?S.time-start:S.time-start-(+f.hold||0);
 if(target<.04){return alert('Place d’abord le curseur après le début de cette phase, en touchant la forme d’onde ou la barre de lecture.')}
 // Calage exact à la position audio : ne pas arrondir à la grille BPM lors de cette action.
 setDuration(idx,key,target);
}
function dragDurationStart(e){
 const handle=e.target.closest('[data-duration-key]');if(!handle)return;
 e.preventDefault();e.stopPropagation();stopPlay();
 const idx=+handle.dataset.durationIndex,key=handle.dataset.durationKey;
 const starting=+S.proj.forms[idx][key]||0,before=JSON.stringify(S.proj);
 S.dragTime={pointerId:e.pointerId,startX:e.clientX,idx,key,starting,before,moved:false};
 S.active=idx;S.timingIndex=idx;
 try{handle.setPointerCapture(e.pointerId)}catch(e){}
}
function dragDurationMove(e){if(!S.dragTime||S.dragTime.pointerId!==e.pointerId)return;
 const d=S.dragTime,dx=e.clientX-d.startX;if(Math.abs(dx)<4&&!d.moved)return;d.moved=true;
 let v=Math.max(0,d.starting+dx/24);
 if(S.proj.music?.beatSnap){const beat=60/(+S.proj.music.bpm||120);v=Math.max(0,Math.round(v/beat)*beat)}else v=Math.round(v*20)/20;
 v=roundTime(v);S.proj.forms[d.idx][d.key]=v;
 const segment=$('#timelineEditor').querySelector(`[data-duration-index="${d.idx}"][data-duration-key="${d.key}"]`)?.parentElement;
 if(segment){segment.style.flex=`${Math.max(.25,v)} 0 0`;segment.querySelector('span').textContent=(d.key==='hold'?S.proj.forms[d.idx].name+' · ':'↝ ')+fmtDec(v)+' s'}
 $('#timelineTotal').textContent=`Chorégraphie ${fmt(lengthOf())}${audioLength()?' · Audio '+fmt(audioLength()):''}`;$('#fullTime').textContent=fmt(playbackEnd());
}
function dragDurationEnd(e){if(!S.dragTime||S.dragTime.pointerId!==e.pointerId)return;
 const d=S.dragTime;S.dragTime=null;S.ignoreTimelineClick=false;
 if(JSON.stringify(S.proj)!==d.before){S.undo.push(d.before);if(S.undo.length>90)S.undo.shift();S.redo=[];saveSoon()}
 render();
}
function field(k,label,v,type='text',extra=''){return `<label class="field"><span>${label}</span><input data-field="${k}" type="${type}" value="${safe(v)}" ${extra}></label>`}
function selector(k,label,opts,selected){return `<label class="field"><span>${label}</span><select data-field="${k}">${opts.map(([v,n])=>`<option value="${safe(v)}" ${selected===v?'selected':''}>${safe(n)}</option>`).join('')}</select></label>`}
function renderInspector(){const body=$('#inspectorBody');$$('.inspector-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===S.tab));let html='';if(S.tab==='selection'){
 if(S.selectedProp){const o=(form().props||[]).find(x=>x.id===S.selectedProp);if(o)html=`<h3>Accessoire</h3><button data-act="clearSelection">Désélectionner</button>${selector('prop.shape','Forme',[['rect','Rectangle'],['circle','Ellipse'],['triangle','Triangle'],['line','Ligne']],o.shape)}${field('prop.color','Couleur',o.color,'color')}<div class="inline-fields">${field('prop.w','Largeur (%)',Math.round(o.w*100),'number','min="1" max="120"')}${field('prop.h','Hauteur (%)',Math.round(o.h*100),'number','min="1" max="120"')}</div>${field('prop.rotation','Rotation (°)',o.rotation,'number')}${field('prop.opacity','Opacité (0 à 1)',o.opacity,'number','step="0.1" min="0.1" max="1"')}<button class="btn-warn" data-act="deleteSelected">Supprimer</button>`}
 else if(S.selected.size===1){const id=[...S.selected][0],d=S.proj.dancers.find(x=>x.id===id),a=appearance(id),p=pos(id);html=`<h3>Artiste sélectionné</h3><button data-act="clearSelection">Désélectionner</button>${field('dancer.name','Nom',d.name)}${field('dancer.short','Abréviation (1–3 signes)',d.short)}${field('appear.color','Couleur pour ce tableau',a.color,'color')}${selector('appear.shape','Forme',[['circle','Cercle'],['square','Carré'],['triangle','Triangle'],['diamond','Losange']],a.shape)}<div class="inline-fields">${field('pos.x','Position X (%)',Math.round(p.x*100),'number')}${field('pos.y','Position Y (%)',Math.round(p.y*100),'number')}</div><button data-act="sendBackstage">Placer en coulisse</button><button class="btn-warn" data-act="deleteSelected">Supprimer artiste</button><p>Glisse ce symbole sur le plan. La couleur et la forme peuvent être différentes d'un tableau à l'autre.</p>`}
 else if(S.selected.size>1){html=`<h3>${S.selected.size} artistes sélectionnés</h3><button data-act="clearSelection">Tout désélectionner</button>${field('appear.color','Couleur commune',appearance([...S.selected][0]).color,'color')}${selector('appear.shape','Forme commune',[['circle','Cercle'],['square','Carré'],['triangle','Triangle'],['diamond','Losange']],appearance([...S.selected][0]).shape)}<div class="control-row"><button data-act="flipH">Miroir horizontal</button><button data-act="flipV">Miroir vertical</button><button data-act="rotateLeft">Rotation −15°</button><button data-act="rotateRight">Rotation +15°</button><button data-act="sendBackstage">Coulisses</button><button data-act="selectColor">Même couleur</button><button data-act="selectShape">Même forme</button>${S.selected.size===2?'<button data-act="swap">Échanger</button>':''}</div><button class="btn-warn" data-act="deleteSelected">Supprimer sélection</button><p>Maintiens Maj sur ordinateur pour sélectionner plusieurs artistes. Sur mobile, touche un artiste puis un autre.</p>`}
 else html=`<h3>Placement scénique</h3><div class="hint-box">Sélectionne ou fais glisser un artiste. Ajoute un tableau pour créer les déplacements entre deux placements.</div><div class="control-row"><button data-act="selectAll">Tout sélectionner</button><button data-act="addDancer">+ Artiste</button><button data-act="presets">Placement automatique</button><button data-act="addProp">+ Accessoire</button></div><p>Chaque tableau mémorise la position, la forme et la couleur de tes artistes, ainsi que les accessoires.</p>`;
 }else if(S.tab==='formation'){const f=form();html=`<h3>Réglages du tableau ${S.active+1}</h3>${field('form.name','Nom du tableau',f.name)}${field('form.color','Couleur de repérage',f.color,'color')}<div class="inline-fields">${field('form.hold','Durée du placement (s)',f.hold,'number','min="0" step="0.5"')}${field('form.transition','Transition suivante (s)',f.transition,'number','min="0" step="0.5"')}</div><label class="field"><span>Notes de répétition</span><textarea data-field="form.note">${safe(f.note)}</textarea></label><div class="control-row"><button data-act="duplicateFormation">Dupliquer tableau</button><button data-act="copyAllForms">Appliquer positions à tous les tableaux</button><button data-act="addFormation">Tableau suivant</button><button data-act="deleteFormation" class="btn-warn">Supprimer</button></div><p>Active « Trajets » pour voir les déplacements vers le tableau suivant. Clique un artiste pour ajouter une courbe.</p>${S.selected.size===1&&S.active<S.proj.forms.length-1?'<button data-act="curve">Créer / supprimer une courbe pour l’artiste</button>':''}`}
 else{const s=S.proj.stage,u=s.units==='m'?'m':'repères';html=`<h3>Configuration de la scène</h3>${s.units!=='m'?'<div class="hint-box">Import ArrangeUs : la grille contient des repères et ne précise pas les dimensions réelles en mètres. <button data-act="setRealStage">Définir la scène en mètres</button></div>':''}<div class="inline-fields">${field('stage.w',`Ouverture (${u})`,s.w,'number','min="1" max="100" step="0.5"')}${field('stage.d',`Profondeur (${u})`,s.d,'number','min="0.5" max="100" step="0.5"')}</div>${field('stage.grid',`Pas de grille (${u})`,s.grid,'number','min="0.25" max="10" step="0.25"')}${selector('stage.showGrid','Grille visible',[['true','Oui'],['false','Non']],String(s.showGrid!==false))}${selector('stage.snap','Aimantation sur la grille',[['true','Oui'],['false','Non']],String(s.snap!==false))}${selector('stage.bgFit','Mode de fond',[['cover','Recadrer'],['contain','Contenir'],['stretch','Étirer']],s.bgFit)}<button data-act="background">Importer fond de scène</button><button data-act="clearBackground">Retirer le fond</button><button data-act="flipStage">Inverser la scène</button><div class="hint-box">${s.units!=='m'?'Le métrage de cette scène n’a pas encore été confirmé. ':''}Les cases restent carrées à l’échelle. Les positions utilisent des coordonnées proportionnelles. Modifier les dimensions de scène ne supprime pas les tableaux.</div>${field('project.description','Description du projet',S.proj.description)}${field('project.tags','Étiquettes (séparées par des virgules)',S.proj.tags.join(', '))}`}
 body.innerHTML=html}
function svgPoint(e){const svg=$('#stageSVG'),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=svg.getScreenCTM();if(!m)return {x:0,y:0};const p=pt.matrixTransform(m.inverse()),g=stageGeometry();return {x:(p.x-g.x)/g.width,y:(p.y-g.y)/g.height}}
// A tap and a drag must be different gestures. All thresholds are in screen pixels;
// a few shaky touch pixels must never move or re-snap a dancer.
function gestureThreshold(pointerType){return pointerType==='touch'?15:pointerType==='pen'?9:7}
function applyStageTap(drag){
 if(drag.hitDancer){
   const id=drag.hitDancer;
   if(S.selected.has(id))S.selected.delete(id);
   else if(drag.pointerType==='touch'||drag.pointerType==='pen'||drag.additive)S.selected.add(id);
   else{S.selected.clear();S.selected.add(id)}
   S.selectedProp=null;
 }else if(drag.hitProp){
   if(S.selectedProp===drag.hitProp)S.selectedProp=null;
   else{S.selected.clear();S.selectedProp=drag.hitProp}
 }else if(!drag.hitHandle&&!drag.hitGrip){
   S.selected.clear();S.selectedProp=null;
 }
 S.tab='selection';
}
function pointerDown(e){if(S.previewTime&&!S.playing){S.previewTime=false;renderStage()}
 if(S.view3d||S.playing)return;
 if(e.pointerType==='mouse'&&e.button!==0&&e.button!==1)return;
 const svg=$('#stageSVG');S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 // Capture both touches, including the second pointer that initiates a pinch.
 try{svg.setPointerCapture(e.pointerId)}catch{}
 if(S.pointers.size===2){
   if(S.drag?.moved&&S.drag.before)S.proj=JSON.parse(S.drag.before);
   S.drag=null;
   const [a,b]=[...S.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y)||1,center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   S.pinch={distance,center,viewport:{...S.viewport},anchor:clientStagePoint(center.x,center.y),scale:svg.getScreenCTM()?.a||1};
   e.preventDefault();return;
 }
 const d=e.target.closest('[data-dancer]'),o=e.target.closest('[data-prop]'),h=e.target.closest('[data-handle]'),grip=e.target.closest('[data-prop-handle]');
 const start=svgPoint(e),before=JSON.stringify(S.proj);
 const common={pointerId:e.pointerId,pointerType:e.pointerType,startClient:{x:e.clientX,y:e.clientY},start,before,moved:false,hitDancer:d?.dataset.dancer||null,hitProp:o?.dataset.prop||null,hitHandle:h?.dataset.handle||null,hitGrip:grip?.dataset.propHandle||null,additive:!!(e.shiftKey||e.ctrlKey||e.metaKey)};
 if(grip){const p=form().props.find(o=>o.id===grip.dataset.prop);if(!p)return;
   S.drag={...common,kind:grip.dataset.propHandle==='size'?'propSize':'propRotate',id:p.id,original:clone(p)};}
 else if(h){S.drag={...common,kind:'handle',id:h.dataset.handle,position:{...form().curves[h.dataset.handle]}};}
 else if(d){S.drag={...common,kind:S.stageTool==='move'?'dancer':'tapDancer',id:d.dataset.dancer,ids:S.selected.has(d.dataset.dancer)?[...S.selected]:[d.dataset.dancer],positions:Object.fromEntries((S.selected.has(d.dataset.dancer)?[...S.selected]:[d.dataset.dancer]).map(id=>[id,{...pos(id)}]))};}
 else if(o){const pt=(form().props||[]).find(p=>p.id===o.dataset.prop);
   S.drag={...common,kind:S.stageTool==='move'?'prop':'tapProp',id:pt.id,position:{x:pt.x,y:pt.y}};}
 else if(S.stageTool==='select')S.drag={...common,kind:'marquee',current:start};
 else S.drag={...common,kind:'pan',viewport:{...S.viewport},scale:svg.getScreenCTM()?.a||1};
 e.preventDefault();
 // Selection changes only on pointerup; avoid swapping SVG nodes out from under a tap.
}
function pointerMove(e){
 if(S.pointers.has(e.pointerId))S.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(S.pinch&&S.pointers.size>=2){
   const [a,b]=[...S.pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y)||1;
   const v=S.pinch.viewport,ratio=clamp(distance/S.pinch.distance,.2,5),z=clamp(132/v.w*ratio,1,5),w=132/z,h=96/z;
   const anchor=S.pinch.anchor;
   const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},scale=S.pinch.scale*(z/(132/v.w));
   S.viewport={x:anchor.x-(anchor.x-v.x)*w/v.w-(mid.x-S.pinch.center.x)/scale,y:anchor.y-(anchor.y-v.y)*h/v.h-(mid.y-S.pinch.center.y)/scale,w,h};applyViewport();updateViewLabel();return;
 }
 const drag=S.drag;if(!drag||drag.pointerId!==e.pointerId||drag.kind==='tapDancer'||drag.kind==='tapProp')return;
 const screenDx=e.clientX-drag.startClient.x,screenDy=e.clientY-drag.startClient.y;
 if(!drag.moved){
   if(Math.hypot(screenDx,screenDy)<gestureThreshold(drag.pointerType))return;
   drag.moved=true;
   if(drag.kind==='dancer'){
     if(!S.selected.has(drag.id)){S.selected.clear();S.selected.add(drag.id)}
     S.selectedProp=null;
   }else if(drag.kind==='prop'){S.selected.clear();S.selectedProp=drag.id}
   S.tab='selection';
 }
 if(drag.kind==='pan'){
   S.viewport={...drag.viewport,x:drag.viewport.x-screenDx/drag.scale,y:drag.viewport.y-screenDy/drag.scale};applyViewport();return;
 }
 const cur=svgPoint(e),dx=cur.x-drag.start.x,dy=cur.y-drag.start.y;
 if(drag.kind==='dancer'){
   for(const id of drag.ids){const old=drag.positions[id];form().positions[id]={x:clamp(old.x+dx,-.12,1.12),y:clamp(old.y+dy,0,1)}}
 }else if(drag.kind==='prop'){
   const p=form().props.find(o=>o.id===drag.id);if(p){p.x=clamp(drag.position.x+dx,-.12,1.12);p.y=clamp(drag.position.y+dy,0,1)}
 }else if(drag.kind==='handle')form().curves[drag.id]={x:clamp(drag.position.x+dx,-.12,1.12),y:clamp(drag.position.y+dy,0,1)};
 else if(drag.kind==='marquee')drag.current=cur;
 else if(drag.kind==='propSize'){
   const p=form().props.find(o=>o.id===drag.id);if(p){p.w=clamp(drag.original.w+dx*2,.025,1.5);p.h=clamp(drag.original.h+dy*2,.025,1.5)}
 }else if(drag.kind==='propRotate'){
   const p=form().props.find(o=>o.id===drag.id);if(p){const g=stageGeometry(),angle=Math.atan2((cur.y-p.y)*g.height,(cur.x-p.x)*g.width)*180/Math.PI;p.rotation=Math.round(angle+90)}
 }
 renderStage();if(drag.kind!=='marquee')renderInspector();
}
function pointerUp(e){
 if(e?.pointerId!==undefined)S.pointers.delete(e.pointerId);
 if(S.pinch){if(S.pointers.size<2)S.pinch=null;return}
 const drag=S.drag;if(!drag||drag.pointerId!==e.pointerId)return;
 if(e.type==='pointercancel'){
   if(drag.moved&&drag.before&&['dancer','prop','handle','propSize','propRotate'].includes(drag.kind))S.proj=JSON.parse(drag.before);
   if(drag.moved&&drag.kind==='pan')S.viewport={...drag.viewport};
   S.drag=null;render();return;
 }
 if(!drag.moved){applyStageTap(drag);S.drag=null;render();return;}
 if(drag.kind==='marquee'){
   const a=drag.start,b=drag.current||a,x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
   if(!drag.additive)S.selected.clear();for(const d of S.proj.dancers){const p=pos(d.id);if(p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1)S.selected.add(d.id)}S.selectedProp=null;
 }
 if(drag.kind==='dancer'&&S.proj.stage.snap!==false){
   const st=S.proj.stage,anchor=form().positions[drag.id];
   if(anchor&&anchor.x>=0&&anchor.x<=1&&anchor.y>=0&&anchor.y<=1){
    const snap=(v,scale)=>{const c=v*scale/st.grid;return (st.snapMode==='center'||st.units==='cases')?(Math.round(c-.5)+.5)*st.grid/scale:Math.round(c)*st.grid/scale};
    // Snap the whole group as a rigid block. Previously each artist snapped
    // individually, damaging their relative spacing after a group move.
    if(drag.ids.length>1){
     const dx=snap(anchor.x,st.w)-anchor.x,dy=snap(anchor.y,st.d)-anchor.y;
     const pts=drag.ids.map(id=>form().positions[id]).filter(Boolean);
     const sx=clamp(dx,Math.max(...pts.map(p=>-.12-p.x)),Math.min(...pts.map(p=>1.12-p.x)));
     const sy=clamp(dy,Math.max(...pts.map(p=>-p.y)),Math.min(...pts.map(p=>1-p.y)));
     pts.forEach(p=>{p.x+=sx;p.y+=sy});
    }else{anchor.x=clamp(snap(anchor.x,st.w),0,1);anchor.y=clamp(snap(anchor.y,st.d),0,1)}
   }
 }
 if(drag.before&&JSON.stringify(S.proj)!==drag.before){S.undo.push(drag.before);if(S.undo.length>90)S.undo.shift();S.redo=[];saveSoon()}
 S.drag=null;render();
}
function stopPlay(){S.playing=false;audio.pause();cancelAnimationFrame(S.raf);S.raf=null;S.lastFrame=0}
function play(){if(S.playing){stopPlay();renderTimeline();drawWave();return}const total=playbackEnd();if(!total)return;if(S.time>=total)S.time=0;S.playing=true;S.previewTime=true;S.lastFrame=performance.now();if(S.musicBlob){try{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Math.min(S.time,Math.max(0,audio.duration-.001));else audio.currentTime=S.time}catch(e){}audio.play().catch(e=>console.warn('La lecture audio a été bloquée',e))}tick(S.lastFrame);renderTimeline()}
function tick(now){if(!S.playing)return;const dt=clamp((now-S.lastFrame)/1000,0,.12);S.lastFrame=now;S.time=(S.musicBlob&&!audio.paused&&S.time<=audioLength())?audio.currentTime:S.time+dt;if(S.time>=playbackEnd()){S.time=playbackEnd();stopPlay()}const r=locAt(S.time);if(r.index!==S.active){S.active=r.index;renderTimeline();renderInspector()}if(S.view3d)draw3d();else renderStage();updatePlayhead();drawWave();if(S.playing)S.raf=requestAnimationFrame(tick);else renderTimeline()}
function changeFormation(index,animate=true){stopPlay();S.active=clamp(index,0,S.proj.forms.length-1);S.timingIndex=S.active;S.selected.clear();S.selectedProp=null;S.previewTime=false;S.time=startOfForm(S.active);if(S.musicBlob&&Number.isFinite(audio.duration))try{audio.currentTime=Math.min(S.time,Math.max(0,audio.duration-.001))}catch(e){}render()}
function addFormation(duplicate=false){const idx=S.active;mutate(()=>{let prev=form(),next=clone(prev);next.id=uid();next.name=duplicate?`${prev.name} (copie)`:`Tableau ${S.proj.forms.length+1}`;next.note=duplicate?prev.note:'';next.curves={};S.proj.forms.splice(idx+1,0,next);S.active=idx+1;S.timingIndex=S.active;S.previewTime=false;S.time=startOfForm(S.active);S.selected.clear();S.selectedProp=null})}
function addDancer(){const name=prompt('Nom de l’artiste :',`Artiste ${S.proj.dancers.length+1}`);if(name===null)return;const short=prompt('Abréviation affichée sur scène :',String(S.proj.dancers.length+1));if(short===null)return;mutate(()=>{const d={id:uid(),name:name.trim()||'Artiste',short:short.slice(0,3)||String(S.proj.dancers.length+1)};S.proj.dancers.push(d);for(let f of S.proj.forms){f.positions[d.id]={x:-.08,y:.1+(S.proj.dancers.length%8)*.1};f.appear[d.id]={color:COLOR[(S.proj.dancers.length-1)%COLOR.length],shape:'circle'}};S.selected.clear();S.selected.add(d.id);S.tab='selection'})}
function addProp(shape='rect'){mutate(()=>{const p={id:uid(),shape,x:.5,y:.5,w:.14,h:.14,rotation:0,color:'#ffc863',opacity:.75};form().props.push(p);S.selected.clear();S.selectedProp=p.id;S.tab='selection'})}
function delSelection(){if(S.selectedProp){mutate(()=>{form().props=form().props.filter(p=>p.id!==S.selectedProp);S.selectedProp=null});return}if(!S.selected.size)return;if(!confirm(`Supprimer ${S.selected.size} artiste(s) de toute la chorégraphie ?`))return;mutate(()=>{S.proj.dancers=S.proj.dancers.filter(d=>!S.selected.has(d.id));for(let f of S.proj.forms){for(let id of S.selected){delete f.positions[id];delete f.appear[id];delete f.curves[id]}}S.selected.clear()})}
function preset(mode){let ids=S.selected.size?[...S.selected]:S.proj.dancers.map(d=>d.id),n=ids.length;if(!n)return;mutate(()=>{ids.forEach((id,i)=>{let x=.5,y=.5,t=n===1?.5:i/(n-1);if(mode==='line'){x=.1+.8*t;y=.5}else if(mode==='rows'){const cols=Math.ceil(Math.sqrt(n*1.6));x=.13+.74*(i%cols)/Math.max(1,cols-1);y=.17+.65*Math.floor(i/cols)/Math.max(1,Math.ceil(n/cols)-1)}else if(mode==='circle'){x=.5+.33*Math.cos(-Math.PI/2+2*Math.PI*i/n);y=.5+.37*Math.sin(-Math.PI/2+2*Math.PI*i/n)}else if(mode==='arc'){x=.5+.37*Math.cos(Math.PI+Math.PI*t);y=.35+.38*Math.sin(Math.PI+Math.PI*t)}else if(mode==='v'){x=.13+.74*t;y=.17+.67*(1-2*Math.abs(t-.5))}else if(mode==='diagonal'){x=.12+.76*t;y=.2+.6*t}else if(mode==='columns'){x=.2+.6*Math.floor(i/Math.ceil(n/3))/Math.max(1,Math.ceil(n/Math.ceil(n/3))-1);y=.15+.7*(i%Math.ceil(n/3))/Math.max(1,Math.ceil(n/3)-1)}form().positions[id]={x,y}})})}
function groupTransform(kind){if(!S.selected.size)return;mutate(()=>{const ids=[...S.selected],center={x:ids.reduce((a,id)=>a+pos(id).x,0)/ids.length,y:ids.reduce((a,id)=>a+pos(id).y,0)/ids.length};for(let id of ids){let p=pos(id),x=p.x-center.x,y=p.y-center.y;if(kind==='h')x=-x;if(kind==='v')y=-y;if(kind==='left'||kind==='right'){const a=(kind==='left'?-15:15)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);[x,y]=[x*c-y*s,x*s+y*c]}form().positions[id]={x:clamp(center.x+x,-.12,1.12),y:clamp(center.y+y,0,1)}}})}
function handleEdit(key,value){if(['form.hold','form.transition'].includes(key))stopPlay();mutate(()=>{const [group,prop]=key.split('.');if(group==='form'){form()[prop]=['hold','transition'].includes(prop)?Math.max(0,Number(value)||0):value}else if(group==='stage'){S.proj.stage[prop]=['w','d','grid'].includes(prop)?Math.max(prop==='d'?.5:.25,Number(value)||1):['snap','showGrid'].includes(prop)?value==='true':value}else if(group==='project'){if(prop==='tags')S.proj.tags=value.split(',').map(x=>x.trim()).filter(Boolean);else S.proj[prop]=value}else if(group==='dancer'){const d=S.proj.dancers.find(x=>x.id===[...S.selected][0]);if(d)d[prop]=prop==='short'?value.slice(0,3):value}else if(group==='appear'){for(let id of S.selected){form().appear[id]??={color:'#ff477e',shape:'circle'};form().appear[id][prop]=value}}else if(group==='pos'){const d=[...S.selected][0];form().positions[d][prop]=clamp((Number(value)||0)/100,prop==='x'?-.12:0,prop==='x'?1.12:1)}else if(group==='prop'){const o=form().props.find(x=>x.id===S.selectedProp);if(!o)return;o[prop]=['w','h'].includes(prop)?Math.max(.01,(Number(value)||1)/100):['rotation','opacity'].includes(prop)?Number(value):value}})}
function openModal(title,html){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;$('#modal').classList.remove('hidden')}
function closeModal(){$('#modal').classList.add('hidden')}
async function showProjects(){try{await flushPendingSave();S.allProjects=await dball('projects');renderProjectModal()}catch(e){console.error(e);alert('Impossible d’afficher les projets : '+e.message)}}
function renderProjectModal(){const items=S.allProjects.filter(p=>(p.status||'active')===S.filter).filter(p=>p.name.toLowerCase().includes(S.projectSearch.toLowerCase())).sort((a,b)=>S.sort==='name'?a.name.localeCompare(b.name):b.updated-a.updated);let html=`<div class="modal-actions"><button class="primary-btn" data-act="newProject">＋ Nouveau projet</button><button data-act="import">⇧ Importer JSON / ArrangeUs</button><button data-act="changeFilter" data-filter="active">Actifs</button><button data-act="changeFilter" data-filter="archive">Archives</button><button data-act="changeFilter" data-filter="trash">Corbeille</button></div><label class="field"><span>Rechercher un projet</span><input id="projectSearch" placeholder="Titre…" value="${safe(S.projectSearch)}" /></label><div class="project-list">${items.length?items.map(p=>`<div class="project-card"><h3>${safe(p.name)}</h3><small>${p.dancers.length} artistes · ${p.forms.length} tableaux · ${new Date(p.updated).toLocaleDateString('fr-FR')}</small><p>${(p.tags||[]).map(t=>`<span class="tag">${safe(t)}</span>`).join('')}</p><div class="actions"><button class="primary-btn" data-project-act="open" data-id="${p.id}">Ouvrir</button>${S.filter==='active'?`<button data-project-act="duplicate" data-id="${p.id}">Copier</button><button data-project-act="archive" data-id="${p.id}">Archiver</button><button data-project-act="trash" data-id="${p.id}">Corbeille</button>`:S.filter==='archive'?`<button data-project-act="active" data-id="${p.id}">Réactiver</button><button data-project-act="trash" data-id="${p.id}">Supprimer</button>`:`<button data-project-act="active" data-id="${p.id}">Restaurer</button><button data-project-act="delete" data-id="${p.id}">Effacer</button>`}</div></div>`).join(''):`<p class="help-text">Aucun projet dans cette catégorie.</p>`}</div>`;openModal('Mes chorégraphies',html)}
async function projectAction(type,id){if(type==='open')return openProject(id);const p=await dbget('projects',id);if(!p)return;if(type==='duplicate'){p.id=uid();p.name+=' (copie)';p.created=Date.now();p.updated=Date.now();p.status='active';await dbput('projects',p)}else if(type==='delete'){if(!confirm('Effacer définitivement ce projet ?'))return;await dbdel('projects',id);await dbdel('media',id)}else{p.status=type;p.updated=Date.now();await dbput('projects',p)}S.allProjects=await dball('projects');renderProjectModal()}
/* Bibliothèque locale : groupes d'artistes et placements réutilisables d'un projet à l'autre. */
async function showLibrary(){
 const entries=(await dball('library')).sort((a,b)=>b.updated-a.updated);
 const list=entries.length?entries.map(x=>`<div class="project-card"><h3>${safe(x.name)}</h3><small>${x.kind==='crew'?'Groupe / crew':'Placement personnel'} · ${x.entries.length} artistes</small><div class="actions"><button data-library-act="${x.kind==='crew'?'useCrew':'usePreset'}" data-id="${safe(x.id)}" class="primary-btn">${x.kind==='crew'?'Ajouter ces artistes':'Appliquer au tableau'}</button><button class="btn-warn" data-library-act="remove" data-id="${safe(x.id)}">Effacer</button></div></div>`).join(''):'<p>Aucun groupe ni placement enregistré dans la bibliothèque.</p>';
 openModal('Bibliothèque réutilisable',`<p class="help-text">Enregistrée localement sur cet appareil. Un groupe ajoute des artistes au spectacle actuel ; un placement s'applique à une sélection du même nombre de personnes.</p><div class="modal-actions"><button data-library-act="saveCrew">＋ Enregistrer la sélection comme groupe</button><button data-library-act="savePreset">＋ Enregistrer les positions comme modèle</button></div><div class="project-list">${list}</div>`);
}
async function libraryAction(action,id){
 if(action==='saveCrew'||action==='savePreset'){
   const ids=S.selected.size?[...S.selected]:S.proj.dancers.map(d=>d.id);
   if(!ids.length)return alert('Sélectionne au moins un artiste.');
   const name=prompt(action==='saveCrew'?'Nom du groupe :':'Nom du placement :');if(!name?.trim())return;
   const entries=ids.map(id=>{
     const dancer=S.proj.dancers.find(d=>d.id===id);
     return {name:dancer.name,short:dancer.short,pos:clone(pos(id)),appearance:clone(appearance(id))};
   });
   await dbput('library',{id:uid(),kind:action==='saveCrew'?'crew':'preset',name:name.trim(),entries,updated:Date.now()});return showLibrary();
 }
 const item=await dbget('library',id);if(!item)return alert('Élément introuvable.');
 if(action==='remove'){if(!confirm(`Effacer « ${item.name} » de la bibliothèque ?`))return;await dbdel('library',id);return showLibrary()}
 if(action==='useCrew'){
   mutate(()=>{const ids=[];for(const [i,e] of item.entries.entries()){
     const id=uid();ids.push(id);S.proj.dancers.push({id,name:e.name,short:e.short||String(S.proj.dancers.length)});
     for(const f of S.proj.forms){f.positions[id]={x:-.08,y:clamp(.08+(i%11)*.08,0,1)};f.appear[id]=clone(e.appearance)}
   }S.selected=new Set(ids);S.selectedProp=null;S.tab='selection'});closeModal();return;
 }
 if(action==='usePreset'){
   const ids=S.selected.size?[...S.selected]:S.proj.dancers.map(d=>d.id);
   if(ids.length!==item.entries.length)return alert(`Ce placement contient ${item.entries.length} artistes. Sélectionne exactement ${item.entries.length} artistes avant de l'appliquer.`);
   mutate(()=>ids.forEach((id,i)=>{const e=item.entries[i];form().positions[id]=clone(e.pos);form().appear[id]=clone(e.appearance)}));closeModal();return;
 }
}
function showPresets(){openModal('Placements automatiques',`<p class="help-text">Le placement s'applique à la sélection actuelle. Si personne n'est sélectionné, il concerne tous les artistes du tableau.</p><div class="modal-grid">${[['line','Ligne'],['rows','Rangées'],['circle','Cercle'],['arc','Demi-cercle'],['v','V'],['diagonal','Diagonale'],['columns','Colonnes']].map(([x,l])=>`<button data-preset="${x}">${l}</button>`).join('')}</div>`)}
function showPropMenu(){openModal('Ajouter un accessoire',`<p class="help-text">Ajoute un objet et déplace-le directement sur scène, puis règle ses dimensions et son orientation dans le panneau de droite.</p><div class="modal-grid">${[['rect','Rectangle'],['circle','Ellipse'],['triangle','Triangle'],['line','Ligne / repère']].map(([k,l])=>`<button data-newprop="${k}">${l}</button>`).join('')}</div>`)}
function help(){openModal('Guide de ScènePlan',`<div class="help-text"><h3>Créer une chorégraphie</h3><p>Utilise « Projets » pour créer un spectacle, ajoute des artistes, place-les en glissant les symboles, puis clique « + Tableau » pour définir le placement suivant. Le bouton ▶ anime automatiquement les mouvements.</p><h3>Différencier les tableaux</h3><p>Tu peux changer le nom, la couleur, la durée fixe et la durée de déplacement dans l'onglet « Tableau ». Sélectionne des artistes, puis utilise les formations automatiques, le miroir ou la rotation. « Fantômes » affiche les positions futures.</p><h3>Trajectoires courbes</h3><p>Sélectionne un artiste, active l'onglet « Tableau », crée sa courbe et déplace sa poignée jaune sur le plan. Le lecteur anime sa trajectoire.</p><h3>Musique et 3D</h3><p>Charge une musique. Touche sa forme d’onde ou déplace le curseur pour voir les artistes pendant les déplacements, même à l’arrêt. Dans « régler le rythme », ajuste les durées ou utilise « Fin fixe = curseur » et « Fin trajet = curseur ». Le BPM permet d’arrondir les prochains réglages ; il ne détecte pas automatiquement les temps. La vue 3D est un aperçu en perspective.</p><h3>Sauvegarder et partager</h3><p>Les projets sont enregistrés dans le navigateur utilisé. Télécharge régulièrement un fichier JSON via « Exporter ». Un PDF est généré via « PDF » puis l'impression du navigateur. L'audio n'est pas intégré à l'export JSON : conserve le fichier audio à part.</p><p><strong>Limites :</strong> ceci est un prototype indépendant, pas un portage du code ArrangeUs. L'import des fichiers .arrus ArrangeUs 2.9.4 est disponible. Les backups .aubkp, les groupes réutilisables et la synchronisation entre appareils ne sont pas encore implémentés.</p></div>`)}
async function createProject(){let name=prompt('Nom du spectacle :','Nouveau spectacle');if(name===null)return;let n=prompt("Nombre d'artistes :",'8');if(n===null)return;const p=newProject(name.trim()||'Nouveau spectacle',clamp(parseInt(n,10)||8,1,180));await dbput('projects',p);await openProject(p.id)}
function download(name,content,type='application/json'){const blob=content instanceof Blob?content:new Blob([content],{type});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500)}
function exportProject(){download(`${S.proj.name.replace(/[^\wÀ-ÿ-]+/g,'_')}.sceneplan.json`,JSON.stringify({format:'sceneplan',version:1,project:S.proj,note:'Audio conservé séparément dans ce navigateur. Ceci n’est pas un fichier ArrangeUs.'},null,2))}
async function importProject(file){try{if(file.size>20*1024*1024)throw Error('Fichier trop volumineux');let p;if(/\.arrus$/i.test(file.name)){if(!window.ArrusImport)throw Error('Module ArrangeUs absent');p=await window.ArrusImport.convert(await file.arrayBuffer());}else{const data=JSON.parse(await file.text());if(data.format!=='sceneplan'||!data.project||!Array.isArray(data.project.forms)||!Array.isArray(data.project.dancers))throw Error('Fichier invalide : utiliser un .arrus ArrangeUs ou .sceneplan.json');p=data.project;}p.id=uid();p.status='active';p.created=Date.now();p.updated=Date.now();if(!p.forms.length)throw Error('Aucun tableau dans ce projet');p.forms.forEach(f=>{f.props??=[];f.curves??={};f.appear??={};f.positions??={}});await dbput('projects',p);await openProject(p.id);alert(`Projet importé : ${p.dancers.length} artistes et ${p.forms.length} formations.`)}catch(e){alert('Import impossible : '+e.message)}}
async function loadStoredAudio(){if(S.musicUrl)URL.revokeObjectURL(S.musicUrl);S.musicBlob=null;S.waveSamples=null;audio.pause();audio.removeAttribute('src');const f=await dbget('media',S.proj.id);if(f?.blob){S.musicBlob=f.blob;S.musicUrl=URL.createObjectURL(f.blob);audio.src=S.musicUrl;analyseWave(f.blob)}}
async function importMusic(f){if(!f||!f.type.startsWith('audio/'))return alert('Choisis un fichier audio.');try{await dbput('media',{id:S.proj.id,blob:f,name:f.name});await loadStoredAudio();render()}catch(e){alert('Le stockage audio a échoué : '+e.message)}}
async function deleteMusic(){stopPlay();await dbdel('media',S.proj.id);await loadStoredAudio();render()}
async function analyseWave(blob){try{const buffer=await blob.arrayBuffer(),ctx=new (window.AudioContext||window.webkitAudioContext)(),b=await ctx.decodeAudioData(buffer),data=b.getChannelData(0),n=380,block=Math.max(1,Math.floor(data.length/n)),samples=[];for(let i=0;i<n;i++){let peak=0;for(let j=0;j<block;j+=Math.max(1,Math.floor(block/90)))peak=Math.max(peak,Math.abs(data[i*block+j]||0));samples.push(peak)}S.waveSamples=samples;await ctx.close();drawWave()}catch(e){S.waveSamples=null;drawWave()}}
function drawWave(){
 const c=$('#waveform'),b=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;if(b.width<1)return;
 c.width=Math.max(1,Math.round(b.width*dpr));c.height=Math.max(1,Math.round(b.height*dpr));let ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
 ctx.clearRect(0,0,b.width,b.height);ctx.fillStyle='#0e1423';ctx.fillRect(0,0,b.width,b.height);
 const range=playbackEnd(),song=audioLength(),musicWidth=song?b.width*song/range:b.width;
 if(S.waveSamples){const max=Math.max(...S.waveSamples,.001),w=musicWidth/S.waveSamples.length;ctx.fillStyle='#78b7f5';S.waveSamples.forEach((amp,i)=>{const h=Math.max(1,amp/max*b.height*.84);ctx.fillRect(i*w,(b.height-h)/2,Math.max(.75,w*.7),h)})}
 else{ctx.fillStyle='#7a87a3';ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillText(S.musicBlob?'Analyse audio…':'Aucune musique chargée · glisse le curseur ci-dessus',b.width/2,b.height/2+4)}
 if(S.proj.music?.bpm){const beat=60/S.proj.music.bpm;if(beat>0&&range/beat<400){ctx.fillStyle='#ffffff25';for(let t=beat;t<range;t+=beat)ctx.fillRect(t/range*b.width,0,.7,b.height)}}
 let pos=0;for(let i=0;i<S.proj.forms.length;i++){
  const f=S.proj.forms[i];pos+=(+f.hold||0);if(pos<range){ctx.fillStyle='#ff477e99';ctx.fillRect(pos/range*b.width,0,1,b.height)}
  if(i<S.proj.forms.length-1){pos+=(+f.transition||0);if(pos<range){ctx.fillStyle='#91b8eacc';ctx.fillRect(pos/range*b.width,0,1,b.height)}}
 }
 ctx.fillStyle='#ff477e';ctx.fillRect(clamp(S.time/range,0,1)*b.width-1,0,2,b.height);
}
function seekWave(e){const r=$('#waveform').getBoundingClientRect();if(!r.width)return;seekTo((e.clientX-r.left)/r.width*playbackEnd())}
function printProject(){stopPlay();const p=S.proj;let content=`<h1>${safe(p.name)} — Plan de scène</h1><p>${safe(p.description)} · ${p.dancers.length} artistes · ${p.forms.length} tableaux · Scène ${p.stage.w} × ${p.stage.d} ${stageUnitLabel(p.stage)}</p>`;p.forms.forEach((f,i)=>{content+=`<div class="print-page"><div class="print-info"><b>${i+1}. ${safe(f.name)}</b> — Maintien ${fmt(f.hold)}${i<p.forms.length-1?' · Transition '+fmt(f.transition):''}</div><svg viewBox="-6 0 132 96" xmlns="http://www.w3.org/2000/svg">${stageMarkup(i,true)}</svg><div class="print-notes">${safe(f.note||'')}</div></div>`});$('#printRoot').innerHTML=content;setTimeout(()=>window.print(),200)}
function handleAction(act,b){switch(act){case'home':showProjects();break;case'openFile':$('#projectImport').click();break;case'closeModal':closeModal();break;case'newProject':createProject();break;case'import':$('#projectImport').click();break;case'export':exportProject();break;case'renameProject':{const n=prompt('Nom du projet',S.proj.name);if(n!==null&&n.trim())mutate(()=>S.proj.name=n.trim());break}case'undo':undo();break;case'redo':redo();break;case'addDancer':addDancer();break;case'addFormation':addFormation();break;case'duplicateFormation':addFormation(true);break;case'deleteFormation':if(S.proj.forms.length===1){alert('Un projet doit conserver au moins un tableau.');break}if(confirm('Supprimer ce tableau ?'))mutate(()=>{S.proj.forms.splice(S.active,1);S.active=Math.max(0,S.active-1);S.timingIndex=S.active;S.previewTime=false;S.time=startOfForm(S.active)});break;case'reorderLeft':case'reorderRight':{const i=S.active,j=i+(act==='reorderLeft'?-1:1);if(j<0||j>=S.proj.forms.length)return;mutate(()=>{[S.proj.forms[i],S.proj.forms[j]]=[S.proj.forms[j],S.proj.forms[i]];S.active=j;S.timingIndex=S.active;S.previewTime=false;S.time=startOfForm(S.active)});break}
 case'syncHold':syncDuration('hold');break;case'syncTransition':syncDuration('transition');break;case'goFormStart':changeFormation(S.timingIndex);break;case'back':changeFormation(S.active-1);break;case'forward':changeFormation(S.active+1);break;
 case'library':showLibrary();break;case'addProp':showPropMenu();break;case'presets':showPresets();break;case'toggle3d':S.view3d=!S.view3d;render();break;case'toggleGhost':S.ghost=!S.ghost;render();break;case'togglePaths':S.paths=!S.paths;render();break;case'play':play();break;case'loadMusic':$('#musicImport').click();break;case'unloadMusic':if(S.musicBlob&&confirm('Retirer la musique de ce projet ?'))deleteMusic();break;case'print':printProject();break;case'help':help();break;
 case'filesMenu':openModal('Fichiers et commandes',`<div class="modal-grid"><button data-act="home">▦ Mes projets</button><button data-act="openFile">⇧ Importer</button><button data-act="export">⇩ Exporter</button><button data-act="undo">↶ Annuler</button><button data-act="redo">↷ Rétablir</button><button data-act="toggle3d">⬡ Vue 2D / 3D</button><button data-act="help">? Aide</button></div>`);break;case'layoutPlacement':setLayoutMode('placement');break;case'layoutSync':setLayoutMode('sync');break;case'toggleFocus':toggleFocus();break;case'toggleTools':setTools(!S.toolsOpen);break;case'closeInspector':setInspector(false);break;case'settings':S.tab='stage';setInspector(true);renderInspector();break;case'inspector':setInspector(!S.inspectorOpen);renderInspector();break;
 case'deleteSelected':delSelection();break;case'selectAll':S.selected=new Set(S.proj.dancers.map(d=>d.id));S.selectedProp=null;render();break;case'clearSelection':S.selected.clear();S.selectedProp=null;render();break;
 case'copyPlacement':{const ids=S.selected.size?[...S.selected]:S.proj.dancers.map(d=>d.id);S.posClipboard={positions:Object.fromEntries(ids.map(id=>[id,clone(pos(id))])),appear:Object.fromEntries(ids.map(id=>[id,clone(appearance(id))]))};alert(`${ids.length} placements copiés. Va sur un autre tableau puis colle-les.`);break}
 case'pastePlacement':if(!S.posClipboard){alert('Copie d’abord des placements sur un tableau.');break}mutate(()=>{for(const [id,pt] of Object.entries(S.posClipboard.positions)){if(form().positions[id]){form().positions[id]=clone(pt);form().appear[id]=clone(S.posClipboard.appear[id])}}});break;
 case'copyAllForms':if(!confirm('Appliquer les positions et apparences de ce tableau à tous les autres ?'))break;mutate(()=>{const src=clone(form());for(let i=0;i<S.proj.forms.length;i++)if(i!==S.active){S.proj.forms[i].positions=clone(src.positions);S.proj.forms[i].appear=clone(src.appear)}});break;
 case'nudgeLeft':shiftSelection('left');break;case'nudgeRight':shiftSelection('right');break;case'nudgeUp':shiftSelection('up');break;case'nudgeDown':shiftSelection('down');break;case'alignMenu':showAlignMenu();break;
 case'zoomIn':zoomStage(1.3);break;case'zoomOut':zoomStage(1/1.3);break;case'zoomReset':resetZoom();break;
 case'stageMove':S.stageTool='move';updateViewLabel();break;case'stageSelect':S.stageTool='select';updateViewLabel();break;
 case'sendBackstage':mutate(()=>{[...S.selected].forEach((id,i)=>{form().positions[id]={x:-.09,y:clamp(.1+(i%10)*.08,0,1)}})});break;
 case'selectColor':case'selectShape':{const sel=[...S.selected].map(id=>appearance(id)[act==='selectColor'?'color':'shape']);S.selected=new Set(S.proj.dancers.filter(d=>sel.includes(appearance(d.id)[act==='selectColor'?'color':'shape'])).map(d=>d.id));render();break}
 case'swap':{if(S.selected.size!==2)break;const[a,b]=[...S.selected];mutate(()=>{[form().positions[a],form().positions[b]]=[form().positions[b],form().positions[a]]});break}
 case'flipStage':if(confirm('Inverser horizontalement les positions, accessoires et courbes de tous les tableaux ?'))mutate(()=>{for(const f of S.proj.forms){for(const p of Object.values(f.positions))p.x=1-p.x;for(const p of f.props){p.x=1-p.x;p.rotation=-(p.rotation||0)}for(const c of Object.values(f.curves))c.x=1-c.x}});break;
 case'flipH':groupTransform('h');break;case'flipV':groupTransform('v');break;case'rotateLeft':groupTransform('left');break;case'rotateRight':groupTransform('right');break;
 case'curve':{const id=[...S.selected][0];if(!id||S.active===S.proj.forms.length-1)return;mutate(()=>{if(form().curves[id])delete form().curves[id];else{let a=pos(id),b=pos(id,S.active+1);form().curves[id]={x:(a.x+b.x)/2+.1,y:(a.y+b.y)/2-.1}}S.paths=true});break}
 case'setRealStage':{const s=S.proj.stage,wRaw=prompt('Ouverture réelle de la scène en mètres :',s.units==='m'?String(s.w):''),dRaw=wRaw===null?null:prompt('Profondeur réelle de la scène en mètres :',s.units==='m'?String(s.d):'');if(dRaw===null)break;const w=Number(String(wRaw).replace(',','.')),d=Number(String(dRaw).replace(',','.'));if(!(w>=.5&&w<=100&&d>=.5&&d<=100)){alert('Indique deux dimensions réelles comprises entre 0,5 et 100 m.');break}mutate(()=>{s.w=w;s.d=d;s.units='m';s.physicalVerified=true;s.approximateMeters=false;s.grid=.5;s.snapMode='line'});break}
 case'background':$('#backgroundImport').click();break;case'clearBackground':mutate(()=>S.proj.stage.bg=null);break;
 case'changeFilter':S.filter=b.dataset.filter;renderProjectModal();break;
 default:break}}
function events(){document.body.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b){const fromTools=!!b.closest('#tools');handleAction(b.dataset.act,b);if(fromTools&&b.dataset.act!=='toggleTools')setTools(false);return}const pr=e.target.closest('[data-project-act]');if(pr){projectAction(pr.dataset.projectAct,pr.dataset.id);return}const fp=e.target.closest('[data-form]');if(fp){if(fp.closest('#timelineEditor')){if(S.ignoreTimelineClick){S.ignoreTimelineClick=false;return}if(e.target.closest('.duration-handle'))return;const i=+fp.dataset.form;if(fp.dataset.segtype==='transition'){S.timingIndex=i;const f=S.proj.forms[i];seekTo(startOfForm(i)+(+f.hold||0)+(+f.transition||0)/2)}else changeFormation(i);return}changeFormation(+fp.dataset.form);return}const dur=e.target.closest('[data-timing-step]');if(dur){adjustDuration(S.timingIndex,dur.dataset.timingKey,Number(dur.dataset.timingStep));return}const al=e.target.closest('[data-align]');if(al){alignSelection(al.dataset.align);closeModal();return}const ps=e.target.closest('[data-preset]');if(ps){preset(ps.dataset.preset);closeModal();return}const pp=e.target.closest('[data-newprop]');if(pp){addProp(pp.dataset.newprop);closeModal();return}const lib=e.target.closest('[data-library-act]');if(lib){libraryAction(lib.dataset.libraryAct,lib.dataset.id);return}const tab=e.target.closest('[data-tab]');if(tab){S.tab=tab.dataset.tab;renderInspector();return}});
 $('#inspectorBody').addEventListener('change',e=>{const input=e.target.closest('[data-field]');if(input)handleEdit(input.dataset.field,input.value)});
 $('#projectImport').addEventListener('change',e=>{const f=e.target.files[0];if(f)importProject(f);e.target.value=''});
 $('#musicImport').addEventListener('change',e=>{const f=e.target.files[0];if(f)importMusic(f);e.target.value=''});
 $('#backgroundImport').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(!f.type.startsWith('image/'))return alert('Choisis une image');if(f.size>4*1024*1024)return alert('Image limitée à 4 Mo pour cette version.');const url=await new Promise(res=>{let r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)});mutate(()=>S.proj.stage.bg=url)});
 new ResizeObserver(()=>scheduleStageFit()).observe($('#scene2d'));
 window.addEventListener('orientationchange',scheduleStageFit);
  $('#stageSVG').addEventListener('pointerdown',pointerDown);$('#stageSVG').addEventListener('pointermove',pointerMove);$('#stageSVG').addEventListener('pointerup',pointerUp);$('#stageSVG').addEventListener('pointercancel',pointerUp);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerUp);
 $('#stageSVG').addEventListener('wheel',e=>{e.preventDefault();zoomStage(e.deltaY<0?1.18:1/1.18,e.clientX,e.clientY)},{passive:false});
 $('#timelineEditor').addEventListener('pointerdown',dragDurationStart);window.addEventListener('pointermove',dragDurationMove);window.addEventListener('pointerup',dragDurationEnd);window.addEventListener('pointercancel',dragDurationEnd);
 $('#timelineEditor').addEventListener('click',e=>{if(e.target.closest('.duration-handle')){e.stopPropagation();e.preventDefault();S.ignoreTimelineClick=false}},true);
 $('#timelineEditor').addEventListener('keydown',e=>{const h=e.target.closest('[data-duration-key]');if(h&&['Enter',' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();S.active=+h.dataset.durationIndex;S.timingIndex=S.active;if(e.key==='ArrowLeft'||e.key==='ArrowRight')adjustDuration(S.active,h.dataset.durationKey,e.key==='ArrowRight'?1:-1);else renderTimeline()}});
 $('#timingPanel').addEventListener('change',e=>{const inp=e.target.closest('input[data-timing-key]');if(inp){setDuration(S.timingIndex,inp.dataset.timingKey,inp.value)}});
 $('#waveform').addEventListener('pointerdown',e=>{e.preventDefault();S.dragWave=true;try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}seekWave(e)});
 $('#waveform').addEventListener('pointermove',e=>{if(S.dragWave)seekWave(e)});
 $('#waveform').addEventListener('pointerup',()=>S.dragWave=false);
 $('#waveform').addEventListener('pointercancel',()=>S.dragWave=false);
 $('#bpmInput').addEventListener('change',e=>{
  // Ne pas reconstruire la barre pendant le blur : sinon le clic suivant est perdu.
  const bpm=clamp(+e.target.value||120,30,280);e.target.value=bpm;
  S.proj.music??={};if(S.proj.music.bpm===bpm)return;
  const before=JSON.stringify(S.proj);S.proj.music.bpm=bpm;S.undo.push(before);if(S.undo.length>90)S.undo.shift();S.redo=[];saveSoon();drawWave();
 });
 $('#beatSnap').addEventListener('change',e=>mutate(()=>{S.proj.music??={};S.proj.music.beatSnap=e.target.checked}));
 $('#seekBar').addEventListener('input',e=>seekTo(playbackEnd()*Number(e.target.value)/1000));
 audio.addEventListener('loadedmetadata',()=>{if(S.proj){renderTimeline();drawWave()}});
 $('#projectSearch')?.addEventListener('input',e=>S.projectSearch=e.target.value);
 $('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
 $('#modalBody').addEventListener('input',e=>{if(e.target.id==='projectSearch'){S.projectSearch=e.target.value;let c=e.target.selectionStart;renderProjectModal();const input=$('#projectSearch');input.focus();input.setSelectionRange(c,c)}});
 document.addEventListener('keydown',e=>{const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}if(!typing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&S.selected.size&&$('#modal').classList.contains('hidden')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();shiftSelection({'ArrowLeft':'left','ArrowRight':'right','ArrowUp':'up','ArrowDown':'down'}[e.key])}if(!typing&&e.key==='Escape'){S.selected.clear();S.selectedProp=null;closeModal();setInspector(false);setTools(false);render()}if(!typing&&(e.key==='Delete'||e.key==='Backspace')&&(S.selected.size||S.selectedProp))delSelection()});
 window.addEventListener('resize',()=>{drawWave();if(S.view3d)draw3d()});window.addEventListener('beforeunload',()=>{if(S.proj)dbput('projects',S.proj)})}
async function init(){
 $('#timingDetails').open=!window.matchMedia('(max-width:740px)').matches;
 try{events()}catch(e){console.error('Initialisation des contrôles impossible',e);alert('Erreur d’initialisation de ScènePlan : '+e.message);return}
 try{
  try{S.db=await idb()}catch(e){console.warn('Stockage local indisponible : lancement temporaire',e);S.db={volatile:true};S.volatile=true}
  let items=await dball('projects');
  if(!items.length){const p=newProject('Mon premier spectacle',8);await dbput('projects',p);items=[p]}
  const active=getLastProjectId(),p=items.find(x=>x.id===active)||items.find(x=>x.status==='active')||items[0];
  await openProject(p.id);
  updateStorageStatus();
  if(S.volatile){$('#hint').textContent='Stockage bloqué sur ce navigateur. Tu peux travailler et importer tes projets, mais exporte en JSON avant de fermer : les modifications de cette session seront perdues.'}
 }catch(e){console.error(e);alert('Impossible de démarrer ScènePlan : '+e.message)}
 if('serviceWorker'in navigator&&/^https?:/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
