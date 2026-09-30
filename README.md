# MindBook

让知识活起来。笔记是一张纸，AI 待在纸的边上：可以整理、生图、检测和面试。多篇笔记会收成知识空间，桌面上还有一只可以换的伙伴。

## 运行

需要 Node 22+。仓库里带了便携 Node（`.tools/node`，不进版本库）。系统没有 Node 时，先把它放进路径：

```bash
export PATH="$(pwd)/.tools/node/bin:$PATH"
npm install
npm test
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

在左上角「设置」里填写，或复制 `.env.example` 为 `.env.local`：

- `DEEPSEEK_API_KEY`：对话、整理、检测、面试、知识地图
- `ARK_API_KEY`：火山方舟 Seedream 生图

## 笔记

正文在中间的纸上。底部有四个入口：整理、生图、检测、面试。

选中一段文字再整理或生图，只处理这一段，原文不会自动改掉。确认之后才会写回；没选中时，整理可以应用到整篇。

图片挂在纸边，点开可以看大图。检测是在原文上做标记。面试是单独一页，可以多轮问。

## 知识空间

首页是知识空间：最近学习、知识地图、待复习、知识缺口、合并笔记。

地图一次展开一篇笔记，圆点是这篇里的知识点。合并会先确认，再生成一篇新笔记，原来的笔记留着。AI 给的关系、缺口和复习都是建议，要点确认才会留下来。

## 伙伴

笔记右下角是伙伴。有提醒或要回忆的知识时，点开会出题。

「放到桌面」后，桌面上只留一只小宠物。点它展开答题，也可以回到笔记或关闭。按住宠物可以拖动。设置里可以换成圆圆、猫猫、小鸟或团子，笔记里和桌面上是同一只。

## 本地应用

桌面和启动台里的 `MindBook.app` 是本地窗口，打开的还是这个项目。第一次若被系统拦住，在图标上右键选「打开」。

源码在 `desktop/MindBook.swift`，图标是 `desktop/AppIcon.icns`。应用会读包内 `Contents/Resources/project-root` 里的项目路径。本机 3000 端口没开时，它会自己拉起开发服务。

重新编译并装到桌面和启动台：

```bash
ROOT="$(pwd)"
STAGE="$ROOT/desktop/.build/MindBook.app"
rm -rf "$STAGE"
mkdir -p "$STAGE/Contents/MacOS" "$STAGE/Contents/Resources"
swiftc -O -o "$STAGE/Contents/MacOS/MindBook" desktop/MindBook.swift -framework Cocoa -framework WebKit
cp desktop/Info.plist "$STAGE/Contents/Info.plist"
cp desktop/AppIcon.icns "$STAGE/Contents/Resources/AppIcon.icns"
printf '%s\n' "$ROOT" > "$STAGE/Contents/Resources/project-root"
xattr -cr "$STAGE"
codesign --force --deep --sign - "$STAGE"
rm -rf "$HOME/Desktop/MindBook.app" "$HOME/Applications/MindBook.app"
cp -R "$STAGE" "$HOME/Desktop/MindBook.app"
cp -R "$STAGE" "$HOME/Applications/MindBook.app"
```
# ai-note
