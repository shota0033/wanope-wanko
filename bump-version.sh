#!/bin/sh
# ゲームの版番号を上げる。更新を公開する（GitHub に送る）前に毎回実行する。
# 使い方: sh bump-version.sh 3
#
# ・index.html で読み込んでいる CSS・JavaScript の URL に ?v=番号 を付ける
#   （スマホなどが古いファイルを使い回して、新旧のファイルが混ざるのを防ぐ）
# ・config.js の version も同じ番号にする（タイトル画面の右下に表示される）
set -e
v="$1"
[ -n "$v" ] || { echo "使い方: sh bump-version.sh <番号>"; exit 1; }
cd "$(dirname "$0")"
sed -i -E "s#(css/[a-z]+\.css|js/[a-z]+\.js)(\?v=[0-9]+)?\"#\1?v=$v\"#g" index.html
sed -i -E "s#^  version: [0-9]+,#  version: $v,#" js/config.js
echo "v$v にしました"
