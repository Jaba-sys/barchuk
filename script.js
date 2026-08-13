(function(){
  const BARCHUK_IMG = "assets/barchuk.png";

  // ---------- element refs ----------
  const screens = {
    menu: document.getElementById('screen-menu'),
    howto: document.getElementById('screen-howto'),
    game: document.getElementById('screen-game'),
    jumpscare: document.getElementById('screen-jumpscare'),
    gameover: document.getElementById('screen-gameover'),
    win: document.getElementById('screen-win'),
  };
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  const doorEl = document.getElementById('door');
  const doorWindow = document.getElementById('door-window');
  const doorPeek = document.getElementById('door-peek');
  const doorBtnLabel = document.getElementById('door-btn');
  const hudDoor = document.getElementById('hud-door');
  const hudCam = document.getElementById('hud-cam');
  const monitor = document.getElementById('monitor');
  const monitorClose = document.getElementById('monitor-close');
  const camCorridor = document.getElementById('cam-corridor');
  const camHall = document.getElementById('cam-hall');
  const subjectCorridor = document.getElementById('subject-corridor');
  const subjectHall = document.getElementById('subject-hall');
  const tabCorridor = document.getElementById('tab-corridor');
  const tabHall = document.getElementById('tab-hall');
  const hallPeek = document.getElementById('hall-peek');
  const alertBanner = document.getElementById('alert-banner');
  const clockTime = document.getElementById('clock-time');

  [subjectCorridor, subjectHall, doorPeek, hallPeek].forEach(el=>{
    el.style.backgroundImage = `url(${BARCHUK_IMG})`;
  });

  // ---------- audio (synth, no external sound files needed) ----------
  let actx = null;
  function ctx(){ if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); return actx; }
  function beep(freq, dur, type, vol){
    try{
      const a = ctx();
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = type||'sine';
      osc.frequency.value = freq;
      gain.gain.value = vol||0.05;
      osc.connect(gain); gain.connect(a.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime+dur);
      osc.stop(a.currentTime+dur);
    }catch(e){}
  }
  function doorClank(){ beep(120,0.25,'square',0.09); }
  function tickSound(){ beep(880,0.04,'sine',0.02); }
  function footstep(){ beep(200,0.06,'square',0.03); }
  function scream(){
    try{
      const a = ctx();
      const bufferSize = a.sampleRate*0.9;
      const buffer = a.createBuffer(1, bufferSize, a.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++){ data[i] = (Math.random()*2-1)*Math.pow(1-i/bufferSize,0.3); }
      const src = a.createBufferSource();
      src.buffer = buffer;
      const gain = a.createGain();
      gain.gain.value = 0.35;
      src.connect(gain); gain.connect(a.destination);
      src.start();
      beep(90,0.9,'sawtooth',0.25);
    }catch(e){}
  }
  let hum = null;
  function startHum(){
    try{
      const a = ctx();
      hum = a.createOscillator();
      const g = a.createGain();
      hum.type='sine'; hum.frequency.value=50; g.gain.value=0.012;
      hum.connect(g); g.connect(a.destination); hum.start();
    }catch(e){}
  }
  function stopHum(){ try{ if(hum){ hum.stop(); hum=null; } }catch(e){} }

  // ---------- game state ----------
  const NIGHT_LENGTH = 180; // seconds to survive one full shift
  let elapsed = 0;
  let doorClosed = false;
  let monitorOpen = false;
  let currentCam = 'hall';
  let barchukState = 'hall'; // hall -> corridor -> door -> retreating
  let stateTimer = 0;
  let corridorThreshold = 20;
  let hallThreshold = 8;
  let loopHandle = null;
  let running = false;
  let lastFootstep = -1;

  function fmtClock(s){
    const totalMinutes = Math.floor((s/NIGHT_LENGTH)*360); // 12am..6am over the night
    let hour = Math.floor(totalMinutes/60);
    let min = totalMinutes%60;
    let displayHour = hour===0?12:hour;
    return `${displayHour}:${String(min).padStart(2,'0')} AM`;
  }

  function randRange(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function resetGame(){
    elapsed = 0; doorClosed = false; monitorOpen = false; currentCam='hall';
    barchukState='hall'; stateTimer=0; corridorThreshold=20; hallThreshold=randRange(5,11);
    updateDoorUI(); updateCamViews(); monitor.classList.remove('active');
    alertBanner.classList.remove('show');
    clockTime.textContent = '12:00 AM';
    selectCam('hall');
  }

  function updateDoorUI(){
    if(doorClosed){
      doorEl.classList.add('closed');
      doorBtnLabel.textContent = 'Дверь: закрыта';
      doorBtnLabel.classList.add('on');
      hudDoor.classList.add('on');
    } else {
      doorEl.classList.remove('closed');
      doorBtnLabel.textContent = 'Дверь: открыта';
      doorBtnLabel.classList.remove('on');
      hudDoor.classList.remove('on');
    }
  }

  function toggleDoor(){
    if(!running) return;
    doorClosed = !doorClosed;
    doorClank();
    updateDoorUI();
    if(barchukState==='door' && doorClosed){
      barchukState='retreating'; stateTimer=0;
      alertBanner.classList.remove('show');
    }
  }

  function openMonitor(){
    if(!running || monitorOpen) return;
    monitorOpen = true;
    monitor.classList.add('active');
    hudCam.classList.add('active-state');
  }
  function closeMonitor(){
    if(!monitorOpen) return;
    monitorOpen = false;
    monitor.classList.remove('active');
    hudCam.classList.remove('active-state');
  }
  function toggleMonitor(){
    if(!running) return;
    if(monitorOpen) closeMonitor(); else openMonitor();
  }

  function selectCam(cam){
    currentCam = cam;
    camCorridor.classList.toggle('hidden', cam!=='corridor');
    camHall.classList.toggle('hidden', cam!=='hall');
    tabCorridor.classList.toggle('selected', cam==='corridor');
    tabHall.classList.toggle('selected', cam==='hall');
  }

  function updateCamViews(){
    subjectHall.classList.toggle('show', barchukState==='hall');
    hallPeek.classList.toggle('show', barchukState==='hall');

    const inCorridor = barchukState==='corridor';
    subjectCorridor.classList.toggle('show', inCorridor);
    if(inCorridor){
      // approach progress: 0 = just entered corridor (far away), 1 = about to reach the door (close)
      const progress = Math.min(1, stateTimer / corridorThreshold);
      const scale = 0.28 + progress*1.5;
      const widthPct = 14 + progress*30;
      const heightPct = 30 + progress*45;
      const bottomPct = 4 + progress*2;
      subjectCorridor.style.width = widthPct+'%';
      subjectCorridor.style.height = heightPct+'%';
      subjectCorridor.style.bottom = bottomPct+'%';
      subjectCorridor.style.transform = `translateX(-50%) scale(${scale.toFixed(2)})`;
    }

    const atDoor = barchukState==='door';
    doorPeek.classList.toggle('show', atDoor);
    doorWindow.classList.toggle('danger-glow', atDoor && !doorClosed);
    alertBanner.classList.toggle('show', atDoor && !doorClosed);
  }

  function gameTick(){
    if(!running) return;
    elapsed += 1;
    clockTime.textContent = fmtClock(elapsed);

    if(elapsed >= NIGHT_LENGTH){
      endGame(true);
      return;
    }

    const progress = elapsed/NIGHT_LENGTH;
    const doorGrace = Math.max(1.6, 3.2 - progress*1.2);

    stateTimer += 1;

    if(barchukState==='hall'){
      if(stateTimer >= hallThreshold){
        barchukState='corridor'; stateTimer=0;
        corridorThreshold = Math.max(12, 20 - Math.floor(progress*8));
      }
    } else if(barchukState==='corridor'){
      if(stateTimer % 2 === 0) footstep();
      if(stateTimer >= corridorThreshold){
        barchukState='door'; stateTimer=0;
        window.__doorGrace = doorGrace;
      }
    } else if(barchukState==='door'){
      if(doorClosed){
        barchukState='retreating'; stateTimer=0;
      } else {
        if(stateTimer >= (window.__doorGrace||3)){
          triggerJumpscare();
          return;
        }
      }
    } else if(barchukState==='retreating'){
      if(stateTimer >= 3){
        barchukState='hall'; stateTimer=0;
        hallThreshold = randRange(5, Math.max(6,10-Math.floor(progress*4)));
      }
    }

    updateCamViews();
    tickSound();
  }

  function triggerJumpscare(){
    running = false;
    clearInterval(loopHandle);
    stopHum();
    scream();
    showScreen('jumpscare');
    setTimeout(()=>{ endGame(false); }, 1400);
  }

  function endGame(won){
    running = false;
    clearInterval(loopHandle);
    stopHum();
    if(won){ showScreen('win'); } else { showScreen('gameover'); }
  }

  function startGame(){
    resetGame();
    showScreen('game');
    running = true;
    startHum();
    loopHandle = setInterval(gameTick, 1000);
  }

  // ---------- events ----------
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-howto').addEventListener('click', ()=>showScreen('howto'));
  document.getElementById('btn-back-menu').addEventListener('click', ()=>showScreen('menu'));
  document.getElementById('btn-retry-1').addEventListener('click', startGame);
  document.getElementById('btn-retry-2').addEventListener('click', startGame);
  document.getElementById('btn-menu-1').addEventListener('click', ()=>showScreen('menu'));
  document.getElementById('btn-menu-2').addEventListener('click', ()=>showScreen('menu'));

  hudDoor.addEventListener('click', toggleDoor);
  hudCam.addEventListener('click', toggleMonitor);
  monitorClose.addEventListener('click', closeMonitor);
  tabCorridor.addEventListener('click', ()=>selectCam('corridor'));
  tabHall.addEventListener('click', ()=>selectCam('hall'));

  document.addEventListener('keydown', (e)=>{
    if(!running) return;
    if(e.code==='Space'){ e.preventDefault(); toggleDoor(); }
    if(e.code==='KeyC'){ toggleMonitor(); }
    if(e.code==='Escape'){ closeMonitor(); }
    if(e.code==='Digit1'){ selectCam('corridor'); }
    if(e.code==='Digit2'){ selectCam('hall'); }
  });

  selectCam('hall');
})();
