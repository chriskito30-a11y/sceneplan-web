'use strict';
/* Import local de projets .arrus exportés par ArrangeUs 2.9.4.
 * Interopérabilité de données : aucune requête réseau, aucune logique de licence.
 * Seul le format observé (version de données 16) est validé actuellement.
 */
(function(global){
 const KEY_BYTES=new TextEncoder().encode('PusHIsgOOnaaSavEGriZZ,fGqEeqcvHe');
 const txtDecoder=new TextDecoder('utf-8',{fatal:true});
 function num(v, fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
 function integer(v,fallback=0){return Number.isInteger(Number(v))?Number(v):fallback}
 function color(n,fallback='#ff6974'){
   if(typeof n==='string' && /^#[0-9a-f]{6}$/i.test(n))return n;
   if(!Number.isFinite(Number(n)))return fallback;
   return '#'+(Number(n)>>>0).toString(16).padStart(8,'0').slice(-6);
 }
 function uid(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4)}
 function shape(s){return ['circle','square','triangle','diamond'].includes(s)?s:'circle'}
 function fromRaw(raw){
   if(!raw || typeof raw!=='object' || !Array.isArray(raw.formations) || !raw.formations.length)throw Error('Structure de chorégraphie non reconnue.');
   if(raw.version!==16)throw Error(`Version ArrangeUs ${String(raw.version??'inconnue')} non validée : seul le schéma 16 est pris en charge actuellement.`);
   if(raw.formations.length>2000)throw Error('Trop de formations pour cet import.');
   const g=raw.gridSize||{},cell=Math.max(.01,num(g.cellSize,1));
   // Les positions x vont de 0 à gridSize.rows et les y de 0 à gridSize.columns.
   const xCells=Math.max(1,num(g.rows,22)),yCells=Math.max(1,num(g.columns,14));
   if(xCells>10000||yCells>10000)throw Error('Dimensions de grille incohérentes.');
   const count=raw.formations.reduce((m,f)=>Math.max(m,Array.isArray(f.units)?f.units.length:0),0);
   if(count<1 || count>1500)throw Error('Nombre d’artistes non pris en charge.');
   const stamp=Date.now();
   const dancers=Array.from({length:count},(_,i)=>{
     const named=raw.formations.map(f=>f.units?.[i]?.dancer?.name).find(n=>typeof n==='string'&&n.trim());
     return {id:uid(),name:named||`Artiste ${i+1}`,short:String(i+1)};
   });
   const forms=raw.formations.map((f,i)=>{
     const positions={},appear={},props=[],curves={};
     for(let k=0;k<count;k++){
       const unit=f.units?.[k];
       if(!unit){positions[dancers[k].id]={x:-.08,y:.5};appear[dancers[k].id]={color:'#888888',shape:'circle'};continue}
       const pt=unit.position||{};
       positions[dancers[k].id]={x:num(pt.x)/xCells,y:num(pt.y)/yCells};
       appear[dancers[k].id]={color:color(unit.color),shape:shape(unit.shape)};
     }
     // Pour ce fichier témoin, props et comments sont vides ; la donnée complète reste dans `source.raw`.
     // Ne pas inventer de schéma d'accessoires ou de trajectoires qui n'a pas été observé.
     const note=Array.isArray(f.comments)?f.comments.map(c=>typeof c==='string'?c:(c?.text||c?.comment||'')).filter(Boolean).join('\n'):'';
     return {id:uid(),name:String(f.name||`Formation ${i+1}`),color:color(f.color,'#ff477e'),hold:Math.max(0,num(f.duration,5)),transition:Math.max(0,num(f.transitionDuration,2)),note,positions,appear,props,curves};
   });
   const backstage=num(g.backstage?.sides,0),b=Math.min(.45,Math.max(0,backstage/xCells));
   const s=raw.settings||{};
   return {schema:1,id:uid(),name:String(raw.name||'Chorégraphie importée'),description:'Import ArrangeUs (.arrus)',status:'active',
     tags:Array.isArray(raw.tags)?raw.tags.map(t=>typeof t==='string'?t:t?.name).filter(Boolean):[],
     created:stamp,updated:stamp,
     stage:{w:xCells*cell,d:yCells*cell,grid:cell,units:'repères',snapMode:'center',physicalVerified:false,snap:s.isGridSnappingEnabled!==false,showGrid:s.isGridShown!==false,wingLeft:b,wingRight:b,bg:null,bgFit:'cover'},
     dancers,forms,
     source:{format:'ArrangeUs .arrus',dataVersion:raw.version||null,originalId:raw.id||null,
       mapping:'Positions normalisées : x / gridSize.rows, y / gridSize.columns. Les artistes sont rapprochés par index entre tableaux.',
       raw:raw}}
 }
 async function decode(buffer){
   if(!global.crypto?.subtle)throw Error('Le déchiffrement nécessite un navigateur HTTPS ou un contexte local sécurisé.');
   const bytes=new Uint8Array(buffer);
   if(bytes.length<32 || bytes.length%16!==0)throw Error('Taille du fichier .arrus invalide pour le format reconnu.');
   const key=await global.crypto.subtle.importKey('raw',KEY_BYTES,{name:'AES-CBC'},false,['decrypt']);
   let clear;
   try{clear=await global.crypto.subtle.decrypt({name:'AES-CBC',iv:bytes.slice(0,16)},key,bytes.slice(16))}
   catch(e){throw Error('Déchiffrement impossible. Ce projet utilise peut-être une autre version du format ArrangeUs.')}
   let raw;
   try{raw=JSON.parse(txtDecoder.decode(clear))}
   catch(e){throw Error('Fichier déchiffré mais données illisibles.')}
   return raw;
 }
 async function convert(buffer){return fromRaw(await decode(buffer))}
 global.ArrusImport={decode,convert,fromRaw};
})(window);
