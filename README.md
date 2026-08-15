# dsh-skin-manager

[English](README.md) | [中文](README.zh.md)

A lightweight **skin manager** for the DeepSeek Harness web GUI. It discovers
every installed skin (any package carrying a `skin.json` plus a prebuilt
client bundle), lists them in a dedicated **Settings → Skins** page, and lets
you switch the active skin with one click — mutually exclusive, hot-reloaded
without restarting `dsh web`.

![skins page](docs/skins.png)

## Features

- **Dynamic discovery** — scans the web profile's `node_modules` for packages
  with `skin.json` + prebuilt `lib/client.js`. Newly installed skins appear
  automatically; no registry regeneration, no code changes.
- **Dedicated settings page** — a `settings.section` entry (id `skins`,
  order 20) in the settings sidebar, next to General / Models.
- **One-click apply** — pick a skin and click **Apply**; the profile patch is
  rewritten and DSH's config watcher hot-reloads it within seconds. Refresh
  the page to activate.
- **Mutually exclusive** — exactly one skin is active at a time (the active
  one gets an `insert` row, every other skin a `disabled: true` row).
- **Restore default** — the **Default** option disables every skin and returns
  to the stock DeepSeek Harness appearance.

## Install

```sh
dsh plugin --profile web add github:xiaoyangcheng84-svg/dsh-skin-manager
```

Then restart `dsh web` (or rely on the market's hot install). Open
**Settings → Skins** after a page refresh.

> Requires git for the `github:` source install; alternatively install from a
> local checkout with `dsh plugin --profile web add link:<path>`.

## Usage

1. Open **Settings → Skins**.
2. See **Default** plus every installed skin (e.g. 深海女仆工坊 / maid-atelier).
3. Click **Apply** on a skin → click **Refresh** when prompted → the skin
   activates.
4. Click **Apply** on **Default** to restore the stock look.

## Skin package protocol

Any package is recognized as a skin when:

- it lives under the profile's `node_modules` (top-level or `@scope/name`),
- it ships a `skin.json` (`id`, `name`, `package`, `accent`, `bodyAttr`,
  `tagline`, optional `wiring.id` — the same fields used by
  dsh-deep-whale / dsh-web-ui skins), and
- it ships a prebuilt client bundle (`exports["./client"]` or `lib/client.js`).

## How switching works

Switching rewrites the managed section of the profile's `cordis.patch.yml`
(between `# --- dsh-skin-manager managed ---` markers):

- active skin → an `- insert:` row;
- every other skin → `- id: <rowId>` + `disabled: true`.

Non-skin user patch rows (e.g. dsh-market) are preserved untouched.

## API

The host half mounts three routes under `/api/skin-manager`:

| Route | Method | Purpose |
|---|---|---|
| `/api/skin-manager/list` | GET | List installed skins + current active id |
| `/api/skin-manager/apply` | POST | `{ id }` or `{ id: "official" }` to switch |
| `/api/skin-manager/bundle` | GET | `?id=<skinId>` serve a skin's client bundle |

## Development

The client bundle is written directly in the `__ModuleLoader__` bundle format
(the same shape tsdown emits for the shipped `ui-*` packages), so no build
step is required. `lib/client.js` may `require` only module-table entities
(platform seed words like `react` and registered client bundles).

## License

MIT
