import * as THREE from './lib/three/three.module.min.js';

// One scene, no external models/textures, and no continuously running idle loop.
export function mountCabinet(host) {
  const stage = host.querySelector('.cabinet-viewport');
  const status = host.querySelector('[data-cabinet-status]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const events = new AbortController();
  const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
  const resources = new Set();
  const keep = resource => { resources.add(resource); return resource; };
  let renderer, touchStick, resizeObserver, intersectionObserver, disposed = false;
  let visible = true, frame = 0, lastTime = 0, hovered = null, active = null;
  let bootAt = null, powered = false, textureFrame = -1, message = '', messageUntil = 0;
  let zoom = false, focusControl = null, joystickX = 0, joystickY = 0;
  const targetRotation = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const controls = new Map();
  const hitMeshes = [];
  let wake = () => {};
  const scene = new THREE.Scene();
  const cabinet = new THREE.Group();
  scene.add(cabinet);
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 40);
  const cameraHome = new THREE.Vector3(3.35, 2.6, 7.3);
  camera.position.copy(cameraHome);
  const viewTarget = new THREE.Vector3(0, -.04, 0);
  camera.lookAt(viewTarget);

  function material(color, extra = {}) {
    return keep(new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .14, ...extra }));
  }
  function mesh(geometry, mat, parent = cabinet) {
    const object = new THREE.Mesh(keep(geometry), mat);
    object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(w, h, d, x, y, z, mat, parent = cabinet) {
    const object = mesh(new THREE.BoxGeometry(w, h, d), mat, parent);
    object.position.set(x, y, z); return object;
  }
  function cylinder(radius, height, x, y, z, mat, parent = cabinet) {
    const object = mesh(new THREE.CylinderGeometry(radius, radius, height, 24), mat, parent);
    object.position.set(x, y, z); return object;
  }
  function texture(width, height, draw) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw?.(canvas.getContext('2d'), width, height);
    const map = keep(new THREE.CanvasTexture(canvas)); map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 2; return map;
  }
  function label(text, w, h, color = '#d7c8b8', size = 36) {
    return texture(512, 128, ctx => {
      ctx.fillStyle = color; ctx.font = `600 ${size}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64);
    });
  }
  function decal(map, w, h, x, y, z, parent = cabinet, top = false) {
    const mat = keep(new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
    const object = mesh(new THREE.PlaneGeometry(w, h), mat, parent);
    object.castShadow = false; object.position.set(x, y, z);
    if (top) object.rotation.x = -Math.PI / 2;
    return object;
  }
  function interactive(id, object, group = object) {
    object.userData.control = id; group.userData.control = id; hitMeshes.push(object);
    if (!controls.has(id)) controls.set(id, { group, rest: group.position.y, pressed: false });
    return object;
  }
  function announce(text) { status.textContent = text; }
  function feedback(text) {
    message = text; messageUntil = performance.now() + 1400; textureFrame = -1; wake();
  }
  function boot() {
    if (bootAt !== null) return;
    powered = motion.matches; bootAt = motion.matches ? null : performance.now(); textureFrame = -1;
    announce(powered ? 'CRT ready. Click the screen to open the game library.' : 'CRT starting.'); wake();
  }
  function openLibrary() {
    // Use the same anchor as the hero's existing library link.
    host.querySelector('[data-cabinet-library]').click();
  }
  function activate(id) {
    if (id === 'start') boot();
    else if (id === 'screen') openLibrary();
    else if (id?.startsWith('button')) {
      if (!powered && bootAt === null) announce(`Button ${id.slice(-1)} pressed. Press START to power the CRT.`);
      else { announce(`Button ${id.slice(-1)} pressed.`); feedback(`BUTTON ${id.slice(-1)}  /  INPUT OK`); }
    }
  }

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    stage.append(renderer.domElement);
    touchStick=document.createElement('div');touchStick.className='cabinet-stick-touch';touchStick.setAttribute('aria-hidden','true');stage.append(touchStick);
    scene.add(new THREE.HemisphereLight(0xe6e8e5, 0x393339, 2.6));
    const key = new THREE.DirectionalLight(0xffe5c7, 4.2);
    key.position.set(-3.2, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4; key.shadow.normalBias = .025;
    key.shadow.bias = -.0002; key.shadow.radius = 3; scene.add(key);
    const rim = new THREE.DirectionalLight(0xe89151, 2.1); rim.position.set(4, 3, -3); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xb1cad5, 1.1); fill.position.set(3, 1, 4); scene.add(fill);

    const shell = material(0x292d30), edge = material(0x161a1d), panel = material(0x363a3c);
    const orange = material(0xb76a35, { roughness: .45 });
    const metal = material(0x8d9595, { metalness: .8, roughness: .34 });
    const black = material(0x080c0e), trim = material(0x42484b);
    // Side profile is extruded as two wooden panels, with continuous T-moulding.
    const profile = [[-.60,-1.8],[.62,-1.8],[.62,-.24],[.95,-.04],[.95,.18],[.46,.40],[.30,1.22],[.63,1.32],[.63,1.78],[-.60,1.78]];
    const shape = new THREE.Shape(profile.map(([z,y]) => new THREE.Vector2(-z,y)));
    for (const x of [-.86, .77]) {
      const side = mesh(new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1, steps: 1 }), shell);
      side.rotation.y = Math.PI / 2; side.position.x = x;
      const points = [...profile, profile[0]].map(([z,y]) => new THREE.Vector3(x + (x < 0 ? -.01 : .10), y, z));
      mesh(new THREE.TubeGeometry(new THREE.CurvePath().add(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0)), 70, .012, 6, false), orange);
    }
    box(1.56, 1.54, 1.14, 0, -1.01, 0, shell);
    box(1.55, .13, 1.13, 0, -1.72, 0, edge);
    box(1.58, .30, .08, 0, -.25, .56, panel);
    box(1.55, .14, .76, 0, 1.72, .0, edge);
    box(1.55, .43, 1.10, 0, 1.53, .01, shell);
    box(1.47, .30, .035, 0, 1.53, .604, black);
    const marquee = texture(1024, 256, ctx => {
      ctx.fillStyle = '#131d21'; ctx.fillRect(0,0,1024,256);
      ctx.strokeStyle = '#5b4533'; ctx.lineWidth = 3; ctx.strokeRect(16,16,992,224);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 90px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = '#f0ad77'; ctx.fillText('RETRO', 319,122);
      ctx.font = '300 90px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = '#f5e8d8'; ctx.fillText('ARCADE', 693,122);
      ctx.font = '18px monospace'; ctx.fillStyle = '#a99982'; ctx.fillText('GOOD GAMES NEVER GET OLD', 512,202);
    });
    decal(marquee,1.45,.29,0,1.53,.625);
    // Screen sits inside a solid tilted bezel; its subtly convex glass has real depth.
    const screenHousing = new THREE.Group(); screenHousing.position.set(0,.83,.43); screenHousing.rotation.x = -.20; cabinet.add(screenHousing);
    box(1.54,1.0,.19,0,0,-.045,edge,screenHousing);
    box(1.32,.84,.035,0,0,.061,black,screenHousing);
    box(1.23,.77,.025,0,0,.084,trim,screenHousing);
    const screenMap = texture(512,384);
    const glass = new THREE.PlaneGeometry(1.18,.73,24,18);
    const pos = glass.attributes.position;
    for (let i=0;i<pos.count;i++) {
      const x = pos.getX(i)/.59, y = pos.getY(i)/.365;
      pos.setZ(i,.042*(1-x*x)*(1-y*y));
    }
    glass.computeVertexNormals();
    const screen = mesh(glass,keep(new THREE.MeshBasicMaterial({ map:screenMap,toneMapped:false })),screenHousing);
    screen.position.z=.103; screen.castShadow=false; interactive('screen',screen);
    // Speaker grille and real fasteners make the upper housing mechanically plausible.
    for (const side of [-1,1]) for (let i=0;i<6;i++) box(.17,.012,.014, side*.54,1.285-i*.027,.557,black);
    for (const x of [-.70,.70]) for (const y of [.36,1.26]) {
      const screw = cylinder(.017,.009,0,0,0,metal); screw.rotation.x=Math.PI/2; screw.position.set(x,y,.557);
    }
    const deck = new THREE.Group(); deck.position.set(0,.145,.52); deck.rotation.x=.16; cabinet.add(deck);
    box(1.72,.16,.82,0,0,0,panel,deck);
    box(1.73,.055,.045,0,-.045,.414,orange,deck);
    decal(label('PLAYER 1',1,1,'#b8b7ab',25),.35,.09,-.43,.086,-.29,deck,true);
    const stick = new THREE.Group(); stick.position.set(-.43,.106,.055); deck.add(stick);
    cylinder(.15,.025,-.43,.096,.055,black,deck);
    cylinder(.079,.013,0,.015,0,edge,stick);
    cylinder(.028,.30,0,.16,0,metal,stick);
    const ball = mesh(new THREE.SphereGeometry(.095,24,16),material(0xe89555,{roughness:.32}),stick); ball.position.y=.32;
    interactive('joystick',ball,stick);
    // The shaft is also draggable. Raycast surfaces are independent from the shell.
    stick.children.forEach(child=>{child.userData.control='joystick';if(!hitMeshes.includes(child))hitMeshes.push(child);});
    const colors=[0xeb9755,0xcbbc97,0xa54d36,0xddd5bf];
    const positions=[[.19,.23],[.47,.23],[.27,-.06],[.55,-.06]];
    positions.forEach(([x,z],i)=>{
      cylinder(.119,.025,x,.091,z,black,deck);
      const group=new THREE.Group();group.position.set(x,.112,z);deck.add(group);
      const capMat=material(colors[i],{roughness:.36,emissive:colors[i],emissiveIntensity:0});
      const points=[[0,0],[.093,0],[.104,.009],[.106,.038],[.095,.051],[0,.051]].map(([r,y])=>new THREE.Vector2(r,y));
      const cap=mesh(new THREE.LatheGeometry(points,24),capMat,group);
      interactive(`button${'ABCD'[i]}`,cap,group);
      decal(label('ABCD'[i],1,1,'#24221e',48),.07,.023,0,.053,0,group,true);
    });
    cylinder(.071,.018,-.65,.094,.23,black,deck);
    const startGroup=new THREE.Group();startGroup.position.set(-.65,.108,.23);deck.add(startGroup);
    interactive('start',cylinder(.054,.038,0,.014,0,material(0xe2d6b7,{roughness:.4}),startGroup),startGroup);
    decal(label('START',1,1,'#d2c5b2',29),.21,.058,-.65,.087,.35,deck,true);
    // Metal coin door, illuminated reject button, return tray and recessed kick plate.
    box(.48,.67,.04,0,-.81,.588,black);
    box(.43,.61,.018,0,-.81,.615,panel);
    box(.25,.10,.028,0,-.63,.633,orange);
    box(.025,.065,.006,0,-.63,.650,black);
    decal(label('25¢  /  1 PLAY',1,1,'#c5b9a6',32),.28,.07,0,-.50,.633);
    box(.26,.14,.025,0,-.96,.635,black);
    box(.27,.022,.07,0,-1.03,.66,trim);
    const lock=cylinder(.025,.008,0,0,0,metal);lock.rotation.x=Math.PI/2;lock.position.set(.13,-.80,.633);
    box(1.40,.13,.025,0,-1.55,.59,edge);
    decal(label('R ↗',1,1,'#bd855c',54),.43,.14,0,-1.29,.588);
    // Cabinet rests on a floor; it never floats or rotates about an arbitrary corner.
    const floor=mesh(new THREE.PlaneGeometry(12,12),keep(new THREE.ShadowMaterial({opacity:.09})),scene);
    floor.rotation.x=-Math.PI/2;floor.position.y=-1.83;floor.castShadow=false;
    const contactMap=texture(256,256,ctx=>{
      const gradient=ctx.createRadialGradient(128,128,10,128,128,125);
      gradient.addColorStop(0,'#0009');gradient.addColorStop(.45,'#0006');gradient.addColorStop(1,'#0000');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
    });
    const contact=mesh(new THREE.PlaneGeometry(3.2,2.6),keep(new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false})),scene);
    contact.rotation.x=-Math.PI/2;contact.position.set(0,-1.825,.1);contact.castShadow=false;

    function drawScreen(now) {
      const elapsed=bootAt===null?0:now-bootAt;
      if(bootAt!==null&&elapsed>2200){bootAt=null;powered=true;announce('CRT ready. Click the screen to open the game library.');}
      const phase=bootAt===null?(powered?'ready':'off'):Math.floor(elapsed/65);
      const key=`${phase}/${now<messageUntil?message:''}`;
      if(key===textureFrame)return;textureFrame=key;
      const ctx=screenMap.image.getContext('2d');
      ctx.fillStyle='#091414';ctx.fillRect(0,0,512,384);
      ctx.textAlign='center';ctx.textBaseline='middle';
      if(bootAt!==null&&!motion.matches&&elapsed<260){
        ctx.fillStyle='#e3f3d3';ctx.fillRect(65,191,382,Math.max(2,elapsed/18));
      }else if(bootAt!==null&&!motion.matches){
        ctx.textAlign='left';ctx.font='19px monospace';ctx.fillStyle='#b8c2a1';
        ['RETRO ARCADE / SYSTEM 01','MEMORY CHECK ........ OK','CONTROLS ............ OK','LOADING THE CLASSICS ...'].slice(0,Math.min(4,1+Math.floor((elapsed-260)/400))).forEach((line,i)=>ctx.fillText(line,30,95+i*45));
        ctx.fillStyle='#344138';ctx.fillRect(30,310,452,7);ctx.fillStyle='#eaa774';ctx.fillRect(30,310,452*Math.min(1,elapsed/2200),7);
      }else if(powered||bootAt!==null){
        ctx.strokeStyle='#3e4c342f';ctx.lineWidth=1;
        for(let x=-300;x<850;x+=75){ctx.beginPath();ctx.moveTo(256,180);ctx.lineTo(x,384);ctx.stroke();}
        for(let y=242;y<384;y+=26){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
        ctx.fillStyle='#95a899';ctx.font='14px monospace';ctx.fillText('PLAYER 1  /  READY',256,41);
        ctx.fillStyle='#edb683';ctx.font='bold 47px monospace';ctx.fillText('ONE MORE',256,143);ctx.font='bold 64px monospace';ctx.fillText('ROUND.',256,204);
        ctx.fillStyle='#aabb9d';ctx.font='16px monospace';ctx.fillText(now<messageUntil?message:'OPEN GAME LIBRARY  >',256,303);
        if(joystickX||joystickY){ctx.fillStyle='#efb37d';ctx.beginPath();ctx.arc(256+joystickX*110,347+joystickY*15,4,0,Math.PI*2);ctx.fill();}
      }else{
        ctx.fillStyle='#35504a';ctx.font='bold 77px monospace';ctx.fillText('R ↗',256,169);
        ctx.fillStyle='#b2bba5';ctx.font='19px monospace';ctx.fillText('PRESS START',256,278);
      }
      // Restrained glass reflection, edge vignette and static CRT scanlines.
      const reflection=ctx.createLinearGradient(0,0,420,320);reflection.addColorStop(0,'#c9d6cf0c');reflection.addColorStop(.45,'#c9d6cf04');reflection.addColorStop(1,'#0000');ctx.fillStyle=reflection;ctx.fillRect(0,0,512,384);
      ctx.fillStyle='#00000022';for(let y=0;y<384;y+=4)ctx.fillRect(0,y,512,1);
      const vignette=ctx.createRadialGradient(256,192,95,256,192,310);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#0009');ctx.fillStyle=vignette;ctx.fillRect(0,0,512,384);
      screenMap.needsUpdate=true;
    }
    function pick(event) {
      const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
      ray.setFromCamera(pointer,camera);
      // Include the cabinet as an occluder so controls cannot be picked through its side.
      const hits=ray.intersectObject(cabinet,true);
      let object=hits[0]?.object;
      while(object&&object!==cabinet){if(object.userData.control)return object.userData.control;object=object.parent;}
      return null;
    }
    function setHover(id){
      if(id&&id!==hovered){
        if(id==='joystick')announce('Joystick · drag to tilt, release to centre.');
        else if(id.startsWith('button'))announce(`Button ${id.slice(-1)} · press to test.`);
        else if(id==='start')announce('START · power the CRT.');
        else if(id==='screen')announce('Screen · open the game library.');
      }
      hovered=id;renderer.domElement.style.cursor=id==='joystick'?'grab':id?'pointer':'default';wake();
    }
    function release(event,cancel=false){
      if(!active||event.pointerId!==active.pointerId)return;
      const previous=active;active=null;
      controls.forEach(c=>c.pressed=false);joystickX=joystickY=0;textureFrame=-1;
      if(previous.surface.hasPointerCapture(event.pointerId))previous.surface.releasePointerCapture(event.pointerId);
      // A cap moves away from the ray as it sinks. Keep a small tap tolerance,
      // while a deliberate drag (including a screen swipe) never becomes a click.
      const travel=Math.hypot(event.clientX-previous.x,event.clientY-previous.y);
      if(!cancel&&previous.id!=='joystick'&&travel<12&&(previous.id!=='screen'||pick(event)==='screen'))activate(previous.id);
      setHover(cancel?null:pick(event));
      if(previous.id==='joystick')announce('Joystick released · returning to centre.');
      wake();
    }
    const movePointer=event=>{
      if(active){
        if(event.pointerId===active.pointerId&&active.id==='joystick'){
          const dx=(event.clientX-active.x)/48,dy=(event.clientY-active.y)/48;
          const length=Math.max(1,Math.hypot(dx,dy));joystickX=dx/length;joystickY=dy/length;textureFrame=-1;wake();
        }
        return; // A held control never drives the cabinet's mouse-follow rotation.
      }
      const id=pick(event);setHover(id);
      if(id||!fine.matches||motion.matches)return;
      targetRotation.set(THREE.MathUtils.clamp(pointer.y*-.028,-.028,.028),THREE.MathUtils.clamp(pointer.x*.075,-.075,.075));wake();
    };
    listen(renderer.domElement,'pointermove',movePointer);
    listen(touchStick,'pointermove',movePointer);
    listen(renderer.domElement,'pointerleave',()=>{if(!active){setHover(null);targetRotation.set(0,0);wake();}});
    const pressPointer=(event,forcedId)=>{
      if(active||event.button!==0)return;
      const id=forcedId||pick(event);if(!id)return;
      event.preventDefault();event.stopPropagation();
      targetRotation.set(cabinet.rotation.x,cabinet.rotation.y);
      active={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,surface:event.currentTarget};
      event.currentTarget.setPointerCapture(event.pointerId);
      if(controls.has(id))controls.get(id).pressed=true;
      if(id==='joystick'){announce('Joystick held. Drag to tilt, release to centre.');renderer.domElement.style.cursor='grabbing';}
      wake();
    };
    listen(renderer.domElement,'pointerdown',event=>pressPointer(event));
    listen(touchStick,'pointerdown',event=>pressPointer(event,'joystick'));
    for(const surface of [renderer.domElement,touchStick]){
      listen(surface,'pointerup',event=>release(event));
      listen(surface,'pointercancel',event=>release(event,true));
      listen(surface,'lostpointercapture',event=>release(event,true));
    }
    const clearInput=()=>{if(active)release({pointerId:active.pointerId},true);controls.forEach(c=>c.pressed=false);joystickX=joystickY=0;focusControl=null;targetRotation.set(0,0);wake();};
    listen(window,'blur',clearInput);
    host.querySelectorAll('[data-cabinet-control]').forEach(button=>{
      const id=button.dataset.cabinetControl;
      listen(button,'focus',()=>{focusControl=id;wake();});listen(button,'blur',()=>{focusControl=null;controls.forEach(c=>c.pressed=false);joystickX=joystickY=0;wake();});
      listen(button,'pointerdown',()=>{if(controls.has(id))controls.get(id).pressed=true;wake();});
      listen(button,'pointerup',()=>{if(controls.has(id))controls.get(id).pressed=false;wake();});
      listen(button,'pointerleave',()=>{if(controls.has(id))controls.get(id).pressed=false;wake();});
      listen(button,'keydown',event=>{
        if(['Enter',' '].includes(event.key)){if(controls.has(id))controls.get(id).pressed=true;wake();}
        if(id==='joystick'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
          event.preventDefault();joystickX=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;joystickY=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;textureFrame=-1;wake();
        }
      });
      listen(button,'keyup',()=>{if(controls.has(id))controls.get(id).pressed=false;joystickX=joystickY=0;textureFrame=-1;wake();});
      listen(button,'click',event=>{if(controls.has(id)){const c=controls.get(id);c.pressed=false;if(event.detail===0)c.pressUntil=performance.now()+140;}activate(id);wake();});
    });
    listen(host.querySelector('[data-cabinet-zoom]'),'click',event=>{zoom=!zoom;event.currentTarget.setAttribute('aria-pressed',String(zoom));wake();});
    function resize(){if(disposed)return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();wake();}
    function tick(now){
      frame=0;if(disposed||!visible||document.hidden)return;
      const dt=Math.min((now-lastTime)/1000||1/60,.05);lastTime=now;
      const k=motion.matches?1:1-Math.exp(-12*dt);let moving=false;
      const approach=(object,key,target)=>{const delta=target-object[key];if(Math.abs(delta)>.0001){object[key]+=delta*k;moving=true;}else object[key]=target;};
      approach(cabinet.rotation,'x',motion.matches?0:targetRotation.x);approach(cabinet.rotation,'y',motion.matches?0:targetRotation.y);
      for(const [id,c] of controls){
        if(id==='joystick'||id==='screen')continue;
        approach(c.group.position,'y',c.rest-((c.pressed||now<(c.pressUntil||0))?.033:0));
        if(now<(c.pressUntil||0))moving=true;
        c.group.traverse(o=>{if(o.material?.emissive){const highlighted=id===(hovered||focusControl);approach(o.material,'emissiveIntensity',highlighted?.30:0);}});
      }
      approach(stick.rotation,'z',-joystickX*.34);approach(stick.rotation,'x',joystickY*.34);
      ball.material.emissive.setHex(0xd98348);approach(ball.material,'emissiveIntensity',(hovered||focusControl)==='joystick'?.18:0);
      const desired=cameraHome.clone().multiplyScalar(zoom?.92:1);approach(camera.position,'x',desired.x);approach(camera.position,'y',desired.y);approach(camera.position,'z',desired.z);camera.lookAt(viewTarget);
      drawScreen(now);renderer.render(scene,camera);
      const grip=ball.getWorldPosition(new THREE.Vector3()).project(camera);
      touchStick.style.left=`${(grip.x+1)*stage.clientWidth/2}px`;touchStick.style.top=`${(1-grip.y)*stage.clientHeight/2}px`;
      if(moving||bootAt!==null||now<messageUntil)wake();
    }
    wake=()=>{if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(tick);};
    function stop(){cancelAnimationFrame(frame);frame=0;lastTime=0;}
    function fallback(){host.classList.remove('cabinet-ready');announce('3D view unavailable. Use the library link to choose a game.');dispose();}
    function dispose(){
      if(disposed)return;disposed=true;stop();events.abort();resizeObserver?.disconnect();intersectionObserver?.disconnect();
      for(const resource of resources)resource.dispose();key.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();touchStick.remove();
    }
    listen(renderer.domElement,'webglcontextlost',event=>{event.preventDefault();fallback();});
    listen(document,'visibilitychange',()=>{if(document.hidden){clearInput();stop();}else wake();});
    listen(motion,'change',()=>{targetRotation.set(0,0);textureFrame=-1;wake();});
    listen(window,'pagehide',event=>{if(event.persisted){clearInput();stop();}else dispose();});
    listen(window,'pageshow',event=>{if(event.persisted)wake();});
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
    intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)wake();else{clearInput();stop();}},{rootMargin:'40px'});intersectionObserver.observe(stage);
    // Only hide the fallback after the first complete WebGL render succeeds.
    resize();drawScreen(performance.now());renderer.render(scene,camera);
    host.classList.add('cabinet-ready');announce('Press START to power the CRT. Drag the joystick or try the buttons.');
    return dispose;
  } catch(error) {
    disposed=true;events.abort();resizeObserver?.disconnect();intersectionObserver?.disconnect();if(frame)cancelAnimationFrame(frame);
    for(const resource of resources)resource.dispose();renderer?.dispose();renderer?.domElement.remove();touchStick?.remove();
    host.classList.remove('cabinet-ready');announce('3D view unavailable. Use the library link to choose a game.');
    console.info('Arcade cabinet: static fallback enabled.', error.message);
    return ()=>{};
  }
}
