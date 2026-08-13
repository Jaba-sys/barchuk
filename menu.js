(function(){
  const viewMain = document.getElementById('view-main');
  const viewHowto = document.getElementById('view-howto');
  const achvGrid = document.getElementById('achv-grid');

  document.getElementById('btn-start').addEventListener('click', ()=>{
    window.location.href = 'game.html';
  });
  document.getElementById('btn-howto').addEventListener('click', ()=>{
    viewMain.classList.add('hidden');
    viewHowto.classList.remove('hidden');
  });
  document.getElementById('btn-back-menu').addEventListener('click', ()=>{
    viewHowto.classList.add('hidden');
    viewMain.classList.remove('hidden');
  });

  function renderAchievements(){
    const earned = window.BarchukAchievements.getEarned();
    achvGrid.innerHTML = '';
    window.BarchukAchievements.all().forEach(a=>{
      const isEarned = !!earned[a.id];
      const card = document.createElement('div');
      card.className = 'achv-card ' + (isEarned ? 'earned' : 'locked');
      const name = document.createElement('div');
      name.className = 'achv-name';
      name.textContent = isEarned ? a.name : '??? ЗАБЛОКИРОВАНО';
      const desc = document.createElement('div');
      desc.className = 'achv-desc';
      desc.textContent = isEarned ? a.desc : 'Сыграй, чтобы открыть.';
      card.appendChild(name);
      card.appendChild(desc);
      achvGrid.appendChild(card);
    });
  }

  renderAchievements();
})();
