// =============================================================
// storage.js … 記録の保存（ブラウザの localStorage を使う）
//
// 難易度ごとのクリア回数・最高提供数を保存します。
// プライベートモードなどで保存できない環境でも、ゲームが止まらないように
// 失敗したときは何もしないようにしています。
//
// 保存しているデータの形：
//   { records: { easy: { plays: 遊んだ回数, clears: クリア回数, bestServed: 最高提供数 }, ... } }
// =============================================================

const SaveData = {
  // 保存するときの名前（他のサイトのデータとまざらないように、ゲーム名を付ける）
  KEY: 'wanoperwanko_save_v1',

  // 保存されているデータを読み込む（なければ空のオブジェクト）
  load() {
    try {
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
    const r = data.records[result.difficultyKey] || { plays: 0, clears: 0, bestServed: 0 };
    r.plays++;
    if (result.cleared) r.clears++;
    r.bestServed = Math.max(r.bestServed, result.served);
    data.records[result.difficultyKey] = r;
    this.save(data);
  },
};
