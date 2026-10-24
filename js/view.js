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
      <span class="topbar-note">${s.diff.name}</span>
      <span class="hud-label">先輩が来るまで</span>
      <div class="progress">
        <div class="progress-fill"></div>
        <span class="progress-senpai">${Assets.icon('senpai', '🐕')}</span>
        <span class="progress-goal">🏠</span>
      </div>
      <span class="hud-label">ライフ</span>
      <span class="hud-lives"></span>
      <span class="topbar-stat">提供 <b data-stat="served">0</b></span>
      <span class="topbar-stat">どんぶり <b data-stat="bowls">0</b></span>
    `;
    els.progressFill = els.topbar.querySelector('.progress-fill');
    els.progressSenpai = els.topbar.querySelector('.progress-senpai');
    els.lives = els.topbar.querySelector('.hud-lives');

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
    // 手洗いの表示（こすっている途中のどんぶりと、進み具合のバー）
    els.handWash = makeEl('div', 'handwash', els.sink);
    els.handWashBar = this.buildBar(els.handWash, 'handwash-bar');
    els.handWashHint = makeEl('div', 'handwash-hint', els.handWash);
    Input.register(els.sink, {
      tap: () => Game.scrub(), // タップで手洗い（こする）
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
    // ボタンは、洗い上がっていれば「取り出す」、それ以外は「洗浄開始」として働く
    Input.register(els.washerBtn, {
      tap: () => (Game.state.washer.status === 'done' ? Game.unloadWasher() : Game.startWasher()),
    });

    els.stack = this.buildZone('stack', 'どんぶり置き場');
    els.stackContent = makeEl('div', 'zone-content', els.stack);
    Input.register(els.stack, {
      drag: () => (Game.state.cleanStack > 0 ? { type: 'cleanBowl', from: 'stack' } : null),
      ghost: () => this.miniBowlGhost('clean'),
      tap: () => Game.emit('hint', { text: 'どんぶりは作業台へドラッグしてね' }),
      // 食洗機から1個ずつドラッグして戻すこともできる
      drop: {
        accepts: (p) => p.type === 'cleanBowl' && p.from === 'washer',
        onDrop: () => Game.moveOneWasherToStack(),
      },
    });

    // --- 作業台 ---
    els.slotArea = makeEl('div', 'slot-area', root);
    els.slots = s.slots.map((_, i) => this.buildSlot(i));

    // --- カリカリタンク ---
    els.tank = this.buildZone('tank', 'カリカリ');
    // タンクの本体：中のカリカリの量をゲージ（茶色の高さ）と数字で見せる
    els.tank.insertAdjacentHTML('beforeend', `
      <div class="tank-body">
        <div class="tank-fill"></div>
        <div class="tank-count"></div>
        <div class="tank-hint">長押しで注ぐ</div>
      </div>
      <div class="tank-nozzle"></div>
      <div class="tank-stream"></div>
    `);
    els.tankFill = els.tank.querySelector('.tank-fill');
    els.tankCount = els.tank.querySelector('.tank-count');
    Input.register(els.tank, {
      holdStart: () => Game.setPouring(true),
      holdEnd: () => Game.setPouring(false),
      // カリカリの袋を落とすと補充
      drop: {
        accepts: (p) => p.type === 'kibbleBag',
        onDrop: () => Game.refillKibbleTank(),
      },
    });
    // カリカリの袋（いくらでもある）。タンクの上へドラッグして補充する
    els.kibbleBag = makeEl('div', 'kibble-bag', els.tank);
    els.kibbleBag.innerHTML = `${Assets.icon('kibble_bag', '🛍️')}<span class="bag-label">袋を<br>タンクへ</span>`;
    Input.register(els.kibbleBag, {
      drag: () => ({ type: 'kibbleBag' }),
      ghost: () => {
        const g = document.createElement('div');
        g.innerHTML = Assets.icon('kibble_bag', '🛍️', 'topping-icon');
        return g;
      },
    });

    // --- トッピング棚 ---
    els.shelf = this.buildZone('shelf', 'トッピング');
    const grid = makeEl('div', 'shelf-grid', els.shelf);
    els.toppingCells = {};
    for (const id of s.toppingIds) {
      const t = toppingInfo(id);
      const cell = makeEl('div', 'topping-cell', grid);
      cell.innerHTML = `${Assets.icon('topping_' + id, t.icon, 'topping-icon')}<span class="topping-name">${t.name}</span>`;
      const count = makeEl('span', 'stock-count', cell); // 残量の数字
      Input.register(cell, {
        drag: () => {
          if (Game.state.stock[id] <= 0) {
            Game.emit('hint', { text: `${t.name}が切れています。冷蔵庫から補充してね` });
            return null;
          }
          return { type: 'topping', id };
        },
        ghost: () => this.iconGhost(t),
      });
      els.toppingCells[id] = { cell, count };
    }
    // 棚全体が「どんぶりのトッピングを戻す場所」になる（どの容器の上に落としても、元の容器に戻る）
    Input.register(els.shelf, {
      drop: {
        accepts: (p) => p.type === 'placedTopping',
        onDrop: (p) => Game.returnTopping(p.slot, p.id),
      },
    });

    // --- ゴミ箱 ---
    els.trash = this.buildZone('trash', 'ゴミ箱');
    els.trash.insertAdjacentHTML('beforeend', `
      <div class="trash-icon">${Assets.icon('trash', '🗑️')}</div>
      <div class="zone-hint">作り直しは<br>ここへ</div>
    `);
    Input.register(els.trash, {
      drop: {
        accepts: (p) => ['workBowl', 'placedTopping', 'boardItem', 'potItem'].includes(p.type),
        onDrop: (p) => {
          if (p.type === 'workBowl') Game.trashBowl(p.slot);
          else if (p.type === 'placedTopping') Game.discardTopping(p.slot, p.id);
          else if (p.type === 'boardItem') Game.clearBoard();
          else if (p.type === 'potItem') Game.clearPot(p.pot);
        },
      },
    });

    // --- まな板 ---
    els.board = this.buildZone('board', 'まな板');
    els.boardContent = makeEl('div', 'zone-content board-content', els.board);
    els.boardBar = this.buildBar(els.board, 'board-bar');
    Input.register(els.board, {
      tap: () => Game.chop(),
      // 置いた食材は、ゴミ箱へドラッグして取り消せる
      drag: () => (Game.state.board ? { type: 'boardItem' } : null),
      ghost: () => this.iconGhost(toppingInfo(Game.state.board.id), 'whole_'),
      drop: {
        // 切る食材だけを光らせる（茹でる食材を落としたときは、Game 側で「鍋へ」と知らせる）
        accepts: (p) => p.type === 'ingredient' && !Game.state.board,
        onDrop: (p) => {
          if (Game.putOnBoard(p.id)) this.setFridgeOpen(false); // 置けたら冷蔵庫は自動で閉じる
        },
      },
    });

    // --- コンロ（鍋） ---
    els.stove = this.buildZone('stove', 'コンロ');
    const potArea = makeEl('div', 'pot-area', els.stove);
    els.pots = s.pots.map((_, i) => {
      const root = makeEl('div', 'pot', potArea);
      const content = makeEl('div', 'pot-content', root);
      // 茹で具合のゲージ（火がついている間だけ表示）
      const gauge = makeEl('div', 'pot-gauge', root);
      // ゲージの中の「ちょうどいい」範囲（緑の帯）。位置は入れた種類数で変わるので render で決める
      const zone = makeEl('div', 'pot-gauge-zone', gauge);
      const fill = makeEl('div', 'pot-gauge-fill', gauge);
      const label = makeEl('div', 'pot-label', root);
      Input.register(root, {
        // タップ：火をつける／取り出す／煮すぎを捨てる（Game.takeFromPot が状態に合わせて判断）
        tap: () => Game.takeFromPot(i),
        // 鍋の中身は、ゴミ箱へドラッグすると全部捨てられる
        drag: () => (Game.state.pots[i] ? { type: 'potItem', pot: i } : null),
        ghost: () => this.iconGhost(toppingInfo(Game.state.pots[i].items[0]), 'whole_'),
        drop: {
          // 火をつける前なら受け取る（種類の重複や上限は Game 側で判定して知らせる）
          accepts: (p) => p.type === 'ingredient' && !(Game.state.pots[i] && Game.state.pots[i].lit),
          // 何種類か続けて入れられるよう、冷蔵庫は開いたままにする
          onDrop: (p) => Game.putInPot(i, p.id),
        },
      });
      return { root, content, gauge, zone, fill, label, key: null };
    });

    // --- 冷蔵庫（タップすると、トッピング棚の上に食材の一覧が開く） ---
    els.fridge = this.buildZone('fridge', '冷蔵庫');
    els.fridge.insertAdjacentHTML('beforeend', `
      <div class="fridge-icon">${Assets.icon('fridge', '🧊')}</div>
      <div class="zone-hint fridge-hint">タップで<br>開く</div>
    `);
    Input.register(els.fridge, { tap: () => this.setFridgeOpen(!this.fridgeOpen) });

    els.fridgePanel = makeEl('div', 'fridge-panel', root);
    els.fridgePanel.innerHTML = '<div class="fridge-panel-title">冷蔵庫：🔪はまな板へ、♨️は鍋へドラッグ</div>';
    const closeBtn = makeEl('div', 'btn fridge-close', els.fridgePanel);
    closeBtn.textContent = '閉じる';
    Input.register(closeBtn, { tap: () => this.setFridgeOpen(false) });
    const fridgeGrid = makeEl('div', 'shelf-grid', els.fridgePanel);
    els.fridgeCounts = {}; // 冷蔵庫の一覧にも、トッピング棚の残量を表示する（開いている間も在庫がわかるように）
    for (const id of s.toppingIds) {
      const t = toppingInfo(id);
      const cell = makeEl('div', 'topping-cell', fridgeGrid);
      // 左上に下処理の方法の印（🔪 切る / ♨️ 茹でる）
      cell.innerHTML = `${Assets.icon('whole_' + id, t.icon, 'topping-icon')}<span class="topping-name">${t.name}</span>` +
        `<span class="prep-mark prep-${t.prep}">${t.prep === 'boil' ? '♨️' : '🔪'}</span>`;
      els.fridgeCounts[id] = { cell, count: makeEl('span', 'stock-count', cell) };
      Input.register(cell, {
        drag: () => ({ type: 'ingredient', id }),
        ghost: () => this.iconGhost(t, 'whole_'),
      });
    }
    this.setFridgeOpen(false);

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
      drag: (target) => {
        if (!Game.state.slots[i]) return null;
        // どんぶりの上のトッピングをつかんだら、そのトッピングだけを運ぶ
        const toppingEl = target.closest('[data-topping]');
        if (toppingEl) return { type: 'placedTopping', slot: i, id: toppingEl.dataset.topping };
        // それ以外なら、どんぶりごと運ぶ
        return { type: 'workBowl', slot: i };
      },
      ghost: (p) => (p.type === 'placedTopping'
        ? this.iconGhost(toppingInfo(p.id))
        : this.bowlGhost(Game.state.slots[p.slot])),
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

    // 上部のバー：先輩が来るまでの進み具合（先輩のアイコンが右のお店へ近づいていく）
    const progress = Math.min(1, s.time / s.diff.duration);
    els.progressFill.style.width = progress * 100 + '%';
    els.progressSenpai.style.left = progress * 100 + '%';
    // ライフ：残りは ❤️、トラブルで減った分は 💔
    const allowed = Game.troublesAllowed();
    const left = Math.max(0, allowed - s.troubles.length);
    setHTML(els.lives, '❤️'.repeat(left) + '💔'.repeat(allowed - left));
    setText(els.topbar.querySelector('[data-stat="served"]'), s.served);
    setText(els.topbar.querySelector('[data-stat="bowls"]'), s.totalBowls);

    s.seats.forEach((_, i) => this.renderSeat(i));
    s.slots.forEach((_, i) => this.renderSlot(i));

    // 流し（枠に収まるよう、積み重ねの絵は最大6個まで）
    setHTML(els.sinkContent,
      `<div class="bowl-pile">${this.miniBowls('dirty', Math.min(s.sink, 6))}</div>
       <div class="count ${s.sink >= s.diff.sinkCapacity ? 'warn' : ''}">${s.sink} / ${s.diff.sinkCapacity}</div>`);
    // 手洗い
    const hw = s.handWash;
    els.handWashBar.bar.style.visibility = hw ? 'visible' : 'hidden';
    if (hw) els.handWashBar.fill.style.width = (hw.taps / CONFIG.handWash.taps) * 100 + '%';
    setText(els.handWashHint, hw ? 'ゴシゴシ…タップ！' : (s.sink > 0 ? 'タップで手洗い' : ''));
    els.sink.classList.toggle('washing-by-hand', !!hw);

    // 食洗機
    const w = s.washer;
    let washerHTML;
    if (w.status === 'idle') {
      washerHTML = '<div class="washer-status">からっぽ</div>';
    } else if (w.status === 'washing') {
      washerHTML = `<div class="washer-status">洗浄中… ${w.count}個</div>`;
    } else {
      washerHTML = `<div class="bowl-pile">${this.miniBowls('clean', Math.min(w.count, 3))}</div>
                    <div class="washer-status done">洗い上がり ×${w.count}</div>`;
    }
    setHTML(els.washerContent, washerHTML);
    els.washer.classList.toggle('is-done', w.status === 'done');
    els.washerBar.bar.style.display = w.status === 'washing' ? '' : 'none';
    if (w.status === 'washing') {
      els.washerBar.fill.style.width = (1 - w.timeLeft / s.diff.washTime) * 100 + '%';
    }
    // 洗い上がったら、ボタンが緑の「取り出す」に変わる
    const isDone = w.status === 'done';
    setText(els.washerBtn, isDone ? '取り出す' : '洗浄開始');
    els.washerBtn.classList.toggle('unload', isDone);
    els.washerBtn.classList.toggle('disabled', !isDone && !Game.canStartWasher());

    // どんぶり置き場
    setHTML(els.stackContent,
      `<div class="bowl-pile">${this.miniBowls('clean', s.cleanStack)}</div>
       <div class="count">× ${s.cleanStack}</div>`);

    // カリカリタンク（注いでいる間だけカリカリが落ちる）
    els.tank.classList.toggle('pouring', s.pouring && !!Game.selectedBowl() && s.kibbleTank > 0);
    // タンクの残り（表示は整数に切り上げ。0.3単位残っていても「1」と見せて、0は本当に空のときだけ）
    const tank = CONFIG.kibbleTank;
    els.tankFill.style.height = (s.kibbleTank / tank.capacity) * 100 + '%';
    setText(els.tankCount, `${Math.ceil(s.kibbleTank)}/${tank.capacity}`);
    els.tank.classList.toggle('tank-low', s.kibbleTank > 0 && s.kibbleTank <= tank.lowWarning);
    els.tank.classList.toggle('tank-empty', s.kibbleTank <= 0);

    // トッピングの残量
    for (const id of s.toppingIds) {
      const n = s.stock[id];
      const { cell, count } = els.toppingCells[id];
      setText(count, n);
      cell.classList.toggle('empty', n <= 0);
      cell.classList.toggle('low', n > 0 && n <= CONFIG.stock.lowWarning);
      // 冷蔵庫の一覧の数字（食材は無限にあるので灰色にはせず、数字の色だけ変える）
      const f = els.fridgeCounts[id];
      setText(f.count, n);
      f.cell.classList.toggle('stock-low', n <= CONFIG.stock.lowWarning);
      f.cell.classList.toggle('stock-out', n <= 0);
    }

    // まな板
    const b = s.board;
    if (b) {
      const t = toppingInfo(b.id);
      setHTML(els.boardContent,
        `<div class="board-item">${Assets.icon('whole_' + b.id, t.icon)}</div>
         <div class="zone-hint">タップで切る！</div>`);
      els.boardBar.bar.style.display = '';
      els.boardBar.fill.style.width = (b.taps / CONFIG.stock.chopTaps) * 100 + '%';
    } else {
      setHTML(els.boardContent, '<div class="zone-hint">🔪の食材を<br>ここへ</div>');
      els.boardBar.bar.style.display = 'none';
    }
    els.board.classList.toggle('has-item', !!b);

    // 鍋
    s.pots.forEach((pot, i) => {
      const e = els.pots[i];
      const status = pot ? Game.potStatus(pot) : 'empty';
      const key = pot ? pot.items.join(',') + '|' + status : 'empty';
      if (e.key !== key) {
        e.key = key;
        e.content.innerHTML = pot
          ? pot.items.map((id) => Assets.icon('whole_' + id, toppingInfo(id).icon)).join('')
          : '';
        e.content.dataset.count = pot ? pot.items.length : 0; // 数に応じて絵の大きさを変える（CSS）
        e.label.innerHTML = {
          empty: '♨️の食材を<br>ここへ',
          waiting: `${pot ? pot.items.length : 0}/${CONFIG.boil.capacity}種類<br>タップで点火`,
          boiling: '茹でています…',
          ready: 'ちょうどいい！<br>タップで取り出す',
          over: '煮すぎ…<br>タップで捨てる',
        }[status];
        e.root.className = 'pot pot-' + status;
        // 「ちょうどいい」の帯の位置（火がついてから決まる）
        if (pot && pot.lit) {
          e.zone.style.left = (pot.readyAt / pot.overAt) * 100 + '%';
          e.zone.style.right = '0';
        }
      }
      e.gauge.style.visibility = pot && pot.lit ? 'visible' : 'hidden';
      e.fill.style.width = pot && pot.lit ? Math.min(1, pot.time / pot.overAt) * 100 + '%' : '0';
    });
  },

  // 冷蔵庫の一覧を開く・閉じる（開いている間はトッピング棚の上に重なる）
  setFridgeOpen(open) {
    this.fridgeOpen = open;
    this.els.fridgePanel.style.display = open ? '' : 'none';
    this.els.fridge.classList.toggle('open', open);
    this.els.fridge.querySelector('.fridge-hint').innerHTML = open ? 'タップで<br>閉じる' : 'タップで<br>開く';
  },

  // 客席1つ分の表示更新
  renderSeat(i) {
    const seat = Game.state.seats[i];
    const e = this.els.seats[i];

    // 中身が変わったときだけ HTML を書き換える（毎フレーム書き換えると重いため）
    const c = seat.customer;
    const key = [seat.status, seat.dirtyType, c ? c.dogIndex : '', c ? c.order.size : '', c ? c.order.toppings.join(',') : ''].join('|');
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
      e.dog.innerHTML = c ? Assets.icon('customer' + (c.dogIndex + 1), CONFIG.customerDogs[c.dogIndex]) : '';
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

  // ドラッグ中の絵：トッピング（prefix='whole_' なら丸ごとの食材の絵）
  iconGhost(t, prefix = 'topping_') {
    const g = document.createElement('div');
    g.innerHTML = Assets.icon(prefix + t.id, t.icon, 'topping-icon');
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
      case 'bowlBroken':     this.floatText(this.els.sink, '💥 パリーン！', 'bad'); break;
      case 'trouble':
        this.toast('トラブル：' + CONFIG.troubleNames[ev.kind]);
        // ライフ表示を一瞬ゆらす
        this.els.lives.classList.remove('shake');
        void this.els.lives.offsetWidth; // アニメーションをやり直すためのおまじない
        this.els.lives.classList.add('shake');
        break;
      case 'gameEnd':        this.showEnd(ev.kind); break;
      case 'washDone':       this.floatText(this.els.washer, '✨ 洗い上がり'); break;
      case 'scrub':          this.restartAnimation(this.els.sink, 'scrubbing'); break;
      case 'handWashDone':   this.floatText(this.els.stack, '✨ 手洗い完了', 'small'); break;
      case 'trash':          this.floatText(this.els.trash, 'ポイッ', 'small'); break;
      case 'overcooked':     this.floatText(this.els.pots[ev.pot].root, '💦 煮すぎた！', 'bad'); break;
      case 'potDiscard':     this.floatText(this.els.pots[ev.pot].root, '食材を捨てた', 'small'); break;
      case 'kibbleRefill':   this.floatText(this.els.tank, `カリカリ +${Math.round(ev.added)}`); break;
      case 'potLit':         this.floatText(this.els.pots[ev.pot].root, '🔥 点火！', 'small'); break;
      case 'returnBowl':     this.floatText(this.els.stack, '置き場へ戻した', 'small'); break;
      case 'chop':           this.restartAnimation(this.els.board, 'chopping'); break;
      case 'prepDone': {
        const t = toppingInfo(ev.id);
        const text = ev.added > 0 ? `✨ ${t.name} +${ev.added}` : `${t.name}は満タンでした`;
        this.floatText(this.els.toppingCells[ev.id].cell, text, ev.added > 0 ? '' : 'small');
        break;
      }
      case 'hint':           this.toast(ev.text); break;
    }
  },

  // ゲーム終了の演出（クリアなら先輩が到着、ゲームオーバーなら残念な表示）
  // 画面全体を覆うので、この後はお店の操作ができなくなる
  showEnd(kind) {
    const cleared = kind === 'clear';
    const overlay = makeEl('div', 'end-overlay ' + (cleared ? 'is-clear' : 'is-over'), this.root);
    overlay.innerHTML = cleared
      ? `<div class="end-title">クリア！</div>
         <div class="end-scene">
           <div class="end-senpai">${Assets.icon('senpai', '🐕')}</div>
           <div class="end-bubble">${CONFIG.texts.senpaiArrive}</div>
         </div>`
      : `<div class="end-title">ゲームオーバー</div>
         <div class="end-scene">
           <div class="end-player">${Assets.icon('player_sad', '🐶')}</div>
           <div class="end-bubble">${CONFIG.texts.gameOver}</div>
         </div>`;
    const btn = makeEl('button', 'btn end-btn', overlay);
    btn.textContent = '結果を見る';
    btn.onclick = () => Scenes.go('result', Game.summary());
  },

  // CSSのアニメーションを最初からやり直す（タップのたびに動かしたいとき用）
  restartAnimation(el, className) {
    el.classList.remove(className);
    void el.offsetWidth; // ブラウザに一度描き直させるためのおまじない
    el.classList.add(className);
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
