// =============================================================
// config.js … ゲームの調整用の数値をすべてここに集めたファイル
//
// ・難易度やバランスを変えたいときは、基本的にこのファイルだけを編集します。
// ・時間はすべて「ゲーム内の秒」で書きます（ゲーム内の1分 = 60）。
//   実際の時間は timeScale で割った長さになります。
//   例：ゲーム内180秒（3分） ÷ 3倍速 = 現実の60秒
// =============================================================

const CONFIG = {
  // ゲームのタイトル（仮）
  title: 'ワンオペわんこ亭',

  // ゲーム領域の大きさ（この大きさで画面を作り、ウィンドウに合わせて拡大縮小する）
  stageWidth: 1280,
  stageHeight: 720,

  // 時間の倍率：ゲーム内の時間が現実の何倍の速さで進むか
  timeScale: 3,

  // ---------------------------------------------------------
  // 操作の感度
  // ---------------------------------------------------------
  input: {
    // 押してからこのピクセル数（画面上の実寸）以上動いたら「ドラッグ」とみなす。
    // これより小さい動きで離したら「タップ」になる。
    dragThreshold: 12,
    // タッチ操作のとき、ドラッグ中の絵を指より少し上に表示する距離（指で隠れないように）
    touchGhostOffsetY: -40,
  },

  // ---------------------------------------------------------
  // カリカリ（どんぶりに盛る量）
  // 量の単位は自由な数値（0 〜 bowlMax）です。
  // ---------------------------------------------------------
  kibble: {
    pourPerSecond: 30,   // 長押し中、「現実の」1秒あたりに増える量
    bowlMax: 110,        // どんぶりに入る上限（ここまで来たら注いでも増えない）
    // 目安線の位置（量）
    lines: {
      small: 35,
      medium: 60,
      large: 85,
    },
    tolerance: 7,        // 目安線からこの量以内のずれなら、その盛りとして判定する
    showJudgeLabel: true, // どんぶりの下に「並盛」などの判定を表示するか（false で上級者向け）
  },

  // ---------------------------------------------------------
  // トッピングの在庫と下処理
  // ---------------------------------------------------------
  stock: {
    max: 10,          // 1つの容器に入る上限（人前）
    initial: 5,       // ゲーム開始時の残量（人前）
    lowWarning: 2,    // 残量がこの数以下になったら、数字を目立たせる
    refill: 5,        // 1回の下処理で補充される量（人前）。上限を超えた分は捨てる
    chopTaps: 10,     // 「切る」食材：下処理を終えるのに必要なタップ回数
  },

  // 「茹でる」食材の設定（時間はゲーム内の秒）
  boil: {
    pots: 1,          // 鍋の数（1〜2）
    readyAt: 90,      // 鍋に入れてから、この時間で「ちょうどいい」になる
    overAt: 150,      // この時間を過ぎると「煮すぎ」になり、食材が無駄になる
  },

  // 盛りの表示名
  sizeNames: {
    small: '小',
    medium: '並',
    large: '大',
  },

  // ---------------------------------------------------------
  // トッピング一覧
  // 難易度で使う種類数が少ないときは、上から順に使います。
  // 新しいトッピングを増やすときは、ここに1行足すだけでOKです。
  //   prep … 下処理の方法。'cut' = まな板で切る / 'boil' = 鍋で茹でる
  // ---------------------------------------------------------
  toppings: [
    { id: 'carrot',      name: 'ニンジン',     icon: '🥕', prep: 'cut'  },
    { id: 'broccoli',    name: 'ブロッコリー', icon: '🥦', prep: 'boil' },
    { id: 'beef',        name: '牛肉',         icon: '🥩', prep: 'cut'  },
    { id: 'chicken',     name: '鶏ささみ',     icon: '🍗', prep: 'boil' },
    { id: 'salmon',      name: 'サーモン',     icon: '🐟', prep: 'cut'  },
    { id: 'egg',         name: 'ゆで卵',       icon: '🥚', prep: 'boil' },
    { id: 'pumpkin',     name: 'かぼちゃ',     icon: '🎃', prep: 'boil' },
    { id: 'sweetpotato', name: 'さつまいも',   icon: '🍠', prep: 'boil' },
    { id: 'cabbage',     name: 'キャベツ',     icon: '🥬', prep: 'cut'  },
    { id: 'corn',        name: 'とうもろこし', icon: '🌽', prep: 'boil' },
    { id: 'apple',       name: 'りんご',       icon: '🍎', prep: 'cut'  },
    { id: 'blueberry',   name: 'ブルーベリー', icon: '🫐', prep: 'cut'  },
    { id: 'banana',      name: 'バナナ',       icon: '🍌', prep: 'cut'  },
    { id: 'cheese',      name: 'チーズ',       icon: '🧀', prep: 'cut'  },
    { id: 'potato',      name: 'じゃがいも',   icon: '🥔', prep: 'boil' },
    { id: 'pork',        name: '豚肉',         icon: '🐖', prep: 'boil' },
    { id: 'peas',        name: 'えんどう豆',   icon: '🫛', prep: 'boil' },
    { id: 'cucumber',    name: 'きゅうり',     icon: '🥒', prep: 'cut'  },
    { id: 'strawberry',  name: 'いちご',       icon: '🍓', prep: 'cut'  },
  ],

  // 客の犬の見た目（仮の絵文字。ランダムで選ばれる）
  customerDogs: ['🐕', '🐶', '🐩', '🦮', '🐕‍🦺'],

  // ---------------------------------------------------------
  // 難易度ごとの設定
  // [最小, 最大] と書いてある項目は、その範囲でランダムに決まります。
  // ---------------------------------------------------------
  difficulties: {
    // フェーズ1の試作用（客席2・トッピング3種類）
    phase1: {
      name: '試作版',
      duration: 15 * 60,          // 耐える時間（フェーズ1ではまだ使わない）
      seats: 2,                   // 客席の数
      workbenchSlots: 3,          // 作業台に置けるどんぶりの数
      toppingCount: 3,            // 使うトッピングの種類数（一覧の上から順）
      toppingsPerOrder: [1, 2],   // 1つの注文に入るトッピングの種類数
      totalBowls: 8,              // 店にあるどんぶりの総数
      sinkCapacity: 6,            // 流しに置ける上限
      washerCapacity: 5,          // 食洗機に一度に入る数
      washTime: 3 * 60,           // 洗浄にかかる時間
      patience: 3 * 60,           // 客が待てる時間
      eatTime: [2 * 60, 3 * 60],  // 客が食べている時間
      customerInterval: [30, 75], // 次の客が来るまでの間隔
      firstCustomerDelay: 6,      // ゲーム開始から最初の客が来るまで
      seatRefillDelay: 10,        // 満席だったとき、席が空いてから次の客が来るまでの最短時間
    },

    // 以下はフェーズ3以降で使う予定の値（仮）
    easy: {
      name: 'かんたん',
      duration: 10 * 60,
      seats: 4,
      workbenchSlots: 3,
      toppingCount: 8,
      toppingsPerOrder: [1, 2],
      totalBowls: 8,
      sinkCapacity: 6,
      washerCapacity: 5,
      washTime: 3 * 60,
      patience: 4 * 60,
      eatTime: [2 * 60, 3 * 60],
      customerInterval: [60, 100],
      firstCustomerDelay: 6,
      seatRefillDelay: 10,
    },
    normal: {
      name: 'ふつう',
      duration: 15 * 60,
      seats: 6,
      workbenchSlots: 3,
      toppingCount: 12,
      toppingsPerOrder: [1, 3],
      totalBowls: 10,
      sinkCapacity: 7,
      washerCapacity: 5,
      washTime: 3 * 60,
      patience: 3 * 60,
      eatTime: [2 * 60, 3 * 60],
      customerInterval: [40, 75],
      firstCustomerDelay: 6,
      seatRefillDelay: 10,
    },
    hard: {
      name: 'むずかしい',
      duration: 20 * 60,
      seats: 10,
      workbenchSlots: 3,
      toppingCount: 19,
      toppingsPerOrder: [1, 4],
      totalBowls: 14,
      sinkCapacity: 8,
      washerCapacity: 6,
      washTime: 3 * 60,
      patience: 150,
      eatTime: [2 * 60, 3 * 60],
      customerInterval: [25, 50],
      firstCustomerDelay: 6,
      seatRefillDelay: 8,
    },
  },
};
