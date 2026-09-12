export type Language = "ja" | "en";
export const LANGUAGE_KEY = "picture-score:language";

// Source copy is the message key; artwork titles and musical IDs never pass through this dictionary.
export const messages: Record<string, Record<Language, string>> = {
  "もうひとつ描いたら、近くに置いてみよう。どんな返事がする？": { ja: "もうひとつ描いたら、近くに置いてみよう。どんな返事がする？", en: "Draw another and place it nearby. What will it answer?" },
  "ふたつの絵を近づけたら、どんな会話になる？": { ja: "ふたつの絵を近づけたら、どんな会話になる？", en: "Bring two drawings closer. What will they say to each other?" },
  "{a}と{b}が、交代で歌っている。": { ja: "{a}と{b}が、交代で歌っている。", en: "{a} and {b} are taking turns." },
  "{a}が、{b}をそっと支えている。": { ja: "{a}が、{b}をそっと支えている。", en: "{a} is gently supporting {b}." },
  "{a}が、{b}の合間にリズムを添えている。": { ja: "{a}が、{b}の合間にリズムを添えている。", en: "{a} adds a pulse between {b}’s phrases." },
  "{a}が、{b}の合間にきらめいている。": { ja: "{a}が、{b}の合間にきらめいている。", en: "{a} sparkles in the spaces around {b}." },
  "{a}と{b}が、ひとつの余韻をつくっている。": { ja: "{a}と{b}が、ひとつの余韻をつくっている。", en: "{a} and {b} share a gentle bed of sound." },
  "少し離すと、それぞれの歌に戻る。": { ja: "少し離すと、それぞれの歌に戻る。", en: "Move them apart to hear their own songs again." },
  "Picture Score ホーム": {
    "ja": "Picture Score ホーム",
    "en": "Picture Score home"
  },
  "作品名": {
    "ja": "作品名",
    "en": "Artwork title"
  },
  "保存できません。作品ファイルを書き出してください。": {
    "ja": "保存できません。作品ファイルを書き出してください。",
    "en": "Unable to save. Please export your project file."
  },
  "このブラウザに保存済み": {
    "ja": "このブラウザに保存済み",
    "en": "Saved in this browser"
  },
  "保存中": {
    "ja": "保存中",
    "en": "Saving"
  },
  "Undo — 元に戻す": {
    "ja": "Undo — 元に戻す",
    "en": "Undo — Undo last change"
  },
  "Redo — やり直す": {
    "ja": "Redo — やり直す",
    "en": "Redo — Redo last change"
  },
  "作品を書き出す": {
    "ja": "作品を書き出す",
    "en": "Export your artwork"
  },
  "絵を保存": {
    "ja": "絵を保存",
    "en": "Save picture"
  },
  "音楽を保存": {
    "ja": "音楽を保存",
    "en": "Save audio"
  },
  "楽譜を保存": {
    "ja": "楽譜を保存",
    "en": "Save score"
  },
  "作品を保存": {
    "ja": "作品を保存",
    "en": "Save project"
  },
  "あとで続きを描く": {
    "ja": "あとで続きを描く",
    "en": "Continue drawing later"
  },
  "作品を開く": {
    "ja": "作品を開く",
    "en": "Open project"
  },
  "制作スペース": {
    "ja": "制作スペース",
    "en": "Creative spaces"
  },
  "楽譜キャンバス": {
    "ja": "楽譜キャンバス",
    "en": "Drawing score"
  },
  "新しいキャンバス": {
    "ja": "新しいキャンバス",
    "en": "New canvas"
  },
  "新しいキャンバス（Undoで復元できます）": {
    "ja": "新しいキャンバス（Undoで復元できます）",
    "en": "New canvas (Undo restores your drawing)"
  },
  "ここに絵を描く。右へ進むと時間が進み、上へ描くと高い音になります。": {
    "ja": "ここに絵を描く。右へ進むと時間が進み、上へ描くと高い音になります。",
    "en": "Draw here. Right moves forward in time; up makes higher notes."
  },
  "まずは、ひと筆。": {
    "ja": "まずは、ひと筆。",
    "en": "Start with a stroke."
  },
  "ハートでも、猫でも、気の向くままに。": {
    "ja": "ハートでも、猫でも、気の向くままに。",
    "en": "A heart, a cat, or whatever comes to mind."
  },
  "指やマウスで、ここに描いてみよう": {
    "ja": "指やマウスで、ここに描いてみよう",
    "en": "Draw here with your finger or mouse"
  },
  "次は何を鳴らす？": {
    "ja": "次は何を鳴らす？",
    "en": "What will you play next?"
  },
  "きっかけに": {
    "ja": "きっかけに",
    "en": "Try a shape"
  },
  "♡ ハート": {
    "ja": "♡ ハート",
    "en": "♡ Heart"
  },
  "〰 波": {
    "ja": "〰 波",
    "en": "〰 Wave"
  },
  "★ 星": {
    "ja": "★ 星",
    "en": "★ Star"
  },
  "ぐるぐる": {
    "ja": "ぐるぐる",
    "en": "Spiral"
  },
  "ギザギザ": {
    "ja": "ギザギザ",
    "en": "Zigzag"
  },
  "名前": {
    "ja": "名前",
    "en": "Your name"
  },
  "縦線": {
    "ja": "縦線",
    "en": "Vertical line"
  },
  "横線": {
    "ja": "横線",
    "en": "Horizontal line"
  },
  "顔": {
    "ja": "顔",
    "en": "Face"
  },
  "描画と再生の操作": {
    "ja": "描画と再生の操作",
    "en": "Drawing and playback controls"
  },
  "DRAW — 描く": {
    "ja": "DRAW — 描く",
    "en": "DRAW — Draw"
  },
  "ERASE — 線を消す": {
    "ja": "ERASE — 線を消す",
    "en": "ERASE — Erase a stroke"
  },
  "その線が、メロディになる": {
    "ja": "その線が、メロディになる",
    "en": "Your line becomes a melody"
  },
  "消したい線にふれてみよう": {
    "ja": "消したい線にふれてみよう",
    "en": "Touch a stroke to erase it"
  },
  "STOP — 再生を止める": {
    "ja": "STOP — 再生を止める",
    "en": "STOP — Stop playback"
  },
  "PLAY — 絵を演奏する": {
    "ja": "PLAY — 絵を演奏する",
    "en": "PLAY — Play your drawing"
  },
  "あなたの絵を、演奏中": {
    "ja": "あなたの絵を、演奏中",
    "en": "Your drawing is playing"
  },
  "描いたら、聴いてみよう": {
    "ja": "描いたら、聴いてみよう",
    "en": "Let’s hear your drawing"
  },
  "絵": {
    "ja": "絵",
    "en": "Drawing"
  },
  "音楽": {
    "ja": "音楽",
    "en": "Music"
  },
  "絵と音楽のバランス": {
    "ja": "絵と音楽のバランス",
    "en": "Drawing and music balance"
  },
  "{mode} {percent}%。絵の音符{visual}個を{play}音で演奏": {
    "ja": "{mode} {percent}%。絵の音符{visual}個を{play}音で演奏",
    "en": "{mode} {percent}%. {visual} visual notes performed as {play} sounds"
  },
  "＋伴奏": {
    "ja": "＋伴奏",
    "en": "+ accompaniment"
  },
  "線の細かな表情まで、音に。": {
    "ja": "線の細かな表情まで、音に。",
    "en": "Hear every little detail of your line."
  },
  "音を選んで、ゆったり歌う。": {
    "ja": "音を選んで、ゆったり歌う。",
    "en": "Fewer notes, more room to sing."
  },
  "絵のかたちを、ひとつのフレーズに。": {
    "ja": "絵のかたちを、ひとつのフレーズに。",
    "en": "Your drawing becomes a phrase."
  },
  "音色の設定": {
    "ja": "音色の設定",
    "en": "Sound settings"
  },
  "そっと伴奏": {
    "ja": "そっと伴奏",
    "en": "Gentle accompaniment"
  },
  "テンポ": {
    "ja": "テンポ",
    "en": "Tempo"
  },
  "ブラウザに保存できません。Saveから作品ファイルを書き出してください。": {
    "ja": "ブラウザに保存できません。Saveから作品ファイルを書き出してください。",
    "en": "Browser storage is unavailable. Export your project from Save."
  },
  "あそびかた": {
    "ja": "あそびかた",
    "en": "How to play"
  },
  "作品ファイルを開く": {
    "ja": "作品ファイルを開く",
    "en": "Open a project file"
  },
  "説明を閉じる": {
    "ja": "説明を閉じる",
    "en": "Close help"
  },
  "うまく描かなくて、いい。": {
    "ja": "うまく描かなくて、いい。",
    "en": "There’s no wrong way to draw."
  },
  "好きな線を描いたら、PLAY。": {
    "ja": "好きな線を描いたら、PLAY。",
    "en": "Draw any line, then press PLAY."
  },
  "その絵のかたちが、そのまま音楽になります。": {
    "ja": "その絵のかたちが、そのまま音楽になります。",
    "en": "The shape of your drawing becomes its music."
  },
  "描く。": {
    "ja": "描く。",
    "en": "Draw."
  },
  "上は高い音、下は低い音。縦の線は和音に。": {
    "ja": "上は高い音、下は低い音。縦の線は和音に。",
    "en": "Up is high, down is low. Vertical lines become chords."
  },
  "聴く。": {
    "ja": "聴く。",
    "en": "Listen."
  },
  "絵の左から右へ、音が見つかります。": {
    "ja": "絵の左から右へ、音が見つかります。",
    "en": "Discover the notes from left to right."
  },
  "ちょっと変える。": {
    "ja": "ちょっと変える。",
    "en": "Make it yours."
  },
  "「絵 ↔ 音楽」で、音の細かさを調整。右ほど音を選び、なめらかなフレーズに。": {
    "ja": "「絵 ↔ 音楽」で、音の細かさを調整。右ほど音を選び、なめらかなフレーズに。",
    "en": "Adjust Drawing ↔ Music for detail or flow. Move right for fewer notes and smoother phrases."
  },
  "元の線は、ずっとそのまま。作品はこのブラウザに自動保存されます。Saveから絵・音・作品ファイルも持ち帰れます。": {
    "ja": "元の線は、ずっとそのまま。作品はこのブラウザに自動保存されます。Saveから絵・音・作品ファイルも持ち帰れます。",
    "en": "Your original lines stay intact. Your work saves automatically in this browser. Use Save to take home a picture, audio, or project file."
  },
  "さあ、描いてみよう": {
    "ja": "さあ、描いてみよう",
    "en": "Let’s draw"
  },
  "音を開始できませんでした。もう一度PLAYを押してください。": {
    "ja": "音を開始できませんでした。もう一度PLAYを押してください。",
    "en": "Couldn’t start audio. Please press PLAY again."
  },
  "線がいっぱいです。作品を保存して、新しい一枚を描きましょう。": {
    "ja": "線がいっぱいです。作品を保存して、新しい一枚を描きましょう。",
    "en": "This canvas is full. Save your work and start a new drawing."
  },
  "音が使えません。描画はそのまま続けられます。": {
    "ja": "音が使えません。描画はそのまま続けられます。",
    "en": "Audio is unavailable. You can keep drawing."
  },
  "長い線はここまで。指を離して続きを描けます。": {
    "ja": "長い線はここまで。指を離して続きを描けます。",
    "en": "This stroke has reached its limit. Lift your finger to start another."
  },
  "新しい一枚。Undoで前の絵に戻せます。": {
    "ja": "新しい一枚。Undoで前の絵に戻せます。",
    "en": "A fresh canvas. Undo brings back your previous drawing."
  },
  "{format}を書き出しました。": {
    "ja": "{format}を書き出しました。",
    "en": "Exported {format}."
  },
  "書き出せませんでした。もう一度お試しください。": {
    "ja": "書き出せませんでした。もう一度お試しください。",
    "en": "Couldn’t export. Please try again."
  },
  "「{idea}」を自由に描いてみよう。": {
    "ja": "「{idea}」を自由に描いてみよう。",
    "en": "Try drawing {idea} in your own way."
  },
  "音を開始できませんでした。": {
    "ja": "音を開始できませんでした。",
    "en": "Couldn’t start audio."
  },
  "ファイルが大きすぎます。8MB以下の作品を選んでください。": {
    "ja": "ファイルが大きすぎます。8MB以下の作品を選んでください。",
    "en": "This file is too large. Choose a project under 8 MB."
  },
  "作品を開きました。": {
    "ja": "作品を開きました。",
    "en": "Project opened."
  },
  "作品ファイルを読み込めませんでした。": {
    "ja": "作品ファイルを読み込めませんでした。",
    "en": "Couldn’t read the project file."
  },
  "Picture Scoreの作品ファイルを選んでください。": {
    "ja": "Picture Scoreの作品ファイルを選んでください。",
    "en": "Please choose a Picture Score project file."
  },
  "作品ファイルの形式が正しくありません。": {
    "ja": "作品ファイルの形式が正しくありません。",
    "en": "This project file has an invalid format."
  },
  "キャンバスの縦横比が正しくありません。": {
    "ja": "キャンバスの縦横比が正しくありません。",
    "en": "Invalid canvas aspect ratio."
  },
  "線のデータが正しくありません。": {
    "ja": "線のデータが正しくありません。",
    "en": "Invalid stroke data."
  },
  "描画座標が正しくありません。": {
    "ja": "描画座標が正しくありません。",
    "en": "Invalid drawing coordinates."
  },
  "Garden 音の庭": {
    "ja": "Garden 音の庭",
    "en": "Garden of sounds"
  },
  "絵を置いて、音のあいだを歩こう。": {
    "ja": "絵を置いて、音のあいだを歩こう。",
    "en": "Place a drawing. Wander between its sounds."
  },
  "うた": {
    "ja": "うた",
    "en": "Melody"
  },
  "和音": {
    "ja": "和音",
    "en": "Harmony"
  },
  "余韻": {
    "ja": "余韻",
    "en": "Drone"
  },
  "リズム": {
    "ja": "リズム",
    "en": "Rhythm"
  },
  "きらめき": {
    "ja": "きらめき",
    "en": "Decoration"
  },
  "準備中…": {
    "ja": "準備中…",
    "en": "Starting…"
  },
  "音を休める": {
    "ja": "音を休める",
    "en": "Pause garden"
  },
  "庭を聴く": {
    "ja": "庭を聴く",
    "en": "Listen to garden"
  },
  "庭のテンポ": {
    "ja": "庭のテンポ",
    "en": "Garden tempo"
  },
  "共通の拍": {
    "ja": "共通の拍",
    "en": "Shared beat"
  },
  "まだ静かな、小さな庭。": {
    "ja": "まだ静かな、小さな庭。",
    "en": "A little garden, still quiet."
  },
  "ひと筆描いて、最初の音を植えてみよう。": {
    "ja": "ひと筆描いて、最初の音を植えてみよう。",
    "en": "Draw a stroke and plant the first sound."
  },
  "{title} — {role}。矢印キーで移動": {
    "ja": "{title} — {role}。矢印キーで移動",
    "en": "{title} — {role}. Use arrow keys to move"
  },
  "歌っている": {
    "ja": "歌っている",
    "en": "Playing"
  },
  "ひと休み": {
    "ja": "ひと休み",
    "en": "Resting"
  },
  "ここに、ひとつの音。": {
    "ja": "ここに、ひとつの音。",
    "en": "A little sound, right here."
  },
  "聴く位置。ドラッグまたは矢印キーで移動": {
    "ja": "聴く位置。ドラッグまたは矢印キーで移動",
    "en": "Listening position. Drag or use arrow keys to move"
  },
  "庭は12作品でいっぱいです。配置をキャンセルして作品を選ぶと取り除けます。": {
    "ja": "庭は12作品でいっぱいです。配置をキャンセルして作品を選ぶと取り除けます。",
    "en": "Your garden has 12 artworks. Cancel placement, then select an artwork to remove it."
  },
  "好きなところにタップして、音を植えよう。": {
    "ja": "好きなところにタップして、音を植えよう。",
    "en": "Tap a spot to plant your sound."
  },
  "耳を動かすと、聴こえる景色が変わる。絵もそのまま動かせます。": {
    "ja": "耳を動かすと、聴こえる景色が変わる。絵もそのまま動かせます。",
    "en": "Move the ear to change what you hear. You can move the drawings too."
  },
  "ここに置く": {
    "ja": "ここに置く",
    "en": "Place here"
  },
  "配置をやめる": {
    "ja": "配置をやめる",
    "en": "Cancel placement"
  },
  "もうひとつ描く": {
    "ja": "もうひとつ描く",
    "en": "Draw another"
  },
  "庭から取り除く": {
    "ja": "庭から取り除く",
    "en": "Remove from garden"
  },
  "庭を保存できません。空き容量を確認してください。この画面を閉じるまで作品は残ります。": {
    "ja": "庭を保存できません。空き容量を確認してください。この画面を閉じるまで作品は残ります。",
    "en": "Couldn’t save the garden. Check your browser storage. Your artworks remain until you close this page."
  },
  "音を開始できませんでした。「庭を聴く」をもう一度押してください。": {
    "ja": "音を開始できませんでした。「庭を聴く」をもう一度押してください。",
    "en": "Couldn’t start audio. Press “Listen to garden” again."
  },
  "庭の保存データを読み込めません。元データは上書きしていません。": {
    "ja": "庭の保存データを読み込めません。元データは上書きしていません。",
    "en": "Couldn’t load the garden. Your original saved data has not been overwritten."
  },
  "庭の保存データを読み込めません。": {
    "ja": "庭の保存データを読み込めません。",
    "en": "Couldn’t load the garden."
  },
  "庭の作品データが不正です。": {
    "ja": "庭の作品データが不正です。",
    "en": "Invalid garden artwork data."
  },
  "空の作品です。": {
    "ja": "空の作品です。",
    "en": "This artwork is empty."
  },
  "Feel the ": {
    "ja": "線を、",
    "en": "Feel the "
  },
  "line.": {
    "ja": "感じよう。",
    "en": "line."
  },
  "Every stroke answers back.": {
    "ja": "ひと筆ごとに、音がこたえる。",
    "en": "Every stroke answers back."
  },
  "A LITTLE DRAWING. A LITTLE MAGIC.": {
    "ja": "小さな絵に、小さな魔法。",
    "en": "A LITTLE DRAWING. A LITTLE MAGIC."
  },
  "No useless strokes.": {
    "ja": "どんな線にも、音がある。",
    "en": "No useless strokes."
  },
  "Just your imagination.": {
    "ja": "想像のままに。",
    "en": "Just your imagination."
  },
  "YOUR DRAWING IS PLAYING": {
    "ja": "あなたの絵を演奏中",
    "en": "YOUR DRAWING IS PLAYING"
  },
  "FOLLOW YOUR LINE": {
    "ja": "線のままに、音のままに",
    "en": "FOLLOW YOUR LINE"
  },
  "YOUR LITTLE COMPOSITION": {
    "ja": "あなただけの小さな曲",
    "en": "YOUR LITTLE COMPOSITION"
  },
  "C pentatonic": {
    "ja": "Cペンタトニック",
    "en": "C pentatonic"
  },
  "HIGH": {
    "ja": "高い音",
    "en": "HIGH"
  },
  "LOW": {
    "ja": "低い音",
    "en": "LOW"
  },
  "TIME": {
    "ja": "時間",
    "en": "TIME"
  },
  "Heart": {
    "ja": "ハート",
    "en": "Heart"
  },
  "Wave": {
    "ja": "波",
    "en": "Wave"
  },
  "Cat": {
    "ja": "猫",
    "en": "Cat"
  },
  "sound": {
    "ja": "音",
    "en": "sound"
  },
  "sounds": {
    "ja": "音",
    "en": "sounds"
  },
  "Every line is a possibility.": {
    "ja": "どんな線にも、可能性。",
    "en": "Every line is a possibility."
  },
  "KEEP YOUR CREATION": {
    "ja": "作品を持ち帰ろう",
    "en": "KEEP YOUR CREATION"
  },
  "PNG image": {
    "ja": "PNG画像",
    "en": "PNG image"
  },
  "WAV audio": {
    "ja": "WAV音声",
    "en": "WAV audio"
  },
  "Drawing + accompaniment": {
    "ja": "描いた音＋伴奏",
    "en": "Drawing + accompaniment"
  },
  "Made of lines. Full of life.": {
    "ja": "線から生まれる、小さないのち。",
    "en": "Made of lines. Full of life."
  },
  "YOUR FIRST LITTLE COMPOSITION": {
    "ja": "はじめての、小さな曲",
    "en": "YOUR FIRST LITTLE COMPOSITION"
  },
  "Give your song ": {
    "ja": "その音に、",
    "en": "Give your song "
  },
  "a place.": {
    "ja": "居場所を。",
    "en": "a place."
  },
  "sounds growing": {
    "ja": "育つ音たち",
    "en": "sounds growing"
  },
  "THE QUIET CORNER": {
    "ja": "静かな片すみ",
    "en": "THE QUIET CORNER"
  },
  "ROOM FOR ANOTHER SONG": {
    "ja": "次の音を待つ場所",
    "en": "ROOM FOR ANOTHER SONG"
  },
  "YOU": {
    "ja": "あなた",
    "en": "YOU"
  },
  "PLACE IN GARDEN": {
    "ja": "庭に置く",
    "en": "PLACE IN GARDEN"
  },
  "Piano": {
    "ja": "ピアノ",
    "en": "Piano"
  },
  "Bell": {
    "ja": "ベル",
    "en": "Bell"
  },
  "Pluck": {
    "ja": "プラック",
    "en": "Pluck"
  },
  "Toy": {
    "ja": "トイ",
    "en": "Toy"
  },
  "Soft Synth": {
    "ja": "ソフトシンセ",
    "en": "Soft Synth"
  },
  "visual": {
    "ja": "表示",
    "en": "visual"
  },
  "play": {
    "ja": "演奏",
    "en": "play"
  },
  "DRAWING": {
    "ja": "描画",
    "en": "DRAWING"
  },
  "MUSIC": {
    "ja": "音楽",
    "en": "MUSIC"
  },
  "BALANCE": {
    "ja": "バランス",
    "en": "BALANCE"
  }
};

export function translate(language: Language, key: string, values: Record<string, string | number> = {}): string {
  const text = messages[key]?.[language] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function loadLanguage(): Language {
  try { return localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "ja"; }
  catch { return "ja"; }
}
