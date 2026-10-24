// =============================================================
// scenes.js … 画面（シーン）の切り替え
//
// タイトル・プレイ・結果などの画面を「シーン」として登録し、
// Scenes.go('名前') で切り替えます。
// 各シーンは次の形のオブジェクトです：
//   { enter(params) { 画面に入ったとき }, exit() { 画面から出るとき } }
// HTML側には id="scene-名前" の要素を用意しておきます（index.html）。
//
// 新しい画面を足すときは、
//   1. index.html に <div id="scene-名前" class="scene"> を足す
//   2. このファイルにシーンのオブジェクトを書いて Scenes.init() で add する
// =============================================================

const Scenes = {
  list: {},       // 登録されたシーン
  current: null,  // いま表示中のシーン

  // シーンを登録する（main.js から1回だけ呼ぶ）
  init() {
    this.add('title', TitleScene);
    this.add('play', PlayScene);
    // フェーズ4で 難易度選択・導入・結果 を追加する予定
  },

  add(name, scene) {
    scene.el = document.getElementById('scene-' + name);
    this.list[name] = scene;
  },

  // シーンを切り替える
  go(name, params = {}) {
    if (this.current && this.current.exit) this.current.exit();
    for (const scene of Object.values(this.list)) scene.el.classList.remove('active');
    this.current = this.list[name];
    this.current.el.classList.add('active');
    if (this.current.enter) this.current.enter(params);
  },
};

// -------------------------------------------------------------
// タイトル画面（フェーズ4で作り込む。今はスタートボタンだけ）
// -------------------------------------------------------------
const TitleScene = {
  enter() {
    this.el.querySelector('.title-name').textContent = CONFIG.title;
    // onclick に代入する形にして、何度この画面に来ても処理が重複しないようにする
    this.el.querySelector('.btn-start').onclick = () => {
      Scenes.go('play', { difficulty: 'phase1' });
    };
  },
};

// -------------------------------------------------------------
// プレイ画面
// -------------------------------------------------------------
const PlayScene = {
  running: false,

  enter(params) {
    Game.start(params.difficulty);
    View.build(this.el);
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  exit() {
    this.running = false;
    Input.reset();
  },

  // ゲームループ：画面の書き換えのたび（1秒に約60回）に呼ばれる
  loop(now) {
    if (!this.running) return;
    // 前回からの経過秒数。タブを裏に回していたときなどに一気に進まないよう、最大0.1秒にする
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    Game.update(dt);
    View.render();
    requestAnimationFrame((t) => this.loop(t));
  },
};
