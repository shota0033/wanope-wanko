// =============================================================
// scenes.js … 画面（シーン）の切り替え
//
// タイトル（レベル選択）・導入・プレイ・結果の画面を「シーン」として登録し、
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

// 文章の中の {troubles} を、レベルに合わせた数字に置き換える
function fillText(text, diff) {
  return text.replace('{troubles}', diff.troublesAllowed);
}

// 秒数を「3分30秒」の形にする
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return sec > 0 ? `${m}分${sec}秒` : `${m}分`;
}

// -------------------------------------------------------------
// タイトル画面（ここでレベルを選ぶ）
// -------------------------------------------------------------
const TitleScene = {
  enter() {
    const records = SaveData.load().records || {};
    // CONFIG.levels の数だけ、レベルのボタンを並べる
    const buttons = CONFIG.levels.map((_, i) => {
      const level = i + 1;
      const r = records[level];
      let recordHTML = '<div class="level-record">未プレイ</div>';
      if (r) {
        recordHTML = `<div class="level-record">${r.clears > 0 ? '🏅' : ''}最高 ${r.bestServed}杯</div>`;
      }
      return `
        <button class="level-btn ${r && r.clears > 0 ? 'is-cleared' : ''}" data-level="${level}">
          <div class="level-name">Lv.${level}</div>
          ${recordHTML}
        </button>`;
    }).join('');

    this.el.innerHTML = `
      <div class="title-dog">${Assets.icon('player', '🐶')}<span class="title-bowl">🍚</span></div>
      <h1 class="title-name">${CONFIG.title}</h1>
      <p class="title-sub">先輩が来るまで、ワンオペでお店を回そう！　レベルをえらんでね</p>
      <div class="level-buttons">${buttons}</div>
      <div class="title-version">ver.${CONFIG.version}</div>
    `;
    this.el.querySelectorAll('.level-btn').forEach((btn) => {
      btn.onclick = () => Scenes.go('intro', { level: Number(btn.dataset.level) });
    });
  },
};

// -------------------------------------------------------------
// 導入（先輩からの連絡）
// -------------------------------------------------------------
const IntroScene = {
  enter(params) {
    const diff = levelSettings(params.level);
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
    this.el.querySelector('.btn-go').onclick = () => Scenes.go('play', { level: params.level });
    this.el.querySelector('.btn-back').onclick = () => Scenes.go('title');
  },
};

// -------------------------------------------------------------
// プレイ画面
// -------------------------------------------------------------
const PlayScene = {
  running: false, // ゲームループが動いているか
  paused: false,  // 一時停止中か

  enter(params) {
    this.level = params.level;
    Game.start(params.level);
    View.build(this.el);
    this.paused = false;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    // アプリを切り替えたり画面を消したりしたら、自動で一時停止する（1回だけ登録）
    if (!this.visibilityHooked) {
      this.visibilityHooked = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.running) this.pause();
      });
    }
  },

  exit() {
    this.running = false;
    this.paused = false;
    Input.reset();
  },

  // ゲームループ：画面の書き換えのたび（1秒に約60回）に呼ばれる
  loop(now) {
    if (!this.running) return;
    // 前回からの経過秒数。タブを裏に回していたときなどに一気に進まないよう、最大0.1秒にする
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (!this.paused) Game.update(dt); // 一時停止中は時間を進めない
    View.render();
    requestAnimationFrame((t) => this.loop(t));
  },

  // 一時停止して、メニューを出す
  pause() {
    if (this.paused || !Game.state || Game.state.ended) return; // ゲームが終わった後は出さない
    this.paused = true;
    Game.state.pouring = false; // カリカリを注いでいる途中なら止める
    const menu = document.createElement('div');
    menu.className = 'pause-overlay';
    menu.innerHTML = `
      <div class="pause-title">一時停止中</div>
      <div class="pause-buttons">
        <button class="btn btn-big btn-resume">つづける</button>
        <button class="btn btn-sub btn-restart">最初からやり直す</button>
        <button class="btn btn-sub btn-title">タイトル（レベル選択）へ</button>
      </div>
      <div class="pause-note">※ やり直す・戻ると、今回のプレイは記録されません</div>
    `;
    this.el.appendChild(menu);
    menu.querySelector('.btn-resume').onclick = () => this.resume();
    menu.querySelector('.btn-restart').onclick = () => Scenes.go('play', { level: this.level });
    menu.querySelector('.btn-title').onclick = () => Scenes.go('title');
  },

  // 一時停止を解いて、ゲームを再開する
  resume() {
    const menu = this.el.querySelector('.pause-overlay');
    if (menu) menu.remove();
    this.paused = false;
    this.lastTime = performance.now(); // 止まっていた時間をまとめて進めないように
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
        <div class="result-diff">${result.levelName}</div>
        ${rank ? `<div class="result-rank">評価：${rank}</div>` : ''}
        <table class="result-table">
          <tr><th>提供した数</th><td>${result.served}杯</td></tr>
          <tr><th>お店を回した時間</th><td>${formatTime(result.time)} ／ ${formatTime(result.duration)}</td></tr>
          ${rows}
        </table>
      </div>
      <div class="result-buttons">
        <button class="btn btn-sub btn-title">タイトル（レベル選択）へ</button>
        <button class="btn btn-big btn-retry">もう一度</button>
      </div>
    `;
    this.el.querySelector('.btn-retry').onclick = () => Scenes.go('play', { level: result.level });
    this.el.querySelector('.btn-title').onclick = () => Scenes.go('title');
  },
};

// 評価ランクを決める（あとで作る予定。null を返すと表示しない）
// 例：return result.served >= 20 ? 'S' : 'A';
function rankFor(result) {
  return null;
}
