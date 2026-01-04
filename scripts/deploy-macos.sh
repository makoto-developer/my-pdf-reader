#!/bin/bash

# エラー時に終了
set -e

echo "🚀 macOS アプリデプロイを開始します..."

# ビルド
echo "📦 アプリをビルド中..."
npm run tauri:build

# ビルド成果物のパスを取得
APP_NAME="My PDF Reader.app"
BUILD_DIR="src-tauri/target/release/bundle/macos"
APP_PATH="$BUILD_DIR/$APP_NAME"

# ビルド成果物の確認
if [ ! -d "$APP_PATH" ]; then
    echo "❌ エラー: ビルド成果物が見つかりません"
    echo "   パス: $APP_PATH"
    exit 1
fi

echo "✅ ビルド完了"

# Applicationsフォルダへコピー
echo "📂 Applications フォルダへコピー中..."
DEST_PATH="/Applications/$APP_NAME"

# 既存のアプリがあれば削除
if [ -d "$DEST_PATH" ]; then
    echo "🗑️  既存のアプリを削除中..."
    rm -rf "$DEST_PATH"
fi

# アプリをコピー
cp -R "$APP_PATH" "/Applications/"

echo "✅ デプロイ完了!"
echo ""
echo "📍 アプリの場所: /Applications/$APP_NAME"
echo "🎉 Launchpad または Spotlight で \"My PDF Reader\" を検索して起動できます"
