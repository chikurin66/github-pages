/* SVG masks leave transparent scalloped bites; original OpenMoji art is unmodified. */
(() => {
  const tray = document.querySelector('#food-tray');
  const ns = 'http://www.w3.org/2000/svg';
  // Unique phrases per food; shared motion families keep the reactions readable.
  const foods = [
    ['1F34C', 'バナナ', 'soft', 'あまくて、やわらかいね！'],
    ['1F370', 'ケーキ', 'sweet', 'ふわふわ！ あまくて、うれしいな！'],
    ['1F34E', 'りんご', 'crunch', 'しゃく、しゃく！ いいおとだね！'],
    ['1F353', 'いちご', 'sweet', 'いちご、あまくていいにおい！'],
    ['1F349', 'すいか', 'juicy', 'しゃりしゃり！ おくちが、じゅわー！'],
    ['1F34B', 'レモン', 'sour', 'わあ、すっぱーい！ おめめが、きゅっ！'],
    ['1F34A', 'みかん', 'juicy', 'みかんのしるが、じゅわー！'],
    ['1F351', 'もも', 'soft', 'もも、やわらかーい！ いいかおり！'],
    ['1F350', 'なし', 'crunch', 'しゃり、しゃり！ みずみずしいね！'],
    ['1F366', 'ソフトクリーム', 'cold', 'ひゃっ！ つめたくて、あまーい！'],
    ['1F368', 'アイスクリーム', 'cold', 'つめたーい！ おくちで、とけちゃった！'],
    ['1F369', 'ドーナツ', 'sweet', 'まあるいドーナツ、ぱくっ！ あまーい！'],
    ['1F36A', 'クッキー', 'crunch', 'さくさく、ぽりぽり！ たのしいおと！'],
    ['1F35E', 'パン', 'soft', 'ふわふわパン！ もぐもぐ、おいしい！'],
    ['1F359', 'おにぎり', 'meal', 'おこめが、もちもち！ げんきがでるね！'],
    ['1F355', 'ピザ', 'meal', 'チーズが、のびーる！ おいしいな！'],
    ['1F360', 'やきいも', 'soft', 'ほくほく！ おいもって、あまいね！'],
    ['1F33D', 'とうもろこし', 'crunch', 'つぶつぶ、ぷちぷち！ あまいね！'],
  ];
  const reactions = {
    soft: ['♥', '#e99b64'], sweet: ['♥', '#ef7299'],
    crunch: ['✦', '#d99827'], juicy: ['●', '#69bdd0'],
    sour: ['✧', '#b2b840'], cold: ['❄', '#73bdda'], meal: ['★', '#eeb74c'],
  };
  let deck = [];
  function nextFood(current) {
    const visible = new Set(Array.from(tray.children, el => el.dataset.hex));
    if (!deck.some(item => !visible.has(item[0]) && item[0] !== current)) {
      deck = foods.filter(item => !visible.has(item[0]) && item[0] !== current);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.splice(deck.findIndex(item => !visible.has(item[0]) && item[0] !== current), 1)[0];
  }
  function setFood(food, item) {
    const [hex, name, reaction, phrase] = item;
    Object.assign(food.dataset, {hex, name, reaction, phrase, bites:'0', dx:'0', dy:'0'});
    counts.set(food, 0);
    food.classList.remove('finished');
    food.setAttribute('aria-label', `${name}をぽんたにあげる`);
    food.querySelector('image').setAttribute('href', `https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/${hex}.svg`);
    food.querySelectorAll('mask circle').forEach(el => el.remove());
  }
  function react(food, complete) {
    const kind = food.dataset.reaction;
    const [symbol, color] = reactions[kind];
    stageShell.dataset.foodReaction = kind;
    replayClass(stageShell, 'food-reacting');
    createSparkBurst(complete);
    effectLayer.querySelectorAll('.spark').forEach(el => {
      el.textContent = symbol;
      el.style.setProperty('--spark-color', color);
    });
  }
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
      react(food, count === 3);
      status.textContent = `${food.dataset.name}を${count}くち たべたよ`;
      speakPhrase(count === 3 ? `${food.dataset.name}、ごちそうさま！` : food.dataset.phrase);
      isTalking = true; scheduleTalking(true);
    }, 380);
    later(() => {
      stopTalking(); resetPosition(food);
      stageShell.classList.remove('is-responding', 'food-reacting');
      food.dataset.dx = '0'; food.dataset.dy = '0';
      if (counts.get(food) === 3) {
        later(() => {
          setFood(food, nextFood(food.dataset.hex));
          busy = false; feedingFood = null;
        }, 300);
      } else {
        busy = false; feedingFood = null;
      }
    }, 3200);
  }
  for (const item of foods.slice(0, 3)) {
    const [hex, name] = item;
    const food = document.createElement('button');
    food.className = 'food'; food.type = 'button'; food.disabled = true;
    food.dataset.name = name; food.dataset.bites = '0';
    food.setAttribute('aria-label', `${name}をぽんたにあげる`);
    food.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><mask id="bite-${hex}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100" style="mask-type:luminance"><rect width="100" height="100" fill="white"/></mask></defs><image href="https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/${hex}.svg" width="100" height="100" mask="url(#bite-${hex})"/></svg>`;
    setFood(food, item);
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
        setFood(feedingFood, nextFood(feedingFood.dataset.hex));
      }
    }
    busy=false; feedingFood=null; stopTalking(); stageShell.classList.remove('is-responding','hungry','food-reacting');
  }
  window.addEventListener('resize', cancelPlay);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPlay(); });
  window.addEventListener('beforeunload', () => { cancelPlay(); clearInterval(ready); });
})();
