(function(){
  // ---------------------------------------------------------------------
  // Access check: this page should only be reachable right after winning
  // in game.html, not by typing the URL directly. game.js stashes a short
  // -lived token in sessionStorage right before navigating here; if it's
  // missing, stale, or this is a fresh tab that never played, we bounce
  // back to the menu immediately. (This is a client-side speed bump for
  // casual URL-editing, not real security -- nothing client-side can be.)
  // ---------------------------------------------------------------------
  const TOKEN_KEY = 'barchukWinToken';
  const CONFIRMED_KEY = 'barchukEndingConfirmed';
  const RESULT_KEY = 'barchukRunResult';
  const TOKEN_MAX_AGE_MS = 20000;

  function hasValidAccess(){
    try{
      if(sessionStorage.getItem(CONFIRMED_KEY) === 'true') return true;
      const raw = sessionStorage.getItem(TOKEN_KEY);
      if(!raw) return false;
      const data = JSON.parse(raw);
      if(!data || typeof data.ts !== 'number') return false;
      if(Date.now() - data.ts > TOKEN_MAX_AGE_MS) return false;
      sessionStorage.setItem(CONFIRMED_KEY, 'true');
      sessionStorage.removeItem(TOKEN_KEY);
      return true;
    }catch(e){ return false; }
  }

  if(!hasValidAccess()){
    window.location.replace('index.html');
    return;
  }

  // ---------------------------------------------------------------------
  // From here on we know this is a legitimate ending reached by playing.
  // ---------------------------------------------------------------------
  const Audio = window.BarchukAudio;
  const Achievements = window.BarchukAchievements;

  let runResult = { earnedThisRun: ['first_shift'], newlyUnlocked: [], finalPower: 0, minPower: 0, doorCloseCount: 0 };
  try{
    const raw = sessionStorage.getItem(RESULT_KEY);
    if(raw) runResult = JSON.parse(raw);
  }catch(e){}

  const barchukImg = document.getElementById('ending-barchuk');
  const monologueEl = document.getElementById('ending-monologue');
  const achievementsBox = document.getElementById('ending-achievements');
  const badgeRow = document.getElementById('ending-badge-row');
  const actionsBox = document.getElementById('ending-actions');
  const timeLabel = document.querySelector('.ending-time');
  const titleLabel = document.querySelector('.ending-title');

  const LINE_SETS = {
    normal: [
      { text: 'Часы на стене показывают 6:00. Сквозь щели в ставнях пробивается серый свет.', quote:false },
      { text: 'Барчук медленно оседает на пол у твоей двери.', quote:false },
      { text: '«...не сегодня.»', quote:true },
      { text: '«Я не смог. Не в этот раз.»', quote:true },
      { text: 'Он сидит так ещё какое-то время — то ли разочарован, то ли просто устал. Не разобрать.', quote:false },
      { text: 'Затем медленно поднимается и уходит обратно во тьму пекарни. До следующей смены.', quote:false },
    ],
    pacifist: [
      { text: 'Ты ни разу не тронул ни дверь, ни решётку вентиляции. Ни разу за всю ночь.', quote:false },
      { text: 'Барчук останавливается у самого порога. Смотрит. Ждёт, что ты дёрнешься.', quote:false },
      { text: '«...ты даже не пытался.»', quote:true },
      { text: 'Что-то в этом сбивает его с толку сильнее, чем закрытая дверь когда-либо могла.', quote:false },
      { text: '«Ладно. Не сегодня. Может, ты просто не боишься.»', quote:true },
      { text: 'Он разворачивается и уходит сам, так и не переступив порог.', quote:false },
    ],
    ninja: [
      { text: 'Ты заметил тень раньше, чем она заметила тебя.', quote:false },
      { text: 'Три быстрых удара — и она замирает, пойманная где-то между кабинетом и тем, что скрывается за ним.', quote:false },
      { text: '«...нашёл-таки.»', quote:true },
      { text: 'Барчук — не единственный, кто ходит по этой пекарне ночью.', quote:false },
      { text: '«Немногие успевают трижды. Обычно они просто исчезают.»', quote:true },
      { text: 'Свет гаснет на мгновение. Когда он возвращается, тень уже ушла — а с ней и часть ответа на вопрос, что здесь происходит на самом деле.', quote:false },
    ],
  };

  const secretType = runResult.secretType; // 'pacifist' | 'ninja' | undefined
  const LINES = LINE_SETS[secretType] || LINE_SETS.normal;

  if(secretType === 'pacifist'){
    timeLabel.textContent = '???';
    titleLabel.textContent = 'ОН ТЕБЯ НЕ ТРОНУЛ';
  } else if(secretType === 'ninja'){
    timeLabel.textContent = '???';
    titleLabel.textContent = 'СЕКРЕТНАЯ ВСТРЕЧА';
  }

  function revealSequence(){
    setTimeout(()=>{ barchukImg.classList.add('show'); Audio.sigh(); }, 400);

    let delay = 1400;
    LINES.forEach((line)=>{
      setTimeout(()=>{
        const p = document.createElement('p');
        p.className = 'ending-line' + (line.quote ? ' quote' : '');
        p.textContent = line.text;
        monologueEl.appendChild(p);
        requestAnimationFrame(()=>requestAnimationFrame(()=>p.classList.add('show')));
      }, delay);
      delay += 1900;
    });

    setTimeout(renderAchievements, delay + 200);
    setTimeout(()=>{ actionsBox.classList.add('show'); }, delay + 900);
  }

  function renderAchievements(){
    const earnedThisRun = runResult.earnedThisRun || [];
    const newly = new Set(runResult.newlyUnlocked || []);
    badgeRow.innerHTML = '';
    earnedThisRun.forEach(id=>{
      const def = Achievements.byId(id);
      if(!def) return;
      const badge = document.createElement('div');
      badge.className = 'ending-badge' + (newly.has(id) ? ' new' : '');
      badge.textContent = def.name;
      badge.title = def.desc;
      badgeRow.appendChild(badge);
    });
    achievementsBox.classList.add('show');
  }

  document.getElementById('btn-play-again').addEventListener('click', ()=>{
    window.location.href = 'game.html';
  });
  document.getElementById('btn-to-menu').addEventListener('click', ()=>{
    window.location.href = 'index.html';
  });

  revealSequence();
})();
