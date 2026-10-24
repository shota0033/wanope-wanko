// =============================================================
// input.js … ドラッグ＆ドロップ・長押し・タップの共通処理
//
// マウスとタッチを同じコードで扱うために「Pointer Events」を使います。
// （pointerdown = 押した / pointermove = 動かした / pointerup = 離した）
//
// 使い方：画面の部品（HTML要素）を Input.register() で登録します。
//
//   Input.register(要素, {
//     drag:  (押した場所の要素) => 運ぶもの or null,  … ドラッグで運べるものを返す
//     ghost: (運ぶもの) => 要素,         … ドラッグ中に指についてくる絵
//     tap:   (押した場所の要素) => {},  … タップされたとき
//     holdStart: () => {},             … 長押しが始まったとき（押した瞬間）
//     holdEnd:   () => {},             … 長押しが終わったとき（離した瞬間）
//     drop: {                          … ドラッグしたものを落とせる場所にする
//       accepts: (運ぶもの) => true/false,  … 受け取れるかどうか
//       onDrop:  (運ぶもの) => {},          … 落とされたときの処理
//     },
//   });
//
// 【タップとドラッグの区別】
//   押してから CONFIG.input.dragThreshold ピクセル以上動いたら「ドラッグ」、
//   それより動かさずに離したら「タップ」と判定します。
//   一度ドラッグと判定されたら、そのあとタップにはなりません（逆も同じ）。
// =============================================================

const Input = {
  stage: null,           // ゲーム領域の要素
  handlers: new Map(),   // 登録された部品の一覧（番号 → { el, opts }）
  nextId: 1,             // 登録番号の連番
  pointers: new Map(),   // いま押されている指（マウス）ごとの状態

  // 最初に1回だけ呼ぶ：イベントの受け取りを始める
  init(stage) {
    this.stage = stage;
    // 押したときは、ゲーム領域の中だけで受け取る
    stage.addEventListener('pointerdown', (e) => this.onDown(e));
    // 動かした・離したは、指がゲーム領域の外に出ても受け取れるよう window で受け取る
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e, false));
    // 電話の着信などで操作が中断されたとき
    window.addEventListener('pointercancel', (e) => this.onUp(e, true));
    // 長押しで右クリックメニューが出ないようにする
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // 部品を登録する（使い方はファイル先頭の説明を参照）
  register(el, opts) {
    const id = String(this.nextId++);
    el.dataset.inputId = id;
    this.handlers.set(id, { el, opts });
  },

  // 登録をすべて消す（画面を作り直すときに呼ぶ）
  reset() {
    // 押しっぱなしの操作があれば、中断扱いで後片付けする
    for (const info of this.pointers.values()) {
      this.finish(info, true);
    }
    this.pointers.clear();
    this.handlers.clear();
  },

  // 画面上の座標（ブラウザの座標）を、ゲーム領域の座標（1280×720）に直す
  toStage(clientX, clientY) {
    const rect = this.stage.getBoundingClientRect();
    const scale = rect.width / CONFIG.stageWidth;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  },

  // 押された要素から外側へたどって、条件に合う登録部品を探す
  // （例：どんぶりの中のトッピングの絵を押したら、外側の「作業台」が見つかる）
  findHandler(target, condition) {
    let el = target instanceof Element ? target.closest('[data-input-id]') : null;
    while (el) {
      const h = this.handlers.get(el.dataset.inputId);
      if (h && condition(h.opts)) return h;
      el = el.parentElement ? el.parentElement.closest('[data-input-id]') : null;
    }
    return null;
  },

  // 画面上のある点の下にある「落とせる場所」を探す
  dropZoneAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    return el ? this.findHandler(el, (o) => o.drop) : null;
  },

  // ---------- 押した ----------
  onDown(e) {
    // マウスは左ボタンだけ受け付ける
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const h = this.findHandler(e.target, (o) => o.drag || o.tap || o.holdStart);
    if (!h) return;
    e.preventDefault();

    const info = {
      h,
      target: e.target,       // 実際に押された要素（どんぶりの中のトッピングなど）
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      mode: 'pending',        // pending=まだ判定前 / drag=ドラッグ中 / hold=長押し中 / none=何もしない
    };

    // 長押しする部品なら、押した瞬間に長押し開始
    if (h.opts.holdStart) {
      info.mode = 'hold';
      h.el.classList.add('holding');
      h.opts.holdStart();
    }
    this.pointers.set(e.pointerId, info);
  },

  // ---------- 動かした ----------
  onMove(e) {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;

    if (info.mode === 'pending') {
      // 押した位置からどれだけ動いたか
      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      if (dist >= CONFIG.input.dragThreshold) {
        // 一定以上動いた → ドラッグ開始を試みる
        const payload = info.h.opts.drag ? info.h.opts.drag(info.target) : null;
        if (payload) {
          this.beginDrag(info, payload, e);
        } else {
          // 運べるものがなければ、この操作は何もしない（タップにもならない）
          info.mode = 'none';
        }
      }
    } else if (info.mode === 'drag') {
      this.moveGhost(info, e.clientX, e.clientY);
      this.updateHover(info, e.clientX, e.clientY);
    }
  },

  // ---------- 離した（cancelled=true なら中断） ----------
  onUp(e, cancelled) {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    this.pointers.delete(e.pointerId);

    if (!cancelled && info.mode === 'pending' && info.h.opts.tap) {
      // ほとんど動かさずに離した → タップ
      info.h.opts.tap(info.target);
    }
    if (!cancelled && info.mode === 'drag') {
      // ドラッグを離した場所に「落とせる場所」があれば渡す
      const zone = this.dropZoneAt(e.clientX, e.clientY);
      if (zone && zone.opts.drop.accepts(info.payload)) {
        zone.opts.drop.onDrop(info.payload);
      }
      // 受け取れる場所でなければ、何も起きない（元の場所に戻ったように見える）
    }
    this.finish(info, cancelled);
  },

  // ドラッグを始める：指についてくる絵（ゴースト）を作る
  beginDrag(info, payload, e) {
    info.mode = 'drag';
    info.payload = payload;
    const ghost = info.h.opts.ghost ? info.h.opts.ghost(payload) : document.createElement('div');
    ghost.classList.add('ghost');
    this.stage.appendChild(ghost);
    info.ghost = ghost;
    info.h.el.classList.add('drag-source');
    this.moveGhost(info, e.clientX, e.clientY);
    this.updateHover(info, e.clientX, e.clientY);
  },

  // ゴーストを指の位置へ動かす
  moveGhost(info, clientX, clientY) {
    const p = this.toStage(clientX, clientY);
    const offsetY = info.pointerType === 'touch' ? CONFIG.input.touchGhostOffsetY : 0;
    info.ghost.style.left = p.x + 'px';
    info.ghost.style.top = (p.y + offsetY) + 'px';
  },

  // 指の下の「落とせる場所」を光らせる
  updateHover(info, clientX, clientY) {
    const zone = this.dropZoneAt(clientX, clientY);
    const el = zone && zone.opts.drop.accepts(info.payload) ? zone.el : null;
    if (info.hoverEl !== el) {
      if (info.hoverEl) info.hoverEl.classList.remove('drop-hover');
      if (el) el.classList.add('drop-hover');
      info.hoverEl = el;
    }
  },

  // 操作の後片付け
  finish(info, cancelled) {
    if (info.mode === 'hold') {
      info.h.el.classList.remove('holding');
      if (info.h.opts.holdEnd) info.h.opts.holdEnd();
    }
    if (info.ghost) info.ghost.remove();
    if (info.hoverEl) info.hoverEl.classList.remove('drop-hover');
    info.h.el.classList.remove('drag-source');
    info.mode = 'none';
  },
};
