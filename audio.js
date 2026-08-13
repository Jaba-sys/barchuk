// Shared synthesized audio (no external sound files needed).
// Exposed as window.BarchukAudio so menu/game/ending pages can all use it.
(function(global){
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
  function denyBeep(){ beep(140,0.08,'square',0.04); }

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

  // A long, weary exhale for the ending screen.
  function sigh(){
    beep(220, 0.6, 'sine', 0.05);
    setTimeout(()=>beep(170, 0.9, 'sine', 0.045), 260);
    setTimeout(()=>beep(120, 1.1, 'sine', 0.035), 620);
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

  global.BarchukAudio = { beep, doorClank, tickSound, footstep, denyBeep, scream, sigh, startHum, stopHum };
})(window);
