// =============================================================
// assets.js … 画像の読み込みと、画像がないときの代替表示
//
// assets/images/ に「決められた名前.png」の画像を置くと、
// ゲームを開いたときに自動でその画像に差し替わります。
// 画像がない（または読み込みに失敗した）ときは、絵文字で仮表示します。
//
// 決められた名前の一覧は ASSETS.md を見てください。
// 画面側は必ず Assets.icon() を通して絵を出すので、このファイルだけで差し替えが完結します。
// =============================================================

const Assets = {
  folder: 'assets/images/',
  available: {}, // 読み込めた画像の名前 → true

  // 差し替えられる画像の名前の一覧を作る
  keys() {
    const keys = ['player', 'player_sad', 'senpai', 'kibble_bag', 'trash', 'fridge', 'bg_title', 'bg_play'];
    CONFIG.customerDogs.forEach((_, i) => keys.push('customer' + (i + 1)));
    for (const t of CONFIG.toppings) {
      keys.push('topping_' + t.id); // 下処理済み（トッピング棚・どんぶりの上）
      keys.push('whole_' + t.id);   // 丸ごと（冷蔵庫・まな板・鍋）
    }
    return keys;
  },

  // ゲーム開始前に、置いてある画像を全部読み込んでみる
  // （読み込めた画像だけ使う。全部終わったら done を呼ぶ）
  preload(done) {
    const keys = this.keys();
    let remaining = keys.length;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.applyBackgrounds();
      done();
    };
    const oneDone = () => {
      remaining--;
      if (remaining <= 0) finish();
    };
    for (const key of keys) {
      const img = new Image();
      img.onload = () => {
        this.available[key] = true;
        oneDone();
      };
      img.onerror = oneDone; // 画像がない → 何もしない（絵文字を使う）
      img.src = this.folder + key + '.png';
    }
    // 念のため、3秒たっても終わらなければ先に進む
    setTimeout(finish, 3000);
  },

  // 背景画像があれば、タイトル画面とプレイ画面の背景に使う
  applyBackgrounds() {
    const pairs = [['bg_title', 'scene-title'], ['bg_play', 'scene-play']];
    for (const [key, id] of pairs) {
      if (this.available[key]) {
        const el = document.getElementById(id);
        el.style.backgroundImage = `url("${this.folder}${key}.png")`;
        el.style.backgroundSize = 'cover';
      }
    }
  },

  // 絵を表示するためのHTML文字列を返す
  //   key      … 画像の名前（例：'topping_carrot'）。ASSETS.md の一覧と同じ
  //   fallback … 画像がないときに表示する絵文字
  //   className… 追加したいCSSクラス（大きさの調整などに使う）
  // 画像は文字の大きさ（font-size）に合わせて表示されるので、絵文字と同じ感覚で大きさを決められます。
  icon(key, fallback, className = '') {
    if (this.available[key]) {
      return `<span class="icon ${className}" data-asset="${key}"><img class="icon-img" src="${this.folder}${key}.png" alt="" draggable="false"></span>`;
    }
    return `<span class="icon ${className}" data-asset="${key}">${fallback}</span>`;
  },
};
