// =============================================================
// view.js … プレイ画面の見た目
//
// game.js の状態（Game.state）を見て、画面の表示を更新します。
// ・build()  … プレイ開始時に1回だけ、画面の部品（HTML要素）を作る
// ・render() … 毎フレーム呼ばれ、状態に合わせて表示を書き換える
//
// 部品の配置（位置や大きさ）は css/style.css に書いてあります。
// =============================================================

const View = {
  root: null,  // プレイ画面の要素
  els: {},     // 作った部品をしまっておく場所

  // ---------------------------------------------------------
  // 画面の部品を作る
  // ---------------------------------------------------------
  build(root) {
    this.root = root;
    root.innerHTML = '';
    Input.reset();
    const s = Game.state;
    const els = (this.els = {});

    // --- 上部のバー ---
    els.topbar = makeEl('div', 'topbar', root);
    els.topbar.innerHTML = `
      <span class="topbar-title">${CONFIG.title}</span>
      <span class="topbar-note">${s.diff.name}</span>
      <span class="topbar-stat">提供 <b data-stat="served">0</b></span>
      <span class="topbar-stat">トラブル <b data-stat="troubles">0</b></span>
      <span class="topbar-stat">どんぶり総数 <b data-stat="bowls">0</b></span>
    `;

    // --- 客席 ---
    els.seatArea = makeEl('div', 'seat-area', root);
    // 席の幅：席数が多いほど細くなる（最大200px）
    const gap = 8;
    const seatWidth = Math.min(200, (1248 - gap * (s.seats.length - 1)) / s.seats.length);
    els.seats = s.seats.map((seat, i) => this.buildSeat(i, seatWidth));
    makeEl('div', 'counter', root); // カウンター（飾り）

    // --- 洗い場 ---
    els.sink = this.buildZone('sink', '流し');
    els.sinkContent = makeEl('div', 'zone-content', els.sink);
    Input.register(els.sink, {
      drop: {
        accepts: (p) => p.type === 'dirtyBowl',
        onDrop: (p) => Game.clearSeat(p.seat),
      },
    });

    els.washer = this.buildZone('washer', '食洗機');
    els.washerContent = makeEl('div', 'zone-content', els.washer);
    els.washerBar = this.buildBar(els.washer, 'washer-bar');
    els.washerBtn = makeEl('div', 'btn washer-btn', els.washer);
    els.washerBtn.textContent = '洗浄開始';
    Input.register(els.washer, {
      // 洗い上がったどんぶりを作業台へ直接ドラッグ
      drag: () => (s.washer.status === 'done' && s.washer.count > 0 ? { type: 'cleanBowl', from: 'washer' } : null),
      ghost: () => this.miniBowlGhost('clean'),
      // タップで全部置き場へ
      tap: () => {
        if (!Game.unloadWasher() && Game.state.washer.status === 'washing') {
          Game.emit('hint', { text: '洗浄中です' });
        }
      },
    });
    Input.register(els.washerBtn, { tap: () => Game.startWasher() });

    els.stack = this.buildZone('stack', 'どんぶり置き場');
    els.stackContent = makeEl('div', 'zone-content', els.stack);
    Input.register(els.stack, {
      drag: () => (Game.state.cleanStack > 0 ? { type: 'cleanBowl', from: 'stack' } : null),
      ghost: () => this.miniBowlGhost('clean'),
      tap: () => Game.emit('hint', { text: 'どんぶりは作業台へドラッグしてね' }),
    });

    // --- 作業台 ---
    els.slotArea = makeEl('div', 'slot-area', root);
    els.slots = s.slots.map((_, i) => this.buildSlot(i));

    // --- カリカリタンク ---
    els.tank = this.buildZone('tank', 'カリカリ');
    els.tank.insertAdjacentHTML('beforeend', `
      <div class="tank-body">${Assets.icon('tank', '🦴', 'tank-icon')}</div>
      <div class="tank-nozzle"></div>
      <div class="tank-stream"></div>
      <div class="zone-hint">長押しで注ぐ</div>
    `);
    Input.register(els.tank, {
      holdStart: () => Game.setPouring(true),
      holdEnd: () => Game.setPouring(false),
    });

    // --- トッピング棚 ---
    els.shelf = this.buildZone('shelf', 'トッピング');
    const grid = makeEl('div', 'shelf-grid', els.shelf);
    els.toppingCells = s.toppingIds.map((id) => {
      const t = toppingInfo(id);
      const cell = makeEl('div', 'topping-cell', grid);
      cell.innerHTML = `${Assets.icon('topping_' + id, t.icon, 'topping-icon')}<span class="topping-name">${t.name}</span>`;
      Input.register(cell, {
        drag: () => ({ type: 'topping', id }),
        ghost: () => this.iconGhost(t),
      });
      return cell;
    });

    // --- フェーズ2で作る場所（今は置き場所だけ表示） ---
    for (const [id, label] of [['trash', 'ゴミ箱'], ['board', 'まな板'], ['fridge', '冷蔵庫']]) {
      const z = this.buildZone(id, label);
      z.classList.add('zone-later');
      makeEl('div', 'zone-hint', z).textContent = 'フェーズ2で追加';
    }

    // --- 演出用の層（ふきだし文字・お知らせ） ---
    els.fx = makeEl('div', 'fx-layer', root);

    this.render();
  },

  // 客席1つ分を作る
  buildSeat(i, width) {
    const root = makeEl('div', 'seat', this.els.seatArea);
    root.style.width = width + 'px';
    const bubble = makeEl('div', 'bubble', root);
    const order = makeEl('div', 'order', bubble);
    const bar = this.buildBar(bubble, 'wait-bar');
    const dog = makeEl('div', 'dog', root);
    const table = makeEl('div', 'table', root);
    const tableBowl = makeEl('div', 'table-bowl', table);

    Input.register(root, {
      // 片付けが必要な席は、どんぶりをドラッグして流しへ運べる
      drag: () => (Game.state.seats[i].status === 'dirty' ? { type: 'dirtyBowl', seat: i } : null),
      ghost: () => this.miniBowlGhost(Game.state.seats[i].dirtyType === 'leftover' ? 'leftover' : 'dirty'),
      // 作業台のどんぶりを受け取って提供する
      drop: {
        accepts: (p) => p.type === 'workBowl' && Game.canServe(i),
        onDrop: (p) => Game.serve(p.slot, i),
      },
    });
    return { root, bubble, order, bar, dog, tableBowl, key: null };
  },

  // 作業台1つ分を作る
  buildSlot(i) {
    const root = makeEl('div', 'slot', this.els.slotArea);
    const content = makeEl('div', 'slot-content', root);
    const label = makeEl('div', 'slot-label', root);

    Input.register(root, {
      drag: () => (Game.state.slots[i] ? { type: 'workBowl', slot: i } : null),
      ghost: (p) => this.bowlGhost(Game.state.slots[p.slot]),
      tap: () => Game.selectSlot(i),
      drop: {
        accepts: (p) => {
          const bowl = Game.state.slots[i];
          if (p.type === 'cleanBowl') return !bowl;
          if (p.type === 'workBowl') return p.slot !== i && !bowl;
          if (p.type === 'topping') return Game.canAddTopping(i, p.id);
          return false;
        },
        onDrop: (p) => {
          if (p.type === 'cleanBowl') Game.placeCleanBowl(p.from, i);
          else if (p.type === 'workBowl') Game.moveBowl(p.slot, i);
          else if (p.type === 'topping') Game.addTopping(i, p.id);
        },
      },
    });
    return { root, content, label, key: null };
  },

  // 見出し付きの枠（流し・食洗機など）を作る
  buildZone(id, label) {
    const z = makeEl('div', 'zone zone-' + id, this.root);
    makeEl('div', 'zone-label', z).textContent = label;
    return z;
  },

  // 進行バーを作る（中身の fill の幅を変えて使う）
  buildBar(parent, className) {
    const bar = makeEl('div', 'bar ' + className, parent);
    const fill = makeEl('div', 'bar-fill', bar);
    return { bar, fill };
  },

  // ---------------------------------------------------------
  // 毎フレームの表示更新
  // ---------------------------------------------------------
  render() {
    const s = Game.state;
    const els = this.els;

    // 出来事を取り出して演出する
    while (Game.events.length > 0) {
      this.handleEvent(Game.events.shift());
    }

    // 上部のバー
    setText(els.topbar.querySelector('[data-stat="served"]'), s.served);
    setText(els.topbar.querySelector('[data-stat="troubles"]'), s.troubles.length);
    setText(els.topbar.querySelector('[data-stat="bowls"]'), s.totalBowls);

    s.seats.forEach((_, i) => this.renderSeat(i));
    s.slots.forEach((_, i) => this.renderSlot(i));

    // 流し
    setHTML(els.sinkContent,
      `<div class="bowl-pile">${this.miniBowls('dirty', s.sink)}</div>
       <div class="count ${s.sink >= s.diff.sinkCapacity ? 'warn' : ''}">${s.sink} / ${s.diff.sinkCapacity}</div>`);

    // 食洗機
    const w = s.washer;
    let washerHTML;
    if (w.status === 'idle') {
      washerHTML = '<div class="washer-status">からっぽ</div>';
    } else if (w.status === 'washing') {
      washerHTML = `<div class="washer-status">洗浄中… ${w.count}個</div>`;
    } else {
      washerHTML = `<div class="washer-status done">洗い上がり ×${w.count}<br><small>タップで置き場へ</small></div>`;
    }
    setHTML(els.washerContent, washerHTML);
    els.washer.classList.toggle('is-done', w.status === 'done');
    els.washerBar.bar.style.display = w.status === 'washing' ? '' : 'none';
    if (w.status === 'washing') {
      els.washerBar.fill.style.width = (1 - w.timeLeft / s.diff.washTime) * 100 + '%';
    }
    els.washerBtn.classList.toggle('disabled', !Game.canStartWasher());

    // どんぶり置き場
    setHTML(els.stackContent,
      `<div class="bowl-pile">${this.miniBowls('clean', s.cleanStack)}</div>
       <div class="count">× ${s.cleanStack}</div>`);

    // カリカリタンク（注いでいる間だけカリカリが落ちる）
    els.tank.classList.toggle('pouring', s.pouring && !!Game.selectedBowl());
  },

  // 客席1つ分の表示更新
  renderSeat(i) {
    const seat = Game.state.seats[i];
    const e = this.els.seats[i];

    // 中身が変わったときだけ HTML を書き換える（毎フレーム書き換えると重いため）
    const c = seat.customer;
    const key = [seat.status, seat.dirtyType, c ? c.dog : '', c ? c.order.size : '', c ? c.order.toppings.join(',') : ''].join('|');
    if (e.key !== key) {
      e.key = key;
      // 注文の吹き出し
      if (seat.status === 'waiting') {
        const sizeName = CONFIG.sizeNames[c.order.size];
        e.order.innerHTML =
          `<span class="size-badge size-${c.order.size}">${sizeName}</span>` +
          // トッピングが3つ以上なら2列に並べる（細い席でも吹き出しに収まるように）
          `<span class="order-toppings ${c.order.toppings.length >= 3 ? 'two-cols' : ''}">${c.order.toppings.map((id) => Assets.icon('topping_' + id, toppingInfo(id).icon)).join('')}</span>`;
      }
      e.bubble.style.visibility = seat.status === 'waiting' ? 'visible' : 'hidden';
      // 犬
      e.dog.innerHTML = c ? Assets.icon('customer', c.dog) : '';
      e.dog.classList.toggle('eating', seat.status === 'eating');
      // テーブルの上のどんぶり
      if (seat.status === 'eating') e.tableBowl.innerHTML = this.miniBowls('food', 1);
      else if (seat.status === 'dirty') e.tableBowl.innerHTML = this.miniBowls(seat.dirtyType === 'leftover' ? 'leftover' : 'dirty', 1);
      else e.tableBowl.innerHTML = '';
      e.root.classList.toggle('needs-clear', seat.status === 'dirty');
    }

    // 待てる時間のバー（毎フレーム更新）
    if (seat.status === 'waiting') {
      const ratio = Math.max(0, c.waitLeft / c.patience);
      e.bar.fill.style.width = ratio * 100 + '%';
      e.bar.fill.classList.toggle('low', ratio < 0.3);
    }
  },

  // 作業台1つ分の表示更新
  renderSlot(i) {
    const s = Game.state;
    const bowl = s.slots[i];
    const e = this.els.slots[i];

    let label = '';
    if (bowl && CONFIG.kibble.showJudgeLabel) {
      const size = Game.judgeSize(bowl.kibble);
      if (Game.isOverfilled(bowl)) label = '盛りすぎ！';
      else if (size) label = CONFIG.sizeNames[size] + '盛';
      else if (bowl.kibble <= 0) label = 'カリカリなし';
      else label = '―';
    }

    // どんぶりの有無・トッピングが変わったときだけ HTML を書き換える
    const key = bowl ? 'bowl|' + bowl.toppings.join(',') : 'empty';
    if (e.key !== key) {
      e.key = key;
      e.content.innerHTML = bowl ? this.bowlHTML(bowl) : '<div class="slot-empty">どんぶりを<br>ここへ</div>';
    }
    // カリカリの量は毎フレーム、高さだけ変える
    if (bowl) {
      e.content.querySelector('.kibble').style.height = (bowl.kibble / CONFIG.kibble.bowlMax) * 100 + '%';
      e.content.querySelector('.bowl-body').classList.toggle('over', Game.isOverfilled(bowl));
    }
    setText(e.label, label);
    e.label.classList.toggle('warn', !!bowl && Game.isOverfilled(bowl));
    e.root.classList.toggle('selected', s.selectedSlot === i && !!bowl);
  },

  // ---------------------------------------------------------
  // 絵のHTMLを作る小道具
  // ---------------------------------------------------------

  // 作業台の大きなどんぶり（目安線つき）
  bowlHTML(bowl) {
    const { lines, bowlMax } = CONFIG.kibble;
    // 目安線（どんぶりの中）と、その名前（どんぶりの右外側）
    const lineHTML = Object.values(lines).map((v) =>
      `<div class="kibble-line" style="bottom:${(v / bowlMax) * 100}%"></div>`
    ).join('');
    const lineLabelHTML = Object.entries(lines).map(([size, v]) =>
      `<span class="kibble-line-label" style="bottom:${(v / bowlMax) * 100}%">${CONFIG.sizeNames[size]}</span>`
    ).join('');
    const toppingHTML = bowl.toppings.map((id) =>
      `<span class="placed-topping" data-topping="${id}">${Assets.icon('topping_' + id, toppingInfo(id).icon)}</span>`
    ).join('');
    return `
      <div class="bowl">
        <div class="bowl-toppings">${toppingHTML}</div>
        <div class="bowl-body">
          <div class="bowl-inner">
            <div class="kibble" style="height:${(bowl.kibble / bowlMax) * 100}%"></div>
            ${lineHTML}
          </div>
          ${lineLabelHTML}
        </div>
      </div>`;
  },

  // 小さなどんぶりを count 個並べる（type: clean / dirty / leftover / food）
  // 数が多いと枠からはみ出すので、絵は最大10個まで（正確な数は横の数字で見せる）
  miniBowls(type, count) {
    let html = '';
    for (let i = 0; i < Math.min(count, 10); i++) html += `<div class="mini-bowl ${type}"></div>`;
    return html;
  },

  // ドラッグ中の絵：大きなどんぶり
  bowlGhost(bowl) {
    const g = document.createElement('div');
    g.innerHTML = this.bowlHTML(bowl);
    return g;
  },

  // ドラッグ中の絵：小さなどんぶり
  miniBowlGhost(type) {
    const g = document.createElement('div');
    g.innerHTML = this.miniBowls(type, 1);
    g.classList.add('ghost-mini');
    return g;
  },

  // ドラッグ中の絵：トッピング
  iconGhost(t) {
    const g = document.createElement('div');
    g.innerHTML = Assets.icon('topping_' + t.id, t.icon, 'topping-icon');
    return g;
  },

  // ---------------------------------------------------------
  // 出来事に合わせた演出
  // ---------------------------------------------------------
  handleEvent(ev) {
    Sound.play(ev.type); // 効果音の受け口（今は何も鳴らない）
    const seatEl = ev.seat !== undefined ? this.els.seats[ev.seat].root : null;
    switch (ev.type) {
      case 'customerArrive': this.floatText(seatEl, 'いらっしゃいませ！', 'small'); break;
      case 'serveOk':        this.floatText(seatEl, '😋 いただきます！'); break;
      case 'serveNg':        this.floatText(seatEl, '💢 注文とちがう！', 'bad'); break;
      case 'customerAngry':  this.floatText(seatEl, '💢 おそい！', 'bad'); break;
      case 'customerFinish': this.floatText(seatEl, 'ごちそうさま！', 'small'); break;
      case 'bowlBroken':
        this.floatText(this.els.sink, '💥 パリーン！', 'bad');
        this.toast('流しがいっぱいで、どんぶりが割れた！');
        break;
      case 'washDone':       this.floatText(this.els.washer, '✨ 洗い上がり'); break;
      case 'hint':           this.toast(ev.text); break;
    }
  },

  // 要素の上にふわっと文字を出す
  floatText(targetEl, text, className = '') {
    if (!targetEl) return;
    const r = targetEl.getBoundingClientRect();
    // 要素の上から6割くらいの高さに出す（客席なら、吹き出しではなく犬のあたり）
    const p = Input.toStage(r.left + r.width / 2, r.top + r.height * 0.6);
    const f = makeEl('div', 'float-text ' + className, this.els.fx);
    f.textContent = text;
    f.style.left = p.x + 'px';
    f.style.top = p.y + 'px';
    setTimeout(() => f.remove(), 1500);
  },

  // 画面中央にお知らせを出す（前のお知らせが残っていたら消してから出す）
  toast(text) {
    if (this.toastEl) this.toastEl.remove();
    const t = makeEl('div', 'toast', this.els.fx);
    t.textContent = text;
    this.toastEl = t;
    setTimeout(() => t.remove(), 2000);
  },
};

// -------------------------------------------------------------
// 便利な小道具（HTML関係）
// -------------------------------------------------------------

// 要素を作って親に追加する
function makeEl(tag, className, parent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (parent) parent.appendChild(el);
  return el;
}

// 中身が変わったときだけ HTML を書き換える
function setHTML(el, html) {
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}

// 中身が変わったときだけ文字を書き換える
function setText(el, text) {
  text = String(text);
  if (el.textContent !== text) el.textContent = text;
}

// トッピングIDから、名前やアイコンの情報を取り出す
function toppingInfo(id) {
  return CONFIG.toppings.find((t) => t.id === id);
}
