# Issue tracker: GitHub

Issue・仕様は otaki0413/spot-finder の GitHub Issues で管理する。
操作には gh CLI を使う。

## 操作方法

- 作成: gh issue create --repo otaki0413/spot-finder --title "..." --body-file <本文ファイル>
- 参照: gh issue view <番号> --repo otaki0413/spot-finder --comments
- 一覧: gh issue list --repo otaki0413/spot-finder --state open
- 本文更新: gh issue edit <番号> --repo otaki0413/spot-finder --body-file <本文ファイル>

複数行の本文はファイルに保存し、--body-file で渡す。
スキルが「Issue tracker に公開する」と指示した場合は、
このリポジトリに GitHub Issue を作成する。

## Pull requests as a triage surface

PRs as a request surface: no.
