# 禅ノート (zen-note)

スマホから GitHub API 経由で直接ノートを書き込むための、軽量なテキストエディタ群。サーバー・ビルド不要、静的HTML1ファイルずつで完結。

**公開URL**: https://plzsayyes3.github.io/zen-note/

## バージョン

| | URL | 内容 |
|---|---|---|
| v1 | [/v1/](https://plzsayyes3.github.io/zen-note/v1/) | ファイルパスを指定して既存ノートを開き、編集して保存する通常のエディタ。Markdownプレビュー付き。 |
| v2 | [/v2/](https://plzsayyes3.github.io/zen-note/v2/) | 「禅モード」。カーソルが常に画面中央に固定され、文字は横に流れる。画面端で折り返して上段に積み上がり、Enterで行が持ち上がる。距離に応じたフェード演出付き。 |
| v3 | [/v3/](https://plzsayyes3.github.io/zen-note/v3/) | v2 + AI漢字変換。ローマ字/ひらがなのまま直接入力し（IME変換は経由しない設計）、投稿前にGemini APIで自然な漢字混じり表記に自動変換してからGitHubへ投稿する。 |

いずれも対象は `plzsayyes3/mynotebook` リポジトリ固定（v3の設定画面でリポジトリ名も変更可能）。

## 仕組み

- 完全に静的（サーバー・ビルドステップなし）。GitHub Pagesでそのままホスティング。
- 認証は GitHub の Fine-grained Personal Access Token をブラウザに貼り付ける方式。トークンは `localStorage` にのみ保存され、どこにも送信されない。
- ファイルの読み書きはブラウザから `api.github.com` に直接アクセス（CORS対応済み）。
- v3のAI変換は Google Gemini API を直接ブラウザから呼び出す。APIキーも同じ `localStorage` に保存。
- v1/v2/v3 は同一オリジン（`plzsayyes3.github.io`）なので、設定（GitHub Token / Gemini API Key）は共通。どれか1つで設定すれば他のバージョンでも使える。

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
- v3の「ひらがな・英数字直打ち」は、IME変換候補UI自体を無効化するWeb APIが存在しないため、`compositionend`時に漢字・カタカナが紛れ込んでいたら検知して取り除く方式。加えて `lang="en"` 指定でiOS Safariに英語キーボードを優先させ、ローマ字のまま入力できるようにしている（Gemini側でローマ字→自然な日本語への変換も行う）。
