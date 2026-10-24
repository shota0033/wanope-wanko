// =============================================================
// sound.js … 効果音・BGMの受け口
//
// 今は何も鳴りません。ゲームの各出来事から Sound.play('名前') が
// 呼ばれるようになっているので、あとで音を付けるときは
// このファイルの中身だけを書けばOKです。
//
// 今呼ばれている名前の例：
//   customerArrive（客が来た） / serveOk（正しく提供） / serveNg（提供間違い）
//   customerAngry（怒って帰った） / customerFinish（食べ終わった）
//   placeBowl（どんぶりを置いた） / topping（トッピングを載せた）
//   toSink（流しに置いた） / bowlBroken（どんぶりが割れた）
//   washStart（洗浄開始） / washDone（洗浄終了） / unloadWasher（取り出し）
//   pourStart / pourEnd（カリカリを注ぎ始め／終わり）
// =============================================================

const Sound = {
  enabled: true,

  // 効果音を鳴らす
  play(name) {
    // 例：あとでここに new Audio('assets/sounds/' + name + '.mp3').play() などを書く
  },

  // BGMを流す・止める
  playBgm(name) {},
  stopBgm() {},
};
