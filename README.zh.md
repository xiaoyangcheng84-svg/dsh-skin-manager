# dsh-skin-manager · 皮肤管理器

[English](README.md) | [中文](README.zh.md)

面向 DeepSeek Harness Web GUI 的轻量**皮肤管理器**：自动发现所有已安装的
皮肤（任何带 `skin.json` 且附带预构建 client bundle 的包），在独立的
**设置 → 皮肤** 页面列出全部皮肤，一键切换——互斥生效，热载入无需重启
`dsh web`。

## 特性

- **动态发现**：扫描 web profile 的 `node_modules`，找出所有带 `skin.json`
  和预构建 `lib/client.js` 的包。新装的皮肤自动出现，无需重新生成清单、
  无需改代码。
- **独立设置页**：注册 `settings.section`（id `skins`，order 20），出现在
  设置侧栏，与「通用」「模型」平级。
- **一键应用**：选中皮肤点「应用」，profile patch 被重写，DSH 配置 watcher
  秒级热载入；刷新页面即生效。
- **互斥切换**：同一时刻只激活一个皮肤（激活者写 `insert` 行，其余写
  `disabled: true` 行）。
- **恢复默认**：「官方默认」关闭全部皮肤，回到 DeepSeek Harness 原生外观。

## 安装

```sh
dsh plugin --profile web add github:xiaoyangcheng84-svg/dsh-skin-manager
```

然后重启 `dsh web`（或走插件市场热安装）。刷新页面后打开
**设置 → 皮肤**。

> `github:` 源安装需要本机有 git；也可以本地 checkout 后用
> `dsh plugin --profile web add link:<路径>` 安装。

## 使用

1. 打开 **设置 → 皮肤**
2. 看到「官方默认」+ 所有已安装皮肤（如 深海女仆工坊 / maid-atelier）
3. 点某皮肤的「应用」→ 提示成功后点「刷新」→ 皮肤切换
4. 点「官方默认」的「应用」→ 恢复原生外观

## 皮肤包协议

任意包满足以下条件即被识别为皮肤并出现在列表：

- 位于 profile 的 `node_modules`（顶层或 `@scope/name`）
- 带 `skin.json`（`id`、`name`、`package`、`accent`、`bodyAttr`、
  `tagline`，可选 `wiring.id`——与 dsh-deep-whale / dsh-web-ui 皮肤字段一致）
- 带预构建 client bundle（`exports["./client"]` 或 `lib/client.js`）

## 切换原理

切换 = 重写 profile 的 `cordis.patch.yml` 中由
`# --- dsh-skin-manager managed ---` 标记的 managed 段：

- 激活皮肤 → `- insert:` 行
- 其他皮肤 → `- id: <rowId>` + `disabled: true` 行

非皮肤的用户 patch 行（如 dsh-market）原样保留。

## API

host 半区在 `/api/skin-manager` 下挂三个路由：

| 路由 | 方法 | 用途 |
|---|---|---|
| `/api/skin-manager/list` | GET | 列出已装皮肤 + 当前激活 id |
| `/api/skin-manager/apply` | POST | `{ id }` 或 `{ id: "official" }` 切换 |
| `/api/skin-manager/bundle` | GET | `?id=<skinId>` 提供皮肤的 client bundle |

## 开发

client bundle 直接用 `__ModuleLoader__` bundle 格式手写（与官方 `ui-*`
包 tsdown 产物的形状一致），无需构建步骤。`lib/client.js` 只能
`require` 模块表实体（平台种子词如 `react`、已注册的 client bundle）。

## 许可

MIT
