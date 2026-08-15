// dsh-skin-manager — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-skin-manager/client.js
// and executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). The factory body is plain CJS with
// require() resolved against the shell's module table — the same shape the
// shipped ui-* packages' tsdown bundles emit.
//
// It registers its own Settings section (settings.section, id "skins"):
// a dedicated 皮肤 / Skins page in the settings sidebar that lists every
// installed skin (discovered at runtime via the host /api/skin-manager/list
// route) plus 官方默认 / Default. Applying a skin rewrites the profile patch
// through the host API; DSH's config watcher hot-reloads it, then the page
// refresh activates the new boot graph.

window.__ModuleLoader__.load({
	id: "dsh-skin-manager",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _react = require("react");
		let _runtime_client = require("@deepseek-ai/dsh-client-runtime/client");

		//#region dsh-skin-manager: definitions
		/** The settings section's locale namespace. */
		const NS = "settings.skin-manager";
		/** Host API prefix. */
		const API = "/api/skin-manager";
		/** Sentinel meaning "no skin — stock look". */
		const OFFICIAL = "official";

		/** zh / en dictionaries. */
		const zh = {
			nav: "皮肤",
			title: "皮肤",
			description: "选择已安装的皮肤（互斥，应用后刷新页面生效）",
			defaultOption: "官方默认",
			defaultTagline: "恢复 DeepSeek Harness 原生外观",
			apply: "应用",
			applying: "应用中…",
			applied: "已应用，刷新页面生效",
			failed: "应用失败",
			none: "未发现已安装的皮肤",
			refresh: "刷新",
			active: "使用中",
		};
		const en = {
			nav: "Skins",
			title: "Skins",
			description: "Pick an installed skin (mutually exclusive; refresh after applying)",
			defaultOption: "Default",
			defaultTagline: "Restore the stock DeepSeek Harness appearance",
			apply: "Apply",
			applying: "Applying…",
			applied: "Applied — refresh the page to activate",
			failed: "Apply failed",
			none: "No skins installed",
			refresh: "Refresh",
			active: "Active",
		};

		/** Resolve a locale key through the injected `t` or fall back to zh. */
		function tt(props, key) {
			if (props && typeof props.t === "function") {
				const v = props.t(key);
				if (typeof v === "string" && v !== key) return v;
			}
			return zh[key] ?? en[key] ?? key;
		}

		/** The dedicated Skins settings section (a full settings page). */
		function SkinManagerSection(props) {
			const _jsx = react_jsx_runtime.jsx;
			const _jsxs = react_jsx_runtime.jsxs;
			const { useEffect, useState, useCallback } = _react;
			const [skins, setSkins] = useState(null);
			const [active, setActive] = useState(null);
			const [busy, setBusy] = useState(false);
			const [status, setStatus] = useState("");

			const load = useCallback(() => {
				fetch(`${API}/list`)
					.then((r) => r.json())
					.then((data) => {
						setSkins(Array.isArray(data.skins) ? data.skins : []);
						setActive(data.active ?? null);
						setStatus("");
					})
					.catch(() => {
						setSkins([]);
						setStatus("failed");
					});
			}, []);

			useEffect(() => { load(); }, [load]);

			const apply = useCallback((id) => {
				setBusy(true);
				setStatus("");
				fetch(`${API}/apply`, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id }),
				})
					.then((r) => r.json())
					.then((data) => {
						setBusy(false);
						if (data.ok === true) {
							setActive(data.active ?? null);
							setStatus("applied");
						} else {
							setStatus("failed");
						}
					})
					.catch(() => {
						setBusy(false);
						setStatus("failed");
					});
			}, []);

			const t = (key) => tt(props, key);

			if (skins === null) {
				return _jsx("div", { style: { padding: "24px 0" }, children: "…" });
			}

			const rows = [];
			// 官方默认 / Default option.
			rows.push(_jsxs("div", {
				style: skinCardStyle(active === null),
				children: [
					_jsx("div", { style: { width: 10, height: 10, borderRadius: 5, background: "var(--dsw-alias-brand-primary, #4d86f8)", marginRight: 10, flexShrink: 0 } }),
					_jsxs("div", { style: { flex: 1 }, children: [
						_jsx("div", { style: { fontWeight: 600 }, children: t("defaultOption") }),
						_jsx("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 }, children: t("defaultTagline") }),
					] }),
					active === null
						? _jsx("span", { style: activeBadge(), children: t("active") })
						: _jsx("button", { style: applyBtn(), disabled: busy, onClick: () => apply(OFFICIAL), children: busy ? t("applying") : t("apply") }),
				],
			}));

			for (const skin of skins) {
				const isActive = active !== null && (skin.id === active || skin.package === active);
				rows.push(_jsxs("div", {
					key: skin.package,
					style: skinCardStyle(isActive),
					children: [
						_jsx("div", { style: { width: 10, height: 10, borderRadius: 5, background: skin.accent || "#888", marginRight: 10, flexShrink: 0 } }),
						_jsxs("div", { style: { flex: 1 }, children: [
							_jsx("div", { style: { fontWeight: 600 }, children: skin.name }),
							_jsx("div", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 }, children: skin.tagline || skin.package }),
						] }),
						isActive
							? _jsx("span", { style: activeBadge(), children: t("active") })
							: _jsx("button", { style: applyBtn(), disabled: busy, onClick: () => apply(skin.id), children: busy ? t("applying") : t("apply") }),
					],
				}));
			}

			if (skins.length === 0) {
				rows.push(_jsx("div", { key: "none", style: { color: "var(--dsw-alias-label-tertiary)", padding: "8px 0" }, children: t("none") }));
			}

			const statusLine = status === "applied"
				? _jsxs("div", { style: statusStyle("var(--dsw-alias-state-business-primary)"), children: [t("applied"), "  ", _jsx("button", { style: linkBtn(), onClick: () => location.reload(), children: t("refresh") })] })
				: status === "failed"
					? _jsx("div", { style: statusStyle("var(--dsw-alias-state-danger-primary, #e5484d)"), children: t("failed") })
					: null;

			return _jsxs("div", { style: { padding: "4px 0" }, children: [
				_jsx("h2", { style: { fontSize: 16, fontWeight: 600, margin: "0 0 4px" }, children: t("title") }),
				_jsx("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", marginBottom: 12 }, children: t("description") }),
				...rows,
				statusLine,
			] });
		}

		function skinCardStyle(active) {
			return {
				display: "flex",
				alignItems: "center",
				gap: 6,
				padding: "10px 12px",
				borderRadius: 8,
				marginBottom: 6,
				border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.2))",
				background: active ? "var(--dsw-alias-interactive-bg-active, rgba(128,128,128,0.15))" : "transparent",
			};
		}
		function activeBadge() {
			return {
				color: "var(--dsw-alias-state-business-primary, #4d86f8)",
				fontSize: 12,
				fontWeight: 600,
			};
		}
		function applyBtn() {
			return {
				padding: "4px 14px",
				borderRadius: 6,
				border: "1px solid var(--dsw-alias-border-l2, #555)",
				background: "var(--dsw-alias-interactive-bg-hover, transparent)",
				color: "var(--dsw-alias-label-primary, #eee)",
				cursor: "pointer",
				fontSize: 13,
			};
		}
		function statusStyle(color) {
			return { padding: "8px 0", fontSize: 13, color };
		}
		function linkBtn() {
			return { background: "none", border: "none", color: "var(--dsw-alias-state-business-primary, #4d86f8)", cursor: "pointer", fontSize: 13, textDecoration: "underline", padding: 0 };
		}

		/** Required services: slots + locale + settings scope transport. */
		const inject = ["slots", "locale", "settingsScope", "connection", "remote"];

		/** Register the dedicated Skins settings section. */
		function apply(ctx) {
			ctx.effect(() => {
				try {
					ctx.locale.register(NS, { zh, en });
				} catch { /* already registered */ }
			}, "ui-skin-manager: dictionaries");

			const sectionInjected = () => ({
				t: (key) => zh[key] ?? en[key] ?? key,
			});

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "skins",
				order: 20,
				label: () => zh.nav ?? "皮肤",
				locale: NS,
				inject: sectionInjected,
			}, SkinManagerSection));
		}
		//#endregion

		exports.SkinManagerSection = SkinManagerSection;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = "ui-skin-manager";
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
