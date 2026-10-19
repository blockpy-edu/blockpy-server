var Le = Object.defineProperty;
var Fe = (n, e, t) => e in n ? Le(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var De = (n, e) => () => (e || n((e = { exports: {} }).exports, e), e.exports);
var h = (n, e, t) => Fe(n, typeof e != "symbol" ? e + "" : e, t);
var on = De((dn, j) => {
  var Ce = Object.defineProperty, o = (n, e) => Ce(n, "name", { value: e, configurable: !0 }), X = ((n) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(n, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : n)(function(n) {
    if (typeof require < "u") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + n + '" is not supported');
  }), Ue = (() => {
    for (var n = new Uint8Array(128), e = 0; e < 64; e++) n[e < 26 ? e + 65 : e < 52 ? e + 71 : e < 62 ? e - 4 : e * 4 - 205] = e;
    return (t) => {
      for (var r = t.length, s = new Uint8Array((r - (t[r - 1] == "=") - (t[r - 2] == "=")) * 3 / 4 | 0), a = 0, i = 0; a < r; ) {
        var d = n[t.charCodeAt(a++)], u = n[t.charCodeAt(a++)], l = n[t.charCodeAt(a++)], c = n[t.charCodeAt(a++)];
        s[i++] = d << 2 | u >> 4, s[i++] = u << 4 | l >> 2, s[i++] = l << 6 | c;
      }
      return s;
    };
  })();
  function Y(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }
  o(Y, "_isNumber");
  function b(n) {
    return n.charAt(0).toUpperCase() + n.substring(1);
  }
  o(b, "_capitalize");
  function L(n) {
    return function() {
      return this[n];
    };
  }
  o(L, "_getter");
  var x = ["isConstructor", "isEval", "isNative", "isToplevel"], N = ["columnNumber", "lineNumber"], S = ["fileName", "functionName", "source"], Me = ["args"], je = ["evalOrigin"], A = x.concat(N, S, Me, je);
  function f(n) {
    if (n) for (var e = 0; e < A.length; e++) n[A[e]] !== void 0 && this["set" + b(A[e])](n[A[e]]);
  }
  o(f, "StackFrame");
  f.prototype = { getArgs: o(function() {
    return this.args;
  }, "getArgs"), setArgs: o(function(n) {
    if (Object.prototype.toString.call(n) !== "[object Array]") throw new TypeError("Args must be an Array");
    this.args = n;
  }, "setArgs"), getEvalOrigin: o(function() {
    return this.evalOrigin;
  }, "getEvalOrigin"), setEvalOrigin: o(function(n) {
    if (n instanceof f) this.evalOrigin = n;
    else if (n instanceof Object) this.evalOrigin = new f(n);
    else throw new TypeError("Eval Origin must be an Object or StackFrame");
  }, "setEvalOrigin"), toString: o(function() {
    var n = this.getFileName() || "", e = this.getLineNumber() || "", t = this.getColumnNumber() || "", r = this.getFunctionName() || "";
    return this.getIsEval() ? n ? "[eval] (" + n + ":" + e + ":" + t + ")" : "[eval]:" + e + ":" + t : r ? r + " (" + n + ":" + e + ":" + t + ")" : n + ":" + e + ":" + t;
  }, "toString") };
  f.fromString = o(function(n) {
    var e = n.indexOf("("), t = n.lastIndexOf(")"), r = n.substring(0, e), s = n.substring(e + 1, t).split(","), a = n.substring(t + 1);
    if (a.indexOf("@") === 0) var i = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(a, ""), d = i[1], u = i[2], l = i[3];
    return new f({ functionName: r, args: s || void 0, fileName: d, lineNumber: u || void 0, columnNumber: l || void 0 });
  }, "StackFrame$$fromString");
  for (w = 0; w < x.length; w++) f.prototype["get" + b(x[w])] = L(x[w]), f.prototype["set" + b(x[w])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      this[n] = !!e;
    };
  })(x[w]);
  var w;
  for (E = 0; E < N.length; E++) f.prototype["get" + b(N[E])] = L(N[E]), f.prototype["set" + b(N[E])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      if (!Y(e)) throw new TypeError(n + " must be a Number");
      this[n] = Number(e);
    };
  })(N[E]);
  var E;
  for (k = 0; k < S.length; k++) f.prototype["get" + b(S[k])] = L(S[k]), f.prototype["set" + b(S[k])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      this[n] = String(e);
    };
  })(S[k]);
  var k, F = f;
  function Q() {
    var n = /^\s*at .*(\S+:\d+|\(native\))/m, e = /^(eval@)?(\[native code])?$/;
    return { parse: o(function(t) {
      if (t.stack && t.stack.match(n)) return this.parseV8OrIE(t);
      if (t.stack) return this.parseFFOrSafari(t);
      throw new Error("Cannot parse given Error object");
    }, "ErrorStackParser$$parse"), extractLocation: o(function(t) {
      if (t.indexOf(":") === -1) return [t];
      var r = /(.+?)(?::(\d+))?(?::(\d+))?$/, s = r.exec(t.replace(/[()]/g, ""));
      return [s[1], s[2] || void 0, s[3] || void 0];
    }, "ErrorStackParser$$extractLocation"), parseV8OrIE: o(function(t) {
      var r = t.stack.split(`
`).filter(function(s) {
        return !!s.match(n);
      }, this);
      return r.map(function(s) {
        s.indexOf("(eval ") > -1 && (s = s.replace(/eval code/g, "eval").replace(/(\(eval at [^()]*)|(,.*$)/g, ""));
        var a = s.replace(/^\s+/, "").replace(/\(eval code/g, "(").replace(/^.*?\s+/, ""), i = a.match(/ (\(.+\)$)/);
        a = i ? a.replace(i[0], "") : a;
        var d = this.extractLocation(i ? i[1] : a), u = i && a || void 0, l = ["eval", "<anonymous>"].indexOf(d[0]) > -1 ? void 0 : d[0];
        return new F({ functionName: u, fileName: l, lineNumber: d[1], columnNumber: d[2], source: s });
      }, this);
    }, "ErrorStackParser$$parseV8OrIE"), parseFFOrSafari: o(function(t) {
      var r = t.stack.split(`
`).filter(function(s) {
        return !s.match(e);
      }, this);
      return r.map(function(s) {
        if (s.indexOf(" > eval") > -1 && (s = s.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ":$1")), s.indexOf("@") === -1 && s.indexOf(":") === -1) return new F({ functionName: s });
        var a = /((.*".+"[^@]*)?[^@]*)(?:@)/, i = s.match(a), d = i && i[1] ? i[1] : void 0, u = this.extractLocation(s.replace(a, ""));
        return new F({ functionName: d, fileName: u[0], lineNumber: u[1], columnNumber: u[2], source: s });
      }, this);
    }, "ErrorStackParser$$parseFFOrSafari") };
  }
  o(Q, "ErrorStackParser");
  var Be = new Q(), qe = Be;
  function Z() {
    var i;
    if (typeof API < "u" && API !== globalThis.API) return API.runtimeEnv;
    let n = typeof Bun < "u", e = typeof Deno < "u", t = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser, r = typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") === -1 && navigator.userAgent.indexOf("Safari") > -1, s = typeof read == "function" && typeof load == "function", a = typeof navigator == "object" && ((i = navigator.userAgent) == null ? void 0 : i.includes("Cloudflare-Workers"));
    return ee({ IN_BUN: n, IN_DENO: e, IN_NODE: t, IN_SAFARI: r, IN_SHELL: s, IN_WORKERD: a });
  }
  o(Z, "getGlobalRuntimeEnv");
  var m = Z();
  function ee(n) {
    let e = n.IN_NODE && typeof j < "u" && j.exports && typeof X == "function" && typeof __dirname == "string", t = n.IN_NODE && !e, r = !n.IN_NODE && !n.IN_DENO && !n.IN_BUN, s = r && typeof window < "u" && typeof window.document < "u" && typeof document.createElement == "function" && "sessionStorage" in window && typeof globalThis.importScripts != "function", a = r && typeof globalThis.WorkerGlobalScope < "u" && typeof globalThis.self < "u" && globalThis.self instanceof globalThis.WorkerGlobalScope;
    if (a && ne()) throw new Error("Classic web workers are not supported");
    let i = { ...n, IN_BROWSER: r, IN_BROWSER_MAIN_THREAD: s, IN_BROWSER_WEB_WORKER: a, IN_NODE_COMMONJS: e, IN_NODE_ESM: t };
    if (!(i.IN_BROWSER_MAIN_THREAD || i.IN_BROWSER_WEB_WORKER || i.IN_NODE || i.IN_SHELL || i.IN_WORKERD)) throw new Error(`Cannot determine runtime environment: ${JSON.stringify(i)}`);
    return i;
  }
  o(ee, "calculateDerivedFlags");
  function ne() {
    try {
      return globalThis.importScripts("data:text/javascript,"), !0;
    } catch {
      return !1;
    }
  }
  o(ne, "isClassicWorker");
  var te, C, V, B;
  async function q() {
    if (!m.IN_NODE || (te = (await Promise.resolve().then(function() {
      return g;
    })).default, V = await Promise.resolve().then(function() {
      return g;
    }), B = await Promise.resolve().then(function() {
      return g;
    }), (await Promise.resolve().then(function() {
      return g;
    })).default, C = await Promise.resolve().then(function() {
      return g;
    }), J = C.sep, typeof X < "u")) return;
    let n = V, e = await Promise.resolve().then(function() {
      return g;
    }), t = await Promise.resolve().then(function() {
      return g;
    }), r = await Promise.resolve().then(function() {
      return g;
    }), s = { fs: n, crypto: e, ws: t, child_process: r };
    globalThis.require = function(a) {
      return s[a];
    };
  }
  o(q, "initNodeModules");
  function se(n, e) {
    return C.resolve(e || ".", n);
  }
  o(se, "node_resolvePath");
  function re(n, e) {
    return e === void 0 && (e = location), new URL(n, e).toString();
  }
  o(re, "browser_resolvePath");
  var I;
  m.IN_NODE ? I = se : m.IN_SHELL ? I = o((n) => n, "resolvePath") : I = re;
  var J;
  m.IN_NODE || (J = "/");
  function ae(n, e) {
    return n.startsWith("file://") && (n = n.slice(7)), n.includes("://") ? { response: fetch(n) } : { binary: B.readFile(n).then((t) => new Uint8Array(t.buffer, t.byteOffset, t.byteLength)) };
  }
  o(ae, "node_getBinaryResponse");
  function ie(n, e) {
    if (n.startsWith("file://") && (n = n.slice(7)), n.includes("://")) throw new Error("Shell cannot fetch urls");
    return { binary: Promise.resolve(new Uint8Array(readbuffer(n))) };
  }
  o(ie, "shell_getBinaryResponse");
  function oe(n, e) {
    let t = new URL(n, location);
    return { response: fetch(t, e ? { integrity: e } : {}) };
  }
  o(oe, "browser_getBinaryResponse");
  var T;
  m.IN_NODE ? T = ae : m.IN_SHELL ? T = ie : T = oe;
  async function le(n, e) {
    let { response: t, binary: r } = T(n, e);
    if (r) return r;
    let s = await t;
    if (!s.ok) throw new Error(`Failed to load '${n}': request failed.`);
    return new Uint8Array(await s.arrayBuffer());
  }
  o(le, "loadBinaryFile");
  var U;
  m.IN_NODE ? U = de : U = o(async (n) => await import(n), "loadScript");
  async function de(n) {
    return n.startsWith("file://") && (n = n.slice(7)), n.includes("://") ? await import(n) : await import(te.pathToFileURL(n).href);
  }
  o(de, "nodeLoadScript");
  async function ue(n) {
    if (m.IN_NODE) {
      await q();
      let e = await B.readFile(n, { encoding: "utf8" });
      return JSON.parse(e);
    } else if (m.IN_SHELL) {
      let e = read(n);
      return JSON.parse(e);
    } else return await (await fetch(n)).json();
  }
  o(ue, "loadLockFile");
  async function ce() {
    if (m.IN_NODE_COMMONJS) return __dirname;
    let n;
    try {
      throw new Error();
    } catch (r) {
      n = r;
    }
    let e = qe.parse(n)[0].fileName;
    if (m.IN_NODE && !e.startsWith("file://") && (e = `file://${e}`), m.IN_NODE_ESM) {
      let r = await Promise.resolve().then(function() {
        return g;
      });
      return (await Promise.resolve().then(function() {
        return g;
      })).fileURLToPath(r.dirname(e));
    }
    let t = e.lastIndexOf(J);
    if (t === -1) throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");
    return e.slice(0, t);
  }
  o(ce, "calculateDirname");
  function pe(n) {
    var e;
    return n.substring(0, n.lastIndexOf("/") + 1) || ((e = globalThis.location) == null ? void 0 : e.toString()) || ".";
  }
  o(pe, "calculateInstallBaseUrl");
  function _e(n) {
    let e = n.FS, t = n.FS.filesystems.MEMFS, r = n.PATH, s = { DIR_MODE: 16895, FILE_MODE: 33279, mount: o(function(a) {
      if (!a.opts.fileSystemHandle) throw new Error("opts.fileSystemHandle is required");
      return t.mount.apply(null, arguments);
    }, "mount"), syncfs: o(async (a, i, d) => {
      try {
        let u = s.getLocalSet(a), l = await s.getRemoteSet(a), c = i ? l : u, _ = i ? u : l;
        await s.reconcile(a, c, _), d(null);
      } catch (u) {
        d(u);
      }
    }, "syncfs"), getLocalSet: o((a) => {
      let i = /* @__PURE__ */ Object.create(null);
      function d(c) {
        return c !== "." && c !== "..";
      }
      o(d, "isRealDir");
      function u(c) {
        return (_) => r.join2(c, _);
      }
      o(u, "toAbsolute");
      let l = e.readdir(a.mountpoint).filter(d).map(u(a.mountpoint));
      for (; l.length; ) {
        let c = l.pop(), _ = e.stat(c);
        e.isDir(_.mode) && l.push.apply(l, e.readdir(c).filter(d).map(u(c))), i[c] = { timestamp: _.mtime, mode: _.mode };
      }
      return { type: "local", entries: i };
    }, "getLocalSet"), getRemoteSet: o(async (a) => {
      let i = /* @__PURE__ */ Object.create(null), d = await Je(a.opts.fileSystemHandle);
      for (let [u, l] of d) u !== "." && (i[r.join2(a.mountpoint, u)] = { timestamp: l.kind === "file" ? new Date((await l.getFile()).lastModified) : /* @__PURE__ */ new Date(), mode: l.kind === "file" ? s.FILE_MODE : s.DIR_MODE });
      return { type: "remote", entries: i, handles: d };
    }, "getRemoteSet"), loadLocalEntry: o((a) => {
      let i = e.lookupPath(a, {}).node, d = e.stat(a);
      if (e.isDir(d.mode)) return { timestamp: d.mtime, mode: d.mode };
      if (e.isFile(d.mode)) return i.contents = t.getFileDataAsTypedArray(i), { timestamp: d.mtime, mode: d.mode, contents: i.contents };
      throw new Error("node type not supported");
    }, "loadLocalEntry"), storeLocalEntry: o((a, i) => {
      if (e.isDir(i.mode)) e.mkdirTree(a, i.mode);
      else if (e.isFile(i.mode)) e.writeFile(a, i.contents, { canOwn: !0 });
      else throw new Error("node type not supported");
      e.chmod(a, i.mode), e.utime(a, i.timestamp, i.timestamp);
    }, "storeLocalEntry"), removeLocalEntry: o((a) => {
      var i = e.stat(a);
      e.isDir(i.mode) ? e.rmdir(a) : e.isFile(i.mode) && e.unlink(a);
    }, "removeLocalEntry"), loadRemoteEntry: o(async (a) => {
      if (a.kind === "file") {
        let i = await a.getFile();
        return { contents: new Uint8Array(await i.arrayBuffer()), mode: s.FILE_MODE, timestamp: new Date(i.lastModified) };
      } else {
        if (a.kind === "directory") return { mode: s.DIR_MODE, timestamp: /* @__PURE__ */ new Date() };
        throw new Error("unknown kind: " + a.kind);
      }
    }, "loadRemoteEntry"), storeRemoteEntry: o(async (a, i, d) => {
      let u = a.get(r.dirname(i)), l = e.isFile(d.mode) ? await u.getFileHandle(r.basename(i), { create: !0 }) : await u.getDirectoryHandle(r.basename(i), { create: !0 });
      if (l.kind === "file") {
        let c = await l.createWritable();
        await c.write(d.contents), await c.close();
      }
      a.set(i, l);
    }, "storeRemoteEntry"), removeRemoteEntry: o(async (a, i) => {
      await a.get(r.dirname(i)).removeEntry(r.basename(i)), a.delete(i);
    }, "removeRemoteEntry"), reconcile: o(async (a, i, d) => {
      let u = 0, l = [];
      Object.keys(i.entries).forEach(function(p) {
        let y = i.entries[p], v = d.entries[p];
        (!v || e.isFile(y.mode) && y.timestamp.getTime() > v.timestamp.getTime()) && (l.push(p), u++);
      }), l.sort();
      let c = [];
      if (Object.keys(d.entries).forEach(function(p) {
        i.entries[p] || (c.push(p), u++);
      }), c.sort().reverse(), !u) return;
      let _ = i.type === "remote" ? i.handles : d.handles;
      for (let p of l) {
        let y = r.normalize(p.replace(a.mountpoint, "/")).substring(1);
        if (d.type === "local") {
          let v = _.get(y), O = await s.loadRemoteEntry(v);
          s.storeLocalEntry(p, O);
        } else {
          let v = s.loadLocalEntry(p);
          await s.storeRemoteEntry(_, y, v);
        }
      }
      for (let p of c) if (d.type === "local") s.removeLocalEntry(p);
      else {
        let y = r.normalize(p.replace(a.mountpoint, "/")).substring(1);
        await s.removeRemoteEntry(_, y);
      }
    }, "reconcile") };
    n.FS.filesystems.NATIVEFS_ASYNC = s;
  }
  o(_e, "initializeNativeFS");
  var Je = o(async (n) => {
    let e = [];
    async function t(s) {
      for await (let a of s.values()) e.push(a), a.kind === "directory" && await t(a);
    }
    o(t, "collect"), await t(n);
    let r = /* @__PURE__ */ new Map();
    r.set(".", n);
    for (let s of e) {
      let a = (await n.resolve(s)).join("/");
      r.set(a, s);
    }
    return r;
  }, "getFsHandles"), We = Ue("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL"), Ge = (async function() {
    if (!(globalThis.navigator && (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints < "u" && navigator.maxTouchPoints > 1))) try {
      let n = await WebAssembly.compile(We);
      return await WebAssembly.instantiate(n);
    } catch (n) {
      if (n instanceof WebAssembly.CompileError) return;
      throw n;
    }
  })();
  async function fe() {
    let n = await Ge;
    if (n) return n.exports;
    let e = Symbol("error marker");
    return { Jsv_GetError_import: o(() => e, "Jsv_GetError_import"), JsvError_Check: o((t) => t === e, "JsvError_Check") };
  }
  o(fe, "getJsvErrorImport");
  function me(n) {
    let e = { config: n, runtimeEnv: m }, t = { noImageDecoding: !0, noAudioDecoding: !0, noWasmDecoding: !1, preRun: we(n), print: n.stdout, printErr: n.stderr, onExit(r) {
      t.exitCode = r;
    }, thisProgram: n._sysExecutable, arguments: n.args, API: e, locateFile: o((r) => n.indexURL + r, "locateFile"), instantiateWasm: Ee(n.indexURL) };
    return t;
  }
  o(me, "createSettings");
  function he(n) {
    return function(e) {
      let t = "/";
      try {
        e.FS.mkdirTree(n);
      } catch (r) {
        console.error(`Error occurred while making a home directory '${n}':`), console.error(r), console.error(`Using '${t}' for a home directory instead`), n = t;
      }
      e.FS.chdir(n);
    };
  }
  o(he, "createHomeDirectory");
  function ge(n) {
    return function(e) {
      Object.assign(e.ENV, n);
    };
  }
  o(ge, "setEnvironment");
  function ye(n) {
    return n ? [async (e) => {
      e.addRunDependency("fsInitHook");
      try {
        await n(e.FS, { sitePackages: e.API.sitePackages });
      } finally {
        e.removeRunDependency("fsInitHook");
      }
    }] : [];
  }
  o(ye, "callFsInitHook");
  function ve(n) {
    let e = n.HEAPU32[n._Py_Version >>> 2], t = e >>> 24 & 255, r = e >>> 16 & 255, s = e >>> 8 & 255;
    return [t, r, s];
  }
  o(ve, "computeVersionTuple");
  function be(n) {
    let e = le(n);
    return async (t) => {
      t.API.pyVersionTuple = ve(t);
      let [r, s] = t.API.pyVersionTuple;
      t.FS.mkdirTree("/lib"), t.API.sitePackages = `/lib/python${r}.${s}/site-packages`, t.FS.mkdirTree(t.API.sitePackages), t.addRunDependency("install-stdlib");
      try {
        let a = await e;
        t.FS.writeFile(`/lib/python${r}${s}.zip`, a);
      } catch (a) {
        console.error("Error occurred while installing the standard library:"), console.error(a);
      } finally {
        t.removeRunDependency("install-stdlib");
      }
    };
  }
  o(be, "installStdlib");
  function we(n) {
    let e;
    return n.stdLibURL != null ? e = n.stdLibURL : e = n.indexURL + "python_stdlib.zip", [be(e), he(n.env.HOME), ge(n.env), _e, ...ye(n.fsInit)];
  }
  o(we, "getFileSystemInitializationFuncs");
  function Ee(n) {
    if (typeof WasmOffsetConverter < "u") return;
    let { binary: e, response: t } = T(n + "pyodide.asm.wasm"), r = fe();
    return function(s, a) {
      return (async function() {
        let { Jsv_GetError_import: i, JsvError_Check: d } = await r;
        s.env.Jsv_GetError_import = i, s.env.JsvError_Check = d;
        try {
          let u;
          t ? u = await WebAssembly.instantiateStreaming(t, s) : u = await WebAssembly.instantiate(await e, s);
          let { instance: l, module: c } = u;
          a(l, c);
        } catch (u) {
          console.warn("wasm instantiation failed!"), console.warn(u);
        }
      })(), {};
    };
  }
  o(Ee, "getInstantiateWasmFunc");
  var $e = "314.0.2";
  function R(n) {
    return n === void 0 || n.endsWith("/") ? n : n + "/";
  }
  o(R, "withTrailingSlash");
  var M = $e;
  async function ke(n = {}) {
    var s, a;
    if (await q(), n.lockFileContents && n.lockFileURL) throw new Error("Can't pass both lockFileContents and lockFileURL");
    let e = n.indexURL || await ce();
    if (e = R(I(e)), n.packageBaseUrl = R(n.packageBaseUrl), n.cdnUrl = R(n.packageBaseUrl ?? `https://cdn.jsdelivr.net/pyodide/v${M}/full/`), !n.lockFileContents) {
      let i = n.lockFileURL ?? e + "pyodide-lock.json";
      n.lockFileContents = ue(i), n.packageBaseUrl ?? (n.packageBaseUrl = pe(i));
    }
    n.indexURL = e, n.packageCacheDir && (n.packageCacheDir = R(I(n.packageCacheDir)));
    let t = { jsglobals: globalThis, stdin: globalThis.prompt ? () => globalThis.prompt() : void 0, args: [], env: {}, packages: [], packageCacheDir: n.packageBaseUrl, enableRunUntilComplete: !0, checkAPIVersion: !0, BUILD_ID: "a4189f0fe3d610ecd603639c08596362b70a34b106c58c9a93486c22df4c89a5" }, r = Object.assign(t, n);
    return (s = r.env).HOME ?? (s.HOME = "/home/pyodide"), (a = r.env).PYTHONINSPECT ?? (a.PYTHONINSPECT = "1"), r;
  }
  o(ke, "initializeConfiguration");
  function xe(n) {
    let e = me(n), t = e.API;
    return t.lockFilePromise = Promise.resolve(n.lockFileContents), e;
  }
  o(xe, "createEmscriptenSettings");
  async function Ne(n) {
    if (n.createPyodideModule) return n.createPyodideModule;
    let e = `${n.indexURL}pyodide.asm.mjs`;
    return (await U(e)).default;
  }
  o(Ne, "loadWasmScript");
  async function Se(n, e) {
    if (!n._loadSnapshot) return;
    let t = await n._loadSnapshot, r = ArrayBuffer.isView(t) ? t : new Uint8Array(t);
    return e.noInitialRun = !0, e.INITIAL_MEMORY = r.length, r;
  }
  o(Se, "prepareSnapshot");
  async function Re(n, e) {
    let t = await n(e);
    if (e.exitCode !== void 0) throw new t.ExitStatus(e.exitCode);
    return t;
  }
  o(Re, "instantiatePyodideModule");
  function Ie(n, e) {
    let t = n.API;
    if (e.pyproxyToStringRepr && t.setPyProxyToStringMethod(!0), e.convertNullToNone && t.setCompatNullToNone(!0), e.toJsLiteralMap && t.setCompatToJsLiteralMap(!0), t.version !== M && e.checkAPIVersion) throw new Error(`Pyodide version does not match: '${M}' <==> '${t.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);
    n.locateFile = (r) => {
      throw r.endsWith(".so") ? new Error(`Failed to find dynamic library "${r}"`) : new Error(`Unexpected call to locateFile("${r}")`);
    };
  }
  o(Ie, "configureAPI");
  function Te(n, e, t) {
    let r = n.API, s;
    return e && (s = r.restoreSnapshot(e)), r.finalizeBootstrap(s, t._snapshotDeserializer);
  }
  o(Te, "bootstrapPyodide");
  async function Oe(n, e) {
    let t = n._api;
    return t.sys.path.insert(0, ""), t._pyodide.set_excepthook(), await t.packageIndexReady, t.initializeStreams(e.stdin, e.stdout, e.stderr), n;
  }
  o(Oe, "finalizeSetup");
  async function Pe(n = {}) {
    let e = await ke(n), t = xe(e), r = await Ne(e), s = await Se(e, t), a = await Re(r, t);
    Ie(a, e);
    let i = Te(a, s, e);
    return await Oe(i, e);
  }
  o(Pe, "loadPyodide");
  function Ve(n) {
    return n.crossOriginIsolated === !0 && typeof n.SharedArrayBuffer == "function" ? "isolated" : "compat";
  }
  var ze = `# The in-worker Python runtime, installed into Pyodide once at boot
# (bundled as a string via a Vite \`?raw\` import - see raw.d.ts). Implements
# per-job isolation (spec 6.2): fresh __main__ module dict per job,
# sys.modules snapshot/restore, FS staging under /mnt/blockpy with artifact
# diff-back (spec 7.5, LD-3x), scripted stdin, student-relative traceback
# line mapping (spec 6.3 - instructor answer_prefix lines are subtracted, as
# legacy Skulpt did), live stdout/stderr tee streaming, and opt-in
# sys.settrace tracing whose step counter doubles as the instruction limit
# (E3, spec 6.2).
import builtins
import contextlib
import io
import json
import linecache
import os
import sys
import traceback
import types
import warnings

MOUNT = '/mnt/blockpy'
# The grading pass's importable package for instructor files (pedal-env.py
# _INSTRUCTOR_PKG) - excluded from artifact diff-back.
INSTRUCTOR_PKG = '_instructor'
TRACE_STORAGE_CAP = 10000
# Modules that are never a job's own (LD-93): the standard library (by name
# - Pyodide ships it zipped, so __file__ prefixes are unreliable) and the
# Pyodide bridge modules the runtime itself imports (run_sync).
STDLIB_NAMES = frozenset(getattr(sys, 'stdlib_module_names', ())) | frozenset(
    sys.builtin_module_names
)
ENGINE_MODULES = frozenset(('pyodide', '_pyodide', 'js', 'pyodide_js'))
# Formatted traceback entries students must never see (format_error).
HARNESS_FRAME_PREFIXES = ('  File "<exec>"', '  File "<frozen _sitebuiltins>"')
# Pyodide tunes the recursion limit to the wasm stack at boot; remember it
# so the health canary scales to platforms with shallow stacks (§6.6).
BOOT_RECURSION_LIMIT = sys.getrecursionlimit()

# Plot capture (spec 10.2): headless Agg backend - figures are snapshotted
# into PNGs after each run instead of "shown". Set before matplotlib can be
# imported; silence Agg's "cannot be shown" warning from plt.show().
os.environ.setdefault('MPLBACKEND', 'Agg')
warnings.filterwarnings('ignore', message='.*non-interactive.*cannot be shown.*')


class TraceLimitError(Exception):
    pass


class _Tee(io.StringIO):
    """Accumulates output while forwarding each chunk to a JS callback."""

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def write(self, text):
        # JS null arrives as JsNull (not None) - guard on callability.
        if text and callable(self.callback):
            self.callback(text)
        return super().write(text)


class StudioRuntime:
    def __init__(self):
        self.baseline_modules = set(sys.modules)
        self.last_globals = None
        self.staged = {}

    # -- filesystem staging (spec 7.5) --------------------------------------

    @staticmethod
    def staged_path(name):
        """Resolve a staged file name under MOUNT, refusing escapes.

        Names come from the VFS (student-created file tabs, uploads): an
        empty name or one that normalizes outside the mount ('/etc/x',
        '../x') is a system error, never something to write blindly.
        """
        if not isinstance(name, str) or not name.strip():
            raise ValueError('Cannot stage a file with an empty name')
        path = os.path.normpath(os.path.join(MOUNT, name))
        if path == MOUNT or not path.startswith(MOUNT + '/'):
            raise ValueError(
                'Cannot stage ' + repr(name) + ': the name escapes the working directory'
            )
        return path

    def stage_files(self, files):
        # Validate every name BEFORE touching the disk so a bad name never
        # leaves a half-staged mount behind.
        paths = {name: self.staged_path(name) for name in files}
        os.makedirs(MOUNT, exist_ok=True)
        for root, dirs, names in os.walk(MOUNT, topdown=False):
            for name in names:
                os.remove(os.path.join(root, name))
            for d in dirs:
                os.rmdir(os.path.join(root, d))
        self.staged = dict(files)
        for name, contents in files.items():
            path = paths[name]
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(contents)
        os.chdir(MOUNT)

    def record_staged(self, path, contents):
        """Register a file the harness (not the student) wrote under MOUNT.

        The grading pass stages grader files into the working directory
        (pedal-env.py); without this they would diff back as run artifacts
        on the next console evaluation - leaking \`!on_run.py\` source.
        Paths outside the mount are ignored.
        """
        path = os.path.abspath(path)
        if path.startswith(MOUNT + '/'):
            self.staged[os.path.relpath(path, MOUNT).replace(os.sep, '/')] = contents

    def collect_artifacts(self):
        artifacts = {}
        for root, dirs, names in os.walk(MOUNT):
            if root == MOUNT and INSTRUCTOR_PKG in dirs:
                # The grader's import package is never a student artifact.
                dirs.remove(INSTRUCTOR_PKG)
            for name in names:
                path = os.path.join(root, name)
                rel = os.path.relpath(path, MOUNT).replace(os.sep, '/')
                try:
                    # newline='' keeps CR/LF byte-exact: universal-newlines
                    # reading would turn an untouched CRLF data file into a
                    # (normalised) "artifact" on every run.
                    with open(path, 'r', encoding='utf-8', newline='') as handle:
                        contents = handle.read()
                except (OSError, UnicodeDecodeError):
                    continue
                if self.staged.get(rel) != contents:
                    artifacts[rel] = contents
        return artifacts

    # -- per-job isolation (spec 6.2) ----------------------------------------

    def restore_modules(self):
        """Per-job module isolation (§6.2), scoped to what a job can own.

        Purged after every job: modules loaded from the mount (student and
        instructor files) and dynamic modules with no __file__ (the
        \`requests\` mock, exec-built modules). Kept - adopted into the
        baseline - are installed packages (loadPackage/micropip: expensive
        to re-initialize, matplotlib takes seconds; per-job figure state is
        reset by capture_figures/discard_figures), the engine's own modules,
        and the STDLIB (LD-93): purging stdlib modules while keeping
        site-packages tore the two apart - numpy's ABC registrations on
        \`numbers\` vanished on the second run, so \`Fraction(np.int64(3))\`
        worked once and then raised TypeError. A mount module shadowing a
        stdlib name (a student \`numbers.py\`) is still purged.
        """
        for name in list(sys.modules):
            if name in self.baseline_modules:
                continue
            module = sys.modules[name]
            file = getattr(module, '__file__', None) or ''
            if file.startswith(MOUNT + '/'):
                del sys.modules[name]
            elif '/site-packages/' in file or self.is_engine_or_stdlib(name):
                self.baseline_modules.add(name)
            else:
                del sys.modules[name]

    @staticmethod
    def is_engine_or_stdlib(name):
        top = name.partition('.')[0]
        return top in STDLIB_NAMES or top in ENGINE_MODULES

    # -- mock URLs (spec 10.4, legacy configurations.js openURL) -------------

    def install_requests_mock(self):
        """Install a per-job \`requests\` shim resolving \`?mock_urls.blockpy\`.

        Legacy parity: ALL url access goes through the mock table - the map
        is JSON \`{filename: [url, ...]}\`; a hit returns the staged file's
        contents, no map or an unknown url raises the legacy IOError texts
        (configurations.js:135-155). The module is dynamic (no __file__), so
        restore_modules purges it after every job.
        """
        mock_map = None
        raw = self.staged.get('mock_urls.blockpy')
        if raw is not None:
            try:
                mock_map = json.loads(raw)
            except Exception:  # noqa: BLE001 - bad JSON = no mocks (legacy)
                mock_map = None
        staged = self.staged

        class MockResponse:
            def __init__(self, text):
                self.text = text
                self.content = text.encode('utf-8')
                self.status_code = 200
                self.ok = True

            def json(self):
                return json.loads(self.text)

            def raise_for_status(self):
                return None

        def get(url, *args, **kwargs):
            if mock_map is None:
                raise OSError(
                    'Cannot access url: URL Data was not made available '
                    'for this assignment'
                )
            for filename, urls in mock_map.items():
                if url in urls:
                    contents = staged.get(filename)
                    if contents is None:
                        # Map keys use legacy prefixed names; staging is
                        # prefix-stripped.
                        contents = staged.get(filename.lstrip('!^?&$*#'))
                    if contents is None:
                        raise OSError('File not found: ' + filename)
                    return MockResponse(contents)
            raise OSError(
                'Cannot access url: ' + url +
                ' was not made available for this assignment'
            )

        module = types.ModuleType('requests')
        module.get = get
        module.Response = MockResponse
        sys.modules['requests'] = module

    # -- plot capture (spec 10.2) --------------------------------------------

    def capture_figures(self):
        """Snapshot every open matplotlib figure to base64 PNG, then close.

        Runs only when the student's code actually imported matplotlib.
        Fail-soft: a broken figure never breaks the run result.
        """
        if 'matplotlib' not in sys.modules:
            return []
        try:
            import base64
            import matplotlib.pyplot as plt
            images = []
            for number in plt.get_fignums():
                buffer = io.BytesIO()
                plt.figure(number).savefig(buffer, format='png')
                images.append(base64.b64encode(buffer.getvalue()).decode('ascii'))
            plt.close('all')
            return images
        except Exception:  # noqa: BLE001
            return []

    def discard_figures(self):
        """Close figures left over from an earlier job (LD-88).

        Every job captures (and closes) its own figures on exit, so this is
        the safety net for whatever escaped that: nothing drawn before a run
        may attach to the run's images.
        """
        if 'matplotlib' not in sys.modules:
            return
        try:
            import matplotlib.pyplot as plt
            plt.close('all')
        except Exception:  # noqa: BLE001
            pass

    # -- tracing (E3): step events + instruction limit ------------------------

    def make_tracer(self, target_filename, prefix_lines, step_limit, steps):
        state = {'count': 0}

        def snapshot_locals(frame):
            snapshot = {}
            for key, value in frame.f_locals.items():
                if key.startswith('__'):
                    continue
                try:
                    snapshot[key] = repr(value)[:120]
                except Exception:  # noqa: BLE001
                    snapshot[key] = '<unrepresentable>'
            return snapshot

        def tracer(frame, event, arg):
            if frame.f_code.co_filename != target_filename:
                return None
            state['count'] += 1
            if step_limit is not None and state['count'] > step_limit:
                raise TraceLimitError(
                    'Execution exceeded the configured limit of '
                    + str(step_limit) + ' steps'
                )
            if len(steps) < TRACE_STORAGE_CAP:
                step = {
                    'event': event,
                    'line': frame.f_lineno,
                    'student_line': frame.f_lineno - prefix_lines,
                }
                # 'line' fires BEFORE the line executes; 'return' fires as
                # the frame exits, so the module-level return carries the
                # final variable state (the trace explorer's last page).
                if event == 'line' or event == 'return':
                    step['locals'] = snapshot_locals(frame)
                steps.append(step)
            return tracer

        return tracer

    # -- execution ------------------------------------------------------------

    @staticmethod
    def can_suspend():
        """True when JSPI is available, so run_sync can suspend at input()."""
        try:
            from pyodide.ffi import can_run_sync
            return bool(can_run_sync())
        except Exception:  # noqa: BLE001 - non-Pyodide/no-JSPI hosts
            return False

    def make_input(self, inputs=None, on_input=None):
        """The builtins.input replacement shared by run() and evaluate().

        Queued inputs replay first (legacy Edit Queued Inputs); then the
        interactive line when the client wired one and JSPI can suspend;
        else the legacy EOFError. Pyodide's default stdin is never reached.
        """
        input_values = iter(inputs or [])
        interactive = callable(on_input) and self.can_suspend()

        def scripted_input(prompt=''):
            # The prompt echoes to stdout exactly as before.
            try:
                value = next(input_values)
            except StopIteration:
                value = None
            if value is not None:
                print(prompt, end='')
                return value
            if interactive:
                # Interactive input (spec §6.5): JSPI suspends this
                # synchronous call while the console shows a textbox. The
                # prompt is NOT echoed to stdout - the console's input line
                # displays (and then freezes with) it, legacy-style.
                from pyodide.ffi import run_sync
                try:
                    value = run_sync(on_input(str(prompt)))
                except Exception:  # noqa: BLE001 - the client answered EOF
                    value = None
                if value is None or not isinstance(value, str):
                    raise EOFError('No input available')
                return value
            print(prompt, end='')
            raise EOFError('No scripted input available')

        return scripted_input

    def run(self, code, filename='answer.py', prefix='', suffix='',
            inputs=None, mode='exec', extract_result=False,
            trace=False, trace_limit=None, on_stdout=None, on_stderr=None,
            allow_real_requests=False, on_input=None, retain_namespace=True):
        # answer_prefix/answer_suffix are concatenated around the student
        # code (legacy getStudentCode, blockpy.js:994-1005). A piece without
        # a trailing newline would fuse with the next line into a SyntaxError
        # (\`print(1)\` + suffix \`print(2)\`), so join on '\\n' where one is
        # missing (LD-95) and count prefix lines on the JOINED text (§6.3 mapping).
        prefix = prefix or ''
        suffix = suffix or ''
        if prefix and not prefix.endswith('\\n'):
            prefix += '\\n'
        if suffix and code and not code.endswith('\\n'):
            code += '\\n'
        full = prefix + code + suffix
        prefix_lines = prefix.count('\\n')
        # JS null arrives as JsNull (not None) - normalize scalar options.
        if not isinstance(trace_limit, int):
            trace_limit = None

        module = types.ModuleType('__main__')
        module.__dict__['__file__'] = filename
        scripted_input = self.make_input(inputs, on_input)

        # The executed source must exist as a REAL file under its compile
        # filename: Python 3.13+ recovers traceback source lines through
        # linecache (SyntaxError.text is no longer always carried), so a
        # synthetic filename yields line-less tracebacks. The staged map is
        # updated so artifact diff-back never reports the write itself.
        try:
            parent = os.path.dirname(filename)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(filename, 'w', encoding='utf-8') as handle:
                handle.write(full)
            self.staged[filename] = full
            # Same filename, new contents every run - drop stale cache
            # entries (MEMFS mtime granularity defeats checkcache).
            linecache.clearcache()
        except OSError:
            pass  # absolute/odd filenames: run anyway, tracebacks degrade

        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)
        steps = []
        old_input = builtins.input
        old_main = sys.modules.get('__main__')
        builtins.input = scripted_input
        sys.modules['__main__'] = module
        # Legacy parity (spec 10.4): requests resolves through the mock-urls
        # table, never the network - unless the allow_real_requests setting
        # is on (M3.5), in which case the REAL requests package (installed
        # host-side with pyodide-http patching) stays importable.
        # The real package, once installed, is adopted into baseline_modules
        # (restore_modules), so the mock written over sys.modules['requests']
        # would otherwise SURVIVE the job and shadow it for later
        # allow_real_requests runs - remember and put back whatever was there.
        had_requests = 'requests' in sys.modules
        old_requests = sys.modules.get('requests')
        if not allow_real_requests:
            self.install_requests_mock()
        error = None
        value = None
        self.discard_figures()
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                compiled = compile(full, filename, mode)
                if trace:
                    sys.settrace(
                        self.make_tracer(filename, prefix_lines, trace_limit, steps),
                    )
                try:
                    result = eval(compiled, module.__dict__)
                finally:
                    if trace:
                        sys.settrace(None)
                if mode == 'eval':
                    value = repr(result)
        except SystemExit as exc:
            error = self.format_exit(exc, filename, prefix_lines)
        except BaseException as exc:  # noqa: BLE001 - full error report needed
            error = self.format_error(exc, filename, prefix_lines)
        finally:
            # Snapshot plots BEFORE the module restore unloads matplotlib -
            # figures drawn before an error still surface (spec 10.2).
            images = self.capture_figures()
            builtins.input = old_input
            if old_main is not None:
                sys.modules['__main__'] = old_main
            if not allow_real_requests:
                if had_requests:
                    sys.modules['requests'] = old_requests
                else:
                    sys.modules.pop('requests', None)
            self.restore_modules()

        if error is None and extract_result and 'result' in module.__dict__:
            # quiz.preprocess: the harness serializes \`result\`, so a
            # non-serializable value is OUR failure to report as a system
            # error - not a TypeError pinned on the student's code.
            try:
                value = json.dumps(module.__dict__['result'])
            except (TypeError, ValueError) as exc:
                error = {
                    'type': 'SystemError',
                    'message': 'The preprocess \`result\` is not JSON-serializable: ' + str(exc),
                    'line': None,
                    'student_line': None,
                    'traceback': (
                        'SystemError: result is not JSON-serializable: ' + str(exc) + chr(10)
                    ),
                }
        # Only the student's run owns the console namespace: a quiz
        # preprocess / on_change job sharing this worker must not replace
        # the REPL globals the next console line evaluates against.
        if retain_namespace:
            self.last_globals = module.__dict__
        return {
            'error': error,
            'value': value,
            'stdout': stdout.getvalue(),
            'stderr': stderr.getvalue(),
            'trace': steps if trace else None,
            'images': images,
        }

    def evaluate(self, expression, on_stdout=None, on_stderr=None, on_input=None):
        """Persistent REPL bound to the last run's namespace (spec 6.4).

        Legacy parity (eval.js:10-17, LD-92): the console evaluated
        \`_ = <expr>\` with \`Sk.retainGlobals\`, so \`_\` names the last result
        and evaluations share one namespace even before the first run.
        """
        if self.last_globals is None:
            self.last_globals = {}
        target = self.last_globals
        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)
        error = None
        value = None
        # Same input model as run(): a console \`input()\` gets the
        # interactive line or the legacy EOFError, never Pyodide's stdin.
        old_input = builtins.input
        builtins.input = self.make_input(None, on_input)
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                compiled = compile(expression, 'evaluations', 'eval')
                result = eval(compiled, target)
                # CPython's REPL convention: None never rebinds \`_\`.
                if result is not None:
                    target['_'] = result
                value = repr(result)
        except SystemExit as exc:
            error = self.format_exit(exc, 'evaluations', 0)
        except BaseException as exc:  # noqa: BLE001
            error = self.format_error(exc, 'evaluations', 0)
        finally:
            # Figures a console expression drew belong to THIS evaluation
            # (LD-88) - without the snapshot they leaked into the next run.
            images = self.capture_figures()
            builtins.input = old_input
            self.restore_modules()
        return {
            'error': error,
            'value': value,
            'stdout': stdout.getvalue(),
            'stderr': stderr.getvalue(),
            'trace': None,
            'images': images,
        }

    def clear_namespace(self):
        self.last_globals = None

    # -- crash recovery (spec 6.6) ---------------------------------------------

    def stack_canary(self):
        """Probe wasm stack headroom after a job (§6.6 crash recovery).

        A stack-overflow fatal (unbounded recursion through C layers, e.g. a
        recursive __getattr__ - pyodide#5959/#5987) can leave the interpreter
        dead or with a corrupted stack pointer WITHOUT failing the job that
        caused it (grading fail-softs around it). On a healthy interpreter
        this probe returns instantly; on a poisoned one it triggers the
        fatal NOW, JS-side, where the worker host answers by reloading the
        runner - instead of the fatal landing on the student's next Run.
        """
        prev = sys.getrecursionlimit()
        depth = min(500, BOOT_RECURSION_LIMIT // 2)

        def probe(n):
            return probe(n - 1) if n else 0

        try:
            sys.setrecursionlimit(max(prev, depth * 4))
            return probe(depth)
        finally:
            sys.setrecursionlimit(prev)

    # -- error shaping (spec 6.3) ----------------------------------------------

    def format_exit(self, exc, filename, prefix_lines):
        """SystemExit shaping (LD-91): \`exit()\`/\`quit()\`/\`sys.exit()\`.

        CPython convention: a None/0 code is a clean stop (no error, output
        kept); any other code fails the run - a string code IS the message
        (CPython prints it to stderr), anything else reports the status.
        """
        code = exc.code
        if code is None or (isinstance(code, int) and code == 0):
            return None
        error = self.format_error(exc, filename, prefix_lines)
        error['message'] = (
            code if isinstance(code, str) else 'The program exited with status ' + repr(code)
        )
        return error

    def format_error(self, exc, filename, prefix_lines):
        line = None
        if isinstance(exc, SyntaxError) and exc.filename == filename:
            line = exc.lineno
        else:
            for frame, lineno in traceback.walk_tb(exc.__traceback__):
                if frame.f_code.co_filename == filename:
                    line = lineno
        # Students must never see the runtime harness frames. This module is
        # loaded via runPython (co_filename "<exec>"), so the caught exception
        # opens with our own run/evaluate frame - drop every leading harness
        # frame before formatting (the student's <module> frame comes right
        # after; a SyntaxError from compile() has ONLY harness frames and
        # formats fine with tb=None from its own attributes).
        tb = exc.__traceback__
        while tb is not None and tb.tb_frame.f_code.co_filename == '<exec>':
            tb = tb.tb_next
        parts = traceback.format_exception(type(exc), exc, tb)
        # Non-leading harness frames (e.g. the trace-limit tracer at the tail)
        # can't be dropped by the walk above - filter their formatted entries.
        # \`exit()\`/\`quit()\` add a \`<frozen _sitebuiltins>\` Quitter frame that
        # is not the student's code either (LD-91).
        formatted = ''.join(
            part for part in parts if not part.startswith(HARNESS_FRAME_PREFIXES)
        )
        student_line = None if line is None else line - prefix_lines
        return {
            'type': type(exc).__name__,
            'message': str(exc),
            'line': line,
            'student_line': student_line,
            'traceback': formatted,
        }


_studio_runtime = StudioRuntime()
`, He = `# The Pedal "blockpy environment" contract for Studio (spec 10.1) - a
# faithful port of the legacy instructor wrappers:
#   blockpy/src/engine/on_run.js   WRAP_INSTRUCTOR_CODE  (grading pass)
#   blockpy/src/engine/on_eval.js  WRAP_INSTRUCTOR_CODE  (console-eval pass)
# built on pedal.environments.blockpy.setup_environment, exactly like legacy:
# the environment supplies the HtmlFormatter, source verify, tifa (unless
# skipped), set_input, and the load-bearing start_trace -> run ordering
# (Spike S3) in one call.
#
# Ported wrapper behaviors: bakery student_tests.reset() per pass, the
# preloaded instructor namespace (parse_program + sandbox/core commands),
# skip_run (disable_instructor_run) / skip_tifa (disable_tifa) settings,
# pool-question seeding by submission id (LD-22 fixes the legacy
# order-of-operations bug that erased the seed), final.instructions /
# final.positives (with the else_message quirk) / final.systems extraction,
# and the on_eval pipeline: keep the last run's report + sandbox, clear the
# presented feedback, pedal \`evaluate\` the console expression, exec on_eval,
# re-resolve.
#
# File staging implements the legacy engine-virtual names (A1 section 3):
# instructor-owned files (!, ?, & prefixes) are staged prefix-stripped into
# the working directory AND (for .py files) into an _instructor package,
# because real graders do \`from _instructor.helpers import ...\` (verified
# against the bakery corpus).
import contextlib
import importlib
import io
import json
import linecache
import os
import shutil
import sys

_INSTRUCTOR_PKG = '_instructor'
_PREFIXES = '!^?&$*#'


class _StudioTee(io.TextIOBase):
    """Forwards the grader's own writes to a JS callback (LD-89).

    Legacy muted the printer during instructor runs and buffered instructor
    stdout for a dialog (instructor.js:20-22, 46-49, dialog.js:265); Studio
    streams it to the instructor dev console. JS null arrives as JsNull -
    guard on callability.
    """

    def __init__(self, callback):
        super().__init__()
        self.callback = callback

    def writable(self):
        return True

    def write(self, text):
        if text and callable(self.callback):
            self.callback(text)
        return len(text)


@contextlib.contextmanager
def _studio_capture(on_stdout, on_stderr):
    """Route the grading pass's OWN stdout/stderr to the dev console.

    Only the grader's prints land here: Pedal's sandbox swaps sys.stdout for
    its own capture while it re-runs the student code (sandbox.py:546,
    run.py:272-298), so the student's re-run output is captured exactly
    once - by Pedal, for get_output() - and never echoed again.
    """
    with contextlib.redirect_stdout(_StudioTee(on_stdout)), \\
            contextlib.redirect_stderr(_StudioTee(on_stderr)):
        yield


def _studio_patch_pedal_traceback():
    """Pedal 3.0.1 on Python 3.13+: SyntaxError feedback crashes.

    CPython renamed FrameSummary._line to _lines (3.13); pedal's
    _fix_frame_line writes the recovered source to \`_lines\`, but its own
    FakeFrame.line property still reads \`_line\` - so format_line receives
    None and dies in inject_line ("'NoneType' object has no attribute
    'split'"), turning EVERY student syntax error into an Internal Grading
    Error. Until the upstream fix ships (SERVER-TEAM/PEDAL FLAG: make
    FakeFrame honor the _lines rename + None-guard format_line's 3.13
    branch), patch FakeFrame.line to fall back _line -> _lines ->
    linecache (the grading staging below writes the REAL files linecache
    needs). Idempotent; safe on older pedals/pythons (pure fallback).
    """
    from pedal.utilities import exceptions as pedal_exceptions

    fake_frame = pedal_exceptions.FakeFrame
    if getattr(fake_frame, '_studio_patched', False):
        return

    def line(self):
        for value in (self._line, getattr(self, '_lines', None)):
            if isinstance(value, str):
                return value
        text = linecache.getline(self.filename or '', self.lineno or 0)
        return text.rstrip('\\n') if text else ''

    fake_frame.line = property(line)
    fake_frame._studio_patched = True


def _studio_patch_ast_legacy_nodes():
    """Python 3.14 removed ast.Num/Str/Bytes/NameConstant/Ellipsis (+ .n/.s).

    pedal 3.0.3 still tests \`isinstance(node, ast.Str)\` (types/normalize,
    tifa, type_definitions, ast_tools) and reads \`node.s\` / \`node.n\`.
    Its only guard, in pedal.types.normalize, is \`ast.Str = None\` when the
    attribute is missing - so \`isinstance(value, None)\` raises TypeError
    for every annotation that is not a bare name or constant: a student
    function annotated \`list[int]\` / \`list[list[int]]\` turned EVERY
    \`ensure_function(...)\` pass into an Internal Grading Error (bakery
    8B1.1 Zero Out Matrix). Reinstate the CPython 3.13 compatibility
    classes (an \`isinstance\` that inspects \`Constant.value\`, constructors
    that build a Constant) and the \`Constant.n\` / \`Constant.s\` aliases.
    Idempotent; a no-op where \`ast\` still provides them (<= 3.13). Until
    the upstream fix ships (SERVER-TEAM/PEDAL FLAG: \`ast.Constant\` +
    \`.value\` throughout, drop the \`ast.Str = None\` guard).
    """
    import ast

    constant = ast.Constant
    if isinstance(getattr(ast, 'Str', None), type) and hasattr(constant, 's'):
        return  # 3.13-: the stdlib still provides them (deprecated)

    const_types = {}
    const_types_not = {}

    class _LegacyConstantMeta(type):
        def __instancecheck__(cls, inst):
            if not isinstance(inst, constant):
                return False
            if cls in const_types:
                try:
                    value = inst.value
                except AttributeError:
                    return False
                return (isinstance(value, const_types[cls])
                        and not isinstance(value, const_types_not.get(cls, ())))
            return type.__instancecheck__(cls, inst)

    def _new(cls, *args, **kwargs):
        if cls in const_types:
            return constant(*args, **kwargs)
        return constant.__new__(cls, *args, **kwargs)

    class Num(constant, metaclass=_LegacyConstantMeta):
        _fields = ('n',)
        __new__ = _new

    class Str(constant, metaclass=_LegacyConstantMeta):
        _fields = ('s',)
        __new__ = _new

    class Bytes(constant, metaclass=_LegacyConstantMeta):
        _fields = ('s',)
        __new__ = _new

    class NameConstant(constant, metaclass=_LegacyConstantMeta):
        __new__ = _new

    class Ellipsis(constant, metaclass=_LegacyConstantMeta):
        _fields = ()

        def __new__(cls, *args, **kwargs):
            if cls is Ellipsis:
                return constant(..., *args, **kwargs)
            return constant.__new__(cls, *args, **kwargs)

    const_types.update({
        Num: (int, float, complex),
        Str: (str,),
        Bytes: (bytes,),
        NameConstant: (type(None), bool),
        Ellipsis: (type(...),),
    })
    const_types_not[Num] = (bool,)

    for legacy in (Num, Str, Bytes, NameConstant, Ellipsis):
        legacy.__doc__ = 'Deprecated AST node class. Use ast.Constant instead'
        legacy.__module__ = 'ast'
        if not isinstance(getattr(ast, legacy.__name__, None), type):
            setattr(ast, legacy.__name__, legacy)

    def _value_getter(self):
        return self.value

    def _value_setter(self, value):
        self.value = value

    for alias in ('n', 's'):
        if not hasattr(constant, alias):
            setattr(constant, alias, property(_value_getter, _value_setter))


_studio_patch_ast_legacy_nodes()


# Legacy \`get_model_info\` values for the current grading pass (assignment
# name, user name, ...), supplied by the client per request.
_STUDIO_MODEL_INFO = {}
# The console expression of the current on_eval pass (legacy get_evaluation).
_STUDIO_EVALUATION = ''
# The instructor namespace of the LAST on_run pass. Legacy ran on_eval with
# the on_run globals (on_eval.js:108 \`Sk.globals = execution.instructor.globals\`),
# so on_eval scripts use names on_run imported (\`ensure_function_call\`
# without any import of their own) - LD-132.
_STUDIO_INSTRUCTOR_NAMESPACE = None
# Lines the instructor \`!answer_prefix.py\` adds above the student's code in
# the graded program (legacy getStudentCode, blockpy.js:994-1005) - LD-133.
_STUDIO_PREFIX_LINES = 0


def _studio_install_utility_module():
    """The legacy \`utility\` instructor module (LD-131).

    Legacy BlockPy registered its Skulpt instructor module
    (sk_mod_instructor.js) as \`src/lib/utility\` and star-imported it into
    EVERY grader (on_run.js:32, on_eval.js:13) - so curriculum graders call
    \`console_debug\`, \`limit_execution_time\`, \`get_model_info\` without
    importing anything, and a few \`from utility import *\` explicitly. Each
    name maps onto the Pedal command that replaced it; the Skulpt-only ones
    (execution limits, scrolling, downloads, trace hooks) are no-ops, since
    Pyodide cannot preempt a running loop and the worker wall clock is the
    only guard. Idempotent; the module object is rebuilt only once.
    """
    import types

    if 'utility' in sys.modules and getattr(sys.modules['utility'], '_studio_shim', False):
        return

    def _dev_console(label, items):
        # Pedal's log/debug become \`system\` feedback the client already
        # routes to the instructor dev console (final.systems, on_run.js:90-95).
        # Not pedal's debug(): in 3.0.4 it drops positional items and emits
        # nothing for message= - build the muted system feedback directly.
        from pedal.core.commands import feedback
        from pedal.core.feedback import Feedback
        text = ' '.join(str(item) for item in items)
        feedback(message=text, label=label, category=Feedback.CATEGORIES.SYSTEM,
                 muted=True, valence=Feedback.NEUTRAL_VALENCE)

    def console_log(*items):
        _dev_console('log', items)

    def console_debug(*items):
        _dev_console('debug', items)

    def get_model_info(key, default=None):
        """\`assignment.name\`, \`user.name\`, ...: dotted lookup, flat keys too."""
        if key in _STUDIO_MODEL_INFO:
            return _STUDIO_MODEL_INFO[key]
        value = _STUDIO_MODEL_INFO
        for part in str(key).split('.'):
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return default
        return value

    def get_program(report=None):
        from pedal.core.report import MAIN_REPORT
        from pedal.source import get_program as pedal_get_program
        return pedal_get_program(report=report or MAIN_REPORT)

    def get_output(report=None):
        from pedal.core.report import MAIN_REPORT
        from pedal.sandbox.commands import get_output as pedal_get_output
        return pedal_get_output(report=report or MAIN_REPORT)

    def reset_output(report=None):
        from pedal.core.report import MAIN_REPORT
        from pedal.sandbox.commands import clear_output
        return clear_output(report=report or MAIN_REPORT)

    def get_evaluation():
        """The console expression of the current on_eval pass (legacy mod.get_evaluation)."""
        return _STUDIO_EVALUATION

    def get_plots(report=None):
        from pedal.core.report import MAIN_REPORT
        from pedal.extensions.plotting import get_plots as pedal_get_plots
        return pedal_get_plots(report=report or MAIN_REPORT)

    def start_trace(report=None):
        from pedal.core.report import MAIN_REPORT
        from pedal.sandbox.commands import start_trace as pedal_start_trace
        return pedal_start_trace(report=report or MAIN_REPORT)

    def limit_execution_time():
        """Skulpt swapped its execution limit around a run; nothing to do here."""

    def unlimit_execution_time():
        """See limit_execution_time."""

    def had_execution_time_error():
        return False

    def set_instructions(*_args, **_kwargs):
        """Legacy replaced the instructions pane; Pedal's resolver carries instructions now."""

    def _noop(*_args, **_kwargs):
        return None

    class timeit:
        """Legacy timing context manager; measures nothing here."""

        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

    module = types.ModuleType('utility', _studio_install_utility_module.__doc__)
    names = {
        'console_log': console_log,
        'console_debug': console_debug,
        'get_model_info': get_model_info,
        'get_program': get_program,
        'get_output': get_output,
        'reset_output': reset_output,
        'get_evaluation': get_evaluation,
        'get_plots': get_plots,
        'start_trace': start_trace,
        'limit_execution_time': limit_execution_time,
        'unlimit_execution_time': unlimit_execution_time,
        'had_execution_time_error': had_execution_time_error,
        'set_instructions': set_instructions,
        'timeit': timeit,
        # Skulpt-only hooks: accepted and ignored.
        'queue_input': _noop,
        'trace_lines': _noop,
        'trace_calls': _noop,
        'stop_trace': _noop,
        'get_student_error': _noop,
        'suppress_scrolling': _noop,
        'get_student_data': _noop,
        'clear_existing_student_imports': _noop,
        'download_file': _noop,
    }
    for name, value in names.items():
        setattr(module, name, value)
    module.__all__ = sorted(names)
    module._studio_shim = True
    sys.modules['utility'] = module


_studio_install_utility_module()


def _studio_safe_name(name, base):
    """Validate a prefix-stripped staging name: relative, inside the cwd.

    Raised errors surface as the job's PedalEnvironmentError (the runner
    wraps staging) - a clear system error instead of writing '/etc/x' or
    crashing on an empty key.
    """
    if not isinstance(base, str) or not base.strip():
        raise ValueError('Cannot stage a file with an empty name: ' + repr(name))
    cwd = os.getcwd()
    path = os.path.normpath(os.path.join(cwd, base))
    root = cwd.rstrip('/') + '/'
    if path == cwd or not path.startswith(root):
        raise ValueError(
            'Cannot stage ' + repr(name) + ': the name escapes the working directory'
        )
    return os.path.relpath(path, cwd)


def _studio_write_staged(path, contents):
    """Write one grading file and register it with the runtime's staged set.

    Everything the grading pass writes into the working directory (grader
    files, the _instructor package, the student-view sources) is harness
    output, not the student's: registering it keeps the next console
    evaluation's artifact diff-back (runtime.py collect_artifacts) from
    reporting \`!on_run.py\` source and grader helpers as run artifacts.
    """
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(contents)
    runtime = globals().get('_studio_runtime')
    if runtime is not None and hasattr(runtime, 'record_staged'):
        runtime.record_staged(path, contents)


def _studio_pedal_stage(files):
    if os.path.isdir(_INSTRUCTOR_PKG):
        shutil.rmtree(_INSTRUCTOR_PKG)
    _studio_write_staged(os.path.join(_INSTRUCTOR_PKG, '__init__.py'), '')
    for name, contents in files.items():
        # \`'' in _PREFIXES\` is True: an empty name must reach the
        # ValueError below, not IndexError from name[0].
        prefix = name[0] if isinstance(name, str) and name and name[0] in _PREFIXES else ''
        base = name[1:] if prefix else name
        if prefix in ('^', '$', '#'):
            continue  # never mounted for grading (A1: editor metadata/wire)
        base = _studio_safe_name(name, base)
        _studio_write_staged(base, contents)
        # The instructor-role staging view (vfs.stageFiles('instructor'))
        # arrives PREFIX-STRIPPED, so every .py it carries is instructor
        # space and must be importable as _instructor.<name>. Callers that
        # still pass prefixed names get the same treatment (the ^/$/# wire
        # names were skipped above).
        if base.endswith('.py'):
            _studio_write_staged(os.path.join(_INSTRUCTOR_PKG, base), contents)
    # fresh imports of _instructor.* each grading pass
    for module_name in list(sys.modules):
        if module_name == _INSTRUCTOR_PKG or module_name.startswith(_INSTRUCTOR_PKG + '.'):
            del sys.modules[module_name]
    # ...and of every module imported FROM the staging directory by an
    # earlier pass (student code's \`from hands import has_pair\`): the
    # interpreter is shared across assignments, so a neighbour's hands.py
    # was otherwise graded as this assignment's (LD-130). Mirrors the
    # per-run purge runtime.py does for student runs.
    stage_dir = os.getcwd().rstrip('/') + '/'
    for module_name, module in list(sys.modules.items()):
        file = getattr(module, '__file__', None) or ''
        if file.startswith(stage_dir):
            del sys.modules[module_name]
    importlib.invalidate_caches()


# The names legacy preloaded into the instructor script's namespace
# (on_run.js:33-36 / on_eval.js:15-18) - graders may use parse_program and
# the sandbox/core commands without importing them.
_INSTRUCTOR_PRELUDE = (
    # Legacy on_run.js:32 / on_eval.js:13: the instructor module first, so
    # Pedal's own commands shadow its delegating copies.
    'from utility import *\\n'
    'from pedal.cait.cait_api import parse_program\\n'
    'from pedal.sandbox.commands import *\\n'
    'from pedal.core.commands import *\\n'
)


def _studio_instructor_globals(student, student_code):
    from pedal.core.report import MAIN_REPORT
    namespace = {
        '__name__': '__main__',
        'student': student,
        'student_code': student_code,
        'MAIN_REPORT': MAIN_REPORT,
    }
    exec(compile(_INSTRUCTOR_PRELUDE, '<pedal prelude>', 'exec'), namespace)
    return namespace


def _studio_pedal_resolve():
    from pedal.core.report import MAIN_REPORT
    from pedal.resolvers.simple import resolve

    final = resolve(report=MAIN_REPORT)
    # Legacy countTestCases (feedback.js:341-368): tallies over ALL
    # considered feedback objects; category 'specification' = test cases,
    # inactive (condition not met) = success. bool(fb) is Pedal's
    # _met_condition, the same check Skulpt's isTrue performed. Pedal 3
    # files unmet feedback under ignored_feedback (legacy Pedal kept one
    # list), so the legacy iteration covers both.
    tests = feedback_count = successes = feedback_success = 0
    for fb in MAIN_REPORT.feedback + MAIN_REPORT.ignored_feedback:
        active = bool(fb)
        if str(fb.category) == 'specification':
            tests += 1
            if not active:
                successes += 1
        feedback_count += 1
        if not active:
            feedback_success += 1

    # Questions (on_run.js:74-76): the LAST instructions feedback replaces
    # the instructions pane (legacy set_instructions).
    instructions = None
    if final.instructions:
        instructions = str(final.instructions[-1].message)

    # Positive feedback (on_run.js:78-88), quirk preserved: an INACTIVE
    # positive presents its else_message.
    positives = []
    for positive in final.positives:
        message = positive.message
        if not positive:
            message = positive.else_message
        positives.append({
            'title': str(positive.title),
            'label': str(positive.label),
            'message': str(message),
        })

    # System messages (on_run.js:90-95): log/debug go to the dev console
    # (legacy console_log / console_debug).
    systems = []
    for system in final.systems:
        if str(system.label) in ('log', 'debug'):
            systems.append({
                'label': str(system.label),
                'title': str(system.title),
                'message': str(system.message),
            })

    # First error line (feedback.js:155-165 findFirstErrorLine reads
    # DATA['location'].line) - drives the editor-error-line highlight.
    line = None
    try:
        data = final.data
        location = data.get('location') if isinstance(data, dict) else None
        if location is not None:
            line = getattr(location, 'line', None)
        # The editor shows the student's own lines (§6.3): subtract the
        # instructor prefix the graded program carries (LD-133).
        if isinstance(line, int) and _STUDIO_PREFIX_LINES:
            line = line - _STUDIO_PREFIX_LINES if line > _STUDIO_PREFIX_LINES else None
    except Exception:  # noqa: BLE001 - highlight is best-effort
        line = None

    return {
        'unit_tests': {
            'tests': tests,
            'feedbacks': feedback_count,
            'successes': successes,
            'feedbackSuccess': feedback_success,
        },
        'success': bool(final.success),
        'score': final.score,
        'category': str(final.category),
        'label': str(final.label),
        'title': str(final.title),
        'message': str(final.message),
        # Legacy HIDE global (on_run.js:73): suppresses correctness
        # display AND gates markCorrect in the submission POST (14.3).
        'hide_correctness': bool(final.hide_correctness),
        'instructions': instructions,
        'positives': positives,
        'systems': systems,
        'line': line,
    }


def _studio_fail_soft():
    # Grader or Pedal-internal crash (e.g. Pedal 3.0.1's syntax-error
    # formatter breaks on Python 3.14 when SyntaxError.text is None -
    # see docs/appendices/skulpt-compat.md). Surface a renderable
    # system-error feedback instead of killing the run; the client logs
    # it as X-System.Error (legacy pathway).
    import traceback as _tb
    return {
        'success': False,
        'score': 0,
        'category': 'system',
        'label': 'internal_error',
        'title': 'Internal Grading Error',
        'message': 'The grading script failed to run. '
                   'Please report this to your instructor.',
        'system_error': _tb.format_exc(),
    }


def _studio_staged_text(staged, name):
    """A staged instructor file by bare name, whichever prefix it arrived with."""
    for key in ('!' + name, '?' + name, '&' + name, name):
        value = staged.get(key)
        if isinstance(value, str) and value:
            return value
    return ''


def _studio_compose_answer(code, prefix, suffix):
    """Legacy getStudentCode (blockpy.js:994-1005): \`!answer_prefix.py\` +
    the student's code + \`!answer_suffix.py\` is what BOTH the student run
    and the grader saw as answer.py (instructor.js:69). Joined on newlines
    like runtime.py (LD-95) so pieces never fuse into a SyntaxError.
    Returns the program and the number of prefix lines."""
    if prefix and not prefix.endswith('\\n'):
        prefix += '\\n'
    if suffix and code and not code.endswith('\\n'):
        code += '\\n'
    return prefix + code + suffix, prefix.count('\\n')


def _studio_set_model_info(model_info):
    _STUDIO_MODEL_INFO.clear()
    if isinstance(model_info, dict):
        _STUDIO_MODEL_INFO.update(model_info)


def _studio_submission_files(student_code, student_files):
    """The Pedal Submission's file view + main code for one grading pass.

    The submission carries the STUDENT-visible files: answer.py + chomped
    ?/& instructor extras + student extras (legacy getAllStudentFiles,
    instructor.js:69-83). \`student_code\` normally IS answer.py; when it
    arrives empty (a \`disable_student_run\` run executed a blank program,
    run.js:9-11) the staged answer.py is the real submission - legacy
    graded getAllStudentFiles, never the blanked program.
    """
    student_files = dict(student_files or {})
    staged_answer = student_files.get('answer.py')
    if not student_code and isinstance(staged_answer, str) and staged_answer:
        student_code = staged_answer
    student_files['answer.py'] = student_code
    return student_code, student_files


def _studio_write_sources(student_files, on_run):
    """Real source files for every compiled name (Python 3.13+ linecache).

    Traceback/SyntaxError source lines are recovered through linecache, so
    grading against purely-synthetic filenames loses the offending line
    (and the FakeFrame patch above falls back to linecache). Written AFTER
    the instructor staging so answer.py always carries THIS pass's
    student code.
    """
    for _name, _contents in list(student_files.items()) + [('on_run.py', on_run)]:
        try:
            # Same hardening as _studio_pedal_stage: an empty name or
            # one escaping the working directory is never written.
            _studio_write_staged(_studio_safe_name(_name, _name), _contents)
        except (OSError, TypeError, ValueError):
            pass  # odd names/contents: grading proceeds, lines degrade
    linecache.clearcache()


def _studio_pedal_grade(student_code, on_run, files_json, inputs, options_json,
                        on_stdout=None, on_stderr=None):
    with _studio_capture(on_stdout, on_stderr):
        return _studio_pedal_grade_captured(
            student_code, on_run, files_json, inputs, options_json)


def _studio_pedal_grade_captured(student_code, on_run, files_json, inputs, options_json):
    from pedal.core.report import MAIN_REPORT

    _studio_patch_pedal_traceback()
    _studio_patch_ast_legacy_nodes()
    # runtime.py's per-run purge drops modules without a file (student runs
    # between grading passes): reinstall the utility module each pass.
    _studio_install_utility_module()
    MAIN_REPORT.clear()
    options = json.loads(options_json) if options_json else {}
    _studio_set_model_info(options.get('model_info'))
    global _STUDIO_EVALUATION, _STUDIO_INSTRUCTOR_NAMESPACE, _STUDIO_PREFIX_LINES
    _STUDIO_EVALUATION = ''
    staged_files = json.loads(files_json) if files_json else {}
    _studio_pedal_stage(staged_files)

    try:
        # bakery's module-level student_tests ledger lives in site-packages
        # and survives across runs - legacy reset it every grading pass
        # (on_run.js:30-31). Optional: bakery may not be installed.
        try:
            from bakery import student_tests
            student_tests.reset()
        except Exception:  # noqa: BLE001
            pass

        skip_run = bool(options.get('skip_run'))
        skip_tifa = bool(options.get('skip_tifa'))
        # Legacy: no inputs at all when the student run is skipped
        # (on_run.js:40-41).
        run_inputs = None if skip_run else list(inputs or [])

        # The instructor staging view lives on DISK (open() + _instructor
        # imports); the submission gets the student view.
        student_code, student_files = _studio_submission_files(
            student_code, options.get('student_files'))
        # The graded program is prefix + answer + suffix (LD-133).
        student_code, _STUDIO_PREFIX_LINES = _studio_compose_answer(
            student_code,
            _studio_staged_text(staged_files, 'answer_prefix.py'),
            _studio_staged_text(staged_files, 'answer_suffix.py'))
        student_files['answer.py'] = student_code
        _studio_write_sources(student_files, on_run)

        # setup_environment = BlockPyEnvironment: HtmlFormatter + verify +
        # (unless skipped) tifa + set_input + start_trace -> run, exactly
        # the legacy pipeline (on_run.js:38-53).
        from pedal.environments.blockpy import setup_environment
        env = setup_environment(
            files=student_files,
            main_file='answer.py',
            main_code=student_code,
            skip_tifa=skip_tifa,
            skip_run=skip_run,
            inputs=run_inputs,
            report=MAIN_REPORT,
        )

        # Pool-question seed = submission id (on_run.js:43-45). LEGACY BUG
        # FIXED (ledger LD-22): legacy called set_seed BEFORE
        # setup_environment, whose report.clear() erased the stored seed
        # (report['questions']['seed']) - pools were never actually seeded.
        # Seeding AFTER setup makes it stick.
        seed = options.get('seed')
        if seed is not None and seed != '':
            try:
                from pedal.questions import set_seed
                # Legacy seeded with str(submission.id), which Pedal HASHES
                # into the question index; an int seed indexes the pool
                # directly (choices[seed % len]) - what the conformance
                # suite uses to enumerate a pedal.questions pool.
                set_seed(seed if isinstance(seed, int) and not isinstance(seed, bool) else str(seed))
            except Exception:  # noqa: BLE001
                pass

        student = env.fields['student']
        namespace = _studio_instructor_globals(student, student_code)
        _STUDIO_INSTRUCTOR_NAMESPACE = namespace
        exec(compile(on_run, 'on_run.py', 'exec'), namespace)
        return _studio_pedal_resolve()
    except BaseException:  # noqa: BLE001 - grading must fail soft
        return _studio_fail_soft()


def _studio_pedal_evaluate(evaluation, on_eval, options_json, on_stdout=None, on_stderr=None):
    with _studio_capture(on_stdout, on_stderr):
        return _studio_pedal_evaluate_captured(evaluation, on_eval, options_json)


def _studio_pedal_evaluate_captured(evaluation, on_eval, options_json):
    # Console-evaluation grading (on_eval.js): KEEP the last grading pass's
    # report and sandbox; clear the presented feedback (legacy "backed up"
    # MAIN_REPORT.feedback into a local it never read again - the effective
    # behavior is a plain clear, on_eval.js:20-24); pedal-\`evaluate\` the
    # console expression inside the student's sandbox; exec the instructor's
    # on_eval script; re-resolve.
    from pedal.core.report import MAIN_REPORT

    options = json.loads(options_json) if options_json else {}
    _studio_set_model_info(options.get('model_info'))
    global _STUDIO_EVALUATION
    _STUDIO_EVALUATION = evaluation
    _studio_patch_pedal_traceback()
    _studio_patch_ast_legacy_nodes()
    # runtime.py's per-run purge drops modules without a file (student runs
    # between grading passes): reinstall the utility module each pass.
    _studio_install_utility_module()
    try:
        MAIN_REPORT.feedback.clear()
        # Suppressed feedback is presented too (the resolver walks it) -
        # leaving the last pass's entries would bleed into this one.
        getattr(MAIN_REPORT, 'ignored_feedback', []).clear()
        from pedal.sandbox.commands import evaluate, get_sandbox
        student = get_sandbox(report=MAIN_REPORT)
        evaluate(evaluation, report=MAIN_REPORT)
        # Legacy on_eval ran in the on_run pass's globals (LD-132): keep
        # everything the grader imported or defined, refresh the prelude.
        if _STUDIO_INSTRUCTOR_NAMESPACE is not None:
            namespace = dict(_STUDIO_INSTRUCTOR_NAMESPACE)
            namespace['student'] = student
            namespace['student_code'] = evaluation
            exec(compile(_INSTRUCTOR_PRELUDE, '<pedal prelude>', 'exec'), namespace)
        else:
            namespace = _studio_instructor_globals(student, evaluation)
        exec(compile(on_eval, 'on_eval.py', 'exec'), namespace)
        return _studio_pedal_resolve()
    except BaseException:  # noqa: BLE001 - grading must fail soft
        return _studio_fail_soft()
`;
  const Ke = [
    "import os",
    "os.environ.setdefault('DRAFTER_SKIP', '1')",
    "for _mock in ('watchfiles', 'uvicorn', 'typer', 'shellingham', 'annotated-doc', 'starlette', 'rich'):",
    "    try:",
    "        micropip.add_mock_package(_mock, '0.0.0')",
    "    except Exception:",
    "        pass"
  ].join(`
`) + `
`, Ae = ["pedal>=3.0.4", "curriculum-sneks", "bakery"];
  function Xe(n) {
    return {
      ...n,
      score: n.score ?? 0,
      instructions: n.instructions ?? null,
      line: n.line ?? null
    };
  }
  const z = (n) => {
    const e = Xe(n.toJs({ dict_converter: Object.fromEntries }));
    return n.destroy(), e;
  };
  class W {
    constructor(e, t) {
      this.grade_ = e, this.evaluate_ = t;
    }
    /**
     * Install wheels (micropip) and the environment module. Call once per
     * interpreter; grading calls are then synchronous and isolated per call
     * via MAIN_REPORT.clear() (verified in Spike S3).
     */
    static async install(e, t = Ae) {
      await e.loadPackage("micropip");
      const r = t.some((i) => /^drafter\b/.test(i));
      await e.runPythonAsync(
        `import micropip
${r ? Ke : ""}await micropip.install(${JSON.stringify(t)})`
      ), e.runPython(He);
      const s = e.globals.get("_studio_pedal_grade"), a = e.globals.get("_studio_pedal_evaluate");
      return new W(s, a);
    }
    grade(e, t = {}) {
      return z(
        this.grade_(
          e.studentCode,
          e.onRun,
          JSON.stringify(e.files ?? {}),
          e.inputs ?? [],
          JSON.stringify({
            skip_tifa: e.skipTifa ?? !1,
            skip_run: e.skipRun ?? !1,
            seed: e.seed ?? null,
            student_files: e.studentFiles ?? {},
            model_info: e.modelInfo ?? {}
          }),
          t.onStdout ?? null,
          t.onStderr ?? null
        )
      );
    }
    /**
     * Console-eval grading (on_eval.js): runs against the LAST grade()'s
     * report/sandbox in this interpreter - call only after a grading pass.
     */
    evaluateGrade(e, t = {}) {
      return z(
        this.evaluate_(
          e.evaluation,
          e.onEval,
          JSON.stringify({ model_info: e.modelInfo ?? {} }),
          t.onStdout ?? null,
          t.onStderr ?? null
        )
      );
    }
  }
  const Ye = () => typeof WebAssembly.Suspending == "function", H = (n) => {
    const e = n.toJs({ dict_converter: Object.fromEntries });
    return n.destroy(), e;
  };
  function Qe(n) {
    var t, r;
    const e = [
      // Joined the way runtime.py run() executes them (LD-95): a newline
      // between pieces that lack one, so a prefix without a trailing newline
      // does not fuse with the student's first line and hide every import.
      Ze(n.answerPrefix ?? "", n.code, n.answerSuffix ?? ""),
      ...Object.entries(n.files).filter(([s]) => s.endsWith(".py")).map(([, s]) => s),
      ((t = n.pedal) == null ? void 0 : t.onRun) ?? "",
      ((r = n.pedal) == null ? void 0 : r.evaluation) ?? ""
    ];
    return [...new Set(e.filter((s) => s.trim() !== ""))];
  }
  function Ze(...n) {
    return n.reduce(
      (e, t) => t === "" || e === "" || e.endsWith(`
`) ? e + t : `${e}
${t}`
    );
  }
  class G {
    constructor(e, t) {
      h(this, "runtime");
      h(this, "pedalEnv", null);
      /** Wheel specs already installed into this interpreter (ensurePedal). */
      h(this, "pedalPackages", /* @__PURE__ */ new Set());
      h(this, "realRequestsReady", !1);
      this.pyodide = e, this.runtime = t;
    }
    /** Install the runtime module into a loaded Pyodide instance. */
    static create(e) {
      e.runPython(ze);
      const t = e.globals.get("_studio_runtime");
      return new G(e, t);
    }
    /** Clear the retained REPL namespace (legacy: cleared on new runs). */
    clearNamespace() {
      this.runtime.clear_namespace();
    }
    /**
     * Post-job stack probe (§6.6 crash recovery): false means the interpreter
     * is dead (a prior fatal) or its stack is poisoned (a stack-overflow
     * fatal survived by a fail-soft catch - the canary triggers the deferred
     * fatal here, inside this try, instead of on the next job).
     */
    healthCheck() {
      try {
        return this.runtime.stack_canary(), !0;
      } catch {
        return !1;
      }
    }
    /**
     * Real-network `requests` (M3.5, `allow_real_requests` setting): install
     * requests + pyodide-http once and patch urllib/requests onto browser
     * fetch. The runtime skips its mock when the job carries the flag; the
     * installed package lives in site-packages, so the per-job module restore
     * adopts it into the baseline like matplotlib.
     */
    async ensureRealRequests() {
      if (this.realRequestsReady) return;
      const e = this.pyodide;
      await e.loadPackage("micropip"), await e.runPythonAsync(
        `import micropip
await micropip.install(['requests', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()`
      ), this.realRequestsReady = !0;
    }
    /**
     * Fetch the Pyodide packages a job's sources import (numpy, matplotlib,
     * …). One call per source: Pyodide parses each with `ast`, so a syntax
     * error in one piece (the student's broken program) must not hide the
     * imports of another (the grader). Fail-soft: offline/unknown imports
     * surface as the natural Python ModuleNotFoundError instead of a
     * transport error.
     */
    async loadImports(e) {
      const t = this.pyodide.loadPackagesFromImports;
      if (t)
        for (const r of Qe(e))
          try {
            await t.call(this.pyodide, r);
          } catch {
          }
    }
    /**
     * Lazy Pedal environment - wheels install on the first grading job. The
     * install is keyed on the package list: a later job asking for wheels
     * this interpreter has not seen yet (a different assignment's
     * `pedal.packages`) installs the missing ones instead of silently
     * grading with the first job's set.
     */
    async ensurePedal(e) {
      const t = e ?? Ae, r = t.filter((s) => !this.pedalPackages.has(s));
      if (this.pedalEnv === null || r.length > 0) {
        this.pedalEnv = await W.install(
          this.pyodide,
          this.pedalEnv === null ? t : r
        );
        for (const s of t) this.pedalPackages.add(s);
      }
      return this.pedalEnv;
    }
    /**
     * Pedal grading job (spec §10.1): the environment re-runs the student
     * submission inside Pedal's sandbox, so no exec happens here. Grader and
     * Pedal crashes are fail-soft inside the environment (`system_error`
     * feedback); only wheel-install failures surface as job errors.
     */
    async executePedal(e, t, r) {
      var u;
      const s = e.pedal;
      let a = "", i = "";
      const d = {
        onStdout: (l) => {
          var c;
          a += l, (c = r.onStdout) == null || c.call(r, l);
        },
        onStderr: (l) => {
          var c;
          i += l, (c = r.onStderr) == null || c.call(r, l);
        }
      };
      try {
        await this.loadImports(e);
        const l = await this.ensurePedal(s.packages);
        (u = r.onStarted) == null || u.call(r);
        const c = s.evaluation !== void 0 ? (
          // on_eval pipeline (on_eval.js): reuses the last grading
          // pass's report/sandbox - no staging, no student re-run.
          l.evaluateGrade(
            {
              evaluation: s.evaluation,
              onEval: s.onRun,
              modelInfo: s.modelInfo
            },
            d
          )
        ) : l.grade(
          {
            studentCode: e.code,
            onRun: s.onRun,
            files: e.files,
            inputs: s.inputs ?? e.inputsPrefill,
            studentFiles: s.studentFiles,
            skipTifa: s.skipTifa,
            skipRun: s.skipRun,
            seed: s.seed,
            modelInfo: s.modelInfo
          },
          d
        );
        return {
          jobId: e.id,
          success: !0,
          stdout: a,
          stderr: i,
          artifacts: {},
          feedback: c,
          durationMs: Date.now() - t
        };
      } catch (l) {
        const c = l instanceof Error ? l.message : String(l);
        return {
          jobId: e.id,
          success: !1,
          stdout: a,
          stderr: i,
          error: {
            type: "PedalEnvironmentError",
            message: c,
            line: null,
            studentLine: null,
            traceback: c + `
`
          },
          artifacts: {},
          durationMs: Date.now() - t
        };
      }
    }
    async execute(e, t = {}) {
      var v, O, $;
      const r = Date.now();
      if (e.pedal)
        return this.executePedal(e, r, t);
      if (await this.loadImports(e), e.allowRealRequests)
        try {
          await this.ensureRealRequests();
        } catch {
        }
      if (e.warmPedal)
        try {
          await this.ensurePedal();
        } catch {
        }
      const s = e.phase === "student.eval" || e.phase === "instructor.on_eval";
      s || this.pyodide.runPython(
        `_studio_runtime.stage_files(__import__('json').loads(${JSON.stringify(
          JSON.stringify(e.files)
        )}))`
      );
      const a = t.onStdout ?? null, i = t.onStderr ?? null, d = (e.interactiveInput ? t.onInput : void 0) ?? null, u = [
        e.code,
        e.filename ?? "answer.py",
        e.answerPrefix ?? "",
        e.answerSuffix ?? "",
        e.inputsPrefill ?? [],
        "exec",
        e.phase === "quiz.preprocess",
        e.trace ?? !1,
        ((v = e.limits) == null ? void 0 : v.traceSteps) ?? null,
        a,
        i,
        e.allowRealRequests ?? !1,
        d,
        // The REPL namespace (§6.4) follows the student's run only.
        e.phase === "student.run"
      ], [l, c] = s ? [this.runtime.evaluate, [e.code, a, i, d]] : [this.runtime.run, u], _ = l;
      (O = t.onStarted) == null || O.call(t);
      const p = H(
        d !== null && Ye() && typeof _.callPromising == "function" ? await _.callPromising(...c) : _(...c)
      ), y = H(this.runtime.collect_artifacts());
      return {
        jobId: e.id,
        // pyodide's toJs maps Python None to undefined (not null): normalize
        // here so the wire carries the `null` the EngineError type promises.
        success: !p.error,
        stdout: p.stdout,
        stderr: p.stderr,
        error: p.error ? {
          type: p.error.type,
          message: p.error.message,
          line: p.error.line ?? null,
          studentLine: p.error.student_line ?? null,
          traceback: p.error.traceback
        } : void 0,
        value: p.value ?? void 0,
        trace: p.trace ? p.trace.map((P) => ({
          event: P.event,
          line: P.line,
          studentLine: P.student_line,
          locals: P.locals
        })) : void 0,
        images: ($ = p.images) != null && $.length ? p.images : void 0,
        artifacts: y,
        durationMs: Date.now() - r
      };
    }
  }
  const en = /call stack|stack overflow|fatally failed/i, nn = "The Python engine crashed - this usually means unbounded recursion (a function calling itself forever). The engine has been restarted; check your code and run again.", K = () => {
  }, D = (n) => n instanceof Error ? n.message : String(n), tn = (n) => {
    const e = n.split(`
`).filter((t) => t.trim() !== "");
    return e.length > 0 ? e[e.length - 1].trim() : n;
  };
  class sn {
    constructor(e) {
      h(this, "runner", null);
      h(this, "interrupted", /* @__PURE__ */ new Set());
      /** Per-job settlers for the in-flight interactive input() request. */
      h(this, "pendingInputs", /* @__PURE__ */ new Map());
      /** Remembered from 'init' so crash/restart reloads hit the same base. */
      h(this, "indexURL");
      /**
       * Serializes init/run/restart handling. Without this, a job posted while
       * a crash reload is in flight would execute against the dead interpreter
       * (worker onmessage fires handle() fire-and-forget). input-response and
       * interrupt bypass the chain - a queued run job AWAITS input-response,
       * so serializing those would deadlock.
       */
      h(this, "chain", Promise.resolve());
      this.options = e;
    }
    handle(e) {
      switch (e.kind) {
        case "interrupt":
          return this.interrupted.add(e.jobId), Promise.resolve();
        case "input-response": {
          const t = this.pendingInputs.get(e.jobId);
          return this.pendingInputs.delete(e.jobId), t && (e.eof ? t.reject(new Error("No input available")) : t.resolve(e.value)), Promise.resolve();
        }
        default: {
          const t = this.chain.then(() => this.process(e));
          return this.chain = t.then(K, K), t;
        }
      }
    }
    async process(e) {
      switch (e.kind) {
        case "init": {
          this.indexURL = e.indexURL, await this.loadFresh();
          return;
        }
        case "run": {
          await this.runJob(e.job);
          return;
        }
        case "restart-kernel": {
          this.interrupted.clear(), await this.loadFresh();
          return;
        }
      }
    }
    /**
     * Boot ('init') / reboot ('restart-kernel'). A load failure (offline
     * CDN, wrong indexURL) is reported as 'init-error' rather than thrown:
     * the worker stays responsive and every job resolves as an EngineError
     * until a later restart succeeds.
     */
    async loadFresh() {
      try {
        this.runner = await this.options.loadRunner(this.indexURL);
      } catch (e) {
        this.runner = null, this.options.post({ kind: "init-error", error: D(e) });
        return;
      }
      this.options.post({ kind: "ready", mode: this.options.mode });
    }
    /**
     * Replace a dead/poisoned interpreter with a fresh one. The client is
     * told FIRST, synchronously, before the load even starts: installed
     * wheels and the REPL namespace are gone either way, and the message
     * must precede the triggering job's 'result' so a client chaining its
     * next job off that result (the adapter's grading pass) already knows
     * the Pedal wheels are gone. Later jobs wait on the message chain. A
     * reload FAILURE (CDN gone mid-session) is posted as 'init-error' like
     * a failed boot (LD-90): the client then fails later jobs itself and the
     * adapter can respawn - silently keeping `runner = null` left the page
     * answering "not initialized" forever.
     */
    reloadRunner() {
      return this.options.post({ kind: "runner-reloaded" }), this.options.loadRunner(this.indexURL).then(
        (e) => {
          this.runner = e;
        },
        (e) => {
          this.runner = null, this.options.post({ kind: "init-error", error: D(e) });
        }
      );
    }
    async runJob(e) {
      var s, a, i, d;
      if (!this.runner) {
        this.options.post({
          kind: "result",
          result: {
            jobId: e.id,
            success: !1,
            stdout: "",
            stderr: "",
            error: {
              type: "EngineError",
              message: "Engine worker not initialized",
              line: null,
              studentLine: null,
              traceback: `Engine worker not initialized
`
            },
            artifacts: {},
            durationMs: 0
          }
        });
        return;
      }
      if (this.interrupted.delete(e.id)) {
        this.options.post({
          kind: "result",
          result: {
            jobId: e.id,
            success: !1,
            stdout: "",
            stderr: "",
            error: {
              type: "KeyboardInterrupt",
              message: "Execution interrupted",
              line: null,
              studentLine: null,
              traceback: `KeyboardInterrupt: Execution interrupted
`
            },
            artifacts: {},
            durationMs: 0
          }
        });
        return;
      }
      let t;
      try {
        t = await this.runner.execute(e, {
          // Setup is over, Python is about to run: the client arms the
          // execution watchdog on this (never on the 'run' post).
          onStarted: () => this.options.post({ kind: "started", jobId: e.id }),
          onStdout: (u) => this.options.post({ kind: "stdout", jobId: e.id, chunk: u }),
          onStderr: (u) => this.options.post({ kind: "stderr", jobId: e.id, chunk: u }),
          // Interactive input() (spec §6.5): the run suspends on this
          // promise until an 'input-response' arrives for the job.
          onInput: (u) => new Promise((l, c) => {
            this.pendingInputs.set(e.id, { resolve: l, reject: c }), this.options.post({ kind: "input-request", jobId: e.id, prompt: u });
          })
        });
      } catch (u) {
        this.pendingInputs.delete(e.id);
        const l = D(u), c = en.test(l), _ = c || ((a = (s = this.runner).healthCheck) == null ? void 0 : a.call(s)) === !1 ? this.reloadRunner() : null;
        this.options.post({
          kind: "result",
          result: {
            jobId: e.id,
            success: !1,
            stdout: "",
            stderr: "",
            error: {
              // EngineCrash = recovered fatal: the student-facing message is
              // instructive; the raw cause stays in the traceback for the
              // dev console / bug-icon dialog.
              type: c ? "EngineCrash" : "EngineError",
              message: c ? nn : tn(l),
              line: null,
              studentLine: null,
              traceback: l + `
`
            },
            artifacts: {},
            durationMs: 0
          }
        }), _ && await _;
        return;
      }
      this.pendingInputs.delete(e.id);
      const r = ((d = (i = this.runner).healthCheck) == null ? void 0 : d.call(i)) === !1 ? this.reloadRunner() : null;
      this.options.post({ kind: "result", result: t }), r && await r;
    }
  }
  const rn = new sn({
    post: (n) => self.postMessage(n),
    loadRunner: async (n) => {
      const e = await Pe(n ? { indexURL: n } : void 0);
      return G.create(e);
    },
    mode: Ve(self)
  });
  self.onmessage = (n) => {
    rn.handle(n.data);
  };
  var an = {}, g = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    default: an
  });
});
export default on();
