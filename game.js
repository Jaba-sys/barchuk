(function(){
  const BARCHUK_IMG = "assets/barchuk.png";
  const Audio = window.BarchukAudio;
  const Achievements = window.BarchukAchievements;

  // ---------- element refs ----------
  const screens = {
    game: document.getElementById('screen-game'),
    jumpscare: document.getElementById('screen-jumpscare'),
    gameover: document.getElementById('screen-gameover'),
  };
  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  const doorEl = document.getElementById('door');
  const doorWindow = document.getElementById('door-window');
  const doorPeek = document.getElementById('door-peek');
  const doorFlashBeam = document.getElementById('door-flash-beam');
  const doorBtnLabel = document.getElementById('door-btn');
  const hudDoor = document.getElementById('hud-door');
  const hudVent = document.getElementById('hud-vent');
  const hudFlashlight = document.getElementById('hud-flashlight');
  const hudCam = document.getElementById('hud-cam');

  const ventEl = document.getElementById('vent');
  const ventGrate = document.getElementById('vent-grate');
  const ventPeek = document.getElementById('vent-peek');
  const ventBtnLabel = document.getElementById('vent-btn');

  const monitor = document.getElementById('monitor');
  const monitorClose = document.getElementById('monitor-close');
  const camCorridor = document.getElementById('cam-corridor');
  const camHall = document.getElementById('cam-hall');
  const subjectCorridor = document.getElementById('subject-corridor');
  const subjectHall = document.getElementById('subject-hall');
  const tabCorridor = document.getElementById('tab-corridor');
  const tabHall = document.getElementById('tab-hall');
  const alertBanner = document.getElementById('alert-banner');
  const clockTime = document.getElementById('clock-time');
  const powerBarFill = document.getElementById('power-bar-fill');
  const godmodeBadge = document.getElementById('godmode-badge');

  const ninjaShadow = document.getElementById('ninja-shadow');
  const ninjaHint = document.getElementById('ninja-hint');
  const gameoverTitle = document.getElementById('gameover-title');
  const gameoverSub = document.getElementById('gameover-sub');

  [subjectCorridor, subjectHall, doorPeek, ventPeek].forEach(el=>{
    el.style.backgroundImage = `url(${BARCHUK_IMG})`;
  });

  // ---------- balance constants ----------
  const NIGHT_LENGTH = 180;          // seconds to survive one full shift
  const DOOR_GRACE = 0.5;            // almost no reaction time left once he's actually AT the door --
                                      // you're meant to close it proactively while watching the corridor cam
  const VENT_GRACE = 3;              // vent stays forgiving: a real 3-second window to seal it
  const RETREAT_DURATION = 4;        // vent: Barchuk lingers this long after it's sealed in time
  const DOOR_RETREAT_DURATION = 7;   // door: he lingers noticeably longer here before giving up
  const POWER_MAX = 100;
  const DOOR_DRAIN_PER_SEC = 7;      // closing the door: full tank lasts ~14s continuously closed
  const VENT_DRAIN_PER_SEC = 7;      // sealing the vent costs just as much as the door
  const CAMERA_DRAIN_PER_SEC = 1.2;  // watching cameras costs much less: ~83s of continuous viewing
  const REGEN_PER_SEC = 1.4;         // idle (door+vent open, cameras off) slowly restores power -- unless dead

  // ---------- game/session state ----------
  let elapsed = 0;
  let doorClosed = false;
  let ventClosed = false;
  let monitorOpen = false;
  let currentCam = 'hall';
  // hall -> corridor -> atDoor -> doorRetreat -> hall
  //      -> ventTravel (invisible on both cams) -> atVent -> ventRetreat -> hall
  let barchukState = 'hall';
  let stateTimer = 0;
  let corridorThreshold = 20;
  let hallThreshold = 8;
  let ventTravelDuration = 12;
  let barchukSpeedTier = 'fast'; // 'fast' or 'veryfast', re-rolled each time he enters the corridor
  let power = POWER_MAX;
  let powerDead = false; // once true, power never regenerates again this run
  let flashlightOn = false; // held manually -- only way to actually see the door window
  let loopHandle = null;
  let running = false;

  // ---------- secret ninja-shadow easter egg ----------
  let ninjaActive = false;
  let ninjaClicks = 0;
  let ninjaTimeoutHandle = null;
  const NINJA_HINT_SEEN_KEY = 'barchukNinjaHintSeen';

  // ---------- run stats (used for achievements) ----------
  let stats = { closeCount:0, minPower:100, blackoutHappened:false, veryFastEncounters:0, ventSurvived:0, everClosedAnything:false };

  function fmtClock(s){
    const totalMinutes = Math.floor((s/NIGHT_LENGTH)*360);
    let hour = Math.floor(totalMinutes/60);
    let min = totalMinutes%60;
    let displayHour = hour===0?12:hour;
    return `${displayHour}:${String(min).padStart(2,'0')} AM`;
  }

  function randRange(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function pickCorridorThreshold(progress){
    const veryFast = Math.random() < 0.4;
    let base, minVal;
    if(veryFast){
      base = randRange(6,10) - Math.floor(progress*3);
      minVal = 4;
      stats.veryFastEncounters++;
    } else {
      base = randRange(13,18) - Math.floor(progress*5);
      minVal = 9;
    }
    barchukSpeedTier = veryFast ? 'veryfast' : 'fast';
    return Math.max(minVal, base);
  }

  function pickVentTravelDuration(progress){
    // He's crawling through the vents, unseen on any camera, for a while.
    const base = randRange(10, 18) - Math.floor(progress*5);
    return Math.max(6, base);
  }

  function resetGame(){
    elapsed = 0; doorClosed = false; ventClosed = false; monitorOpen = false; currentCam='hall';
    barchukState='hall'; stateTimer=0; corridorThreshold=20; hallThreshold=randRange(5,11);
    ventTravelDuration = 12; power = POWER_MAX; powerDead = false; flashlightOn = false; barchukSpeedTier='fast';
    stats = { closeCount:0, minPower:100, blackoutHappened:false, veryFastEncounters:0, ventSurvived:0, everClosedAnything:false };
    updateDoorUI(); updateVentUI(); updateCamViews(); updatePowerUI(); monitor.classList.remove('active');
    alertBanner.classList.remove('show');
    hudFlashlight.classList.remove('on');
    doorFlashBeam.classList.remove('on');
    clockTime.textContent = '12:00 AM';
    hideNinja();
    godmodeBadge.classList.toggle('hidden', !(window.BarchukCheats && window.BarchukCheats.isGodMode()));
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

  function updateVentUI(){
    ventGrate.classList.toggle('closed', ventClosed);
    if(ventClosed){
      ventBtnLabel.textContent = 'Вентиляция: закрыта';
      ventBtnLabel.classList.add('on');
      hudVent.classList.add('on');
    } else {
      ventBtnLabel.textContent = 'Вентиляция: открыта';
      ventBtnLabel.classList.remove('on');
      hudVent.classList.remove('on');
    }
  }

  function updatePowerUI(){
    const pct = Math.max(0, Math.min(100, power));
    powerBarFill.style.width = pct + '%';
    powerBarFill.classList.toggle('low', pct <= 25 || powerDead);
  }

  function accessLocked(){ return monitorOpen || power <= 0; }

  function refreshLockUI(){
    hudDoor.classList.toggle('locked', accessLocked());
    hudVent.classList.toggle('locked', accessLocked());
    hudFlashlight.classList.toggle('locked', monitorOpen);
  }

  function denyAttempt(el){
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    Audio.denyBeep();
  }

  function toggleDoor(){
    if(!running) return;
    if(accessLocked()){ denyAttempt(hudDoor); return; }
    doorClosed = !doorClosed;
    Audio.doorClank();
    updateDoorUI();
    if(doorClosed){ stats.closeCount++; stats.everClosedAnything = true; }
    if(barchukState==='atDoor' && doorClosed){
      barchukState='doorRetreat'; stateTimer=0;
      alertBanner.classList.remove('show');
    }
  }

  function toggleVent(){
    if(!running) return;
    if(accessLocked()){ denyAttempt(hudVent); return; }
    ventClosed = !ventClosed;
    Audio.doorClank();
    updateVentUI();
    if(ventClosed){ stats.closeCount++; stats.everClosedAnything = true; }
    if(barchukState==='atVent' && ventClosed){
      stats.ventSurvived++;
      barchukState='ventRetreat'; stateTimer=0;
      alertBanner.classList.remove('show');
    }
  }

  function setFlashlight(on){
    if(!running) return;
    if(on && (monitorOpen)) return; // can't hold the flashlight to the window while staring at cameras
    flashlightOn = on;
    hudFlashlight.classList.toggle('on', flashlightOn);
    doorFlashBeam.classList.toggle('on', flashlightOn);
    updateCamViews();
  }

  function openMonitor(){
    if(!running || monitorOpen) return;
    monitorOpen = true;
    monitor.classList.add('active');
    hudCam.classList.add('active-state');
    if(flashlightOn) setFlashlight(false);
    refreshLockUI();
  }
  function closeMonitor(){
    if(!monitorOpen) return;
    monitorOpen = false;
    monitor.classList.remove('active');
    hudCam.classList.remove('active-state');
    refreshLockUI();
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
    // Both cameras only ever show Barchuk while he's actually IN that room.
    // During ventTravel / atVent / ventRetreat he's inside the walls: invisible on both.
    subjectHall.classList.toggle('show', barchukState==='hall');

    const inCorridor = barchukState==='corridor';
    subjectCorridor.classList.toggle('show', inCorridor);
    if(inCorridor){
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

    const atDoor = barchukState==='atDoor';
    doorPeek.classList.toggle('show', atDoor && flashlightOn);
    doorWindow.classList.toggle('danger-glow', atDoor && !doorClosed && flashlightOn);

    const atVent = barchukState==='atVent';
    ventPeek.classList.toggle('show', atVent);
    ventEl.classList.toggle('danger', atVent && !ventClosed);

    if(atDoor && !doorClosed){
      alertBanner.textContent = 'БАРЧУК У ДВЕРИ! ЗАКРОЙ ЕЁ!';
      alertBanner.classList.add('show');
    } else if(atVent && !ventClosed){
      alertBanner.textContent = 'БАРЧУК В ВЕНТИЛЯЦИИ! ЗАКРОЙ ЕЁ!';
      alertBanner.classList.add('show');
    } else {
      alertBanner.classList.remove('show');
    }
  }

  function gameTick(){
    if(!running) return;
    elapsed += 1;
    clockTime.textContent = fmtClock(elapsed);

    if(elapsed >= NIGHT_LENGTH){
      winGame();
      return;
    }

    const progress = elapsed/NIGHT_LENGTH;
    const godMode = window.BarchukCheats && window.BarchukCheats.isGodMode();

    if(godMode){
      // Auto-defend: whatever is threatening you gets sealed instantly, and
      // the generator never runs dry.
      powerDead = false;
      power = POWER_MAX;
      if(barchukState==='atDoor' && !doorClosed){ doorClosed = true; updateDoorUI(); }
      if(barchukState==='atVent' && !ventClosed){ ventClosed = true; updateVentUI(); }
    }

    // ---- power: door & vent drain heavily, cameras drain lightly, idle regens ----
    // Once power has ever hit zero, it's permanently dead for the rest of the run.
    if(!powerDead && !godMode){
      let drain = 0;
      if(doorClosed) drain += DOOR_DRAIN_PER_SEC;
      if(ventClosed) drain += VENT_DRAIN_PER_SEC;
      if(monitorOpen) drain += CAMERA_DRAIN_PER_SEC;

      if(drain > 0){
        power = Math.max(0, power - drain);
        if(power <= 0){
          powerDead = true;
          stats.blackoutHappened = true;
          if(doorClosed){ doorClosed = false; updateDoorUI(); }
          if(ventClosed){ ventClosed = false; updateVentUI(); }
          Audio.doorClank();
        }
      } else {
        power = Math.min(POWER_MAX, power + REGEN_PER_SEC);
      }
    }
    stats.minPower = Math.min(stats.minPower, power);
    updatePowerUI();
    refreshLockUI();

    // rare secret: a shadow flickers into view for a few seconds
    if(!ninjaActive && !godMode && Math.random() < 0.012){
      spawnNinja();
    }

    stateTimer += 1;

    if(barchukState==='hall'){
      if(stateTimer >= hallThreshold){
        stateTimer = 0;
        const goesForVent = Math.random() < 0.35;
        if(goesForVent){
          barchukState = 'ventTravel';
          ventTravelDuration = pickVentTravelDuration(progress);
        } else {
          barchukState = 'corridor';
          corridorThreshold = pickCorridorThreshold(progress);
        }
      }
    } else if(barchukState==='corridor'){
      const footstepInterval = barchukSpeedTier==='veryfast' ? 1 : 2;
      if(stateTimer % footstepInterval === 0) Audio.footstep();
      if(stateTimer >= corridorThreshold){
        barchukState='atDoor'; stateTimer=0;
      }
    } else if(barchukState==='atDoor'){
      if(doorClosed){
        barchukState='doorRetreat'; stateTimer=0;
      } else if(stateTimer >= DOOR_GRACE){
        if(!stats.everClosedAnything && !godMode){ triggerSecretEnding('pacifist'); return; }
        triggerJumpscare();
        return;
      }
    } else if(barchukState==='doorRetreat'){
      if(stateTimer >= DOOR_RETREAT_DURATION){
        barchukState='hall'; stateTimer=0;
        hallThreshold = randRange(5, Math.max(6,10-Math.floor(progress*4)));
      }
    } else if(barchukState==='ventTravel'){
      // silent, invisible on every camera -- no footstep or visual cue here on purpose
      if(stateTimer >= ventTravelDuration){
        barchukState='atVent'; stateTimer=0;
      }
    } else if(barchukState==='atVent'){
      if(ventClosed){
        barchukState='ventRetreat'; stateTimer=0;
      } else if(stateTimer >= VENT_GRACE){
        if(!stats.everClosedAnything && !godMode){ triggerSecretEnding('pacifist'); return; }
        triggerJumpscare();
        return;
      }
    } else if(barchukState==='ventRetreat'){
      if(stateTimer >= RETREAT_DURATION){
        barchukState='hall'; stateTimer=0;
        hallThreshold = randRange(5, Math.max(6,10-Math.floor(progress*4)));
      }
    }

    updateCamViews();
    Audio.tickSound();
  }

  function triggerJumpscare(reason){
    running = false;
    clearInterval(loopHandle);
    hideNinja();
    Audio.stopHum();
    Audio.scream();
    if(reason==='ninja'){
      gameoverTitle.textContent = 'ТЕНЬ ТЕБЯ ПОЙМАЛА';
      gameoverSub.textContent = 'НЕ СТОИЛО ТРОГАТЬ ТО, ЧТО ПРЯТАЛОСЬ В УГЛУ';
    } else {
      gameoverTitle.textContent = 'ТЫ НЕ ПЕРЕЖИЛ СМЕНУ';
      gameoverSub.textContent = 'БАРЧУК БЕКЕРИ ЗАБРАЛ ЕЩЁ ОДНОГО ОХРАННИКА';
    }
    showScreen('jumpscare');
    setTimeout(()=>{ showScreen('gameover'); }, 1400);
  }

  // ---- secret endings: reached without surviving to 6 AM the normal way ----
  function triggerSecretEnding(type){
    running = false;
    clearInterval(loopHandle);
    hideNinja();
    Audio.stopHum();

    const secretId = type === 'ninja' ? 'secret_ninja' : 'secret_pacifist';
    const ids = [secretId];
    const newly = Achievements.markEarned(ids);

    try{
      sessionStorage.setItem('barchukWinToken', JSON.stringify({ ts: Date.now() }));
      sessionStorage.setItem('barchukRunResult', JSON.stringify({
        earnedThisRun: ids,
        newlyUnlocked: newly,
        finalPower: Math.round(power),
        minPower: Math.round(stats.minPower),
        closeCount: stats.closeCount,
        secretType: type,
      }));
    }catch(e){}

    window.location.href = 'ending.html';
  }

  // ---- secret ninja-shadow easter egg: rare, click 3 times within 5s to win it ----
  function hasSeenNinjaHint(){
    try{ return sessionStorage.getItem(NINJA_HINT_SEEN_KEY) === 'true'; }
    catch(e){ return false; }
  }
  function markNinjaHintSeen(){
    try{ sessionStorage.setItem(NINJA_HINT_SEEN_KEY, 'true'); }
    catch(e){}
  }

  function spawnNinja(){
    if(ninjaActive || !running) return;
    ninjaActive = true;
    ninjaClicks = 0;
    const topPct = 12 + Math.random()*55;
    ninjaShadow.style.top = topPct + '%';
    ninjaShadow.classList.remove('hidden');
    ninjaHint.classList.toggle('hidden', !hasSeenNinjaHint());
    ninjaTimeoutHandle = setTimeout(ninjaTimeout, 5000);
  }

  function hideNinja(){
    ninjaActive = false;
    ninjaShadow.classList.add('hidden');
    ninjaHint.classList.add('hidden');
    if(ninjaTimeoutHandle){ clearTimeout(ninjaTimeoutHandle); ninjaTimeoutHandle = null; }
  }

  function ninjaTimeout(){
    if(!ninjaActive) return;
    const hadAttempt = ninjaClicks > 0;
    hideNinja();
    if(hadAttempt){
      markNinjaHintSeen();
      // touching it and failing to finish in time is a little risky
      if(Math.random() < 0.3 && running){
        triggerJumpscare('ninja');
      }
    }
  }

  ninjaShadow.addEventListener('click', ()=>{
    if(!ninjaActive || !running) return;
    ninjaClicks++;
    Audio.beep(560 + ninjaClicks*90, 0.05, 'square', 0.05);
    if(ninjaClicks >= 3){
      hideNinja();
      triggerSecretEnding('ninja');
    }
  });

  // ---- winning: compute achievements, stash a short-lived session token, navigate to ending.html ----
  function winGame(){
    running = false;
    clearInterval(loopHandle);
    hideNinja();
    Audio.stopHum();

    const ids = ['first_shift'];
    if(!stats.blackoutHappened) ids.push('no_blackout');
    if(stats.minPower <= 15) ids.push('edge_of_dawn');
    if(stats.closeCount <= 5) ids.push('cold_blooded');
    if(stats.veryFastEncounters >= 3) ids.push('speed_demon');
    if(stats.ventSurvived >= 1) ids.push('vent_guardian');

    const newly = Achievements.markEarned(ids);

    try{
      sessionStorage.setItem('barchukWinToken', JSON.stringify({ ts: Date.now() }));
      sessionStorage.setItem('barchukRunResult', JSON.stringify({
        earnedThisRun: ids,
        newlyUnlocked: newly,
        finalPower: Math.round(power),
        minPower: Math.round(stats.minPower),
        closeCount: stats.closeCount,
      }));
    }catch(e){}

    window.location.href = 'ending.html';
  }

  function startGame(){
    resetGame();
    showScreen('game');
    running = true;
    Audio.startHum();
    loopHandle = setInterval(gameTick, 1000);
  }

  // ---------- events ----------
  document.getElementById('btn-retry').addEventListener('click', startGame);
  document.getElementById('btn-menu').addEventListener('click', ()=>{ window.location.href = 'index.html'; });

  hudDoor.addEventListener('click', toggleDoor);
  hudVent.addEventListener('click', toggleVent);
  hudCam.addEventListener('click', toggleMonitor);
  monitorClose.addEventListener('click', closeMonitor);
  tabCorridor.addEventListener('click', ()=>selectCam('corridor'));
  tabHall.addEventListener('click', ()=>selectCam('hall'));

  // flashlight: press-and-hold, mouse or touch
  hudFlashlight.addEventListener('mousedown', (e)=>{ e.preventDefault(); setFlashlight(true); });
  hudFlashlight.addEventListener('mouseup', ()=>setFlashlight(false));
  hudFlashlight.addEventListener('mouseleave', ()=>setFlashlight(false));
  hudFlashlight.addEventListener('touchstart', (e)=>{ e.preventDefault(); setFlashlight(true); }, { passive:false });
  hudFlashlight.addEventListener('touchend', (e)=>{ e.preventDefault(); setFlashlight(false); });
  hudFlashlight.addEventListener('touchcancel', ()=>setFlashlight(false));

  document.addEventListener('keydown', (e)=>{
    if(!running) return;
    if(e.code==='Space'){ e.preventDefault(); toggleDoor(); }
    if(e.code==='KeyV'){ toggleVent(); }
    if(e.code==='KeyC'){ toggleMonitor(); }
    if(e.code==='KeyF' && !e.repeat){ setFlashlight(true); }
    if(e.code==='Escape'){ closeMonitor(); }
    if(e.code==='Digit1'){ selectCam('corridor'); }
    if(e.code==='Digit2'){ selectCam('hall'); }
  });
  document.addEventListener('keyup', (e)=>{
    if(e.code==='KeyF'){ setFlashlight(false); }
  });

  selectCam('hall');
  startGame();
})();
