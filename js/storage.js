// =============================================================
// storage.js … 記録の保存（ブラウザの localStorage を使う）
//
// 難易度ごとのクリア記録などを保存するための最小限の仕組みです。
// プライベートモードなどで保存できない環境でも、ゲームが止まらないように
// 失敗したときは何もしないようにしています。
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
};
