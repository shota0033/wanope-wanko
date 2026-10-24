// =============================================================
// main.js … 起動処理
//
// ・ゲーム領域（1280×720）をウィンドウの大きさに合わせて拡大縮小する
// ・入力の受け取りを始めて、最初の画面（タイトル）を出す
// =============================================================

// ゲーム領域をウィンドウに収まる大きさに拡大縮小する
function fitStage() {
  const stage = document.getElementById('stage');
  const scale = Math.min(
    window.innerWidth / CONFIG.stageWidth,
    window.innerHeight / CONFIG.stageHeight
  );
  // 画面の中央に置いてから、scale 倍する
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('DOMContentLoaded', () => {
  document.title = CONFIG.title;
  fitStage();
  window.addEventListener('resize', fitStage);

  Input.init(document.getElementById('stage'));
  Scenes.init();
  Scenes.go('title');
});
