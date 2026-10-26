import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050914');
scene.fog = new THREE.FogExp2('#050914', 0.012);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 500);
camera.position.set(0, 1.8, 9);

const clock = new THREE.Clock();
const root = new THREE.Group(); scene.add(root);
const world = new THREE.Group(); root.add(world);
const ambient = new THREE.HemisphereLight(0x9cbfff, 0x111323, 1.2); scene.add(ambient);
const keyLight = new THREE.PointLight(0x8bdfff, 80, 100); keyLight.position.set(-6, 5, 7); scene.add(keyLight);
const warmLight = new THREE.PointLight(0xffa76d, 30, 70); warmLight.position.set(7, -1, -8); scene.add(warmLight);
const sun = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 24), new THREE.MeshBasicMaterial({color:0x9deaff}));
sun.position.set(-6, 3.8, -19); scene.add(sun);
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: makeGlowTexture(), color:0x50cfff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
sunGlow.position.copy(sun.position); sunGlow.scale.set(10,10,1); scene.add(sunGlow);

function makeGlowTexture(){
 const c=document.createElement('canvas'); c.width=c.height=128; const ctx=c.getContext('2d');
 const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(150,235,255,.8)');g.addColorStop(.2,'rgba(80,190,255,.32)');g.addColorStop(1,'rgba(30,80,180,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const t=new THREE.CanvasTexture(c);return t;
}
function seededRandom(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const rand=seededRandom(98117);
function addStars(count=2500, spread=180){
 const positions=new Float32Array(count*3), colors=new Float32Array(count*3), sizes=new Float32Array(count);
 for(let i=0;i<count;i++){positions[i*3]=(rand()-.5)*spread;positions[i*3+1]=(rand()-.5)*spread*.7;positions[i*3+2]=-rand()*spread;const k=.55+rand()*.45;colors[i*3]=k*.72;colors[i*3+1]=k*.85;colors[i*3+2]=k;sizes[i]=rand()*1.4+.25}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setAttribute('size',new THREE.BufferAttribute(sizes,1));
 const mat=new THREE.PointsMaterial({size:.09,vertexColors:true,transparent:true,opacity:.9,sizeAttenuation:true,depthWrite:false});
 const stars=new THREE.Points(geo,mat);scene.add(stars);return stars;
}
const stars=addStars();

function makePlanetTexture(kind){
 const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');
 const palettes={
  aurelia:['#0b3d43','#2a8175','#b5c68b','#193c5a','#6bb4aa'],
  nyx:['#1d2b48','#4e719c','#a5c6e3','#25334f','#d0e8ff'],
  cinder:['#3b1721','#a43d2d','#e88b4b','#541e29','#f3bb73']
 }[kind];
 const grad=x.createLinearGradient(0,0,1024,512);grad.addColorStop(0,palettes[0]);grad.addColorStop(.3,palettes[1]);grad.addColorStop(.58,palettes[3]);grad.addColorStop(1,palettes[0]);x.fillStyle=grad;x.fillRect(0,0,1024,512);
 const rr=seededRandom(kind==='aurelia'?12:kind==='nyx'?25:66);
 for(let i=0;i<190;i++){
  const px=rr()*1024,py=rr()*512,w=25+rr()*180,h=5+rr()*34;
  x.fillStyle=palettes[Math.floor(rr()*palettes.length)];x.globalAlpha=.06+rr()*.16;
  x.beginPath();x.ellipse(px,py,w,h,rr()*2,0,Math.PI*2);x.fill();
 }
 x.globalAlpha=1;
 for(let i=0;i<120;i++){const px=rr()*1024,py=rr()*512,r=2+rr()*12;x.fillStyle=palettes[Math.floor(rr()*palettes.length)];x.globalAlpha=.06+rr()*.12;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}
 x.globalAlpha=1;
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function createPlanet(kind, radius, pos, parent=world){
 const group=new THREE.Group();group.position.set(...pos);parent.add(group);
 const texture=makePlanetTexture(kind);
 const mat=new THREE.MeshStandardMaterial({map:texture,roughness:.94,metalness:.02});
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,72,56),mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 const cloudMat=new THREE.MeshStandardMaterial({color:kind==='cinder'?0x7d382d:0x9cd7d4,transparent:true,opacity:.07,roughness:1,side:THREE.DoubleSide});
 const cloud=new THREE.Mesh(new THREE.SphereGeometry(radius*1.012,48,32),cloudMat);group.add(cloud);
 const atmoMat=new THREE.MeshBasicMaterial({color:kind==='nyx'?0x91cfff:kind==='cinder'?0xff8c58:0x64e7d7,transparent:true,opacity:.12,side:THREE.BackSide});
 const atmo=new THREE.Mesh(new THREE.SphereGeometry(radius*1.08,48,32),atmoMat);group.add(atmo);
 if(kind==='nyx'){
  const ring=new THREE.Mesh(new THREE.RingGeometry(radius*1.28,radius*1.8,100),new THREE.MeshBasicMaterial({color:0x8faecf,side:THREE.DoubleSide,transparent:true,opacity:.45}));
  ring.rotation.x=Math.PI*.38;group.add(ring);
 }
 return {group,mesh,cloud,kind};
}
const planetObjects={};
planetObjects.aurelia=createPlanet('aurelia',2.25,[3.8,.2,-13]);
planetObjects.nyx=createPlanet('nyx',2.7,[-6,1,-17]);
planetObjects.cinder=createPlanet('cinder',1.8,[8,-2,-16]);

function createStation(){
 const g=new THREE.Group();g.position.set(-1.5,-1.5,-8);world.add(g);
 const metal=new THREE.MeshStandardMaterial({color:0x65758b,metalness:.75,roughness:.32});
 const dark=new THREE.MeshStandardMaterial({color:0x172438,metalness:.65,roughness:.45});
 const glow=new THREE.MeshStandardMaterial({color:0x7beaff,emissive:0x2d9cbf,emissiveIntensity:2,metalness:.2,roughness:.3});
 function box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m}
 function cylinder(r1,r2,h,mat,x,y,z,rotX=0,rotZ=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,20),mat);m.position.set(x,y,z);m.rotation.x=rotX;m.rotation.z=rotZ;m.castShadow=true;g.add(m);return m}
 // Central habitat module and axial spine
 cylinder(.82,.82,2.5,metal,0,0,0,Math.PI/2);
 cylinder(.95,.95,.12,dark,-.7,0,0,Math.PI/2);
 cylinder(.95,.95,.12,dark,.7,0,0,Math.PI/2);
 cylinder(.75,.75,.08,glow,-.78,0,0,Math.PI/2);
 cylinder(.75,.75,.08,glow,.78,0,0,Math.PI/2);
 box(5,.12,.12,metal,0,0,0);
 box(2.4,.08,1.5,dark,0,0,0);
 for(let i=-1;i<=1;i++){box(.13,.06,.06,glow,i*1.6,.12,0)}
 // Solar arrays
 for(const side of [-1,1]){
  const arm=box(.15,.15,1.3,metal,side*1.2,0,0);
  const panel=box(2.3,.07,1.1,new THREE.MeshStandardMaterial({color:0x183d64,metalness:.5,roughness:.3}),side*2.4,0,0);
  for(let j=-3;j<=3;j++)box(.015,.075,1.1,glow,side*2.4+j*.31,.045,0);
 }
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,.07,10,64),metal);ring.rotation.y=.2;g.add(ring);
 const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.55,.025,8,64),glow);ring2.rotation.y=.2;g.add(ring2);
 return g;
}
const station=createStation();

function createBlackHole(){
 const g=new THREE.Group();g.position.set(0,.4,-12);world.add(g);
 const hole=new THREE.Mesh(new THREE.SphereGeometry(1.08,48,32),new THREE.MeshBasicMaterial({color:0x010207}));g.add(hole);
 const diskMat=new THREE.MeshBasicMaterial({color:0xff9b55,transparent:true,opacity:.85,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});
 const disk=new THREE.Mesh(new THREE.TorusGeometry(2.05,.42,18,120),diskMat);disk.rotation.x=Math.PI*.18;g.add(disk);
 const disk2=new THREE.Mesh(new THREE.TorusGeometry(1.48,.18,14,120),new THREE.MeshBasicMaterial({color:0x67caff,transparent:true,opacity:.5,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));disk2.rotation.x=Math.PI*.25;g.add(disk2);
 const lens=new THREE.Mesh(new THREE.TorusGeometry(1.2,.035,8,90),new THREE.MeshBasicMaterial({color:0xffd5a2,transparent:true,opacity:.7}));lens.rotation.x=Math.PI*.5;g.add(lens);
 const particleCount=800, p=new Float32Array(particleCount*3), colors=new Float32Array(particleCount*3);
 for(let i=0;i<particleCount;i++){const a=rand()*Math.PI*2,r=1.2+rand()*1.6;p[i*3]=Math.cos(a)*r;p[i*3+1]=(rand()-.5)*.22;p[i*3+2]=Math.sin(a)*r;const q=rand();colors[i*3]=1;colors[i*3+1]=.35+q*.5;colors[i*3+2]=.12+q*.8}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 const particles=new THREE.Points(geo,new THREE.PointsMaterial({size:.035,vertexColors:true,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false}));g.add(particles);
 return {group:g,disk,disk2,particles};
}
const blackhole=createBlackHole();

function createCockpit(){
 const g=new THREE.Group();g.position.set(0,-.8,1.4);scene.add(g);
 const darkmat=new THREE.MeshStandardMaterial({color:0x111b2b,metalness:.72,roughness:.3});
 const trim=new THREE.MeshStandardMaterial({color:0x526780,metalness:.8,roughness:.28});
 const screenmat=new THREE.MeshBasicMaterial({color:0x2b9fc5,transparent:true,opacity:.7});
 function box(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m}
 // Lower console edge, side rails and HUD panels
 box(7,.22,.35,darkmat,0,-.45,-1.2);
 box(.24,1.5,.28,trim,-3.25,.2,-1.1,0,0,-.1);
 box(.24,1.5,.28,trim,3.25,.2,-1.1,0,0,.1);
 box(2.5,.5,.14,darkmat,-1.8,-.2,-1.05,-.18,0,0);
 box(2.5,.5,.14,darkmat,1.8,-.2,-1.05,-.18,0,0);
 for(let i=0;i<5;i++){box(.28,.13,.025,screenmat,-2.55+i*.37,.02,-.95);box(.28,.13,.025,screenmat,1.8+i*.37,.02,-.95)}
 box(1.15,.36,.1,trim,0,-.12,-1.05,-.15,0,0);
 // central holographic reticle
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.008,8,60),new THREE.MeshBasicMaterial({color:0x8ceeff,transparent:true,opacity:.6}));ring.position.set(0,.1,-2.6);g.add(ring);
 return g;
}
const cockpit=createCockpit();

function createExplorer(){
 const g=new THREE.Group();g.position.set(0,-1.8,-5.5);world.add(g);
 const suit=new THREE.MeshStandardMaterial({color:0x9eb8cb,metalness:.25,roughness:.65});
 const darkSuit=new THREE.MeshStandardMaterial({color:0x263a52,metalness:.3,roughness:.45});
 const visor=new THREE.MeshStandardMaterial({color:0x163a57,metalness:.8,roughness:.12,emissive:0x092c46});
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.26,.58,5,12),suit);body.position.y=1.05;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.23,20,16),suit);head.position.y=1.65;g.add(head);
 const glass=new THREE.Mesh(new THREE.SphereGeometry(.19,20,16,0,Math.PI*2,0,Math.PI*.55),visor);glass.position.set(0,1.68,.08);g.add(glass);
 const backpack=new THREE.Mesh(new THREE.BoxGeometry(.36,.5,.2),darkSuit);backpack.position.set(0,1.12,-.27);g.add(backpack);
 const limbs=[];
 for(const side of [-1,1]){
  const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.09,.42,4,8),suit);arm.position.set(side*.36,1.1,0);arm.rotation.z=side*.13;g.add(arm);limbs.push(arm);
  const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.45,4,8),darkSuit);leg.position.set(side*.14,.42,0);g.add(leg);limbs.push(leg);
  const boot=new THREE.Mesh(new THREE.BoxGeometry(.18,.13,.28),suit);boot.position.set(side*.14,.12,.05);g.add(boot);
 }
 const lamp=new THREE.PointLight(0x80e8ff,2,3);lamp.position.set(0,1.7,.3);g.add(lamp);
 return {group:g,limbs};
}
const explorer=createExplorer();

const modes={
 cockpit:{title:'Beyond the<br><em>known.</em>',eyebrow:'FLIGHT DECK // ORBITAL VIEW',desc:'A new frontier begins where the familiar ends. Chart the unknown, discover distant worlds, and look deeper into the cosmos.',loc:'ORBITAL BRIDGE',sub:'EARTH-LUNA LAGRANGE POINT',objective:'Map the outer rim',objectiveDesc:'Survey the surrounding star field and identify a viable destination.',index:'01',sector:'09–A'},
 planets:{title:'Worlds without<br><em>limits.</em>',eyebrow:'DEEP SPACE // PLANETARY SYSTEM',desc:'Three distant worlds. Three different destinies. Choose a destination and chart a course through the unknown.',loc:'PLANETARY SYSTEM',sub:'AURELIA / NYX-9 / CINDER',objective:'Select a destination',objectiveDesc:'Inspect a planet and set a course to begin your approach.',index:'02',sector:'12–C'},
 station:{title:'A foothold in<br><em>infinity.</em>',eyebrow:'EXTRAVEHICULAR // STATION 07',desc:'Leave the bridge behind. Move through the station, inspect its modules, and explore the silent architecture of orbit.',loc:'KEPLER OUTPOST',sub:'LOW ORBIT / SECTOR 07',objective:'Inspect the habitat ring',objectiveDesc:'Approach the station structure and activate the interaction console.',index:'03',sector:'07–B'},
 blackhole:{title:'Face the<br><em>impossible.</em>',eyebrow:'ANOMALY WATCH // EVENT HORIZON',desc:'Gravity rewrites the rules here. Observe the luminous accretion disk and study the dark heart of a cosmic anomaly.',loc:'ANOMALY 001',sub:'UNSTABLE GRAVITATIONAL FIELD',objective:'Scan the event horizon',objectiveDesc:'Observe the anomaly from a safe distance and complete the scan.',index:'04',sector:'00–X'}
};
let mode='cockpit', selectedPlanet='aurelia', targetCam=new THREE.Vector3(0,1.8,9), targetLook=new THREE.Vector3(0,0,-10);
let yaw=0,pitch=0, pointerDown=false,lastX=0,lastY=0,sensitivity=1, quality='high', bloom=true, objectiveDone=false, move={x:0,z:0}, keys={};
let camAuto=true, traveling=false, travelT=0, travelFrom=new THREE.Vector3(), travelTo=new THREE.Vector3();
const $=s=>document.querySelector(s);
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2400)}
function setMode(next){
 mode=next;document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
 const m=modes[mode];$('#scene-title').innerHTML=m.title;$('#eyebrow-text').textContent=m.eyebrow;$('#scene-description').textContent=m.desc;$('#location-name').textContent=m.loc;$('#location-sub').textContent=m.sub;$('#objective-title').textContent=m.objective;$('#objective-desc').textContent=m.objectiveDesc;$('#scene-index').textContent=m.index;$('#sector-code').textContent=m.sector;
 $('#planet-picker').classList.toggle('hidden',mode!=='planets');$('#station-controls').classList.toggle('hidden',mode!=='station');
 cockpit.visible=mode==='cockpit';
 planetObjects.aurelia.group.visible=mode==='planets'||mode==='cockpit';
 planetObjects.nyx.group.visible=mode==='planets'||mode==='cockpit';
 planetObjects.cinder.group.visible=mode==='planets'||mode==='cockpit';
 station.visible=mode==='station'||mode==='cockpit';
 explorer.group.visible=mode==='station';
 blackhole.group.visible=mode==='blackhole';
 if(mode==='cockpit'){targetCam.set(0,1.8,9);targetLook.set(0,0,-10)}
 if(mode==='planets'){targetCam.set(0,2.2,7.8);targetLook.set(1,0,-13)}
 if(mode==='station'){targetCam.set(0,2.4,2.5);targetLook.set(0,0,-6);explorer.group.position.set(0,-1.8,-5.5)}
 if(mode==='blackhole'){targetCam.set(0,2.4,8.5);targetLook.set(0,.4,-12)}
 camAuto=true;showToast(`${m.loc} // NAVIGATION UPDATED`);
}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('#primary-action').addEventListener('click',()=>{
 if(mode==='planets'){$('#planet-picker').classList.remove('hidden');showToast('SELECT A PLANET TO SET COURSE');}
 else if(mode==='station'){showToast('EXPLORER SYSTEMS ACTIVE');}
 else if(mode==='blackhole'){showToast('ANOMALY SCAN INITIATED');$('#objective-title').textContent='Analyzing event horizon';}
 else {setMode('planets');$('#planet-picker').classList.remove('hidden');}
});
$('#view-toggle').addEventListener('click',()=>{
 if(mode==='cockpit'){camera.position.x=camera.position.x===0?2.2:0;showToast('CAMERA VIEW CHANGED')}
 else if(mode==='planets'){const p=planetObjects[selectedPlanet].group.position;targetCam.set(p.x+1.5,p.y+1.5,p.z+4);targetLook.copy(p);showToast('PLANETARY CLOSE-UP')}
 else if(mode==='station'){targetCam.x=targetCam.x===0?2:0;showToast('EXTERIOR CAMERA CHANGED')}
 else {targetCam.x=targetCam.x===0?2:0;showToast('ANOMALY VIEW CHANGED')}
 camAuto=true;
});
$('#settings-open').addEventListener('click',()=>$('#settings-modal').classList.remove('hidden'));
$('#settings-close').addEventListener('click',()=>$('#settings-modal').classList.add('hidden'));
$('#settings-modal').addEventListener('click',e=>{if(e.target.id==='settings-modal')$('#settings-modal').classList.add('hidden')});
$('#quality').addEventListener('change',e=>{quality=e.target.value;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='high'?1.75:quality==='medium'?1.25:1));renderer.shadowMap.enabled=quality!=='low';showToast(`RENDER QUALITY: ${quality.toUpperCase()}`)});
$('#bloom-toggle').addEventListener('change',e=>{bloom=e.target.checked;sunGlow.material.opacity=bloom?1:0.35;showToast(`GLOW EFFECT ${bloom?'ENABLED':'REDUCED'}`)});
$('#sensitivity').addEventListener('input',e=>sensitivity=Number(e.target.value));
$('#reset-camera').addEventListener('click',()=>{setMode(mode);$('#settings-modal').classList.add('hidden');showToast('CAMERA RESET')});
document.querySelectorAll('.planet-card').forEach(b=>b.addEventListener('click',()=>{selectedPlanet=b.dataset.planet;document.querySelectorAll('.planet-card').forEach(x=>x.classList.toggle('selected',x===b));const p=planetObjects[selectedPlanet];$('#location-name').textContent=selectedPlanet.toUpperCase();$('#location-sub').textContent='DESTINATION LOCKED // COURSE AVAILABLE';showToast(`${selectedPlanet.toUpperCase()} SELECTED`)}));
$('#close-picker').addEventListener('click',()=>$('#planet-picker').classList.add('hidden'));
$('#travel-button').addEventListener('click',()=>{
 const p=planetObjects[selectedPlanet].group.position;travelFrom.copy(camera.position);travelTo.set(p.x*.65,p.y+1.5,p.z+5.8);travelT=0;traveling=true;targetLook.copy(p);$('#planet-picker').classList.add('hidden');showToast(`COURSE SET: ${selectedPlanet.toUpperCase()}`);
});
$('#objective-complete').addEventListener('click',()=>{objectiveDone=!objectiveDone;$('#objective-complete').innerHTML=objectiveDone?'OBJECTIVE COMPLETE ✓ <span>✓</span>':'MARK OBJECTIVE COMPLETE <span>↗</span>';$('#objective-title').textContent=objectiveDone?'Objective logged':modes[mode].objective;$('#objective-desc').textContent=objectiveDone?'Mission record updated. Proceed to the next exploration milestone.':modes[mode].objectiveDesc;showToast(objectiveDone?'OBJECTIVE LOGGED':'OBJECTIVE REOPENED')});
$('#interact-button').addEventListener('click',()=>showToast('STATION CONSOLE // DATA LINK ESTABLISHED'));

window.addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(['w','a','s','d',' '].includes(e.key.toLowerCase()))e.preventDefault();if(e.key.toLowerCase()==='e'&&mode==='station')showToast('STATION CONSOLE // DATA LINK ESTABLISHED')});
window.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
canvas.addEventListener('pointerdown',e=>{pointerDown=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId)});
window.addEventListener('pointerup',()=>pointerDown=false);
window.addEventListener('pointermove',e=>{if(!pointerDown)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.002*sensitivity;pitch-=dy*.0015*sensitivity;pitch=THREE.MathUtils.clamp(pitch,-.7,.7);camAuto=false});
const joystick=$('#joystick'), knob=$('#joystick-knob');let joyActive=false;
function joyMove(e){if(!joyActive)return;const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=29,mag=Math.hypot(dx,dy);if(mag>max){dx=dx/mag*max;dy=dy/mag*max}knob.style.transform=`translate(${dx}px,${dy}px)`;move.x=dx/max;move.z=dy/max}
joystick.addEventListener('pointerdown',e=>{joyActive=true;joystick.setPointerCapture(e.pointerId);joyMove(e)});
joystick.addEventListener('pointermove',joyMove);
function joyEnd(){joyActive=false;move.x=move.z=0;knob.style.transform='translate(0,0)'}
joystick.addEventListener('pointerup',joyEnd);joystick.addEventListener('pointercancel',joyEnd);

function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.04), t=clock.elapsedTime;
 // Environmental motion
 stars.rotation.y+=dt*.002;
 sunGlow.material.opacity=bloom?.82+.12*Math.sin(t*1.3):.3;
 for(const [key,p] of Object.entries(planetObjects)){p.mesh.rotation.y+=dt*(key==='cinder'?.06:.018);p.cloud.rotation.y-=dt*.006;}
 station.rotation.y=Math.sin(t*.15)*.06;
 blackhole.disk.rotation.z+=dt*.18;blackhole.disk2.rotation.z-=dt*.11;blackhole.particles.rotation.y+=dt*.08;blackhole.group.rotation.y=Math.sin(t*.1)*.05;
 cockpit.rotation.z=Math.sin(t*.25)*.003;
 // Camera transitions and manual look
 if(traveling){travelT=Math.min(1,travelT+dt*.32);const smooth=travelT*travelT*(3-2*travelT);camera.position.lerpVectors(travelFrom,travelTo,smooth);if(travelT>=1){traveling=false;setMode('planets');camera.position.copy(travelTo);showToast('ARRIVAL CONFIRMED');}}
 const inputX=(keys.d?1:0)-(keys.a?1:0)+move.x, inputZ=(keys.s?1:0)-(keys.w?1:0)+move.z;
 if(mode==='station'&&(Math.abs(inputX)+Math.abs(inputZ)>.01)){
  const speed=dt*2.5;explorer.group.position.x+=inputX*speed;explorer.group.position.z+=inputZ*speed;
  explorer.group.position.x=THREE.MathUtils.clamp(explorer.group.position.x,-3.2,3.2);explorer.group.position.z=THREE.MathUtils.clamp(explorer.group.position.z,-7,-3.2);
  explorer.group.rotation.y=Math.atan2(inputX,inputZ);
  explorer.limbs.forEach((l,i)=>{l.rotation.x=Math.sin(t*9+i*Math.PI)*.42});
 }else{explorer.limbs.forEach(l=>l.rotation.x=THREE.MathUtils.damp(l.rotation.x,0,5,dt))}
 if(mode!=='station'&&(Math.abs(inputX)+Math.abs(inputZ)>.01)){camera.position.x+=inputX*dt*1.5;camera.position.z+=inputZ*dt*1.5;camAuto=false}
 if(camAuto&&!traveling){camera.position.lerp(targetCam,1-Math.exp(-dt*1.8));}
 const direction=new THREE.Vector3(Math.sin(yaw),Math.sin(pitch),-Math.cos(yaw));
 const lookTarget=camera.position.clone().add(direction.multiplyScalar(10));
 if(camAuto&&!pointerDown)lookTarget.lerp(targetLook,0.4);
 camera.lookAt(lookTarget);
 const fps=Math.round(1/Math.max(dt,.001));$('#fps').innerHTML=`${fps} <small>FPS</small>`;$('#fps-bar').style.width=`${Math.min(100,fps/60*100)}%`;
 $('#velocity').innerHTML=`${(Math.hypot(inputX,inputZ)*.18+.02).toFixed(2)} <small>AU/s</small>`;
 $('#coords').textContent=`X ${camera.position.x>=0?'+':'−'}${Math.abs(camera.position.x*3.1).toFixed(2)} / Y ${camera.position.y>=0?'+':'−'}${Math.abs(camera.position.y*2.1).toFixed(2)} / Z ${camera.position.z>=0?'+':'−'}${Math.abs(camera.position.z*1.8).toFixed(2)}`;
 renderer.render(scene,camera);
}
function resize(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='high'?1.75:quality==='medium'?1.25:1))}
window.addEventListener('resize',resize);
function boot(){
 let progress=0;const interval=setInterval(()=>{progress=Math.min(100,progress+Math.random()*17+8);$('#boot-progress').style.width=progress+'%';$('#boot-status').textContent=progress<35?'CALIBRATING OPTICS':progress<70?'MAPPING STAR FIELD':'SYNCHRONIZING FLIGHT SYSTEMS';if(progress>=100){clearInterval(interval);setTimeout(()=>{const b=$('#boot');b.style.opacity='0';setTimeout(()=>b.remove(),650)},250)}},110);
}
setMode('cockpit');boot();animate();
setInterval(()=>{const d=new Date();$('#clock').textContent=d.toISOString().slice(11,19)+' UTC'},1000);
