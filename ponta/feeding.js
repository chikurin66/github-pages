/* SVG masks leave transparent scalloped bites; original OpenMoji art is unmodified. */
(() => {
  const tray = document.querySelector('#food-tray');
  const ns = 'http://www.w3.org/2000/svg';
  const foods = [ ['1F34C', 'バナナ'], ['1F370', 'ケーキ'], ['1F34E', 'りんご'] ];
  let drag = null;
  let busy = false;
  let feedingFood = null;
  const counts = new Map();
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const mouth = () => {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + r.width * .5, y: r.top + r.height * .65, radius: r.width * .2 };
  };
  const near = (x, y) => { const m = mouth(); return Math.hypot(x-m.x, y-m.y) < m.radius; };
  function resetPosition(food) {
    food.classList.remove('dragging');
    food.classList.add('returning');
    food.style.transform = '';
    stageShell.classList.remove('hungry');
    later(() => food.classList.remove('returning'), 300);
  }
  function maskBite(food) {
    const count = (counts.get(food) || 0) + 1;
    counts.set(food, count);
    food.dataset.bites = String(count);
    const mask = food.querySelector('mask');
    // Three overlapping circles give each bite a soft, scalloped edge.
    const positions = [[65, 26], [32, 44], [59, 67]];
    const [x,y] = positions[count-1];
    for (const [dx,dy] of [[-12,0],[0,7],[12,0]]) {
      const hole = document.createElementNS(ns, 'circle');
      hole.setAttribute('cx', x+dx); hole.setAttribute('cy', y+dy);
      hole.setAttribute('r', '19'); hole.setAttribute('fill', 'black');
      mask.append(hole);
    }
    if (count === 3) food.classList.add('finished');
    return count;
  }
  function feed(food) {
    if (busy || !isTalk) { resetPosition(food); return; }
    busy = true; feedingFood = food;
    window.clearTimeout(responseTimer); stopTalking();
    window.speechSynthesis?.cancel();
    const m = mouth();
    const r = food.getBoundingClientRect();
    const dx = parseFloat(food.dataset.dx || 0) + m.x - (r.left+r.width/2);
    const dy = parseFloat(food.dataset.dy || 0) + m.y - (r.top+r.height/2);
    food.classList.remove('dragging'); food.classList.add('returning');
    food.style.transform = `translate(${dx}px, ${dy}px) scale(.8)`;
    setTalk(true);
    later(() => {
      setTalk(false);
      const count = maskBite(food);
      createSparkBurst(count === 3);
      replayClass(stageShell, 'is-responding');
      status.textContent = `${food.dataset.name}を${count}くち たべたよ`;
      speakPhrase(count === 3 ? 'ごちそうさま！ おいしかった！' : 'もぐもぐ。おいしい！');
      isTalking = true; scheduleTalking(true);
    }, 380);
    later(() => {
      stopTalking(); resetPosition(food);
      stageShell.classList.remove('is-responding');
      food.dataset.dx = '0'; food.dataset.dy = '0';
      if (counts.get(food) === 3) {
        later(() => {
          food.querySelectorAll('mask circle').forEach(el => el.remove());
          counts.set(food, 0); food.dataset.bites = '0'; food.classList.remove('finished');
          busy = false; feedingFood = null;
        }, 300);
      } else {
        busy = false; feedingFood = null;
      }
    }, 1900);
  }
  for (const [hex, name] of foods) {
    const food = document.createElement('button');
    food.className = 'food'; food.type = 'button'; food.disabled = true;
    food.dataset.name = name; food.dataset.bites = '0';
    food.setAttribute('aria-label', `${name}をぽんたにあげる`);
    food.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="bite-${hex}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100" style="mask-type:luminance"><rect width="100" height="100" fill="white"/></mask></defs><image href="https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/${hex}.svg" width="100" height="100" mask="url(#bite-${hex})"/></svg>`;
    let suppressClick = false;
    food.addEventListener('pointerdown', e => {
      if (busy || drag || e.button !== 0) return;
      food.classList.remove('returning');
      food.setPointerCapture(e.pointerId);
      drag = { food, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    });
    food.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId || drag.food !== food) return;
      const dx = e.clientX-drag.x, dy = e.clientY-drag.y;
      if (Math.hypot(dx,dy)>8) drag.moved = true;
      if (!drag.moved) return;
      food.classList.add('dragging');
      food.dataset.dx = dx; food.dataset.dy = dy;
      food.style.transform = `translate(${dx}px, ${dy}px)`;
      stageShell.classList.toggle('hungry', near(e.clientX,e.clientY));
    });
    const release = e => {
      if (!drag || drag.id !== e.pointerId || drag.food !== food) return;
      const moved = drag.moved;
      drag = null;
      if (food.hasPointerCapture(e.pointerId)) food.releasePointerCapture(e.pointerId);
      suppressClick = moved || e.type !== 'pointerup';
      if (moved && e.type === 'pointerup' && near(e.clientX,e.clientY)) feed(food);
      else { resetPosition(food); food.dataset.dx='0'; food.dataset.dy='0'; }
      later(() => { suppressClick = false; }, 500);
    };
    food.addEventListener('pointerup', release);
    food.addEventListener('pointercancel', release);
    food.addEventListener('lostpointercapture', release);
    food.addEventListener('click', () => { if (!suppressClick && !busy) feed(food); });
    tray.append(food);
  }
  const ready = setInterval(() => {
    if (isTalk) { tray.querySelectorAll('button').forEach(b => b.disabled=false); clearInterval(ready); }
  }, 150);
  const explain = () => { if (!busy && !drag) callPonta(); };
  dailyItemElement.addEventListener('click', explain);
  dailyItemElement.addEventListener('keydown', e => {
    if (e.key==='Enter' || e.key===' ') { e.preventDefault(); e.stopPropagation(); explain(); }
  });
  function cancelPlay() {
    if (drag) { resetPosition(drag.food); drag.food.dataset.dx='0'; drag.food.dataset.dy='0'; drag=null; }
    timers.forEach(clearTimeout); timers.clear();
    if (feedingFood) {
      resetPosition(feedingFood);
      feedingFood.dataset.dx='0'; feedingFood.dataset.dy='0';
      if (counts.get(feedingFood)===3) {
        feedingFood.querySelectorAll('mask circle').forEach(el=>el.remove());
        counts.set(feedingFood,0); feedingFood.dataset.bites='0'; feedingFood.classList.remove('finished');
      }
    }
    busy=false; feedingFood=null; stopTalking(); stageShell.classList.remove('is-responding','hungry');
  }
  window.addEventListener('resize', cancelPlay);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPlay(); });
  window.addEventListener('beforeunload', () => { cancelPlay(); clearInterval(ready); });
})();
