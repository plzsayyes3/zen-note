# 禅ノート (zen-note)

スマホから GitHub API 経由で直接ノートを書き込むための、軽量なテキストエディタ群。サーバー・ビルド不要、静的HTML1ファイルずつで完結。

**公開URL**: https://plzsayyes3.github.io/zen-note/

## バージョン

| | URL | 内容 |
|---|---|---|
| v1 | [/v1/](https://plzsayyes3.github.io/zen-note/v1/) | ファイルパスを指定して既存ノートを開き、編集して保存する通常のエディタ。Markdownプレビュー付き。 |
| v2 | [/v2/](https://plzsayyes3.github.io/zen-note/v2/) | 「禅モード」。カーソルが常に画面中央に固定され、文字は横に流れる。画面端で折り返して上段に積み上がり、Enterで行が持ち上がる。距離に応じたフェード演出付き。 |
| v2v | [/v2v/](https://plzsayyes3.github.io/zen-note/v2v/) | v2の派生「縦書きモード」。カーソルを画面中央に固定し、文字は上から下へ流れ、列が埋まると左へ進む。GitHubへの読み込み・保存に対応。 |
| v3 | [/v3/](https://plzsayyes3.github.io/zen-note/v3/) | v2 + AI漢字変換。ローマ字/ひらがなのまま直接入力し（IME変換は経由しない設計）、投稿前にGemini APIで自然な漢字混じり表記に自動変換してからGitHubへ投稿する。 |
| v4 | [/v4/](https://plzsayyes3.github.io/zen-note/v4/) | 「自転車モード」。走行中の音声入力に特化。iOS標準ディクテーションで話した内容が末尾に自動で積み上がるログ形式で、文中カーソル位置合わせは不要。画面はキーボードより上だけで完結し、屋外視認性を優先したライトモードが既定（ダークにも切替可）。発話は無音1.6秒で自動確定し、数秒後にGitHubへ自動保存。走行中は設定を求めない・保存に失敗してもローカルの下書きは消えず、電波復帰時に自動再送する。 |

いずれも対象は `plzsayyes3/mynotebook` を既定値とし、GitHub Token・保存先は各モードの設定画面から変更可能。

## 仕組み

- 完全に静的（サーバー・ビルドステップなし）。GitHub Pagesでそのままホスティング。
- 認証は GitHub の Fine-grained Personal Access Token をブラウザに貼り付ける方式。トークンは `localStorage` に保存し、GitHub API以外へ送信しない。
- ファイルの読み書きはブラウザから `api.github.com` に直接アクセス。
- v3のAI変換は Google Gemini API を直接ブラウザから呼び出す。APIキーも `localStorage` に保存。
- v2vはv2の操作思想を引き継ぎつつ、描画部分を縦書き用に分離。論理テキストは通常のMarkdown文字列のまま保持し、表示時だけ縦方向の列へ分割する。

## セットアップ

### 1. GitHub Fine-grained Personal Access Token

https://github.com/settings/personal-access-tokens/new

- Repository access: 対象リポジトリ（例: `mynotebook`）のみ
- Permissions: Contents = **Read and write**

### 2. (v3のみ) Gemini API Key

https://aistudio.google.com/apikey で発行。

- **無料枠は学習に利用される場合がある。** 避けたい場合は課金登録済みの有料枠のキーを使うこと。
- モデルが廃止された場合、エラーメッセージから代替モデル名を自動検出して1回リトライし、以後はそのモデル名を使うようになっている。
- 429/500/503（一時的な過負荷）は自動的に間隔を空けてリトライする。

### 3. スマホで開く

各バージョンのURLを開き、設定画面（歯車アイコン、またはv3ならステータスバーの「設定」ボタン）からトークンを貼り付ける。「ホーム画面に追加」するとアプリのように使える。

## 開発メモ

- v2/v3の「カーソル中央固定」は `position:fixed` + `transform:translateX()` で実現。文字幅の実測には、`<input>` に対して `getComputedStyle().font`（ショートハンド）が正しく取れない環境があるため、フォントプロパティは個別に指定したDOMミラー要素で測定している。
- v2vは入力用の不可視 `<textarea>` と表示用の縦書きDOMを分離。入力値を論理テキストとして保持し、1列に表示できる文字数を画面高から算出して列へ分割する。最新列を画面中央に置き、過去列を左側へ送る。
- v2vの日本語表示は `writing-mode: vertical-rl` と `text-orientation: mixed` を使用。日本語だけでなく英数字も入力値を壊さず保持する。
- v3の「ひらがな・英数字直打ち」は、IME変換候補UI自体を無効化するWeb APIが存在しないため、`compositionend`時に漢字・カタカナが紛れ込んでいたら検知して取り除く方式。加えて `lang="en"` 指定でiOS Safariに英語キーボードを優先させ、ローマ字のまま入力できるようにしている（Gemini側でローマ字→自然な日本語への変換も行う）。
- v4は、Safari(iOS)がWeb Speech API(`SpeechRecognition`)を実装していないため、音声認識自体はOS標準キーボードのディクテーション機能に依存する設計。「キーボードが出ること」自体は避けられないので、代わりに `visualViewport` の `height`/`offsetTop` を毎回 `#app` の高さ/位置に反映し、キーボードが出てもその上の可視領域だけでレイアウトが完結するようにしている。入力欄はカーソル位置合わせが不要な追記オンリーのログ形式（無音1.6秒で1行確定）にすることで、暗い画面でカーソルを探す操作自体をなくしている。GitHubへの保存は行確定のたびに即localStorageへ退避した上でデバウンスしてPUTし、走行中に接続設定モーダルを自動で開くことはしない（未設定/オフライン時はローカル下書きを保持し続け、`online`イベントで自動再送）。
