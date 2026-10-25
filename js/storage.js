// =============================================================
// storage.js … 記録の保存（ブラウザの localStorage を使う）
//
// レベルごとのクリア回数・最高提供数を保存します。
// プライベートモードなどで保存できない環境でも、ゲームが止まらないように
// 失敗したときは何もしないようにしています。
//
// 保存しているデータの形：
//   { records: { 1: { plays: 遊んだ回数, clears: クリア回数, bestServed: 最高提供数 }, ... } }（1 は Lv.1）
// =============================================================

const SaveData = {
  // 保存するときの名前（他のサイトのデータとまざらないように、ゲーム名を付ける）
  // v1 は「かんたん／ふつう／むずかしい」の3段階だったころの記録。レベル制にしたときに消した
  KEY: 'wanoperwanko_save_v2',
  OLD_KEYS: ['wanoperwanko_save_v1'],

  // 保存されているデータを読み込む（なければ空のオブジェクト）
  load() {
    try {
      for (const key of this.OLD_KEYS) localStorage.removeItem(key); // 古い記録は消す
      const text = localStorage.getItem(this.KEY);
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {};
    }
  },

  // データを保存する
  save(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      // 保存できなくてもゲームは続ける
    }
  },

  // 1回遊んだ結果を記録する（結果画面から呼ばれる）
  recordResult(result) {
    const data = this.load();
    data.records = data.records || {};
    const r = data.records[result.level] || { plays: 0, clears: 0, bestServed: 0 };
    r.plays++;
    if (result.cleared) r.clears++;
    r.bestServed = Math.max(r.bestServed, result.served);
    data.records[result.level] = r;
    this.save(data);
  },
};
