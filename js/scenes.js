// =============================================================
// scenes.js … 画面（シーン）の切り替え
//
// タイトル・難易度選択・導入・プレイ・結果の画面を「シーン」として登録し、
// Scenes.go('名前', 渡したい情報) で切り替えます。
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
    this.add('select', SelectScene);
    this.add('intro', IntroScene);
    this.add('play', PlayScene);
    this.add('result', ResultScene);
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

// 文章の中の {minutes} {troubles} を、難易度に合わせた数字に置き換える
function fillText(text, diff) {
  const troubles = diff.troublesAllowed !== undefined ? diff.troublesAllowed : CONFIG.troublesAllowed;
  return text
    .replace('{minutes}', Math.round(diff.duration / 60))
    .replace('{troubles}', troubles);
}

// -------------------------------------------------------------
// タイトル画面
// -------------------------------------------------------------
const TitleScene = {
  enter() {
    this.el.innerHTML = `
      <div class="title-dog">${Assets.icon('player', '🐶')}<span class="title-bowl">🍚</span></div>
      <h1 class="title-name">${CONFIG.title}</h1>
      <p class="title-sub">先輩が来るまで、ワンオペでお店を回そう！</p>
      <button class="btn btn-big">はじめる</button>
      <div class="title-version">ver.${CONFIG.version}</div>
    `;
    this.el.querySelector('button').onclick = () => Scenes.go('select');
  },
};

// -------------------------------------------------------------
// 難易度選択
// -------------------------------------------------------------
const SelectScene = {
  enter() {
    const records = SaveData.load().records || {};
    // CONFIG.difficulties に書いてある難易度を、書いてある順にカードにする
    const cards = Object.entries(CONFIG.difficulties).map(([key, d]) => {
      const r = records[key];
      const recordHTML = r
        ? `<div class="card-record">${r.clears > 0 ? '🏅 クリア ' + r.clears + '回' : '未クリア'}／最高 ${r.bestServed}杯</div>`
        : '<div class="card-record">まだ遊んでいません</div>';
      return `
        <button class="diff-card" data-key="${key}">
          <div class="card-name">${d.name}</div>
          <ul class="card-info">
            <li>耐える時間 <b>${Math.round(d.duration / 60)}分</b></li>
            <li>客席 <b>${d.seats}席</b></li>
            <li>トッピング <b>${d.toppingCount}種類</b></li>
          </ul>
          ${recordHTML}
        </button>`;
    }).join('');

    this.el.innerHTML = `
      <h2 class="scene-heading">難易度をえらんでね</h2>
      <div class="diff-cards">${cards}</div>
      <button class="btn btn-sub btn-back">もどる</button>
    `;
    this.el.querySelectorAll('.diff-card').forEach((card) => {
      card.onclick = () => Scenes.go('intro', { difficulty: card.dataset.key });
    });
    this.el.querySelector('.btn-back').onclick = () => Scenes.go('title');
  },
};

// -------------------------------------------------------------
// 導入（先輩からの連絡）
// -------------------------------------------------------------
const IntroScene = {
  enter(params) {
    const diff = CONFIG.difficulties[params.difficulty];
    const lines = CONFIG.texts.intro.map((t) => fillText(t, diff)).join('<br>');
    this.el.innerHTML = `
      <div class="phone">
        <div class="phone-head">📱 先輩からの連絡</div>
        <div class="phone-body">
          <div class="phone-icon">${Assets.icon('senpai', '🐕')}</div>
          <div class="phone-bubble">${lines}</div>
        </div>
      </div>
      <div class="intro-buttons">
        <button class="btn btn-sub btn-back">もどる</button>
        <button class="btn btn-big btn-go">お店をあける！</button>
      </div>
    `;
    this.el.querySelector('.btn-go').onclick = () => Scenes.go('play', { difficulty: params.difficulty });
    this.el.querySelector('.btn-back').onclick = () => Scenes.go('select');
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

// -------------------------------------------------------------
// 結果画面
// -------------------------------------------------------------
const ResultScene = {
  enter(result) {
    SaveData.recordResult(result); // 記録を保存

    const rows = Object.entries(CONFIG.troubleNames).map(([kind, name]) =>
      `<tr><th>${name}</th><td>${result.troubleCounts[kind]}回</td></tr>`
    ).join('');
    const rank = rankFor(result);

    this.el.innerHTML = `
      <div class="result-box ${result.cleared ? 'is-clear' : 'is-over'}">
        <div class="result-title">${result.cleared ? '🎉 クリア！' : 'ゲームオーバー'}</div>
        <div class="result-diff">${result.difficultyName}</div>
        ${rank ? `<div class="result-rank">評価：${rank}</div>` : ''}
        <table class="result-table">
          <tr><th>提供した数</th><td>${result.served}杯</td></tr>
          <tr><th>お店を回した時間</th><td>${Math.floor(result.time / 60)}分 ／ ${Math.round(result.duration / 60)}分</td></tr>
          ${rows}
        </table>
      </div>
      <div class="result-buttons">
        <button class="btn btn-sub btn-title">タイトルへ</button>
        <button class="btn btn-sub btn-select">難易度をえらぶ</button>
        <button class="btn btn-big btn-retry">もう一度</button>
      </div>
    `;
    this.el.querySelector('.btn-retry').onclick = () => Scenes.go('play', { difficulty: result.difficultyKey });
    this.el.querySelector('.btn-select').onclick = () => Scenes.go('select');
    this.el.querySelector('.btn-title').onclick = () => Scenes.go('title');
  },
};

// 評価ランクを決める（あとで作る予定。null を返すと表示しない）
// 例：return result.served >= 20 ? 'S' : 'A';
function rankFor(result) {
  return null;
}
