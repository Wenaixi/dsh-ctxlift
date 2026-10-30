/**
 * 生成 DSH 官方 Web 客户端产物 lib/client.js
 *
 * 为什么用字符串模板而不是 tsc 编译 .tsx：宿主 client runner 只认
 * `window.__ModuleLoader__.load({ id, factory })` 这一种形态，普通 ESM/CJS 产物会被
 * 直接跳过（dsh-client-modules 的 resolveMeta 只接受该形态）。官方参考实现
 * （dsh-ponytail）同样用模板生成，这里沿用同一套路。
 *
 * 产物职责：把本插件的配置卡片挂到 plugins.bundle.config 插槽，并把全局指令文件
 * 的读写经 Typert Remote 通道接到宿主。
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG } from '../lib/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf-8'));
const PKG = pkg.name;
const NS = 'dsh-ctxlift';

const zh = JSON.parse(await readFile(join(root, 'locale/zh.json'), 'utf-8'));
const en = JSON.parse(await readFile(join(root, 'locale/en.json'), 'utf-8'));

/** 用户在界面上改动的四层策略，键名与 Config Schema 完全一致 */
const LAYERS = ['globalPolicy', 'projectClaudePolicy', 'projectAgentsPolicy', 'subdirectoriesPolicy'];

/** 界面回退显示用的默认值，直接复用 DEFAULT_CONFIG 单一事实来源 */
const DEFAULTS = DEFAULT_CONFIG;

const content = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PKG)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let React = require("react");
    let P = require("@deepseek-ai/dsh-client-ui-primitives");
    let e = React.createElement;

    var NS = ${JSON.stringify(NS)};
    var PKG = ${JSON.stringify(PKG)};
    var LAYERS = ${JSON.stringify(LAYERS)};
    var DEFAULTS = ${JSON.stringify(DEFAULTS)};
    var ZH = ${JSON.stringify(zh)};
    var EN = ${JSON.stringify(en)};

    var localeCtx = null;
    function t(key, params) {
      var dict = ZH;
      var text = dict[key] !== undefined ? dict[key] : key;
      if (params) {
        Object.keys(params).forEach(function (name) {
          text = text.split("{" + name + "}").join(String(params[name]));
        });
      }
      return text;
    }

    var L = {
      section: { display: "flex", flexDirection: "column", gap: "8px" },
      title: { fontSize: "13px", fontWeight: "600", margin: "0", color: "var(--dsw-alias-label-primary)" },
      hint: { fontSize: "12px", margin: "0", color: "var(--dsw-alias-label-tertiary)" },
      row: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "8px", padding: "10px 12px",
        borderRadius: "var(--dsw-radius-sm)", border: "1px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-1)"
      },
      rowText: { display: "flex", flexDirection: "column", gap: "2px" },
      rowName: { fontSize: "13px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" },
      rowDesc: { fontSize: "12px", color: "var(--dsw-alias-label-tertiary)" },
      select: {
        padding: "4px 8px", fontSize: "12px", borderRadius: "var(--dsw-radius-sm)",
        border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)",
        color: "var(--dsw-alias-label-primary)"
      },
      input: {
        width: "96px", padding: "4px 8px", fontSize: "12px", textAlign: "right",
        borderRadius: "var(--dsw-radius-sm)", border: "1px solid var(--dsw-alias-border-l2)",
        background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)"
      },
      textarea: {
        width: "100%", boxSizing: "border-box", padding: "10px", fontFamily: "monospace",
        fontSize: "13px", lineHeight: "1.5", borderRadius: "var(--dsw-radius-sm)",
        border: "1px solid var(--dsw-alias-border-l2)", background: "var(--dsw-alias-bg-layer-1)",
        color: "var(--dsw-alias-label-primary)", resize: "vertical"
      },
      warn: { fontSize: "12px", margin: "0", color: "var(--dsw-alias-state-warn-primary)" }
    };

    /** 最小订阅存储：一个对象 + 一组监听者，够 useSyncExternalStore 用 */
    function createStore(initial) {
      var listeners = new Set();
      var current = initial;
      return {
        getSnapshot: function () { return current; },
        subscribe: function (listener) {
          listeners.add(listener);
          return function () { listeners.delete(listener); };
        },
        set: function (next) {
          current = next;
          listeners.forEach(function (listener) { listener(); });
        }
      };
    }

    /**
     * 本插件向官方网关声明的 Remote 贡献。
     *
     * 必须显式声明并 $mount：浏览器侧 dsh-api-remotes 只遍历编译期写死的官方贡献
     * 清单，第三方不 $mount 就永远没有 remote.<namespace>。
     *
     * 带参方法的每个参数都必须带 codec.mode === "strict"（requireStrictCodec 只认这个，
     * dsh-api-gateway/lib/client.js:2101），否则整个贡献被拒。create 返回一个 parse 恒等
     * 的 TypertSchema 即可；result.decode 省略时网关原样透传。
     */
    function identityCodec(typeSymbol) {
      return {
        mode: "strict",
        typeSymbol: typeSymbol,
        create: function () {
          return { parse: function (value) { return value; } };
        }
      };
    }

    var REMOTE = {
      package: PKG,
      descriptors: [
        {
          id: PKG + "#instructionsGuard/getGlobalInfo",
          service: "instructionsGuard",
          namespace: NS,
          method: "getGlobalInfo",
          invocation: { kind: "direct" },
          parameters: [],
          result: { mode: "strict", typeSymbol: PKG + "/types#GlobalFileResolution", create: function (v) { return v; } },
          sourceLocation: { file: "src/remote.ts", line: 1, column: 1 }
        },
        {
          id: PKG + "#instructionsGuard/saveGlobalContent",
          service: "instructionsGuard",
          namespace: NS,
          method: "saveGlobalContent",
          invocation: { kind: "direct" },
          parameters: [
            {
              name: "payload",
              wire: "payload",
              source: "json",
              codec: identityCodec(PKG + "/types#SaveGlobalPayload")
            }
          ],
          result: { mode: "strict", typeSymbol: PKG + "/types#SaveGlobalResult", create: function (v) { return v; } },
          sourceLocation: { file: "src/remote.ts", line: 1, column: 1 }
        },
        {
          id: PKG + "#instructionsGuard/switchGlobalFilename",
          service: "instructionsGuard",
          namespace: NS,
          method: "switchGlobalFilename",
          invocation: { kind: "direct" },
          parameters: [
            {
              name: "payload",
              wire: "payload",
              source: "json",
              codec: identityCodec(PKG + "/types#SwitchGlobalPayload")
            }
          ],
          result: { mode: "strict", typeSymbol: PKG + "/types#SwitchGlobalResult", create: function (v) { return v; } },
          sourceLocation: { file: "src/remote.ts", line: 1, column: 1 }
        }
      ]
    };

    function createUnavailableGlobalStore() {
      var store = createStore({ status: "unavailable", value: null });
      store.reload = function () {};
      store.save = function () { return Promise.resolve(false); };
      store.switchTo = function () { return Promise.resolve(false); };
      return store;
    }

    /**
     * 全局指令文件的远程读写通道。
     *
     * 远程方法返回 { ok: true, value } / { ok: false, error } 信封（网关 client 侧
     * lib/client.js:1795-1802），这里自己拆包。$mount 返回前挂载已完成（内部 await fiber），
     * 所以挂载后同步问一次即可，不轮询。
     */
    function createGlobalStore(ctx, namespace) {
      var store = createStore({ status: "loading", value: null });

      function endpoint(method) {
        var ns = ctx.get("remote." + namespace);
        if (ns === null || ns === undefined || typeof ns[method] !== "function") return null;
        return ns;
      }

      function fail() {
        store.set({ status: "unavailable", value: null });
      }

      function unwrap(response) {
        return response && response.ok === true ? response.value : undefined;
      }

      var load = function () {
        var ns = endpoint("getGlobalInfo");
        if (ns === null) { fail(); return Promise.resolve(false); }
        return Promise.resolve(ns.getGlobalInfo()).then(function (response) {
          var value = unwrap(response);
          if (value === undefined) { fail(); return false; }
          store.set({ status: "ready", value: value });
          return true;
        }).catch(function () { fail(); return false; });
      };

      var save = function (filename, text) {
        var ns = endpoint("saveGlobalContent");
        if (ns === null) return Promise.resolve(false);
        return Promise.resolve(ns.saveGlobalContent({ filename: filename, content: text }))
          .then(function (response) {
            var value = unwrap(response);
            if (value === undefined || value.ok !== true) return false;
            // 保存后停在刚写的文件上，并刷新它的新内容与大小
            return switchTo(filename);
          })
          .catch(function () { return false; });
      };

      // 切换只读不落盘：目标文件不存在时 value.content 就是空串，编辑器直接显示空文本，
      // 用户写好内容再保存时才由 saveGlobalContent 自动创建文件。
      var switchTo = function (target) {
        var ns = endpoint("switchGlobalFilename");
        if (ns === null) return Promise.resolve(false);
        return Promise.resolve(ns.switchGlobalFilename({ target: target }))
          .then(function (response) {
            var value = unwrap(response);
            if (value === undefined) { fail(); return false; }
            store.set({ status: "ready", value: value });
            return true;
          })
          .catch(function () { fail(); return false; });
      };

      store.reload = load;
      store.save = save;
      store.switchTo = switchTo;
      load();
      return store;
    }

    /** 取某层策略的展示值：未配置时回退默认值，界面上永远是确定值 */
    function policyOf(config, layer) {
      var fallback = DEFAULTS[layer];
      var raw = config && config[layer];
      if (!raw || typeof raw !== "object") return { mode: fallback.mode, maxBytes: fallback.maxBytes };
      return {
        mode: typeof raw.mode === "string" ? raw.mode : fallback.mode,
        maxBytes: typeof raw.maxBytes === "number" ? raw.maxBytes : fallback.maxBytes
      };
    }

    function CtxliftConfigPanel(props) {
      var snapshot = props.useCtxliftConfig(function (s) { return s; });
      var globalState = props.useCtxliftGlobal(function (s) { return s; });

      var busyPair = React.useState(false);
      var busy = busyPair[0];
      var setBusy = busyPair[1];
      var notePair = React.useState(null);
      var note = notePair[0];
      var setNote = notePair[1];

      var writable = snapshot.writable === true && snapshot.status === "ready";
      var config = snapshot.value || {};

      var info = globalState.value;
      var basePair = React.useState("");
      var base = basePair[0];
      var setBase = basePair[1];
      var draftPair = React.useState("");
      var draft = draftPair[0];
      var setDraft = draftPair[1];

      React.useEffect(function () {
        var text = info && typeof info.content === "string" ? info.content : "";
        setBase(text);
        setDraft(text);
      }, [info]);

      var dirty = draft !== base;

      function normalizeConfig(c) {
        var raw = c || {};
        var res = {
          globalPreference: typeof raw.globalPreference === "string" ? raw.globalPreference : DEFAULTS.globalPreference
        };
        for (var i = 0; i < LAYERS.length; i++) {
          res[LAYERS[i]] = policyOf(raw, LAYERS[i]);
        }
        return res;
      }

      var serverConfig = React.useMemo(function () {
        return normalizeConfig(config);
      }, [config]);

      var configDraftPair = React.useState(null);
      var configDraft = configDraftPair[0];
      var setConfigDraft = configDraftPair[1];

      var currentConfig = configDraft || serverConfig;

      var configDirty = React.useMemo(function () {
        if (!configDraft) return false;
        if (configDraft.globalPreference !== serverConfig.globalPreference) return true;
        for (var i = 0; i < LAYERS.length; i++) {
          var l = LAYERS[i];
          if (configDraft[l].mode !== serverConfig[l].mode) return true;
          if (configDraft[l].maxBytes !== serverConfig[l].maxBytes) return true;
        }
        return false;
      }, [configDraft, serverConfig]);

      var setPreferenceDraft = function (pref) {
        setConfigDraft(function (prev) {
          var baseConfig = prev || serverConfig;
          return Object.assign({}, baseConfig, { globalPreference: pref });
        });
      };

      var writePolicyDraft = function (layer, next) {
        setConfigDraft(function (prev) {
          var baseConfig = prev || serverConfig;
          var updated = Object.assign({}, baseConfig);
          updated[layer] = { mode: next.mode, maxBytes: next.maxBytes };
          return updated;
        });
      };

      var saveConfig = function () {
        if (!configDirty || busy || !writable) return;
        var ops = [];
        if (currentConfig.globalPreference !== serverConfig.globalPreference) {
          ops.push({ op: "set", path: ["globalPreference"], value: currentConfig.globalPreference });
        }
        for (var i = 0; i < LAYERS.length; i++) {
          var l = LAYERS[i];
          if (currentConfig[l].mode !== serverConfig[l].mode || currentConfig[l].maxBytes !== serverConfig[l].maxBytes) {
            ops.push({ op: "set", path: [l], value: currentConfig[l] });
          }
        }
        if (ops.length === 0) {
          setConfigDraft(null);
          return;
        }
        setBusy(true);
        setNote(null);
        props.mutate(ops, snapshot.revision).then(function (landed) {
          setBusy(false);
          if (landed) {
            setConfigDraft(null);
            setNote(t("toast.saved"));
          } else {
            setNote(t("toast.rejected"));
          }
        });
      };

      var resetConfig = function () {
        setConfigDraft(null);
      };

      var renderPolicyRow = function (layer) {
        var policy = currentConfig[layer];
        var rowKey = "policy." + layer;
        return e(
          "div",
          { key: layer, style: L.row },
          e(
            "div",
            { style: L.rowText },
            e("span", { style: L.rowName }, t(rowKey + ".title")),
            e("span", { style: L.rowDesc }, t(rowKey + ".desc"))
          ),
          e(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            e(
              "select",
              {
                value: policy.mode,
                disabled: busy || !writable,
                style: L.select,
                onChange: function (event) {
                  writePolicyDraft(layer, { mode: event.target.value, maxBytes: policy.maxBytes });
                }
              },
              e("option", { value: "unlimited" }, t("policy.mode.unlimited")),
              e("option", { value: "truncate" }, t("policy.mode.truncate")),
              e("option", { value: "disabled" }, t("policy.mode.disabled"))
            ),
            policy.mode === "truncate"
              ? e(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: "4px" } },
                  e("input", {
                    type: "number",
                    min: 128,
                    step: 1024,
                    value: policy.maxBytes,
                    disabled: busy || !writable,
                    style: L.input,
                    onChange: function (event) {
                      var next = Number(event.target.value);
                      if (!Number.isFinite(next) || next < 128) return;
                      writePolicyDraft(layer, { mode: policy.mode, maxBytes: Math.floor(next) });
                    }
                  }),
                  e("span", { style: L.hint }, t("policy.bytes"))
                )
              : null
          )
        );
      };

      var saveFile = function () {
        if (!info || busy) return;
        setBusy(true);
        setNote(null);
        props.saveGlobal(info.activeFilename, draft).then(function (ok) {
          setBusy(false);
          setNote(ok ? t("editor.saved") : t("editor.error", { msg: "save failed" }));
        });
      };

      var switchFile = function (target) {
        if (!info || busy || info.activeFilename === target) return;
        if (dirty && !confirm(t("editor.confirmSwitch"))) return;
        setBusy(true);
        setNote(null);
        props.switchGlobal(target).then(function (ok) {
          setBusy(false);
          if (!ok) setNote(t("editor.error", { msg: "switch failed" }));
        });
      };

      var activeFilename = info && typeof info.activeFilename === "string" ? info.activeFilename : "AGENTS.md";
      var sizeBytes = info && typeof info.sizeBytes === "number" ? info.sizeBytes : 0;

      return e(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "16px", maxWidth: "880px" } },
        e("h3", { style: { margin: "0", fontSize: "15px", fontWeight: "600", color: "var(--dsw-alias-label-primary)" } }, t("panel.title")),
        e("p", { style: L.hint }, t("panel.description")),

        e(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginTop: "4px" } },
          e("span", { style: L.title }, t("config.sectionTitle")),
          e(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px" } },
            configDirty ? e("span", { style: L.warn }, t("config.dirty")) : null,
            configDirty
              ? e("button", {
                  type: "button",
                  disabled: busy || !writable,
                  style: L.select,
                  onClick: resetConfig
                }, t("config.reset"))
              : null,
            e(P.Button, {
              variant: "primary",
              size: "sm",
              disabled: busy || !configDirty || !writable,
              onClick: saveConfig
            }, t("config.save"))
          )
        ),

        e(
          "div",
          { style: L.row },
          e(
            "div",
            { style: L.rowText },
            e("span", { style: L.rowName }, t("pref.title")),
            e("span", { style: L.rowDesc }, t("pref.description"))
          ),
          e(
            "select",
            {
              value: currentConfig.globalPreference,
              disabled: busy || !writable,
              style: L.select,
              onChange: function (event) { setPreferenceDraft(event.target.value); }
            },
            e("option", { value: "auto" }, t("pref.auto")),
            e("option", { value: "claude" }, t("pref.claude")),
            e("option", { value: "agents" }, t("pref.agents")),
            e("option", { value: "both" }, t("pref.both"))
          )
        ),

        e("div", { style: L.section }, LAYERS.map(renderPolicyRow)),

        e(
          "div",
          { style: Object.assign({}, L.section, { marginTop: "8px" }) },
          e(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
            e(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              e("span", { style: L.title }, t("editor.title")),
              e("button", { type: "button", disabled: busy, style: L.select, onClick: function () { switchFile("AGENTS.md"); } }, "AGENTS.md"),
              e("button", { type: "button", disabled: busy, style: L.select, onClick: function () { switchFile("CLAUDE.md"); } }, "CLAUDE.md")
            ),
            e(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px" } },
              e("span", { style: L.hint }, t("editor.size", { n: sizeBytes })),
              dirty ? e("span", { style: L.warn }, t("editor.dirty")) : null,
              e(P.Button, { variant: "primary", size: "sm", disabled: busy || !dirty, onClick: saveFile }, t("editor.save"))
            )
          ),
          e("textarea", {
            rows: 14,
            value: draft,
            placeholder: t("editor.placeholder", { file: activeFilename }),
            style: L.textarea,
            onChange: function (event) { setDraft(event.target.value); }
          }),
          note !== null ? e("p", { style: L.hint }, note) : null,
          !writable && snapshot.status === "ready" ? e("p", { style: L.warn }, t("state.readOnly")) : null
        )
      );
    }

    async function apply(ctx) {
      // 先把 Remote 贡献挂到官方网关：命名空间不会自动出现，必须显式 $mount
      var mounted = null;
      try {
        mounted = await ctx.remote.$mount(REMOTE);
      } catch (error) {
        if (ctx.logger) ctx.logger.warn("[dsh-ctxlift] remote 贡献挂载失败（全局文件编辑器将不可用）: " + String(error));
      }
      ctx.effect(function () {
        return function () { if (mounted) void mounted(); };
      }, "dsh-ctxlift: remote contribution");

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: ZH, en: EN });
      }, "dsh-ctxlift: dictionaries");
      localeCtx = ctx.locale;
      t = ctx.locale.bind(NS);

      var scope = ctx.configForms.get(NS);
      var globalStore = mounted === null ? createUnavailableGlobalStore() : createGlobalStore(ctx, NS);

      // 数据面经 inject 提供：组件只从 props 消费，不触碰 ctx（渲染器铁律）
      var formStore = {
        getSnapshot: function () { return scope.getSnapshot(); },
        subscribe: function (listener) { return scope.subscribe(listener); }
      };
      var face = function () {
        return {
          hooks: { ctxliftConfig: formStore, ctxliftGlobal: globalStore },
          mutate: function (ops, revision) { return scope.mutate(ops, revision); },
          saveGlobal: function (filename, text) { return globalStore.save(filename, text); },
          switchGlobal: function (target) { return globalStore.switchTo(target); }
        };
      };

      // whileServed：宿主没有服务该命名空间时整张卡片不出现，页面上不留痕迹
      ctx.effect(function () {
        return ctx.configForms.whileServed([NS], function () {
          return ctx.slots.inject("plugins.bundle.config", function () {
            return ctx.slots.register(
              { name: "plugins.bundle.config", key: PKG, locale: NS, inject: face },
              CtxliftConfigPanel
            );
          });
        });
      }, "dsh-ctxlift: config card");
    }

    exports.apply = apply;
    exports.inject = ["slots", "locale", "configForms", "remote"];
    return module.exports;
  }
});
`;

await mkdir(join(root, 'lib'), { recursive: true });
await writeFile(join(root, 'lib/client.js'), content, 'utf-8');
console.log('[build-client] generated lib/client.js');
