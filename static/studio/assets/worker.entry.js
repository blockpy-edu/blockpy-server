var Fe = Object.defineProperty;
var Le = (n, e, t) => e in n ? Fe(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : n[e] = t;
var De = (n, e) => () => (e || n((e = { exports: {} }).exports, e), e.exports);
var h = (n, e, t) => Le(n, typeof e != "symbol" ? e + "" : e, t);
var an = De((ln, j) => {
  var Ce = Object.defineProperty, o = (n, e) => Ce(n, "name", { value: e, configurable: !0 }), X = ((n) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(n, { get: (e, t) => (typeof require < "u" ? require : e)[t] }) : n)(function(n) {
    if (typeof require < "u") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + n + '" is not supported');
  }), Me = (() => {
    for (var n = new Uint8Array(128), e = 0; e < 64; e++) n[e < 26 ? e + 65 : e < 52 ? e + 71 : e < 62 ? e - 4 : e * 4 - 205] = e;
    return (t) => {
      for (var s = t.length, r = new Uint8Array((s - (t[s - 1] == "=") - (t[s - 2] == "=")) * 3 / 4 | 0), i = 0, a = 0; i < s; ) {
        var c = n[t.charCodeAt(i++)], u = n[t.charCodeAt(i++)], l = n[t.charCodeAt(i++)], d = n[t.charCodeAt(i++)];
        r[a++] = c << 2 | u >> 4, r[a++] = u << 4 | l >> 2, r[a++] = l << 6 | d;
      }
      return r;
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
  function F(n) {
    return function() {
      return this[n];
    };
  }
  o(F, "_getter");
  var x = ["isConstructor", "isEval", "isNative", "isToplevel"], N = ["columnNumber", "lineNumber"], S = ["fileName", "functionName", "source"], Ue = ["args"], je = ["evalOrigin"], A = x.concat(N, S, Ue, je);
  function m(n) {
    if (n) for (var e = 0; e < A.length; e++) n[A[e]] !== void 0 && this["set" + b(A[e])](n[A[e]]);
  }
  o(m, "StackFrame");
  m.prototype = { getArgs: o(function() {
    return this.args;
  }, "getArgs"), setArgs: o(function(n) {
    if (Object.prototype.toString.call(n) !== "[object Array]") throw new TypeError("Args must be an Array");
    this.args = n;
  }, "setArgs"), getEvalOrigin: o(function() {
    return this.evalOrigin;
  }, "getEvalOrigin"), setEvalOrigin: o(function(n) {
    if (n instanceof m) this.evalOrigin = n;
    else if (n instanceof Object) this.evalOrigin = new m(n);
    else throw new TypeError("Eval Origin must be an Object or StackFrame");
  }, "setEvalOrigin"), toString: o(function() {
    var n = this.getFileName() || "", e = this.getLineNumber() || "", t = this.getColumnNumber() || "", s = this.getFunctionName() || "";
    return this.getIsEval() ? n ? "[eval] (" + n + ":" + e + ":" + t + ")" : "[eval]:" + e + ":" + t : s ? s + " (" + n + ":" + e + ":" + t + ")" : n + ":" + e + ":" + t;
  }, "toString") };
  m.fromString = o(function(n) {
    var e = n.indexOf("("), t = n.lastIndexOf(")"), s = n.substring(0, e), r = n.substring(e + 1, t).split(","), i = n.substring(t + 1);
    if (i.indexOf("@") === 0) var a = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(i, ""), c = a[1], u = a[2], l = a[3];
    return new m({ functionName: s, args: r || void 0, fileName: c, lineNumber: u || void 0, columnNumber: l || void 0 });
  }, "StackFrame$$fromString");
  for (w = 0; w < x.length; w++) m.prototype["get" + b(x[w])] = F(x[w]), m.prototype["set" + b(x[w])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      this[n] = !!e;
    };
  })(x[w]);
  var w;
  for (E = 0; E < N.length; E++) m.prototype["get" + b(N[E])] = F(N[E]), m.prototype["set" + b(N[E])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      if (!Y(e)) throw new TypeError(n + " must be a Number");
      this[n] = Number(e);
    };
  })(N[E]);
  var E;
  for (k = 0; k < S.length; k++) m.prototype["get" + b(S[k])] = F(S[k]), m.prototype["set" + b(S[k])] = /* @__PURE__ */ (function(n) {
    return function(e) {
      this[n] = String(e);
    };
  })(S[k]);
  var k, L = m;
  function Q() {
    var n = /^\s*at .*(\S+:\d+|\(native\))/m, e = /^(eval@)?(\[native code])?$/;
    return { parse: o(function(t) {
      if (t.stack && t.stack.match(n)) return this.parseV8OrIE(t);
      if (t.stack) return this.parseFFOrSafari(t);
      throw new Error("Cannot parse given Error object");
    }, "ErrorStackParser$$parse"), extractLocation: o(function(t) {
      if (t.indexOf(":") === -1) return [t];
      var s = /(.+?)(?::(\d+))?(?::(\d+))?$/, r = s.exec(t.replace(/[()]/g, ""));
      return [r[1], r[2] || void 0, r[3] || void 0];
    }, "ErrorStackParser$$extractLocation"), parseV8OrIE: o(function(t) {
      var s = t.stack.split(`
`).filter(function(r) {
        return !!r.match(n);
      }, this);
      return s.map(function(r) {
        r.indexOf("(eval ") > -1 && (r = r.replace(/eval code/g, "eval").replace(/(\(eval at [^()]*)|(,.*$)/g, ""));
        var i = r.replace(/^\s+/, "").replace(/\(eval code/g, "(").replace(/^.*?\s+/, ""), a = i.match(/ (\(.+\)$)/);
        i = a ? i.replace(a[0], "") : i;
        var c = this.extractLocation(a ? a[1] : i), u = a && i || void 0, l = ["eval", "<anonymous>"].indexOf(c[0]) > -1 ? void 0 : c[0];
        return new L({ functionName: u, fileName: l, lineNumber: c[1], columnNumber: c[2], source: r });
      }, this);
    }, "ErrorStackParser$$parseV8OrIE"), parseFFOrSafari: o(function(t) {
      var s = t.stack.split(`
`).filter(function(r) {
        return !r.match(e);
      }, this);
      return s.map(function(r) {
        if (r.indexOf(" > eval") > -1 && (r = r.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ":$1")), r.indexOf("@") === -1 && r.indexOf(":") === -1) return new L({ functionName: r });
        var i = /((.*".+"[^@]*)?[^@]*)(?:@)/, a = r.match(i), c = a && a[1] ? a[1] : void 0, u = this.extractLocation(r.replace(i, ""));
        return new L({ functionName: c, fileName: u[0], lineNumber: u[1], columnNumber: u[2], source: r });
      }, this);
    }, "ErrorStackParser$$parseFFOrSafari") };
  }
  o(Q, "ErrorStackParser");
  var qe = new Q(), Be = qe;
  function Z() {
    var a;
    if (typeof API < "u" && API !== globalThis.API) return API.runtimeEnv;
    let n = typeof Bun < "u", e = typeof Deno < "u", t = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser, s = typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") === -1 && navigator.userAgent.indexOf("Safari") > -1, r = typeof read == "function" && typeof load == "function", i = typeof navigator == "object" && ((a = navigator.userAgent) == null ? void 0 : a.includes("Cloudflare-Workers"));
    return ee({ IN_BUN: n, IN_DENO: e, IN_NODE: t, IN_SAFARI: s, IN_SHELL: r, IN_WORKERD: i });
  }
  o(Z, "getGlobalRuntimeEnv");
  var _ = Z();
  function ee(n) {
    let e = n.IN_NODE && typeof j < "u" && j.exports && typeof X == "function" && typeof __dirname == "string", t = n.IN_NODE && !e, s = !n.IN_NODE && !n.IN_DENO && !n.IN_BUN, r = s && typeof window < "u" && typeof window.document < "u" && typeof document.createElement == "function" && "sessionStorage" in window && typeof globalThis.importScripts != "function", i = s && typeof globalThis.WorkerGlobalScope < "u" && typeof globalThis.self < "u" && globalThis.self instanceof globalThis.WorkerGlobalScope;
    if (i && ne()) throw new Error("Classic web workers are not supported");
    let a = { ...n, IN_BROWSER: s, IN_BROWSER_MAIN_THREAD: r, IN_BROWSER_WEB_WORKER: i, IN_NODE_COMMONJS: e, IN_NODE_ESM: t };
    if (!(a.IN_BROWSER_MAIN_THREAD || a.IN_BROWSER_WEB_WORKER || a.IN_NODE || a.IN_SHELL || a.IN_WORKERD)) throw new Error(`Cannot determine runtime environment: ${JSON.stringify(a)}`);
    return a;
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
  var te, C, z, q;
  async function B() {
    if (!_.IN_NODE || (te = (await Promise.resolve().then(function() {
      return g;
    })).default, z = await Promise.resolve().then(function() {
      return g;
    }), q = await Promise.resolve().then(function() {
      return g;
    }), (await Promise.resolve().then(function() {
      return g;
    })).default, C = await Promise.resolve().then(function() {
      return g;
    }), J = C.sep, typeof X < "u")) return;
    let n = z, e = await Promise.resolve().then(function() {
      return g;
    }), t = await Promise.resolve().then(function() {
      return g;
    }), s = await Promise.resolve().then(function() {
      return g;
    }), r = { fs: n, crypto: e, ws: t, child_process: s };
    globalThis.require = function(i) {
      return r[i];
    };
  }
  o(B, "initNodeModules");
  function re(n, e) {
    return C.resolve(e || ".", n);
  }
  o(re, "node_resolvePath");
  function se(n, e) {
    return e === void 0 && (e = location), new URL(n, e).toString();
  }
  o(se, "browser_resolvePath");
  var P;
  _.IN_NODE ? P = re : _.IN_SHELL ? P = o((n) => n, "resolvePath") : P = se;
  var J;
  _.IN_NODE || (J = "/");
  function ie(n, e) {
    return n.startsWith("file://") && (n = n.slice(7)), n.includes("://") ? { response: fetch(n) } : { binary: q.readFile(n).then((t) => new Uint8Array(t.buffer, t.byteOffset, t.byteLength)) };
  }
  o(ie, "node_getBinaryResponse");
  function ae(n, e) {
    if (n.startsWith("file://") && (n = n.slice(7)), n.includes("://")) throw new Error("Shell cannot fetch urls");
    return { binary: Promise.resolve(new Uint8Array(readbuffer(n))) };
  }
  o(ae, "shell_getBinaryResponse");
  function oe(n, e) {
    let t = new URL(n, location);
    return { response: fetch(t, e ? { integrity: e } : {}) };
  }
  o(oe, "browser_getBinaryResponse");
  var I;
  _.IN_NODE ? I = ie : _.IN_SHELL ? I = ae : I = oe;
  async function le(n, e) {
    let { response: t, binary: s } = I(n, e);
    if (s) return s;
    let r = await t;
    if (!r.ok) throw new Error(`Failed to load '${n}': request failed.`);
    return new Uint8Array(await r.arrayBuffer());
  }
  o(le, "loadBinaryFile");
  var M;
  _.IN_NODE ? M = ce : M = o(async (n) => await import(n), "loadScript");
  async function ce(n) {
    return n.startsWith("file://") && (n = n.slice(7)), n.includes("://") ? await import(n) : await import(te.pathToFileURL(n).href);
  }
  o(ce, "nodeLoadScript");
  async function ue(n) {
    if (_.IN_NODE) {
      await B();
      let e = await q.readFile(n, { encoding: "utf8" });
      return JSON.parse(e);
    } else if (_.IN_SHELL) {
      let e = read(n);
      return JSON.parse(e);
    } else return await (await fetch(n)).json();
  }
  o(ue, "loadLockFile");
  async function de() {
    if (_.IN_NODE_COMMONJS) return __dirname;
    let n;
    try {
      throw new Error();
    } catch (s) {
      n = s;
    }
    let e = Be.parse(n)[0].fileName;
    if (_.IN_NODE && !e.startsWith("file://") && (e = `file://${e}`), _.IN_NODE_ESM) {
      let s = await Promise.resolve().then(function() {
        return g;
      });
      return (await Promise.resolve().then(function() {
        return g;
      })).fileURLToPath(s.dirname(e));
    }
    let t = e.lastIndexOf(J);
    if (t === -1) throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");
    return e.slice(0, t);
  }
  o(de, "calculateDirname");
  function pe(n) {
    var e;
    return n.substring(0, n.lastIndexOf("/") + 1) || ((e = globalThis.location) == null ? void 0 : e.toString()) || ".";
  }
  o(pe, "calculateInstallBaseUrl");
  function fe(n) {
    let e = n.FS, t = n.FS.filesystems.MEMFS, s = n.PATH, r = { DIR_MODE: 16895, FILE_MODE: 33279, mount: o(function(i) {
      if (!i.opts.fileSystemHandle) throw new Error("opts.fileSystemHandle is required");
      return t.mount.apply(null, arguments);
    }, "mount"), syncfs: o(async (i, a, c) => {
      try {
        let u = r.getLocalSet(i), l = await r.getRemoteSet(i), d = a ? l : u, f = a ? u : l;
        await r.reconcile(i, d, f), c(null);
      } catch (u) {
        c(u);
      }
    }, "syncfs"), getLocalSet: o((i) => {
      let a = /* @__PURE__ */ Object.create(null);
      function c(d) {
        return d !== "." && d !== "..";
      }
      o(c, "isRealDir");
      function u(d) {
        return (f) => s.join2(d, f);
      }
      o(u, "toAbsolute");
      let l = e.readdir(i.mountpoint).filter(c).map(u(i.mountpoint));
      for (; l.length; ) {
        let d = l.pop(), f = e.stat(d);
        e.isDir(f.mode) && l.push.apply(l, e.readdir(d).filter(c).map(u(d))), a[d] = { timestamp: f.mtime, mode: f.mode };
      }
      return { type: "local", entries: a };
    }, "getLocalSet"), getRemoteSet: o(async (i) => {
      let a = /* @__PURE__ */ Object.create(null), c = await Je(i.opts.fileSystemHandle);
      for (let [u, l] of c) u !== "." && (a[s.join2(i.mountpoint, u)] = { timestamp: l.kind === "file" ? new Date((await l.getFile()).lastModified) : /* @__PURE__ */ new Date(), mode: l.kind === "file" ? r.FILE_MODE : r.DIR_MODE });
      return { type: "remote", entries: a, handles: c };
    }, "getRemoteSet"), loadLocalEntry: o((i) => {
      let a = e.lookupPath(i, {}).node, c = e.stat(i);
      if (e.isDir(c.mode)) return { timestamp: c.mtime, mode: c.mode };
      if (e.isFile(c.mode)) return a.contents = t.getFileDataAsTypedArray(a), { timestamp: c.mtime, mode: c.mode, contents: a.contents };
      throw new Error("node type not supported");
    }, "loadLocalEntry"), storeLocalEntry: o((i, a) => {
      if (e.isDir(a.mode)) e.mkdirTree(i, a.mode);
      else if (e.isFile(a.mode)) e.writeFile(i, a.contents, { canOwn: !0 });
      else throw new Error("node type not supported");
      e.chmod(i, a.mode), e.utime(i, a.timestamp, a.timestamp);
    }, "storeLocalEntry"), removeLocalEntry: o((i) => {
      var a = e.stat(i);
      e.isDir(a.mode) ? e.rmdir(i) : e.isFile(a.mode) && e.unlink(i);
    }, "removeLocalEntry"), loadRemoteEntry: o(async (i) => {
      if (i.kind === "file") {
        let a = await i.getFile();
        return { contents: new Uint8Array(await a.arrayBuffer()), mode: r.FILE_MODE, timestamp: new Date(a.lastModified) };
      } else {
        if (i.kind === "directory") return { mode: r.DIR_MODE, timestamp: /* @__PURE__ */ new Date() };
        throw new Error("unknown kind: " + i.kind);
      }
    }, "loadRemoteEntry"), storeRemoteEntry: o(async (i, a, c) => {
      let u = i.get(s.dirname(a)), l = e.isFile(c.mode) ? await u.getFileHandle(s.basename(a), { create: !0 }) : await u.getDirectoryHandle(s.basename(a), { create: !0 });
      if (l.kind === "file") {
        let d = await l.createWritable();
        await d.write(c.contents), await d.close();
      }
      i.set(a, l);
    }, "storeRemoteEntry"), removeRemoteEntry: o(async (i, a) => {
      await i.get(s.dirname(a)).removeEntry(s.basename(a)), i.delete(a);
    }, "removeRemoteEntry"), reconcile: o(async (i, a, c) => {
      let u = 0, l = [];
      Object.keys(a.entries).forEach(function(p) {
        let y = a.entries[p], v = c.entries[p];
        (!v || e.isFile(y.mode) && y.timestamp.getTime() > v.timestamp.getTime()) && (l.push(p), u++);
      }), l.sort();
      let d = [];
      if (Object.keys(c.entries).forEach(function(p) {
        a.entries[p] || (d.push(p), u++);
      }), d.sort().reverse(), !u) return;
      let f = a.type === "remote" ? a.handles : c.handles;
      for (let p of l) {
        let y = s.normalize(p.replace(i.mountpoint, "/")).substring(1);
        if (c.type === "local") {
          let v = f.get(y), T = await r.loadRemoteEntry(v);
          r.storeLocalEntry(p, T);
        } else {
          let v = r.loadLocalEntry(p);
          await r.storeRemoteEntry(f, y, v);
        }
      }
      for (let p of d) if (c.type === "local") r.removeLocalEntry(p);
      else {
        let y = s.normalize(p.replace(i.mountpoint, "/")).substring(1);
        await r.removeRemoteEntry(f, y);
      }
    }, "reconcile") };
    n.FS.filesystems.NATIVEFS_ASYNC = r;
  }
  o(fe, "initializeNativeFS");
  var Je = o(async (n) => {
    let e = [];
    async function t(r) {
      for await (let i of r.values()) e.push(i), i.kind === "directory" && await t(i);
    }
    o(t, "collect"), await t(n);
    let s = /* @__PURE__ */ new Map();
    s.set(".", n);
    for (let r of e) {
      let i = (await n.resolve(r)).join("/");
      s.set(i, r);
    }
    return s;
  }, "getFsHandles"), We = Me("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL"), Ge = (async function() {
    if (!(globalThis.navigator && (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints < "u" && navigator.maxTouchPoints > 1))) try {
      let n = await WebAssembly.compile(We);
      return await WebAssembly.instantiate(n);
    } catch (n) {
      if (n instanceof WebAssembly.CompileError) return;
      throw n;
    }
  })();
  async function me() {
    let n = await Ge;
    if (n) return n.exports;
    let e = Symbol("error marker");
    return { Jsv_GetError_import: o(() => e, "Jsv_GetError_import"), JsvError_Check: o((t) => t === e, "JsvError_Check") };
  }
  o(me, "getJsvErrorImport");
  function _e(n) {
    let e = { config: n, runtimeEnv: _ }, t = { noImageDecoding: !0, noAudioDecoding: !0, noWasmDecoding: !1, preRun: we(n), print: n.stdout, printErr: n.stderr, onExit(s) {
      t.exitCode = s;
    }, thisProgram: n._sysExecutable, arguments: n.args, API: e, locateFile: o((s) => n.indexURL + s, "locateFile"), instantiateWasm: Ee(n.indexURL) };
    return t;
  }
  o(_e, "createSettings");
  function he(n) {
    return function(e) {
      let t = "/";
      try {
        e.FS.mkdirTree(n);
      } catch (s) {
        console.error(`Error occurred while making a home directory '${n}':`), console.error(s), console.error(`Using '${t}' for a home directory instead`), n = t;
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
    let e = n.HEAPU32[n._Py_Version >>> 2], t = e >>> 24 & 255, s = e >>> 16 & 255, r = e >>> 8 & 255;
    return [t, s, r];
  }
  o(ve, "computeVersionTuple");
  function be(n) {
    let e = le(n);
    return async (t) => {
      t.API.pyVersionTuple = ve(t);
      let [s, r] = t.API.pyVersionTuple;
      t.FS.mkdirTree("/lib"), t.API.sitePackages = `/lib/python${s}.${r}/site-packages`, t.FS.mkdirTree(t.API.sitePackages), t.addRunDependency("install-stdlib");
      try {
        let i = await e;
        t.FS.writeFile(`/lib/python${s}${r}.zip`, i);
      } catch (i) {
        console.error("Error occurred while installing the standard library:"), console.error(i);
      } finally {
        t.removeRunDependency("install-stdlib");
      }
    };
  }
  o(be, "installStdlib");
  function we(n) {
    let e;
    return n.stdLibURL != null ? e = n.stdLibURL : e = n.indexURL + "python_stdlib.zip", [be(e), he(n.env.HOME), ge(n.env), fe, ...ye(n.fsInit)];
  }
  o(we, "getFileSystemInitializationFuncs");
  function Ee(n) {
    if (typeof WasmOffsetConverter < "u") return;
    let { binary: e, response: t } = I(n + "pyodide.asm.wasm"), s = me();
    return function(r, i) {
      return (async function() {
        let { Jsv_GetError_import: a, JsvError_Check: c } = await s;
        r.env.Jsv_GetError_import = a, r.env.JsvError_Check = c;
        try {
          let u;
          t ? u = await WebAssembly.instantiateStreaming(t, r) : u = await WebAssembly.instantiate(await e, r);
          let { instance: l, module: d } = u;
          i(l, d);
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
  var U = $e;
  async function ke(n = {}) {
    var r, i;
    if (await B(), n.lockFileContents && n.lockFileURL) throw new Error("Can't pass both lockFileContents and lockFileURL");
    let e = n.indexURL || await de();
    if (e = R(P(e)), n.packageBaseUrl = R(n.packageBaseUrl), n.cdnUrl = R(n.packageBaseUrl ?? `https://cdn.jsdelivr.net/pyodide/v${U}/full/`), !n.lockFileContents) {
      let a = n.lockFileURL ?? e + "pyodide-lock.json";
      n.lockFileContents = ue(a), n.packageBaseUrl ?? (n.packageBaseUrl = pe(a));
    }
    n.indexURL = e, n.packageCacheDir && (n.packageCacheDir = R(P(n.packageCacheDir)));
    let t = { jsglobals: globalThis, stdin: globalThis.prompt ? () => globalThis.prompt() : void 0, args: [], env: {}, packages: [], packageCacheDir: n.packageBaseUrl, enableRunUntilComplete: !0, checkAPIVersion: !0, BUILD_ID: "a4189f0fe3d610ecd603639c08596362b70a34b106c58c9a93486c22df4c89a5" }, s = Object.assign(t, n);
    return (r = s.env).HOME ?? (r.HOME = "/home/pyodide"), (i = s.env).PYTHONINSPECT ?? (i.PYTHONINSPECT = "1"), s;
  }
  o(ke, "initializeConfiguration");
  function xe(n) {
    let e = _e(n), t = e.API;
    return t.lockFilePromise = Promise.resolve(n.lockFileContents), e;
  }
  o(xe, "createEmscriptenSettings");
  async function Ne(n) {
    if (n.createPyodideModule) return n.createPyodideModule;
    let e = `${n.indexURL}pyodide.asm.mjs`;
    return (await M(e)).default;
  }
  o(Ne, "loadWasmScript");
  async function Se(n, e) {
    if (!n._loadSnapshot) return;
    let t = await n._loadSnapshot, s = ArrayBuffer.isView(t) ? t : new Uint8Array(t);
    return e.noInitialRun = !0, e.INITIAL_MEMORY = s.length, s;
  }
  o(Se, "prepareSnapshot");
  async function Re(n, e) {
    let t = await n(e);
    if (e.exitCode !== void 0) throw new t.ExitStatus(e.exitCode);
    return t;
  }
  o(Re, "instantiatePyodideModule");
  function Pe(n, e) {
    let t = n.API;
    if (e.pyproxyToStringRepr && t.setPyProxyToStringMethod(!0), e.convertNullToNone && t.setCompatNullToNone(!0), e.toJsLiteralMap && t.setCompatToJsLiteralMap(!0), t.version !== U && e.checkAPIVersion) throw new Error(`Pyodide version does not match: '${U}' <==> '${t.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);
    n.locateFile = (s) => {
      throw s.endsWith(".so") ? new Error(`Failed to find dynamic library "${s}"`) : new Error(`Unexpected call to locateFile("${s}")`);
    };
  }
  o(Pe, "configureAPI");
  function Ie(n, e, t) {
    let s = n.API, r;
    return e && (r = s.restoreSnapshot(e)), s.finalizeBootstrap(r, t._snapshotDeserializer);
  }
  o(Ie, "bootstrapPyodide");
  async function Te(n, e) {
    let t = n._api;
    return t.sys.path.insert(0, ""), t._pyodide.set_excepthook(), await t.packageIndexReady, t.initializeStreams(e.stdin, e.stdout, e.stderr), n;
  }
  o(Te, "finalizeSetup");
  async function Oe(n = {}) {
    let e = await ke(n), t = xe(e), s = await Ne(e), r = await Se(e, t), i = await Re(s, t);
    Pe(i, e);
    let a = Ie(i, r, e);
    return await Te(a, e);
  }
  o(Oe, "loadPyodide");
  function ze(n) {
    return n.crossOriginIsolated === !0 && typeof n.SharedArrayBuffer == "function" ? "isolated" : "compat";
  }
  var He = `# The in-worker Python runtime, installed into Pyodide once at boot
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
`, Ve = `# The Pedal "blockpy environment" contract for Studio (spec 10.1) - a
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
    importlib.invalidate_caches()


# The names legacy preloaded into the instructor script's namespace
# (on_run.js:33-36 / on_eval.js:15-18) - graders may use parse_program and
# the sandbox/core commands without importing them.
_INSTRUCTOR_PRELUDE = (
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
    MAIN_REPORT.clear()
    options = json.loads(options_json) if options_json else {}
    _studio_pedal_stage(json.loads(files_json) if files_json else {})

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
                set_seed(str(seed))
            except Exception:  # noqa: BLE001
                pass

        student = env.fields['student']
        exec(compile(on_run, 'on_run.py', 'exec'),
             _studio_instructor_globals(student, student_code))
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

    del options_json  # reserved (parity with _studio_pedal_grade)
    _studio_patch_pedal_traceback()
    try:
        MAIN_REPORT.feedback.clear()
        # Suppressed feedback is presented too (the resolver walks it) -
        # leaving the last pass's entries would bleed into this one.
        getattr(MAIN_REPORT, 'ignored_feedback', []).clear()
        from pedal.sandbox.commands import evaluate, get_sandbox
        student = get_sandbox(report=MAIN_REPORT)
        evaluate(evaluation, report=MAIN_REPORT)
        exec(compile(on_eval, 'on_eval.py', 'exec'),
             _studio_instructor_globals(student, evaluation))
        return _studio_pedal_resolve()
    except BaseException:  # noqa: BLE001 - grading must fail soft
        return _studio_fail_soft()
`;
  const Ae = ["pedal>=3.0.3", "curriculum-sneks", "bakery"];
  function Ke(n) {
    return {
      ...n,
      score: n.score ?? 0,
      instructions: n.instructions ?? null,
      line: n.line ?? null
    };
  }
  const H = (n) => {
    const e = Ke(n.toJs({ dict_converter: Object.fromEntries }));
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
      await e.loadPackage("micropip"), await e.runPythonAsync(
        `import micropip
await micropip.install(${JSON.stringify(t)})`
      ), e.runPython(Ve);
      const s = e.globals.get("_studio_pedal_grade"), r = e.globals.get("_studio_pedal_evaluate");
      return new W(s, r);
    }
    grade(e, t = {}) {
      return H(
        this.grade_(
          e.studentCode,
          e.onRun,
          JSON.stringify(e.files ?? {}),
          e.inputs ?? [],
          JSON.stringify({
            skip_tifa: e.skipTifa ?? !1,
            skip_run: e.skipRun ?? !1,
            seed: e.seed ?? null,
            student_files: e.studentFiles ?? {}
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
      return H(
        this.evaluate_(
          e.evaluation,
          e.onEval,
          "{}",
          t.onStdout ?? null,
          t.onStderr ?? null
        )
      );
    }
  }
  const Xe = () => typeof WebAssembly.Suspending == "function", V = (n) => {
    const e = n.toJs({ dict_converter: Object.fromEntries });
    return n.destroy(), e;
  };
  function Ye(n) {
    var t, s;
    const e = [
      // Joined the way runtime.py run() executes them (LD-95): a newline
      // between pieces that lack one, so a prefix without a trailing newline
      // does not fuse with the student's first line and hide every import.
      Qe(n.answerPrefix ?? "", n.code, n.answerSuffix ?? ""),
      ...Object.entries(n.files).filter(([r]) => r.endsWith(".py")).map(([, r]) => r),
      ((t = n.pedal) == null ? void 0 : t.onRun) ?? "",
      ((s = n.pedal) == null ? void 0 : s.evaluation) ?? ""
    ];
    return [...new Set(e.filter((r) => r.trim() !== ""))];
  }
  function Qe(...n) {
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
      e.runPython(He);
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
        for (const s of Ye(e))
          try {
            await t.call(this.pyodide, s);
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
      const t = e ?? Ae, s = t.filter((r) => !this.pedalPackages.has(r));
      if (this.pedalEnv === null || s.length > 0) {
        this.pedalEnv = await W.install(
          this.pyodide,
          this.pedalEnv === null ? t : s
        );
        for (const r of t) this.pedalPackages.add(r);
      }
      return this.pedalEnv;
    }
    /**
     * Pedal grading job (spec §10.1): the environment re-runs the student
     * submission inside Pedal's sandbox, so no exec happens here. Grader and
     * Pedal crashes are fail-soft inside the environment (`system_error`
     * feedback); only wheel-install failures surface as job errors.
     */
    async executePedal(e, t, s) {
      var u;
      const r = e.pedal;
      let i = "", a = "";
      const c = {
        onStdout: (l) => {
          var d;
          i += l, (d = s.onStdout) == null || d.call(s, l);
        },
        onStderr: (l) => {
          var d;
          a += l, (d = s.onStderr) == null || d.call(s, l);
        }
      };
      try {
        await this.loadImports(e);
        const l = await this.ensurePedal(r.packages);
        (u = s.onStarted) == null || u.call(s);
        const d = r.evaluation !== void 0 ? (
          // on_eval pipeline (on_eval.js): reuses the last grading
          // pass's report/sandbox - no staging, no student re-run.
          l.evaluateGrade(
            {
              evaluation: r.evaluation,
              onEval: r.onRun
            },
            c
          )
        ) : l.grade(
          {
            studentCode: e.code,
            onRun: r.onRun,
            files: e.files,
            inputs: r.inputs ?? e.inputsPrefill,
            studentFiles: r.studentFiles,
            skipTifa: r.skipTifa,
            skipRun: r.skipRun,
            seed: r.seed
          },
          c
        );
        return {
          jobId: e.id,
          success: !0,
          stdout: i,
          stderr: a,
          artifacts: {},
          feedback: d,
          durationMs: Date.now() - t
        };
      } catch (l) {
        const d = l instanceof Error ? l.message : String(l);
        return {
          jobId: e.id,
          success: !1,
          stdout: i,
          stderr: a,
          error: {
            type: "PedalEnvironmentError",
            message: d,
            line: null,
            studentLine: null,
            traceback: d + `
`
          },
          artifacts: {},
          durationMs: Date.now() - t
        };
      }
    }
    async execute(e, t = {}) {
      var v, T, $;
      const s = Date.now();
      if (e.pedal)
        return this.executePedal(e, s, t);
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
      const r = e.phase === "student.eval" || e.phase === "instructor.on_eval";
      r || this.pyodide.runPython(
        `_studio_runtime.stage_files(__import__('json').loads(${JSON.stringify(
          JSON.stringify(e.files)
        )}))`
      );
      const i = t.onStdout ?? null, a = t.onStderr ?? null, c = (e.interactiveInput ? t.onInput : void 0) ?? null, u = [
        e.code,
        e.filename ?? "answer.py",
        e.answerPrefix ?? "",
        e.answerSuffix ?? "",
        e.inputsPrefill ?? [],
        "exec",
        e.phase === "quiz.preprocess",
        e.trace ?? !1,
        ((v = e.limits) == null ? void 0 : v.traceSteps) ?? null,
        i,
        a,
        e.allowRealRequests ?? !1,
        c,
        // The REPL namespace (§6.4) follows the student's run only.
        e.phase === "student.run"
      ], [l, d] = r ? [this.runtime.evaluate, [e.code, i, a, c]] : [this.runtime.run, u], f = l;
      (T = t.onStarted) == null || T.call(t);
      const p = V(
        c !== null && Xe() && typeof f.callPromising == "function" ? await f.callPromising(...d) : f(...d)
      ), y = V(this.runtime.collect_artifacts());
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
        trace: p.trace ? p.trace.map((O) => ({
          event: O.event,
          line: O.line,
          studentLine: O.student_line,
          locals: O.locals
        })) : void 0,
        images: ($ = p.images) != null && $.length ? p.images : void 0,
        artifacts: y,
        durationMs: Date.now() - s
      };
    }
  }
  const Ze = /call stack|stack overflow|fatally failed/i, en = "The Python engine crashed - this usually means unbounded recursion (a function calling itself forever). The engine has been restarted; check your code and run again.", K = () => {
  }, D = (n) => n instanceof Error ? n.message : String(n), nn = (n) => {
    const e = n.split(`
`).filter((t) => t.trim() !== "");
    return e.length > 0 ? e[e.length - 1].trim() : n;
  };
  class tn {
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
      var r, i, a, c;
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
          onInput: (u) => new Promise((l, d) => {
            this.pendingInputs.set(e.id, { resolve: l, reject: d }), this.options.post({ kind: "input-request", jobId: e.id, prompt: u });
          })
        });
      } catch (u) {
        this.pendingInputs.delete(e.id);
        const l = D(u), d = Ze.test(l), f = d || ((i = (r = this.runner).healthCheck) == null ? void 0 : i.call(r)) === !1 ? this.reloadRunner() : null;
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
              type: d ? "EngineCrash" : "EngineError",
              message: d ? en : nn(l),
              line: null,
              studentLine: null,
              traceback: l + `
`
            },
            artifacts: {},
            durationMs: 0
          }
        }), f && await f;
        return;
      }
      this.pendingInputs.delete(e.id);
      const s = ((c = (a = this.runner).healthCheck) == null ? void 0 : c.call(a)) === !1 ? this.reloadRunner() : null;
      this.options.post({ kind: "result", result: t }), s && await s;
    }
  }
  const rn = new tn({
    post: (n) => self.postMessage(n),
    loadRunner: async (n) => {
      const e = await Oe(n ? { indexURL: n } : void 0);
      return G.create(e);
    },
    mode: ze(self)
  });
  self.onmessage = (n) => {
    rn.handle(n.data);
  };
  var sn = {}, g = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    default: sn
  });
});
export default an();
