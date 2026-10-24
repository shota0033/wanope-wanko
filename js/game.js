// =============================================================
// game.js … ゲーム本体
//
// このファイルは「お店の状態」と「ルール」だけを扱います。
// 画面の見た目（HTML）には一切触りません。見た目は view.js の担当です。
//
// 画面に知らせたい出来事（客が来た、どんぶりが割れた、など）は
// Game.emit() で events にためておき、view.js が毎フレーム取り出して
// 演出や効果音を出します。
// =============================================================

const Game = {
  state: null,   // お店の状態をまとめたもの（start で作る）
  events: [],    // 画面に知らせたい出来事の箱

  // ---------------------------------------------------------
  // ゲーム開始：お店の状態を初期化する
  // ---------------------------------------------------------
  start(difficultyKey) {
    const diff = CONFIG.difficulties[difficultyKey];
    // 使うトッピング（一覧の上から toppingCount 個）
    const toppingIds = CONFIG.toppings.slice(0, diff.toppingCount).map((t) => t.id);

    this.state = {
      difficultyKey,
      diff,                 // 難易度の設定
      time: 0,              // 経過したゲーム内時間（秒）
      toppingIds,

      // 客席。status は次のどれか：
      //   'empty'   … 空席（客が座れる）
      //   'waiting' … 客が注文して待っている
      //   'eating'  … 客が食べている
      //   'dirty'   … 客が帰って、どんぶりが残っている（片付けが必要）
      seats: Array.from({ length: diff.seats }, () => ({
        status: 'empty',
        customer: null,
        dirtyType: null,    // 'empty'=食べ終わり / 'leftover'=食べ残し（提供間違い）
      })),

      totalBowls: diff.totalBowls,  // 店にあるどんぶりの総数（割れると減る）
      cleanStack: diff.totalBowls,  // きれいなどんぶり置き場の数

      // 作業台。null なら空き、どんぶりがあれば { kibble: 量, toppings: [ID...] }
      slots: Array(diff.workbenchSlots).fill(null),
      selectedSlot: null,   // 選択中の作業台の番号（カリカリを注ぐ先）
      pouring: false,       // カリカリタンクを長押し中か

      // トッピングの残量（例：{ carrot: 5, broccoli: 5, ... }）
      stock: Object.fromEntries(toppingIds.map((id) => [id, CONFIG.stock.initial])),
      // まな板。null なら空き、食材があれば { id: トッピングID, taps: 切った回数 }
      board: null,
      // 鍋。null なら空き、食材があれば { id: トッピングID, time: 茹でている時間, over: 煮すぎたか }
      pots: Array(CONFIG.boil.pots).fill(null),

      sink: 0,              // 流しにある汚れたどんぶりの数

      // 食洗機。status は 'idle'（空）/ 'washing'（洗浄中）/ 'done'（洗い上がり）
      washer: { status: 'idle', count: 0, timeLeft: 0 },

      nextCustomerIn: diff.firstCustomerDelay, // 次の客が来るまでの残り時間
      served: 0,            // 正しく提供した数
      troubles: [],         // 起きたトラブルの記録 { kind, time }
    };
    this.events = [];
  },

  // ---------------------------------------------------------
  // 毎フレーム呼ばれる：時間を進める
  //   realDt … 前のフレームからの「現実の」経過秒数
  // ---------------------------------------------------------
  update(realDt) {
    const s = this.state;
    if (!s) return;
    const dt = realDt * CONFIG.timeScale; // ゲーム内の経過秒数
    s.time += dt;

    // --- カリカリを注ぐ（プレイヤーの操作なので「現実の時間」で増やす） ---
    if (s.pouring) {
      const bowl = this.selectedBowl();
      if (bowl) {
        bowl.kibble = Math.min(CONFIG.kibble.bowlMax, bowl.kibble + CONFIG.kibble.pourPerSecond * realDt);
      }
    }

    // --- 客席 ---
    s.seats.forEach((seat, i) => {
      if (seat.status === 'waiting') {
        seat.customer.waitLeft -= dt;
        if (seat.customer.waitLeft <= 0) {
          // 待ちきれずに怒って帰る（どんぶりは残らないので、すぐ空席になる）
          seat.status = 'empty';
          seat.customer = null;
          this.emit('customerAngry', { seat: i });
          this.addTrouble('late');
        }
      } else if (seat.status === 'eating') {
        seat.customer.eatLeft -= dt;
        if (seat.customer.eatLeft <= 0) {
          // 食べ終わって帰る → 空のどんぶりが席に残る
          seat.status = 'dirty';
          seat.dirtyType = 'empty';
          seat.customer = null;
          this.emit('customerFinish', { seat: i });
        }
      }
    });

    // --- 食洗機 ---
    const w = s.washer;
    if (w.status === 'washing') {
      w.timeLeft -= dt;
      if (w.timeLeft <= 0) {
        w.status = 'done'; // 洗い上がっても自動では出てこない
        w.timeLeft = 0;
        this.emit('washDone');
      }
    }

    // --- 鍋（茹でている時間を進める） ---
    s.pots.forEach((pot, i) => {
      if (!pot) return;
      pot.time += dt;
      if (!pot.over && pot.time >= CONFIG.boil.overAt) {
        pot.over = true; // 取り出すのが遅れて煮すぎた
        this.emit('overcooked', { pot: i });
      }
    });

    // --- 新しい客 ---
    s.nextCustomerIn -= dt;
    if (s.nextCustomerIn <= 0) {
      const emptySeats = s.seats
        .map((seat, i) => (seat.status === 'empty' ? i : -1))
        .filter((i) => i >= 0);
      if (emptySeats.length > 0) {
        this.spawnCustomer(randomPick(emptySeats));
        s.nextCustomerIn = randomRange(s.diff.customerInterval);
      } else {
        // 満席なら、少し待ってからもう一度確かめる
        s.nextCustomerIn = s.diff.seatRefillDelay;
      }
    }
  },

  // 客を席に座らせて、注文を決める
  spawnCustomer(seatIndex) {
    const s = this.state;
    const seat = s.seats[seatIndex];
    seat.status = 'waiting';
    seat.customer = {
      dog: randomPick(CONFIG.customerDogs),
      order: this.makeOrder(),
      patience: s.diff.patience,  // 待てる時間（バーの長さの基準）
      waitLeft: s.diff.patience,  // 残りの待てる時間
      eatLeft: 0,
    };
    this.emit('customerArrive', { seat: seatIndex });
  },

  // ランダムな注文を作る
  makeOrder() {
    const s = this.state;
    const size = randomPick(Object.keys(CONFIG.kibble.lines)); // small / medium / large
    const [min, max] = s.diff.toppingsPerOrder;
    const count = randomInt(min, Math.min(max, s.toppingIds.length));
    // トッピングをシャッフルして先頭から count 個選ぶ
    const picked = shuffle(s.toppingIds.slice()).slice(0, count);
    // 表示が毎回バラバラにならないよう、一覧の順番に並べ直す
    picked.sort((a, b) => s.toppingIds.indexOf(a) - s.toppingIds.indexOf(b));
    return { size, toppings: picked };
  },

  // ---------------------------------------------------------
  // カリカリ量の判定
  // ---------------------------------------------------------

  // 量から「small / medium / large」を判定する。どの目安線にも近くなければ null
  judgeSize(kibble) {
    const { lines, tolerance } = CONFIG.kibble;
    for (const [size, line] of Object.entries(lines)) {
      if (Math.abs(kibble - line) <= tolerance) return size;
    }
    return null;
  },

  // 大盛の上限を超えて盛りすぎているか
  isOverfilled(bowl) {
    return bowl.kibble > CONFIG.kibble.lines.large + CONFIG.kibble.tolerance;
  },

  // どんぶりが注文どおりか
  isMatch(bowl, order) {
    if (this.judgeSize(bowl.kibble) !== order.size) return false;
    if (bowl.toppings.length !== order.toppings.length) return false;
    return order.toppings.every((id) => bowl.toppings.includes(id));
  },

  // ---------------------------------------------------------
  // プレイヤーの操作（成功したら true、できなければ false を返す）
  // ---------------------------------------------------------

  // きれいなどんぶりを作業台に置く（from は 'stack'=置き場 / 'washer'=食洗機）
  placeCleanBowl(from, slotIndex) {
    const s = this.state;
    if (s.slots[slotIndex]) return false; // すでにどんぶりがある
    if (from === 'stack') {
      if (s.cleanStack <= 0) return false;
      s.cleanStack--;
    } else if (from === 'washer') {
      if (!this.takeOneFromWasher()) return false;
    } else {
      return false;
    }
    s.slots[slotIndex] = { kibble: 0, toppings: [] };
    s.selectedSlot = slotIndex; // 置いたどんぶりを自動で選択中にする
    this.emit('placeBowl', { slot: slotIndex });
    return true;
  },

  // 作業台のどんぶりを、別の空いている作業台へ移す
  moveBowl(fromSlot, toSlot) {
    const s = this.state;
    if (!s.slots[fromSlot] || s.slots[toSlot]) return false;
    s.slots[toSlot] = s.slots[fromSlot];
    s.slots[fromSlot] = null;
    if (s.selectedSlot === fromSlot) s.selectedSlot = toSlot;
    return true;
  },

  // 作業台のどんぶりを選択する（タップしたとき）
  selectSlot(slotIndex) {
    const s = this.state;
    if (!s.slots[slotIndex]) return false;
    s.selectedSlot = slotIndex;
    return true;
  },

  // 選択中のどんぶり（なければ null）
  selectedBowl() {
    const s = this.state;
    return s.selectedSlot === null ? null : s.slots[s.selectedSlot];
  },

  // カリカリタンクの長押しを始めた／やめた
  setPouring(on) {
    const s = this.state;
    if (on && !this.selectedBowl()) {
      this.emit('hint', { text: '先に作業台にどんぶりを置いてね' });
    }
    s.pouring = on;
    this.emit(on ? 'pourStart' : 'pourEnd');
  },

  // トッピングを載せる（容器の残量が1減る）
  addTopping(slotIndex, toppingId) {
    if (!this.canAddTopping(slotIndex, toppingId)) return false;
    this.state.slots[slotIndex].toppings.push(toppingId);
    this.state.stock[toppingId]--;
    this.emit('topping', { slot: slotIndex });
    return true;
  },

  // そのトッピングを載せられるか（ドラッグ中に光らせる判定用）
  canAddTopping(slotIndex, toppingId) {
    const bowl = this.state.slots[slotIndex];
    return !!bowl && !bowl.toppings.includes(toppingId) && this.state.stock[toppingId] > 0;
  },

  // どんぶりのトッピングを容器へ戻す（残量が1増える。上限は超えない）
  returnTopping(slotIndex, toppingId) {
    const s = this.state;
    if (!this.removeTopping(slotIndex, toppingId)) return false;
    s.stock[toppingId] = Math.min(CONFIG.stock.max, s.stock[toppingId] + 1);
    this.emit('returnTopping');
    return true;
  },

  // どんぶりのトッピングを1つだけゴミ箱へ捨てる（残量は戻らない）
  discardTopping(slotIndex, toppingId) {
    if (!this.removeTopping(slotIndex, toppingId)) return false;
    this.emit('trash');
    return true;
  },

  // どんぶりからトッピングを取り除く（returnTopping と discardTopping の共通部分）
  removeTopping(slotIndex, toppingId) {
    const bowl = this.state.slots[slotIndex];
    if (!bowl || !bowl.toppings.includes(toppingId)) return false;
    bowl.toppings = bowl.toppings.filter((id) => id !== toppingId);
    return true;
  },

  // 作業台のどんぶりをゴミ箱へ：中身を捨てて、どんぶりは流しへ
  //   ・中身が空っぽ（まだ使っていない）なら、汚れていないので置き場へ戻す
  //   ・流しが満杯なら、どんぶりは割れてトラブル（putToSink の中で判定）
  trashBowl(slotIndex) {
    const s = this.state;
    const bowl = s.slots[slotIndex];
    if (!bowl) return false;
    s.slots[slotIndex] = null;
    this.fixSelection();
    if (bowl.kibble <= 0 && bowl.toppings.length === 0) {
      s.cleanStack++;
      this.emit('returnBowl');
    } else {
      this.emit('trash');
      this.putToSink();
    }
    return true;
  },

  // ---------------------------------------------------------
  // 下処理
  //   切る食材   … 冷蔵庫 → まな板 → タップで切る → 容器に補充
  //   茹でる食材 … 冷蔵庫 → 鍋 → 待つ → ちょうどいいときにタップで取り出す → 容器に補充
  // ---------------------------------------------------------

  // 冷蔵庫の食材をまな板に置く（まな板は1つなので、空いているときだけ）
  putOnBoard(toppingId) {
    const s = this.state;
    if (s.board || !s.toppingIds.includes(toppingId)) return false;
    if (toppingInfo(toppingId).prep !== 'cut') {
      this.emit('hint', { text: 'これは鍋で茹でる食材です' });
      return false;
    }
    s.board = { id: toppingId, taps: 0 };
    this.emit('putOnBoard');
    return true;
  },

  // 冷蔵庫の食材を鍋に入れる（空いている鍋だけ）
  putInPot(potIndex, toppingId) {
    const s = this.state;
    if (s.pots[potIndex] || !s.toppingIds.includes(toppingId)) return false;
    if (toppingInfo(toppingId).prep !== 'boil') {
      this.emit('hint', { text: 'これはまな板で切る食材です' });
      return false;
    }
    s.pots[potIndex] = { id: toppingId, time: 0, over: false };
    this.emit('putInPot', { pot: potIndex });
    return true;
  },

  // 鍋の茹で具合：'boiling'（まだ）/ 'ready'（ちょうどいい）/ 'over'（煮すぎ）
  potStatus(pot) {
    if (pot.over) return 'over';
    return pot.time >= CONFIG.boil.readyAt ? 'ready' : 'boiling';
  },

  // 鍋をタップ：ちょうどいいなら取り出して補充、煮すぎなら捨てる
  takeFromPot(potIndex) {
    const s = this.state;
    const pot = s.pots[potIndex];
    if (!pot) {
      this.emit('hint', { text: '冷蔵庫から茹でる食材を鍋へ運んでね' });
      return false;
    }
    const status = this.potStatus(pot);
    if (status === 'boiling') {
      // 早すぎるタップは失敗にしない（うっかり押しても大丈夫）
      this.emit('hint', { text: 'まだ茹でている途中です' });
      return false;
    }
    s.pots[potIndex] = null;
    if (status === 'over') {
      this.emit('potDiscard', { pot: potIndex });
      return false;
    }
    this.refillStock(pot.id);
    return true;
  },

  // 鍋の食材をゴミ箱へ捨てる
  clearPot(potIndex) {
    if (!this.state.pots[potIndex]) return false;
    this.state.pots[potIndex] = null;
    this.emit('trash');
    return true;
  },

  // 下処理が終わった食材を容器に補充する（上限を超えた分は捨てる）
  refillStock(toppingId) {
    const s = this.state;
    const before = s.stock[toppingId];
    s.stock[toppingId] = Math.min(CONFIG.stock.max, before + CONFIG.stock.refill);
    this.emit('prepDone', { id: toppingId, added: s.stock[toppingId] - before });
  },

  // まな板をタップして切る。必要な回数に達したら容器に補充する
  chop() {
    const s = this.state;
    if (!s.board) {
      this.emit('hint', { text: '冷蔵庫から食材をまな板へ運んでね' });
      return false;
    }
    s.board.taps++;
    this.emit('chop');
    if (s.board.taps >= CONFIG.stock.chopTaps) {
      const id = s.board.id;
      s.board = null;
      this.refillStock(id);
    }
    return true;
  },

  // まな板の食材をゴミ箱へ捨てる（下処理の取り消し）
  clearBoard() {
    if (!this.state.board) return false;
    this.state.board = null;
    this.emit('trash');
    return true;
  },

  // その席に提供できるか（注文を待っている客がいるか）
  canServe(seatIndex) {
    return this.state.seats[seatIndex].status === 'waiting';
  },

  // 作業台のどんぶりを客席に出す
  serve(slotIndex, seatIndex) {
    const s = this.state;
    const bowl = s.slots[slotIndex];
    const seat = s.seats[seatIndex];
    if (!bowl || seat.status !== 'waiting') return false;

    // 作業台からどんぶりをなくす
    s.slots[slotIndex] = null;
    this.fixSelection();

    if (this.isMatch(bowl, seat.customer.order)) {
      // 正解：食べ始める
      seat.status = 'eating';
      seat.customer.eatLeft = randomRange(s.diff.eatTime);
      s.served++;
      this.emit('serveOk', { seat: seatIndex });
    } else {
      // 間違い：客は帰り、食べ残しのどんぶりが席に残る
      seat.status = 'dirty';
      seat.dirtyType = 'leftover';
      seat.customer = null;
      this.emit('serveNg', { seat: seatIndex });
      this.addTrouble('wrong');
    }
    return true;
  },

  // 選択中のどんぶりがなくなったら、残っている別のどんぶりを選び直す
  fixSelection() {
    const s = this.state;
    if (s.selectedSlot !== null && s.slots[s.selectedSlot]) return;
    const next = s.slots.findIndex((b) => b !== null);
    s.selectedSlot = next >= 0 ? next : null;
  },

  // 席に残ったどんぶりを流しへ片付ける
  clearSeat(seatIndex) {
    const seat = this.state.seats[seatIndex];
    if (seat.status !== 'dirty') return false;
    seat.status = 'empty';
    seat.dirtyType = null;
    this.putToSink();
    return true;
  },

  // 汚れたどんぶりを流しに置く。満杯なら割れてトラブル
  putToSink() {
    const s = this.state;
    if (s.sink >= s.diff.sinkCapacity) {
      s.totalBowls--;           // どんぶりが1つ減る
      this.emit('bowlBroken');
      this.addTrouble('broken');
      return false;
    }
    s.sink++;
    this.emit('toSink');
    return true;
  },

  // 食洗機の洗浄を開始できるか
  canStartWasher() {
    const s = this.state;
    return s.washer.status === 'idle' && s.sink > 0;
  },

  // 「洗浄開始」ボタン
  startWasher() {
    const s = this.state;
    const w = s.washer;
    if (w.status === 'washing') {
      this.emit('hint', { text: '洗浄中です' });
      return false;
    }
    if (w.status === 'done') {
      this.emit('hint', { text: '先に洗い上がったどんぶりを取り出してね' });
      return false;
    }
    if (s.sink <= 0) {
      this.emit('hint', { text: '流しにどんぶりがありません' });
      return false;
    }
    w.count = Math.min(s.sink, s.diff.washerCapacity);
    s.sink -= w.count;
    w.status = 'washing';
    w.timeLeft = s.diff.washTime;
    this.emit('washStart');
    return true;
  },

  // 食洗機をタップ：洗い上がったどんぶりを全部置き場へ移す
  unloadWasher() {
    const s = this.state;
    const w = s.washer;
    if (w.status !== 'done') return false;
    s.cleanStack += w.count;
    w.count = 0;
    w.status = 'idle';
    this.emit('unloadWasher');
    return true;
  },

  // 食洗機から1個だけ取り出す（作業台へ直接ドラッグしたとき）
  takeOneFromWasher() {
    const w = this.state.washer;
    if (w.status !== 'done' || w.count <= 0) return false;
    w.count--;
    if (w.count === 0) w.status = 'idle';
    return true;
  },

  // トラブルを記録する（フェーズ3でライフやゲームオーバーにつなげる）
  addTrouble(kind) {
    const s = this.state;
    s.troubles.push({ kind, time: s.time });
    this.emit('trouble', { kind });
  },

  // 画面に知らせたい出来事を箱に入れる
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  },
};

// -------------------------------------------------------------
// 便利な小道具
// -------------------------------------------------------------

// トッピングIDから、名前・アイコン・下処理の方法などの情報を取り出す
function toppingInfo(id) {
  return CONFIG.toppings.find((t) => t.id === id);
}

// 配列からランダムに1つ選ぶ
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// [最小, 最大] の範囲のランダムな小数
function randomRange([min, max]) {
  return min + Math.random() * (max - min);
}

// min 以上 max 以下のランダムな整数
function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// 配列の順番をランダムに入れ替える（元の配列を書き換えて返す）
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
