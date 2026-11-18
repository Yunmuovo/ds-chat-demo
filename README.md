# ds-chat-demo

基于 [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo) 改造的 DeepSeek 聊天界面。
纯静态网页，没有后端：打开网页、在设置里填自己的 API Key 就能用。

## 直接使用

- 在线版：开启 GitHub Pages 后访问 `https://yunmuovo.github.io/ds-chat-demo/`
- 离线版：下载本仓库，浏览器直接打开 `docs/index.html`

首次打开会弹出「设置 → 数据管理」，在最上面填入 API Key
（在 [platform.deepseek.com](https://platform.deepseek.com) 申请）。Key 只存在你自己的浏览器里。

## 相比原版改了什么

- **品牌**：标题、侧栏、新对话页换成 DeepSeek 鲸鱼图标与主色 `#4D6BFE`，侧栏纯白
- **搜索**：侧栏顶部可搜索对话标题
- **多选**：长按或菜单进入多选，支持批量置顶 / 批量删除、全选
- **会话置顶**：置顶组固定在列表最上方，刷新后保留（标题前不再显示图钉）
- **长会话性能**：首屏只渲染 12 条（手机）/ 20 条（桌面），顶部「加载更早的消息」按需补，滚动位置不跳动
- **压缩上下文**：最新一条回复的操作栏里有「压缩上下文」，把早期对话总结成摘要，之后每次发送只带摘要，省 token
- **思考折叠**：思考内容超过 600 字，回答结束后自动收起
- **不弹键盘**：触摸设备切换对话不再自动聚焦输入框，发送后收起键盘
- **图片预览**：点消息里的图片在页内全屏查看（blob 链接在手机上打不开新标签页）
- **公式**：`$$` 公式正常渲染；`\scalebox` 按倍数近似成字号；裸 LaTeX 自动补定界符；括号不配平时自动补齐
- **审核档位**：`safety_check` 调整为 `low`
- **旧内核兼容**：内置 `toReversed / toSorted / toSpliced` 补丁，Chrome 109 也能正常发送
- **抽屉手势**：从左往右滑出侧栏，跟手拖动、松手吸附
- **欢迎页**：随机问候语

## 本地开发

```sh
pnpm install
pnpm dev        # http://localhost:8090
pnpm type       # 类型检查
pnpm build      # 产物在 dist/
bash build.sh   # 构建 + 部署到手机目录 + 同步 docs/
```

## 部署给别人用

仓库里的 `docs/` 就是构建产物。在仓库 Settings → Pages → Source 选 `main` 分支的 `/docs` 目录，
保存后会得到一个 `https://<用户名>.github.io/ds-chat-demo/` 的地址，发给谁谁就能用（各自填各自的 Key）。

也可以直接把 `docs/` 拖到 Netlify Drop，或部署到任意静态托管。

## 说明

- 这是开源 demo 的自部署版本，不是官方产品，请保留 LICENSE（MIT）。
- 没有账号体系：谁拿到地址都能用，数据只存在各自浏览器的 IndexedDB / localStorage 里，互不相通。
- 换域名或端口 = 换数据源，旧地址的对话不会自动迁移；搬迁请用「设置 → 数据管理 → 导出所有历史对话」。

## Android APK

`android/` 是一个最小的 WebView 外壳工程：App 打开时加载线上站点，网页更新后无需重新发版。

构建不需要本地装 Android SDK —— 推送到 `main` 且改动涉及 `android/` 时，GitHub Actions 会自动
编译 debug APK，在 Actions 页面的 `ds-chat-demo-apk` 产物里下载。

- 站点地址写在 `android/app/src/main/java/com/yunmuovo/dschat/MainActivity.java` 的 `HOME_URL`
- 默认 debug 签名，可直接安装（需允许“未知来源”）
- 更换图标：替换 `android/app/src/main/res/mipmap-*/ic_launcher.png`

### 2.0.0（纪念版）

- Image viewer: pinch to zoom, drag to pan, double tap to toggle zoom, wheel zoom on desktop
- New splash: logo fades in place, breathes, then the whole screen fades out
- Cold start: logo appears after 260ms, "loading" hint only after 1.2s, cache-first WebView

### 签名与升级

APK 用固定密钥签名（`android/keystore.jks`，由 CI 首次构建时生成并提交），
因此后续版本可以直接覆盖安装。**首次从「每次构建随机签名」的旧版切换过来时，
需要卸载旧版一次**，否则会提示“与已安装应用签名不同”。
