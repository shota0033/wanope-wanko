// =============================================================
// main.js … 起動処理
//
// ・ゲーム領域（1280×720）をウィンドウの大きさに合わせて拡大縮小する
// ・画像を読み込んでから、入力の受け取りを始めて、最初の画面（タイトル）を出す
// =============================================================

// ゲーム領域をウィンドウに収まる大きさに拡大縮小する
let fittedSize = ''; // 最後に合わせた画面の大きさ（変わっていなければ何もしない）
function fitStage() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w + 'x' + h === fittedSize) return;
  fittedSize = w + 'x' + h;
  const stage = document.getElementById('stage');
  const scale = Math.min(w / CONFIG.stageWidth, h / CONFIG.stageHeight);
  // 画面の中央に置いてから、scale 倍する
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('DOMContentLoaded', () => {
  document.title = CONFIG.title;
  fitStage();
  // 画面の大きさが変わったら合わせ直す。
  // スマホを横向きにしたまま起動すると、開いた瞬間は縦向きの大きさが返ってきて、
  // そのあと「大きさが変わった」知らせが来ないことがある（画面が半分くらいの大きさになる）。
  // そのため、いろいろな知らせで合わせ直すほか、0.5秒ごとにも大きさを確かめる。
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);
  window.addEventListener('pageshow', fitStage);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitStage);
  setInterval(fitStage, 500);

  Input.init(document.getElementById('stage'));
  Scenes.init();
  // 画像の読み込みが終わってからタイトルを出す（置いていなければすぐ終わる）
  Assets.preload(() => Scenes.go('title'));
});
