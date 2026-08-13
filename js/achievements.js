// Achievement definitions + persistence (localStorage), shared across pages.
// Exposed as window.BarchukAchievements.
(function(global){
  const STORAGE_KEY = 'barchukBekeryAchievements';

  const ACHIEVEMENTS = [
    { id:'first_shift',   name:'ПЕРВАЯ СМЕНА',      desc:'Доживи до 6 утра первый раз.' },
    { id:'no_blackout',   name:'БЕЗ СБОЕВ',          desc:'Пройди ночь так, чтобы энергия ни разу не кончилась.' },
    { id:'edge_of_dawn',  name:'НА ГРАНИ РАССВЕТА',  desc:'Встреть 6 утра с энергией 15% или ниже.' },
    { id:'cold_blooded',  name:'ХЛАДНОКРОВИЕ',       desc:'Победи, закрыв дверь и вентиляцию суммарно не больше 5 раз.' },
    { id:'speed_demon',   name:'ОН СПЕШИЛ',          desc:'Переживи не меньше 3 забегов Барчука на максимальной скорости.' },
    { id:'vent_guardian', name:'ХРАНИТЕЛЬ ВЕНТИЛЯЦИИ', desc:'Успей закрыть вентиляцию, когда Барчук в ней появится.' },
  ];

  function getEarned(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch(e){ return {}; }
  }

  function saveEarned(map){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
    catch(e){}
  }

  // Marks a list of achievement ids as earned; returns only the ones that
  // were newly earned just now (weren't already unlocked before).
  function markEarned(ids){
    const map = getEarned();
    const newly = [];
    ids.forEach(id=>{
      if(!map[id]){ map[id] = true; newly.push(id); }
    });
    saveEarned(map);
    return newly;
  }

  function all(){ return ACHIEVEMENTS; }
  function isEarned(id){ return !!getEarned()[id]; }
  function byId(id){ return ACHIEVEMENTS.find(a=>a.id===id); }

  global.BarchukAchievements = { all, getEarned, markEarned, isEarned, byId, STORAGE_KEY };
})(window);
