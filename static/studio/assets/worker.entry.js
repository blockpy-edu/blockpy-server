var Oe = Object.defineProperty;
var Te = (r, e, n) => e in r ? Oe(r, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : r[e] = n;
var Ae = (r, e) => () => (e || r((e = { exports: {} }).exports, e), e.exports);
var g = (r, e, n) => Te(r, typeof e != "symbol" ? e + "" : e, n);
var Xe = Ae((er, U) => {
  var Fe = Object.defineProperty, o = (r, e) => Fe(r, "name", { value: e, configurable: !0 }), z = ((r) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(r, { get: (e, n) => (typeof require < "u" ? require : e)[n] }) : r)(function(r) {
    if (typeof require < "u") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + r + '" is not supported');
  }), Le = (() => {
    for (var r = new Uint8Array(128), e = 0; e < 64; e++) r[e < 26 ? e + 65 : e < 52 ? e + 71 : e < 62 ? e - 4 : e * 4 - 205] = e;
    return (n) => {
      for (var t = n.length, s = new Uint8Array((t - (n[t - 1] == "=") - (n[t - 2] == "=")) * 3 / 4 | 0), a = 0, i = 0; a < t; ) {
        var l = r[n.charCodeAt(a++)], u = r[n.charCodeAt(a++)], c = r[n.charCodeAt(a++)], d = r[n.charCodeAt(a++)];
        s[i++] = l << 2 | u >> 4, s[i++] = u << 4 | c >> 2, s[i++] = c << 6 | d;
      }
      return s;
    };
  })();
  function V(r) {
    return !isNaN(parseFloat(r)) && isFinite(r);
  }
  o(V, "_isNumber");
  function b(r) {
    return r.charAt(0).toUpperCase() + r.substring(1);
  }
  o(b, "_capitalize");
  function A(r) {
    return function() {
      return this[r];
    };
  }
  o(A, "_getter");
  var N = ["isConstructor", "isEval", "isNative", "isToplevel"], R = ["columnNumber", "lineNumber"], S = ["fileName", "functionName", "source"], De = ["args"], Ce = ["evalOrigin"], T = N.concat(R, S, De, Ce);
  function m(r) {
    if (r) for (var e = 0; e < T.length; e++) r[T[e]] !== void 0 && this["set" + b(T[e])](r[T[e]]);
  }
  o(m, "StackFrame");
  m.prototype = { getArgs: o(function() {
    return this.args;
  }, "getArgs"), setArgs: o(function(r) {
    if (Object.prototype.toString.call(r) !== "[object Array]") throw new TypeError("Args must be an Array");
    this.args = r;
  }, "setArgs"), getEvalOrigin: o(function() {
    return this.evalOrigin;
  }, "getEvalOrigin"), setEvalOrigin: o(function(r) {
    if (r instanceof m) this.evalOrigin = r;
    else if (r instanceof Object) this.evalOrigin = new m(r);
    else throw new TypeError("Eval Origin must be an Object or StackFrame");
  }, "setEvalOrigin"), toString: o(function() {
    var r = this.getFileName() || "", e = this.getLineNumber() || "", n = this.getColumnNumber() || "", t = this.getFunctionName() || "";
    return this.getIsEval() ? r ? "[eval] (" + r + ":" + e + ":" + n + ")" : "[eval]:" + e + ":" + n : t ? t + " (" + r + ":" + e + ":" + n + ")" : r + ":" + e + ":" + n;
  }, "toString") };
  m.fromString = o(function(r) {
    var e = r.indexOf("("), n = r.lastIndexOf(")"), t = r.substring(0, e), s = r.substring(e + 1, n).split(","), a = r.substring(n + 1);
    if (a.indexOf("@") === 0) var i = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(a, ""), l = i[1], u = i[2], c = i[3];
    return new m({ functionName: t, args: s || void 0, fileName: l, lineNumber: u || void 0, columnNumber: c || void 0 });
  }, "StackFrame$$fromString");
  for (w = 0; w < N.length; w++) m.prototype["get" + b(N[w])] = A(N[w]), m.prototype["set" + b(N[w])] = /* @__PURE__ */ (function(r) {
    return function(e) {
      this[r] = !!e;
    };
  })(N[w]);
  var w;
  for (k = 0; k < R.length; k++) m.prototype["get" + b(R[k])] = A(R[k]), m.prototype["set" + b(R[k])] = /* @__PURE__ */ (function(r) {
    return function(e) {
      if (!V(e)) throw new TypeError(r + " must be a Number");
      this[r] = Number(e);
    };
  })(R[k]);
  var k;
  for (E = 0; E < S.length; E++) m.prototype["get" + b(S[E])] = A(S[E]), m.prototype["set" + b(S[E])] = /* @__PURE__ */ (function(r) {
    return function(e) {
      this[r] = String(e);
    };
  })(S[E]);
  var E, F = m;
  function K() {
    var r = /^\s*at .*(\S+:\d+|\(native\))/m, e = /^(eval@)?(\[native code])?$/;
    return { parse: o(function(n) {
      if (n.stack && n.stack.match(r)) return this.parseV8OrIE(n);
      if (n.stack) return this.parseFFOrSafari(n);
      throw new Error("Cannot parse given Error object");
    }, "ErrorStackParser$$parse"), extractLocation: o(function(n) {
      if (n.indexOf(":") === -1) return [n];
      var t = /(.+?)(?::(\d+))?(?::(\d+))?$/, s = t.exec(n.replace(/[()]/g, ""));
      return [s[1], s[2] || void 0, s[3] || void 0];
    }, "ErrorStackParser$$extractLocation"), parseV8OrIE: o(function(n) {
      var t = n.stack.split(`
`).filter(function(s) {
        return !!s.match(r);
      }, this);
      return t.map(function(s) {
        s.indexOf("(eval ") > -1 && (s = s.replace(/eval code/g, "eval").replace(/(\(eval at [^()]*)|(,.*$)/g, ""));
        var a = s.replace(/^\s+/, "").replace(/\(eval code/g, "(").replace(/^.*?\s+/, ""), i = a.match(/ (\(.+\)$)/);
        a = i ? a.replace(i[0], "") : a;
        var l = this.extractLocation(i ? i[1] : a), u = i && a || void 0, c = ["eval", "<anonymous>"].indexOf(l[0]) > -1 ? void 0 : l[0];
        return new F({ functionName: u, fileName: c, lineNumber: l[1], columnNumber: l[2], source: s });
      }, this);
    }, "ErrorStackParser$$parseV8OrIE"), parseFFOrSafari: o(function(n) {
      var t = n.stack.split(`
`).filter(function(s) {
        return !s.match(e);
      }, this);
      return t.map(function(s) {
        if (s.indexOf(" > eval") > -1 && (s = s.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ":$1")), s.indexOf("@") === -1 && s.indexOf(":") === -1) return new F({ functionName: s });
        var a = /((.*".+"[^@]*)?[^@]*)(?:@)/, i = s.match(a), l = i && i[1] ? i[1] : void 0, u = this.extractLocation(s.replace(a, ""));
        return new F({ functionName: l, fileName: u[0], lineNumber: u[1], columnNumber: u[2], source: s });
      }, this);
    }, "ErrorStackParser$$parseFFOrSafari") };
  }
  o(K, "ErrorStackParser");
  var Me = new K(), Ue = Me;
  function Y() {
    var i;
    if (typeof API < "u" && API !== globalThis.API) return API.runtimeEnv;
    let r = typeof Bun < "u", e = typeof Deno < "u", n = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && !process.browser, t = typeof navigator == "object" && typeof navigator.userAgent == "string" && navigator.userAgent.indexOf("Chrome") === -1 && navigator.userAgent.indexOf("Safari") > -1, s = typeof read == "function" && typeof load == "function", a = typeof navigator == "object" && ((i = navigator.userAgent) == null ? void 0 : i.includes("Cloudflare-Workers"));
    return Q({ IN_BUN: r, IN_DENO: e, IN_NODE: n, IN_SAFARI: t, IN_SHELL: s, IN_WORKERD: a });
  }
  o(Y, "getGlobalRuntimeEnv");
  var h = Y();
  function Q(r) {
    let e = r.IN_NODE && typeof U < "u" && U.exports && typeof z == "function" && typeof __dirname == "string", n = r.IN_NODE && !e, t = !r.IN_NODE && !r.IN_DENO && !r.IN_BUN, s = t && typeof window < "u" && typeof window.document < "u" && typeof document.createElement == "function" && "sessionStorage" in window && typeof globalThis.importScripts != "function", a = t && typeof globalThis.WorkerGlobalScope < "u" && typeof globalThis.self < "u" && globalThis.self instanceof globalThis.WorkerGlobalScope;
    if (a && X()) throw new Error("Classic web workers are not supported");
    let i = { ...r, IN_BROWSER: t, IN_BROWSER_MAIN_THREAD: s, IN_BROWSER_WEB_WORKER: a, IN_NODE_COMMONJS: e, IN_NODE_ESM: n };
    if (!(i.IN_BROWSER_MAIN_THREAD || i.IN_BROWSER_WEB_WORKER || i.IN_NODE || i.IN_SHELL || i.IN_WORKERD)) throw new Error(`Cannot determine runtime environment: ${JSON.stringify(i)}`);
    return i;
  }
  o(Q, "calculateDerivedFlags");
  function X() {
    try {
      return globalThis.importScripts("data:text/javascript,"), !0;
    } catch {
      return !1;
    }
  }
  o(X, "isClassicWorker");
  var Z, D, $, j;
  async function B() {
    if (!h.IN_NODE || (Z = (await Promise.resolve().then(function() {
      return y;
    })).default, $ = await Promise.resolve().then(function() {
      return y;
    }), j = await Promise.resolve().then(function() {
      return y;
    }), (await Promise.resolve().then(function() {
      return y;
    })).default, D = await Promise.resolve().then(function() {
      return y;
    }), q = D.sep, typeof z < "u")) return;
    let r = $, e = await Promise.resolve().then(function() {
      return y;
    }), n = await Promise.resolve().then(function() {
      return y;
    }), t = await Promise.resolve().then(function() {
      return y;
    }), s = { fs: r, crypto: e, ws: n, child_process: t };
    globalThis.require = function(a) {
      return s[a];
    };
  }
  o(B, "initNodeModules");
  function ee(r, e) {
    return D.resolve(e || ".", r);
  }
  o(ee, "node_resolvePath");
  function re(r, e) {
    return e === void 0 && (e = location), new URL(r, e).toString();
  }
  o(re, "browser_resolvePath");
  var I;
  h.IN_NODE ? I = ee : h.IN_SHELL ? I = o((r) => r, "resolvePath") : I = re;
  var q;
  h.IN_NODE || (q = "/");
  function ne(r, e) {
    return r.startsWith("file://") && (r = r.slice(7)), r.includes("://") ? { response: fetch(r) } : { binary: j.readFile(r).then((n) => new Uint8Array(n.buffer, n.byteOffset, n.byteLength)) };
  }
  o(ne, "node_getBinaryResponse");
  function te(r, e) {
    if (r.startsWith("file://") && (r = r.slice(7)), r.includes("://")) throw new Error("Shell cannot fetch urls");
    return { binary: Promise.resolve(new Uint8Array(readbuffer(r))) };
  }
  o(te, "shell_getBinaryResponse");
  function se(r, e) {
    let n = new URL(r, location);
    return { response: fetch(n, e ? { integrity: e } : {}) };
  }
  o(se, "browser_getBinaryResponse");
  var O;
  h.IN_NODE ? O = ne : h.IN_SHELL ? O = te : O = se;
  async function ae(r, e) {
    let { response: n, binary: t } = O(r, e);
    if (t) return t;
    let s = await n;
    if (!s.ok) throw new Error(`Failed to load '${r}': request failed.`);
    return new Uint8Array(await s.arrayBuffer());
  }
  o(ae, "loadBinaryFile");
  var C;
  h.IN_NODE ? C = ie : C = o(async (r) => await import(r), "loadScript");
  async function ie(r) {
    return r.startsWith("file://") && (r = r.slice(7)), r.includes("://") ? await import(r) : await import(Z.pathToFileURL(r).href);
  }
  o(ie, "nodeLoadScript");
  async function oe(r) {
    if (h.IN_NODE) {
      await B();
      let e = await j.readFile(r, { encoding: "utf8" });
      return JSON.parse(e);
    } else if (h.IN_SHELL) {
      let e = read(r);
      return JSON.parse(e);
    } else return await (await fetch(r)).json();
  }
  o(oe, "loadLockFile");
  async function le() {
    if (h.IN_NODE_COMMONJS) return __dirname;
    let r;
    try {
      throw new Error();
    } catch (t) {
      r = t;
    }
    let e = Ue.parse(r)[0].fileName;
    if (h.IN_NODE && !e.startsWith("file://") && (e = `file://${e}`), h.IN_NODE_ESM) {
      let t = await Promise.resolve().then(function() {
        return y;
      });
      return (await Promise.resolve().then(function() {
        return y;
      })).fileURLToPath(t.dirname(e));
    }
    let n = e.lastIndexOf(q);
    if (n === -1) throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");
    return e.slice(0, n);
  }
  o(le, "calculateDirname");
  function ce(r) {
    var e;
    return r.substring(0, r.lastIndexOf("/") + 1) || ((e = globalThis.location) == null ? void 0 : e.toString()) || ".";
  }
  o(ce, "calculateInstallBaseUrl");
  function ue(r) {
    let e = r.FS, n = r.FS.filesystems.MEMFS, t = r.PATH, s = { DIR_MODE: 16895, FILE_MODE: 33279, mount: o(function(a) {
      if (!a.opts.fileSystemHandle) throw new Error("opts.fileSystemHandle is required");
      return n.mount.apply(null, arguments);
    }, "mount"), syncfs: o(async (a, i, l) => {
      try {
        let u = s.getLocalSet(a), c = await s.getRemoteSet(a), d = i ? c : u, f = i ? u : c;
        await s.reconcile(a, d, f), l(null);
      } catch (u) {
        l(u);
      }
    }, "syncfs"), getLocalSet: o((a) => {
      let i = /* @__PURE__ */ Object.create(null);
      function l(d) {
        return d !== "." && d !== "..";
      }
      o(l, "isRealDir");
      function u(d) {
        return (f) => t.join2(d, f);
      }
      o(u, "toAbsolute");
      let c = e.readdir(a.mountpoint).filter(l).map(u(a.mountpoint));
      for (; c.length; ) {
        let d = c.pop(), f = e.stat(d);
        e.isDir(f.mode) && c.push.apply(c, e.readdir(d).filter(l).map(u(d))), i[d] = { timestamp: f.mtime, mode: f.mode };
      }
      return { type: "local", entries: i };
    }, "getLocalSet"), getRemoteSet: o(async (a) => {
      let i = /* @__PURE__ */ Object.create(null), l = await je(a.opts.fileSystemHandle);
      for (let [u, c] of l) u !== "." && (i[t.join2(a.mountpoint, u)] = { timestamp: c.kind === "file" ? new Date((await c.getFile()).lastModified) : /* @__PURE__ */ new Date(), mode: c.kind === "file" ? s.FILE_MODE : s.DIR_MODE });
      return { type: "remote", entries: i, handles: l };
    }, "getRemoteSet"), loadLocalEntry: o((a) => {
      let i = e.lookupPath(a, {}).node, l = e.stat(a);
      if (e.isDir(l.mode)) return { timestamp: l.mtime, mode: l.mode };
      if (e.isFile(l.mode)) return i.contents = n.getFileDataAsTypedArray(i), { timestamp: l.mtime, mode: l.mode, contents: i.contents };
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
    }, "loadRemoteEntry"), storeRemoteEntry: o(async (a, i, l) => {
      let u = a.get(t.dirname(i)), c = e.isFile(l.mode) ? await u.getFileHandle(t.basename(i), { create: !0 }) : await u.getDirectoryHandle(t.basename(i), { create: !0 });
      if (c.kind === "file") {
        let d = await c.createWritable();
        await d.write(l.contents), await d.close();
      }
      a.set(i, c);
    }, "storeRemoteEntry"), removeRemoteEntry: o(async (a, i) => {
      await a.get(t.dirname(i)).removeEntry(t.basename(i)), a.delete(i);
    }, "removeRemoteEntry"), reconcile: o(async (a, i, l) => {
      let u = 0, c = [];
      Object.keys(i.entries).forEach(function(p) {
        let _ = i.entries[p], v = l.entries[p];
        (!v || e.isFile(_.mode) && _.timestamp.getTime() > v.timestamp.getTime()) && (c.push(p), u++);
      }), c.sort();
      let d = [];
      if (Object.keys(l.entries).forEach(function(p) {
        i.entries[p] || (d.push(p), u++);
      }), d.sort().reverse(), !u) return;
      let f = i.type === "remote" ? i.handles : l.handles;
      for (let p of c) {
        let _ = t.normalize(p.replace(a.mountpoint, "/")).substring(1);
        if (l.type === "local") {
          let v = f.get(_), x = await s.loadRemoteEntry(v);
          s.storeLocalEntry(p, x);
        } else {
          let v = s.loadLocalEntry(p);
          await s.storeRemoteEntry(f, _, v);
        }
      }
      for (let p of d) if (l.type === "local") s.removeLocalEntry(p);
      else {
        let _ = t.normalize(p.replace(a.mountpoint, "/")).substring(1);
        await s.removeRemoteEntry(f, _);
      }
    }, "reconcile") };
    r.FS.filesystems.NATIVEFS_ASYNC = s;
  }
  o(ue, "initializeNativeFS");
  var je = o(async (r) => {
    let e = [];
    async function n(s) {
      for await (let a of s.values()) e.push(a), a.kind === "directory" && await n(a);
    }
    o(n, "collect"), await n(r);
    let t = /* @__PURE__ */ new Map();
    t.set(".", r);
    for (let s of e) {
      let a = (await r.resolve(s)).join("/");
      t.set(a, s);
    }
    return t;
  }, "getFsHandles"), Be = Le("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL"), qe = (async function() {
    if (!(globalThis.navigator && (/iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints < "u" && navigator.maxTouchPoints > 1))) try {
      let r = await WebAssembly.compile(Be);
      return await WebAssembly.instantiate(r);
    } catch (r) {
      if (r instanceof WebAssembly.CompileError) return;
      throw r;
    }
  })();
  async function de() {
    let r = await qe;
    if (r) return r.exports;
    let e = Symbol("error marker");
    return { Jsv_GetError_import: o(() => e, "Jsv_GetError_import"), JsvError_Check: o((n) => n === e, "JsvError_Check") };
  }
  o(de, "getJsvErrorImport");
  function pe(r) {
    let e = { config: r, runtimeEnv: h }, n = { noImageDecoding: !0, noAudioDecoding: !0, noWasmDecoding: !1, preRun: ye(r), print: r.stdout, printErr: r.stderr, onExit(t) {
      n.exitCode = t;
    }, thisProgram: r._sysExecutable, arguments: r.args, API: e, locateFile: o((t) => r.indexURL + t, "locateFile"), instantiateWasm: ve(r.indexURL) };
    return n;
  }
  o(pe, "createSettings");
  function fe(r) {
    return function(e) {
      let n = "/";
      try {
        e.FS.mkdirTree(r);
      } catch (t) {
        console.error(`Error occurred while making a home directory '${r}':`), console.error(t), console.error(`Using '${n}' for a home directory instead`), r = n;
      }
      e.FS.chdir(r);
    };
  }
  o(fe, "createHomeDirectory");
  function me(r) {
    return function(e) {
      Object.assign(e.ENV, r);
    };
  }
  o(me, "setEnvironment");
  function he(r) {
    return r ? [async (e) => {
      e.addRunDependency("fsInitHook");
      try {
        await r(e.FS, { sitePackages: e.API.sitePackages });
      } finally {
        e.removeRunDependency("fsInitHook");
      }
    }] : [];
  }
  o(he, "callFsInitHook");
  function _e(r) {
    let e = r.HEAPU32[r._Py_Version >>> 2], n = e >>> 24 & 255, t = e >>> 16 & 255, s = e >>> 8 & 255;
    return [n, t, s];
  }
  o(_e, "computeVersionTuple");
  function ge(r) {
    let e = ae(r);
    return async (n) => {
      n.API.pyVersionTuple = _e(n);
      let [t, s] = n.API.pyVersionTuple;
      n.FS.mkdirTree("/lib"), n.API.sitePackages = `/lib/python${t}.${s}/site-packages`, n.FS.mkdirTree(n.API.sitePackages), n.addRunDependency("install-stdlib");
      try {
        let a = await e;
        n.FS.writeFile(`/lib/python${t}${s}.zip`, a);
      } catch (a) {
        console.error("Error occurred while installing the standard library:"), console.error(a);
      } finally {
        n.removeRunDependency("install-stdlib");
      }
    };
  }
  o(ge, "installStdlib");
  function ye(r) {
    let e;
    return r.stdLibURL != null ? e = r.stdLibURL : e = r.indexURL + "python_stdlib.zip", [ge(e), fe(r.env.HOME), me(r.env), ue, ...he(r.fsInit)];
  }
  o(ye, "getFileSystemInitializationFuncs");
  function ve(r) {
    if (typeof WasmOffsetConverter < "u") return;
    let { binary: e, response: n } = O(r + "pyodide.asm.wasm"), t = de();
    return function(s, a) {
      return (async function() {
        let { Jsv_GetError_import: i, JsvError_Check: l } = await t;
        s.env.Jsv_GetError_import = i, s.env.JsvError_Check = l;
        try {
          let u;
          n ? u = await WebAssembly.instantiateStreaming(n, s) : u = await WebAssembly.instantiate(await e, s);
          let { instance: c, module: d } = u;
          a(c, d);
        } catch (u) {
          console.warn("wasm instantiation failed!"), console.warn(u);
        }
      })(), {};
    };
  }
  o(ve, "getInstantiateWasmFunc");
  var Je = "314.0.2";
  function P(r) {
    return r === void 0 || r.endsWith("/") ? r : r + "/";
  }
  o(P, "withTrailingSlash");
  var M = Je;
  async function be(r = {}) {
    var s, a;
    if (await B(), r.lockFileContents && r.lockFileURL) throw new Error("Can't pass both lockFileContents and lockFileURL");
    let e = r.indexURL || await le();
    if (e = P(I(e)), r.packageBaseUrl = P(r.packageBaseUrl), r.cdnUrl = P(r.packageBaseUrl ?? `https://cdn.jsdelivr.net/pyodide/v${M}/full/`), !r.lockFileContents) {
      let i = r.lockFileURL ?? e + "pyodide-lock.json";
      r.lockFileContents = oe(i), r.packageBaseUrl ?? (r.packageBaseUrl = ce(i));
    }
    r.indexURL = e, r.packageCacheDir && (r.packageCacheDir = P(I(r.packageCacheDir)));
    let n = { jsglobals: globalThis, stdin: globalThis.prompt ? () => globalThis.prompt() : void 0, args: [], env: {}, packages: [], packageCacheDir: r.packageBaseUrl, enableRunUntilComplete: !0, checkAPIVersion: !0, BUILD_ID: "a4189f0fe3d610ecd603639c08596362b70a34b106c58c9a93486c22df4c89a5" }, t = Object.assign(n, r);
    return (s = t.env).HOME ?? (s.HOME = "/home/pyodide"), (a = t.env).PYTHONINSPECT ?? (a.PYTHONINSPECT = "1"), t;
  }
  o(be, "initializeConfiguration");
  function we(r) {
    let e = pe(r), n = e.API;
    return n.lockFilePromise = Promise.resolve(r.lockFileContents), e;
  }
  o(we, "createEmscriptenSettings");
  async function ke(r) {
    if (r.createPyodideModule) return r.createPyodideModule;
    let e = `${r.indexURL}pyodide.asm.mjs`;
    return (await C(e)).default;
  }
  o(ke, "loadWasmScript");
  async function Ee(r, e) {
    if (!r._loadSnapshot) return;
    let n = await r._loadSnapshot, t = ArrayBuffer.isView(n) ? n : new Uint8Array(n);
    return e.noInitialRun = !0, e.INITIAL_MEMORY = t.length, t;
  }
  o(Ee, "prepareSnapshot");
  async function xe(r, e) {
    let n = await r(e);
    if (e.exitCode !== void 0) throw new n.ExitStatus(e.exitCode);
    return n;
  }
  o(xe, "instantiatePyodideModule");
  function Ne(r, e) {
    let n = r.API;
    if (e.pyproxyToStringRepr && n.setPyProxyToStringMethod(!0), e.convertNullToNone && n.setCompatNullToNone(!0), e.toJsLiteralMap && n.setCompatToJsLiteralMap(!0), n.version !== M && e.checkAPIVersion) throw new Error(`Pyodide version does not match: '${M}' <==> '${n.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);
    r.locateFile = (t) => {
      throw t.endsWith(".so") ? new Error(`Failed to find dynamic library "${t}"`) : new Error(`Unexpected call to locateFile("${t}")`);
    };
  }
  o(Ne, "configureAPI");
  function Re(r, e, n) {
    let t = r.API, s;
    return e && (s = t.restoreSnapshot(e)), t.finalizeBootstrap(s, n._snapshotDeserializer);
  }
  o(Re, "bootstrapPyodide");
  async function Se(r, e) {
    let n = r._api;
    return n.sys.path.insert(0, ""), n._pyodide.set_excepthook(), await n.packageIndexReady, n.initializeStreams(e.stdin, e.stdout, e.stderr), r;
  }
  o(Se, "finalizeSetup");
  async function Pe(r = {}) {
    let e = await be(r), n = we(e), t = await ke(e), s = await Ee(e, n), a = await xe(t, n);
    Ne(a, e);
    let i = Re(a, s, e);
    return await Se(i, e);
  }
  o(Pe, "loadPyodide");
  function We(r) {
    return r.crossOriginIsolated === !0 && typeof r.SharedArrayBuffer == "function" ? "isolated" : "compat";
  }
  var $e = `# The in-worker Python runtime, installed into Pyodide once at boot\r
# (bundled as a string via a Vite \`?raw\` import - see raw.d.ts). Implements\r
# per-job isolation (spec 6.2): fresh __main__ module dict per job,\r
# sys.modules snapshot/restore, FS staging under /mnt/blockpy with artifact\r
# diff-back (spec 7.5, LD-3x), scripted stdin, student-relative traceback\r
# line mapping (spec 6.3 - instructor answer_prefix lines are subtracted, as\r
# legacy Skulpt did), live stdout/stderr tee streaming, and opt-in\r
# sys.settrace tracing whose step counter doubles as the instruction limit\r
# (E3, spec 6.2).\r
import builtins\r
import contextlib\r
import io\r
import json\r
import linecache\r
import os\r
import sys\r
import traceback\r
import types\r
import warnings\r
\r
MOUNT = '/mnt/blockpy'\r
TRACE_STORAGE_CAP = 10000\r
# Pyodide tunes the recursion limit to the wasm stack at boot; remember it\r
# so the health canary scales to platforms with shallow stacks (§6.6).\r
BOOT_RECURSION_LIMIT = sys.getrecursionlimit()\r
\r
# Plot capture (spec 10.2): headless Agg backend - figures are snapshotted\r
# into PNGs after each run instead of "shown". Set before matplotlib can be\r
# imported; silence Agg's "cannot be shown" warning from plt.show().\r
os.environ.setdefault('MPLBACKEND', 'Agg')\r
warnings.filterwarnings('ignore', message='.*non-interactive.*cannot be shown.*')\r
\r
\r
class TraceLimitError(Exception):\r
    pass\r
\r
\r
class _Tee(io.StringIO):\r
    """Accumulates output while forwarding each chunk to a JS callback."""\r
\r
    def __init__(self, callback):\r
        super().__init__()\r
        self.callback = callback\r
\r
    def write(self, text):\r
        # JS null arrives as JsNull (not None) - guard on callability.\r
        if text and callable(self.callback):\r
            self.callback(text)\r
        return super().write(text)\r
\r
\r
class StudioRuntime:\r
    def __init__(self):\r
        self.baseline_modules = set(sys.modules)\r
        self.last_globals = None\r
        self.staged = {}\r
\r
    # -- filesystem staging (spec 7.5) --------------------------------------\r
\r
    @staticmethod\r
    def staged_path(name):\r
        """Resolve a staged file name under MOUNT, refusing escapes.\r
\r
        Names come from the VFS (student-created file tabs, uploads): an\r
        empty name or one that normalizes outside the mount ('/etc/x',\r
        '../x') is a system error, never something to write blindly.\r
        """\r
        if not isinstance(name, str) or not name.strip():\r
            raise ValueError('Cannot stage a file with an empty name')\r
        path = os.path.normpath(os.path.join(MOUNT, name))\r
        if path == MOUNT or not path.startswith(MOUNT + '/'):\r
            raise ValueError(\r
                'Cannot stage ' + repr(name) + ': the name escapes the working directory'\r
            )\r
        return path\r
\r
    def stage_files(self, files):\r
        # Validate every name BEFORE touching the disk so a bad name never\r
        # leaves a half-staged mount behind.\r
        paths = {name: self.staged_path(name) for name in files}\r
        os.makedirs(MOUNT, exist_ok=True)\r
        for root, dirs, names in os.walk(MOUNT, topdown=False):\r
            for name in names:\r
                os.remove(os.path.join(root, name))\r
            for d in dirs:\r
                os.rmdir(os.path.join(root, d))\r
        self.staged = dict(files)\r
        for name, contents in files.items():\r
            path = paths[name]\r
            parent = os.path.dirname(path)\r
            if parent:\r
                os.makedirs(parent, exist_ok=True)\r
            with open(path, 'w', encoding='utf-8') as handle:\r
                handle.write(contents)\r
        os.chdir(MOUNT)\r
\r
    def collect_artifacts(self):\r
        artifacts = {}\r
        for root, _dirs, names in os.walk(MOUNT):\r
            for name in names:\r
                path = os.path.join(root, name)\r
                rel = os.path.relpath(path, MOUNT).replace(os.sep, '/')\r
                try:\r
                    with open(path, 'r', encoding='utf-8') as handle:\r
                        contents = handle.read()\r
                except (OSError, UnicodeDecodeError):\r
                    continue\r
                if self.staged.get(rel) != contents:\r
                    artifacts[rel] = contents\r
        return artifacts\r
\r
    # -- per-job isolation (spec 6.2) ----------------------------------------\r
\r
    def restore_modules(self):\r
        for name in list(sys.modules):\r
            if name in self.baseline_modules:\r
                continue\r
            module = sys.modules[name]\r
            file = getattr(module, '__file__', '') or ''\r
            if '/site-packages/' in file:\r
                # Installed packages (loadPackage/micropip) are expensive to\r
                # re-initialize (matplotlib takes seconds) and stateless per\r
                # job in practice - adopt into the baseline. Per-job figure\r
                # state is reset by capture_figures (plt.close('all')).\r
                self.baseline_modules.add(name)\r
                continue\r
            # Stdlib, student/staged (/mnt/blockpy), and dynamic modules stay\r
            # per-job (§6.2): purge so the next run reimports fresh state.\r
            del sys.modules[name]\r
\r
    # -- mock URLs (spec 10.4, legacy configurations.js openURL) -------------\r
\r
    def install_requests_mock(self):\r
        """Install a per-job \`requests\` shim resolving \`?mock_urls.blockpy\`.\r
\r
        Legacy parity: ALL url access goes through the mock table - the map\r
        is JSON \`{filename: [url, ...]}\`; a hit returns the staged file's\r
        contents, no map or an unknown url raises the legacy IOError texts\r
        (configurations.js:135-155). The module is dynamic (no __file__), so\r
        restore_modules purges it after every job.\r
        """\r
        mock_map = None\r
        raw = self.staged.get('mock_urls.blockpy')\r
        if raw is not None:\r
            try:\r
                mock_map = json.loads(raw)\r
            except Exception:  # noqa: BLE001 - bad JSON = no mocks (legacy)\r
                mock_map = None\r
        staged = self.staged\r
\r
        class MockResponse:\r
            def __init__(self, text):\r
                self.text = text\r
                self.content = text.encode('utf-8')\r
                self.status_code = 200\r
                self.ok = True\r
\r
            def json(self):\r
                return json.loads(self.text)\r
\r
            def raise_for_status(self):\r
                return None\r
\r
        def get(url, *args, **kwargs):\r
            if mock_map is None:\r
                raise OSError(\r
                    'Cannot access url: URL Data was not made available '\r
                    'for this assignment'\r
                )\r
            for filename, urls in mock_map.items():\r
                if url in urls:\r
                    contents = staged.get(filename)\r
                    if contents is None:\r
                        # Map keys use legacy prefixed names; staging is\r
                        # prefix-stripped.\r
                        contents = staged.get(filename.lstrip('!^?&$*#'))\r
                    if contents is None:\r
                        raise OSError('File not found: ' + filename)\r
                    return MockResponse(contents)\r
            raise OSError(\r
                'Cannot access url: ' + url +\r
                ' was not made available for this assignment'\r
            )\r
\r
        module = types.ModuleType('requests')\r
        module.get = get\r
        module.Response = MockResponse\r
        sys.modules['requests'] = module\r
\r
    # -- plot capture (spec 10.2) --------------------------------------------\r
\r
    def capture_figures(self):\r
        """Snapshot every open matplotlib figure to base64 PNG, then close.\r
\r
        Runs only when the student's code actually imported matplotlib.\r
        Fail-soft: a broken figure never breaks the run result.\r
        """\r
        if 'matplotlib' not in sys.modules:\r
            return []\r
        try:\r
            import base64\r
            import matplotlib.pyplot as plt\r
            images = []\r
            for number in plt.get_fignums():\r
                buffer = io.BytesIO()\r
                plt.figure(number).savefig(buffer, format='png')\r
                images.append(base64.b64encode(buffer.getvalue()).decode('ascii'))\r
            plt.close('all')\r
            return images\r
        except Exception:  # noqa: BLE001\r
            return []\r
\r
    # -- tracing (E3): step events + instruction limit ------------------------\r
\r
    def make_tracer(self, target_filename, prefix_lines, step_limit, steps):\r
        state = {'count': 0}\r
\r
        def snapshot_locals(frame):\r
            snapshot = {}\r
            for key, value in frame.f_locals.items():\r
                if key.startswith('__'):\r
                    continue\r
                try:\r
                    snapshot[key] = repr(value)[:120]\r
                except Exception:  # noqa: BLE001\r
                    snapshot[key] = '<unrepresentable>'\r
            return snapshot\r
\r
        def tracer(frame, event, arg):\r
            if frame.f_code.co_filename != target_filename:\r
                return None\r
            state['count'] += 1\r
            if step_limit is not None and state['count'] > step_limit:\r
                raise TraceLimitError(\r
                    'Execution exceeded the configured limit of '\r
                    + str(step_limit) + ' steps'\r
                )\r
            if len(steps) < TRACE_STORAGE_CAP:\r
                step = {\r
                    'event': event,\r
                    'line': frame.f_lineno,\r
                    'student_line': frame.f_lineno - prefix_lines,\r
                }\r
                # 'line' fires BEFORE the line executes; 'return' fires as\r
                # the frame exits, so the module-level return carries the\r
                # final variable state (the trace explorer's last page).\r
                if event == 'line' or event == 'return':\r
                    step['locals'] = snapshot_locals(frame)\r
                steps.append(step)\r
            return tracer\r
\r
        return tracer\r
\r
    # -- execution ------------------------------------------------------------\r
\r
    @staticmethod\r
    def can_suspend():\r
        """True when JSPI is available, so run_sync can suspend at input()."""\r
        try:\r
            from pyodide.ffi import can_run_sync\r
            return bool(can_run_sync())\r
        except Exception:  # noqa: BLE001 - non-Pyodide/no-JSPI hosts\r
            return False\r
\r
    def run(self, code, filename='answer.py', prefix='', suffix='',\r
            inputs=None, mode='exec', extract_result=False,\r
            trace=False, trace_limit=None, on_stdout=None, on_stderr=None,\r
            allow_real_requests=False, on_input=None):\r
        full = (prefix or '') + code + (suffix or '')\r
        prefix_lines = (prefix or '').count('\\n')\r
        # JS null arrives as JsNull (not None) - normalize scalar options.\r
        if not isinstance(trace_limit, int):\r
            trace_limit = None\r
\r
        module = types.ModuleType('__main__')\r
        module.__dict__['__file__'] = filename\r
\r
        input_values = iter(inputs or [])\r
        interactive = callable(on_input) and self.can_suspend()\r
\r
        def scripted_input(prompt=''):\r
            # Queued inputs replay first (legacy Edit Queued Inputs); the\r
            # prompt echoes to stdout exactly as before.\r
            try:\r
                value = next(input_values)\r
            except StopIteration:\r
                value = None\r
            if value is not None:\r
                print(prompt, end='')\r
                return value\r
            if interactive:\r
                # Interactive input (spec §6.5): JSPI suspends this\r
                # synchronous call while the console shows a textbox. The\r
                # prompt is NOT echoed to stdout - the console's input line\r
                # displays (and then freezes with) it, legacy-style.\r
                from pyodide.ffi import run_sync\r
                try:\r
                    value = run_sync(on_input(str(prompt)))\r
                except Exception:  # noqa: BLE001 - the client answered EOF\r
                    value = None\r
                if value is None or not isinstance(value, str):\r
                    raise EOFError('No input available')\r
                return value\r
            print(prompt, end='')\r
            raise EOFError('No scripted input available')\r
\r
        # The executed source must exist as a REAL file under its compile\r
        # filename: Python 3.13+ recovers traceback source lines through\r
        # linecache (SyntaxError.text is no longer always carried), so a\r
        # synthetic filename yields line-less tracebacks. The staged map is\r
        # updated so artifact diff-back never reports the write itself.\r
        try:\r
            parent = os.path.dirname(filename)\r
            if parent:\r
                os.makedirs(parent, exist_ok=True)\r
            with open(filename, 'w', encoding='utf-8') as handle:\r
                handle.write(full)\r
            self.staged[filename] = full\r
            # Same filename, new contents every run - drop stale cache\r
            # entries (MEMFS mtime granularity defeats checkcache).\r
            linecache.clearcache()\r
        except OSError:\r
            pass  # absolute/odd filenames: run anyway, tracebacks degrade\r
\r
        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)\r
        steps = []\r
        old_input = builtins.input\r
        old_main = sys.modules.get('__main__')\r
        builtins.input = scripted_input\r
        sys.modules['__main__'] = module\r
        # Legacy parity (spec 10.4): requests resolves through the mock-urls\r
        # table, never the network - unless the allow_real_requests setting\r
        # is on (M3.5), in which case the REAL requests package (installed\r
        # host-side with pyodide-http patching) stays importable.\r
        if not allow_real_requests:\r
            self.install_requests_mock()\r
        error = None\r
        value = None\r
        try:\r
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):\r
                compiled = compile(full, filename, mode)\r
                if trace:\r
                    sys.settrace(\r
                        self.make_tracer(filename, prefix_lines, trace_limit, steps),\r
                    )\r
                try:\r
                    result = eval(compiled, module.__dict__)\r
                finally:\r
                    if trace:\r
                        sys.settrace(None)\r
                if mode == 'eval':\r
                    value = repr(result)\r
        except BaseException as exc:  # noqa: BLE001 - full error report needed\r
            error = self.format_error(exc, filename, prefix_lines)\r
        finally:\r
            # Snapshot plots BEFORE the module restore unloads matplotlib -\r
            # figures drawn before an error still surface (spec 10.2).\r
            images = self.capture_figures()\r
            builtins.input = old_input\r
            if old_main is not None:\r
                sys.modules['__main__'] = old_main\r
            self.restore_modules()\r
\r
        if error is None and extract_result and 'result' in module.__dict__:\r
            # quiz.preprocess: the harness serializes \`result\`, so a\r
            # non-serializable value is OUR failure to report as a system\r
            # error - not a TypeError pinned on the student's code.\r
            try:\r
                value = json.dumps(module.__dict__['result'])\r
            except (TypeError, ValueError) as exc:\r
                error = {\r
                    'type': 'SystemError',\r
                    'message': 'The preprocess \`result\` is not JSON-serializable: ' + str(exc),\r
                    'line': None,\r
                    'student_line': None,\r
                    'traceback': (\r
                        'SystemError: result is not JSON-serializable: ' + str(exc) + chr(10)\r
                    ),\r
                }\r
        self.last_globals = module.__dict__\r
        return {\r
            'error': error,\r
            'value': value,\r
            'stdout': stdout.getvalue(),\r
            'stderr': stderr.getvalue(),\r
            'trace': steps if trace else None,\r
            'images': images,\r
        }\r
\r
    def evaluate(self, expression, on_stdout=None, on_stderr=None):\r
        """Persistent REPL bound to the last run's namespace (spec 6.4)."""\r
        target = self.last_globals if self.last_globals is not None else {}\r
        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)\r
        error = None\r
        value = None\r
        try:\r
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):\r
                compiled = compile(expression, 'evaluations', 'eval')\r
                value = repr(eval(compiled, target))\r
        except BaseException as exc:  # noqa: BLE001\r
            error = self.format_error(exc, 'evaluations', 0)\r
        finally:\r
            self.restore_modules()\r
        return {\r
            'error': error,\r
            'value': value,\r
            'stdout': stdout.getvalue(),\r
            'stderr': stderr.getvalue(),\r
            'trace': None,\r
        }\r
\r
    def clear_namespace(self):\r
        self.last_globals = None\r
\r
    # -- crash recovery (spec 6.6) ---------------------------------------------\r
\r
    def stack_canary(self):\r
        """Probe wasm stack headroom after a job (§6.6 crash recovery).\r
\r
        A stack-overflow fatal (unbounded recursion through C layers, e.g. a\r
        recursive __getattr__ - pyodide#5959/#5987) can leave the interpreter\r
        dead or with a corrupted stack pointer WITHOUT failing the job that\r
        caused it (grading fail-softs around it). On a healthy interpreter\r
        this probe returns instantly; on a poisoned one it triggers the\r
        fatal NOW, JS-side, where the worker host answers by reloading the\r
        runner - instead of the fatal landing on the student's next Run.\r
        """\r
        prev = sys.getrecursionlimit()\r
        depth = min(500, BOOT_RECURSION_LIMIT // 2)\r
\r
        def probe(n):\r
            return probe(n - 1) if n else 0\r
\r
        try:\r
            sys.setrecursionlimit(max(prev, depth * 4))\r
            return probe(depth)\r
        finally:\r
            sys.setrecursionlimit(prev)\r
\r
    # -- error shaping (spec 6.3) ----------------------------------------------\r
\r
    def format_error(self, exc, filename, prefix_lines):\r
        line = None\r
        if isinstance(exc, SyntaxError) and exc.filename == filename:\r
            line = exc.lineno\r
        else:\r
            for frame, lineno in traceback.walk_tb(exc.__traceback__):\r
                if frame.f_code.co_filename == filename:\r
                    line = lineno\r
        # Students must never see the runtime harness frames. This module is\r
        # loaded via runPython (co_filename "<exec>"), so the caught exception\r
        # opens with our own run/evaluate frame - drop every leading harness\r
        # frame before formatting (the student's <module> frame comes right\r
        # after; a SyntaxError from compile() has ONLY harness frames and\r
        # formats fine with tb=None from its own attributes).\r
        tb = exc.__traceback__\r
        while tb is not None and tb.tb_frame.f_code.co_filename == '<exec>':\r
            tb = tb.tb_next\r
        parts = traceback.format_exception(type(exc), exc, tb)\r
        # Non-leading harness frames (e.g. the trace-limit tracer at the tail)\r
        # can't be dropped by the walk above - filter their formatted entries.\r
        formatted = ''.join(\r
            part for part in parts if not part.startswith('  File "<exec>"')\r
        )\r
        student_line = None if line is None else line - prefix_lines\r
        return {\r
            'type': type(exc).__name__,\r
            'message': str(exc),\r
            'line': line,\r
            'student_line': student_line,\r
            'traceback': formatted,\r
        }\r
\r
\r
_studio_runtime = StudioRuntime()\r
`, Ge = `# The Pedal "blockpy environment" contract for Studio (spec 10.1) - a\r
# faithful port of the legacy instructor wrappers:\r
#   blockpy/src/engine/on_run.js   WRAP_INSTRUCTOR_CODE  (grading pass)\r
#   blockpy/src/engine/on_eval.js  WRAP_INSTRUCTOR_CODE  (console-eval pass)\r
# built on pedal.environments.blockpy.setup_environment, exactly like legacy:\r
# the environment supplies the HtmlFormatter, source verify, tifa (unless\r
# skipped), set_input, and the load-bearing start_trace -> run ordering\r
# (Spike S3) in one call.\r
#\r
# Ported wrapper behaviors: bakery student_tests.reset() per pass, the\r
# preloaded instructor namespace (parse_program + sandbox/core commands),\r
# skip_run (disable_instructor_run) / skip_tifa (disable_tifa) settings,\r
# pool-question seeding by submission id (LD-22 fixes the legacy\r
# order-of-operations bug that erased the seed), final.instructions /\r
# final.positives (with the else_message quirk) / final.systems extraction,\r
# and the on_eval pipeline: keep the last run's report + sandbox, clear the\r
# presented feedback, pedal \`evaluate\` the console expression, exec on_eval,\r
# re-resolve.\r
#\r
# File staging implements the legacy engine-virtual names (A1 section 3):\r
# instructor-owned files (!, ?, & prefixes) are staged prefix-stripped into\r
# the working directory AND (for .py files) into an _instructor package,\r
# because real graders do \`from _instructor.helpers import ...\` (verified\r
# against the bakery corpus).\r
import importlib\r
import json\r
import linecache\r
import os\r
import shutil\r
import sys\r
\r
_INSTRUCTOR_PKG = '_instructor'\r
_PREFIXES = '!^?&$*#'\r
\r
\r
def _studio_patch_pedal_traceback():\r
    """Pedal 3.0.1 on Python 3.13+: SyntaxError feedback crashes.\r
\r
    CPython renamed FrameSummary._line to _lines (3.13); pedal's\r
    _fix_frame_line writes the recovered source to \`_lines\`, but its own\r
    FakeFrame.line property still reads \`_line\` - so format_line receives\r
    None and dies in inject_line ("'NoneType' object has no attribute\r
    'split'"), turning EVERY student syntax error into an Internal Grading\r
    Error. Until the upstream fix ships (SERVER-TEAM/PEDAL FLAG: make\r
    FakeFrame honor the _lines rename + None-guard format_line's 3.13\r
    branch), patch FakeFrame.line to fall back _line -> _lines ->\r
    linecache (the grading staging below writes the REAL files linecache\r
    needs). Idempotent; safe on older pedals/pythons (pure fallback).\r
    """\r
    from pedal.utilities import exceptions as pedal_exceptions\r
\r
    fake_frame = pedal_exceptions.FakeFrame\r
    if getattr(fake_frame, '_studio_patched', False):\r
        return\r
\r
    def line(self):\r
        for value in (self._line, getattr(self, '_lines', None)):\r
            if isinstance(value, str):\r
                return value\r
        text = linecache.getline(self.filename or '', self.lineno or 0)\r
        return text.rstrip('\\n') if text else ''\r
\r
    fake_frame.line = property(line)\r
    fake_frame._studio_patched = True\r
\r
\r
def _studio_safe_name(name, base):\r
    """Validate a prefix-stripped staging name: relative, inside the cwd.\r
\r
    Raised errors surface as the job's PedalEnvironmentError (the runner\r
    wraps staging) - a clear system error instead of writing '/etc/x' or\r
    crashing on an empty key.\r
    """\r
    if not isinstance(base, str) or not base.strip():\r
        raise ValueError('Cannot stage a file with an empty name: ' + repr(name))\r
    cwd = os.getcwd()\r
    path = os.path.normpath(os.path.join(cwd, base))\r
    root = cwd.rstrip('/') + '/'\r
    if path == cwd or not path.startswith(root):\r
        raise ValueError(\r
            'Cannot stage ' + repr(name) + ': the name escapes the working directory'\r
        )\r
    return os.path.relpath(path, cwd)\r
\r
\r
def _studio_pedal_stage(files):\r
    if os.path.isdir(_INSTRUCTOR_PKG):\r
        shutil.rmtree(_INSTRUCTOR_PKG)\r
    os.makedirs(_INSTRUCTOR_PKG, exist_ok=True)\r
    with open(os.path.join(_INSTRUCTOR_PKG, '__init__.py'), 'w') as handle:\r
        handle.write('')\r
    for name, contents in files.items():\r
        prefix = name[0] if name[:1] in _PREFIXES else ''\r
        base = name[1:] if prefix else name\r
        if prefix in ('^', '$', '#'):\r
            continue  # never mounted for grading (A1: editor metadata/wire)\r
        base = _studio_safe_name(name, base)\r
        parent = os.path.dirname(base)\r
        if parent:\r
            os.makedirs(parent, exist_ok=True)\r
        with open(base, 'w', encoding='utf-8') as handle:\r
            handle.write(contents)\r
        if prefix in ('!', '?', '&') and base.endswith('.py'):\r
            with open(os.path.join(_INSTRUCTOR_PKG, base), 'w', encoding='utf-8') as handle:\r
                handle.write(contents)\r
    # fresh imports of _instructor.* each grading pass\r
    for module_name in list(sys.modules):\r
        if module_name == _INSTRUCTOR_PKG or module_name.startswith(_INSTRUCTOR_PKG + '.'):\r
            del sys.modules[module_name]\r
    importlib.invalidate_caches()\r
\r
\r
# The names legacy preloaded into the instructor script's namespace\r
# (on_run.js:33-36 / on_eval.js:15-18) - graders may use parse_program and\r
# the sandbox/core commands without importing them.\r
_INSTRUCTOR_PRELUDE = (\r
    'from pedal.cait.cait_api import parse_program\\n'\r
    'from pedal.sandbox.commands import *\\n'\r
    'from pedal.core.commands import *\\n'\r
)\r
\r
\r
def _studio_instructor_globals(student, student_code):\r
    from pedal.core.report import MAIN_REPORT\r
    namespace = {\r
        '__name__': '__main__',\r
        'student': student,\r
        'student_code': student_code,\r
        'MAIN_REPORT': MAIN_REPORT,\r
    }\r
    exec(compile(_INSTRUCTOR_PRELUDE, '<pedal prelude>', 'exec'), namespace)\r
    return namespace\r
\r
\r
def _studio_pedal_resolve():\r
    from pedal.core.report import MAIN_REPORT\r
    from pedal.resolvers.simple import resolve\r
\r
    final = resolve(report=MAIN_REPORT)\r
    # Legacy countTestCases (feedback.js:341-368): tallies over ALL\r
    # considered feedback objects; category 'specification' = test cases,\r
    # inactive (condition not met) = success. bool(fb) is Pedal's\r
    # _met_condition, the same check Skulpt's isTrue performed. Pedal 3\r
    # files unmet feedback under ignored_feedback (legacy Pedal kept one\r
    # list), so the legacy iteration covers both.\r
    tests = feedback_count = successes = feedback_success = 0\r
    for fb in MAIN_REPORT.feedback + MAIN_REPORT.ignored_feedback:\r
        active = bool(fb)\r
        if str(fb.category) == 'specification':\r
            tests += 1\r
            if not active:\r
                successes += 1\r
        feedback_count += 1\r
        if not active:\r
            feedback_success += 1\r
\r
    # Questions (on_run.js:74-76): the LAST instructions feedback replaces\r
    # the instructions pane (legacy set_instructions).\r
    instructions = None\r
    if final.instructions:\r
        instructions = str(final.instructions[-1].message)\r
\r
    # Positive feedback (on_run.js:78-88), quirk preserved: an INACTIVE\r
    # positive presents its else_message.\r
    positives = []\r
    for positive in final.positives:\r
        message = positive.message\r
        if not positive:\r
            message = positive.else_message\r
        positives.append({\r
            'title': str(positive.title),\r
            'label': str(positive.label),\r
            'message': str(message),\r
        })\r
\r
    # System messages (on_run.js:90-95): log/debug go to the dev console\r
    # (legacy console_log / console_debug).\r
    systems = []\r
    for system in final.systems:\r
        if str(system.label) in ('log', 'debug'):\r
            systems.append({\r
                'label': str(system.label),\r
                'title': str(system.title),\r
                'message': str(system.message),\r
            })\r
\r
    # First error line (feedback.js:155-165 findFirstErrorLine reads\r
    # DATA['location'].line) - drives the editor-error-line highlight.\r
    line = None\r
    try:\r
        data = final.data\r
        location = data.get('location') if isinstance(data, dict) else None\r
        if location is not None:\r
            line = getattr(location, 'line', None)\r
    except Exception:  # noqa: BLE001 - highlight is best-effort\r
        line = None\r
\r
    return {\r
        'unit_tests': {\r
            'tests': tests,\r
            'feedbacks': feedback_count,\r
            'successes': successes,\r
            'feedbackSuccess': feedback_success,\r
        },\r
        'success': bool(final.success),\r
        'score': final.score,\r
        'category': str(final.category),\r
        'label': str(final.label),\r
        'title': str(final.title),\r
        'message': str(final.message),\r
        # Legacy HIDE global (on_run.js:73): suppresses correctness\r
        # display AND gates markCorrect in the submission POST (14.3).\r
        'hide_correctness': bool(final.hide_correctness),\r
        'instructions': instructions,\r
        'positives': positives,\r
        'systems': systems,\r
        'line': line,\r
    }\r
\r
\r
def _studio_fail_soft():\r
    # Grader or Pedal-internal crash (e.g. Pedal 3.0.1's syntax-error\r
    # formatter breaks on Python 3.14 when SyntaxError.text is None -\r
    # see docs/appendices/skulpt-compat.md). Surface a renderable\r
    # system-error feedback instead of killing the run; the client logs\r
    # it as X-System.Error (legacy pathway).\r
    import traceback as _tb\r
    return {\r
        'success': False,\r
        'score': 0,\r
        'category': 'system',\r
        'label': 'internal_error',\r
        'title': 'Internal Grading Error',\r
        'message': 'The grading script failed to run. '\r
                   'Please report this to your instructor.',\r
        'system_error': _tb.format_exc(),\r
    }\r
\r
\r
def _studio_pedal_grade(student_code, on_run, files_json, inputs, options_json):\r
    from pedal.core.report import MAIN_REPORT\r
\r
    _studio_patch_pedal_traceback()\r
    MAIN_REPORT.clear()\r
    options = json.loads(options_json) if options_json else {}\r
    _studio_pedal_stage(json.loads(files_json) if files_json else {})\r
\r
    try:\r
        # bakery's module-level student_tests ledger lives in site-packages\r
        # and survives across runs - legacy reset it every grading pass\r
        # (on_run.js:30-31). Optional: bakery may not be installed.\r
        try:\r
            from bakery import student_tests\r
            student_tests.reset()\r
        except Exception:  # noqa: BLE001\r
            pass\r
\r
        skip_run = bool(options.get('skip_run'))\r
        skip_tifa = bool(options.get('skip_tifa'))\r
        # Legacy: no inputs at all when the student run is skipped\r
        # (on_run.js:40-41).\r
        run_inputs = None if skip_run else list(inputs or [])\r
\r
        # The submission carries the STUDENT-visible files: answer.py +\r
        # chomped ?/& instructor extras + student extras (legacy\r
        # getAllStudentFiles, instructor.js:69-83). The instructor staging\r
        # view lives on DISK (open() + _instructor imports), not here.\r
        student_files = dict(options.get('student_files') or {})\r
        student_files['answer.py'] = student_code\r
\r
        # Real source files for every compiled name: Python 3.13+ recovers\r
        # traceback/SyntaxError source lines through linecache, so grading\r
        # against purely-synthetic filenames loses the offending line (and\r
        # the FakeFrame patch above falls back to linecache). Written AFTER\r
        # the instructor staging so answer.py always carries THIS pass's\r
        # student code.\r
        for _name, _contents in list(student_files.items()) + [('on_run.py', on_run)]:\r
            try:\r
                _parent = os.path.dirname(_name)\r
                if _parent:\r
                    os.makedirs(_parent, exist_ok=True)\r
                with open(_name, 'w', encoding='utf-8') as _handle:\r
                    _handle.write(_contents)\r
            except (OSError, TypeError):\r
                pass  # odd names/contents: grading proceeds, lines degrade\r
        linecache.clearcache()\r
\r
        # setup_environment = BlockPyEnvironment: HtmlFormatter + verify +\r
        # (unless skipped) tifa + set_input + start_trace -> run, exactly\r
        # the legacy pipeline (on_run.js:38-53).\r
        from pedal.environments.blockpy import setup_environment\r
        env = setup_environment(\r
            files=student_files,\r
            main_file='answer.py',\r
            main_code=student_code,\r
            skip_tifa=skip_tifa,\r
            skip_run=skip_run,\r
            inputs=run_inputs,\r
            report=MAIN_REPORT,\r
        )\r
\r
        # Pool-question seed = submission id (on_run.js:43-45). LEGACY BUG\r
        # FIXED (ledger LD-22): legacy called set_seed BEFORE\r
        # setup_environment, whose report.clear() erased the stored seed\r
        # (report['questions']['seed']) - pools were never actually seeded.\r
        # Seeding AFTER setup makes it stick.\r
        seed = options.get('seed')\r
        if seed is not None and seed != '':\r
            try:\r
                from pedal.questions import set_seed\r
                set_seed(str(seed))\r
            except Exception:  # noqa: BLE001\r
                pass\r
\r
        student = env.fields['student']\r
        exec(compile(on_run, 'on_run.py', 'exec'),\r
             _studio_instructor_globals(student, student_code))\r
        return _studio_pedal_resolve()\r
    except BaseException:  # noqa: BLE001 - grading must fail soft\r
        return _studio_fail_soft()\r
\r
\r
def _studio_pedal_evaluate(evaluation, on_eval, options_json):\r
    # Console-evaluation grading (on_eval.js): KEEP the last grading pass's\r
    # report and sandbox; clear the presented feedback (legacy "backed up"\r
    # MAIN_REPORT.feedback into a local it never read again - the effective\r
    # behavior is a plain clear, on_eval.js:20-24); pedal-\`evaluate\` the\r
    # console expression inside the student's sandbox; exec the instructor's\r
    # on_eval script; re-resolve.\r
    from pedal.core.report import MAIN_REPORT\r
\r
    del options_json  # reserved (parity with _studio_pedal_grade)\r
    _studio_patch_pedal_traceback()\r
    try:\r
        MAIN_REPORT.feedback.clear()\r
        # Suppressed feedback is presented too (the resolver walks it) -\r
        # leaving the last pass's entries would bleed into this one.\r
        getattr(MAIN_REPORT, 'ignored_feedback', []).clear()\r
        from pedal.sandbox.commands import evaluate, get_sandbox\r
        student = get_sandbox(report=MAIN_REPORT)\r
        evaluate(evaluation, report=MAIN_REPORT)\r
        exec(compile(on_eval, 'on_eval.py', 'exec'),\r
             _studio_instructor_globals(student, evaluation))\r
        return _studio_pedal_resolve()\r
    except BaseException:  # noqa: BLE001 - grading must fail soft\r
        return _studio_fail_soft()\r
`;
  const Ie = ["pedal>=3.0.3", "curriculum-sneks", "bakery"];
  class J {
    constructor(e, n) {
      this.grade_ = e, this.evaluate_ = n;
    }
    /**
     * Install wheels (micropip) and the environment module. Call once per
     * interpreter; grading calls are then synchronous and isolated per call
     * via MAIN_REPORT.clear() (verified in Spike S3).
     */
    static async install(e, n = Ie) {
      await e.loadPackage("micropip"), await e.runPythonAsync(
        `import micropip
await micropip.install(${JSON.stringify(n)})`
      ), e.runPython(Ge);
      const t = e.globals.get("_studio_pedal_grade"), s = e.globals.get("_studio_pedal_evaluate");
      return new J(t, s);
    }
    grade(e) {
      const n = this.grade_(
        e.studentCode,
        e.onRun,
        JSON.stringify(e.files ?? {}),
        e.inputs ?? [],
        JSON.stringify({
          skip_tifa: e.skipTifa ?? !1,
          skip_run: e.skipRun ?? !1,
          seed: e.seed ?? null,
          student_files: e.studentFiles ?? {}
        })
      ), t = n.toJs({ dict_converter: Object.fromEntries });
      return n.destroy(), t;
    }
    /**
     * Console-eval grading (on_eval.js): runs against the LAST grade()'s
     * report/sandbox in this interpreter - call only after a grading pass.
     */
    evaluateGrade(e) {
      const n = this.evaluate_(e.evaluation, e.onEval, "{}"), t = n.toJs({ dict_converter: Object.fromEntries });
      return n.destroy(), t;
    }
  }
  const He = () => typeof WebAssembly.Suspending == "function", L = (r) => {
    const e = r.toJs({ dict_converter: Object.fromEntries });
    return r.destroy(), e;
  };
  class W {
    constructor(e, n) {
      g(this, "runtime");
      g(this, "pedalEnv", null);
      /** Wheel specs already installed into this interpreter (ensurePedal). */
      g(this, "pedalPackages", /* @__PURE__ */ new Set());
      g(this, "realRequestsReady", !1);
      this.pyodide = e, this.runtime = n;
    }
    /** Install the runtime module into a loaded Pyodide instance. */
    static create(e) {
      e.runPython($e);
      const n = e.globals.get("_studio_runtime");
      return new W(e, n);
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
     * Lazy Pedal environment - wheels install on the first grading job. The
     * install is keyed on the package list: a later job asking for wheels
     * this interpreter has not seen yet (a different assignment's
     * `pedal.packages`) installs the missing ones instead of silently
     * grading with the first job's set.
     */
    async ensurePedal(e) {
      const n = e ?? Ie, t = n.filter((s) => !this.pedalPackages.has(s));
      if (this.pedalEnv === null || t.length > 0) {
        this.pedalEnv = await J.install(
          this.pyodide,
          this.pedalEnv === null ? n : t
        );
        for (const s of n) this.pedalPackages.add(s);
      }
      return this.pedalEnv;
    }
    /**
     * Pedal grading job (spec §10.1): the environment re-runs the student
     * submission inside Pedal's sandbox, so no exec happens here. Grader and
     * Pedal crashes are fail-soft inside the environment (`system_error`
     * feedback); only wheel-install failures surface as job errors.
     */
    async executePedal(e, n) {
      const t = e.pedal;
      try {
        const s = await this.ensurePedal(t.packages), a = t.evaluation !== void 0 ? (
          // on_eval pipeline (on_eval.js): reuses the last grading
          // pass's report/sandbox - no staging, no student re-run.
          s.evaluateGrade({
            evaluation: t.evaluation,
            onEval: t.onRun
          })
        ) : s.grade({
          studentCode: e.code,
          onRun: t.onRun,
          files: e.files,
          inputs: t.inputs ?? e.inputsPrefill,
          studentFiles: t.studentFiles,
          skipTifa: t.skipTifa,
          skipRun: t.skipRun,
          seed: t.seed
        });
        return {
          jobId: e.id,
          success: !0,
          stdout: "",
          stderr: "",
          artifacts: {},
          feedback: a,
          durationMs: Date.now() - n
        };
      } catch (s) {
        const a = s instanceof Error ? s.message : String(s);
        return {
          jobId: e.id,
          success: !1,
          stdout: "",
          stderr: "",
          error: {
            type: "PedalEnvironmentError",
            message: a,
            line: null,
            studentLine: null,
            traceback: a + `
`
          },
          artifacts: {},
          durationMs: Date.now() - n
        };
      }
    }
    async execute(e, n = {}) {
      var f, p, _, v;
      const t = Date.now();
      if (e.pedal)
        return this.executePedal(e, t);
      try {
        await ((p = (f = this.pyodide).loadPackagesFromImports) == null ? void 0 : p.call(f, e.code));
      } catch {
      }
      if (e.allowRealRequests)
        try {
          await this.ensureRealRequests();
        } catch {
        }
      if (e.warmPedal)
        try {
          await this.ensurePedal();
        } catch {
        }
      this.pyodide.runPython(
        `_studio_runtime.stage_files(__import__('json').loads(${JSON.stringify(
          JSON.stringify(e.files)
        )}))`
      );
      const s = n.onStdout ?? null, a = n.onStderr ?? null, i = (e.interactiveInput ? n.onInput : void 0) ?? null, l = [
        e.code,
        e.filename ?? "answer.py",
        e.answerPrefix ?? "",
        e.answerSuffix ?? "",
        e.inputsPrefill ?? [],
        "exec",
        e.phase === "quiz.preprocess",
        e.trace ?? !1,
        ((_ = e.limits) == null ? void 0 : _.traceSteps) ?? null,
        s,
        a,
        e.allowRealRequests ?? !1,
        i
      ], u = this.runtime.run, c = e.phase === "student.eval" || e.phase === "instructor.on_eval" ? L(this.runtime.evaluate(e.code, s, a)) : L(
        i !== null && He() && typeof u.callPromising == "function" ? await u.callPromising(...l) : u(...l)
      ), d = L(this.runtime.collect_artifacts());
      return {
        jobId: e.id,
        // pyodide's toJs maps Python None to undefined (not null)
        success: !c.error,
        stdout: c.stdout,
        stderr: c.stderr,
        error: c.error ? {
          type: c.error.type,
          message: c.error.message,
          line: c.error.line,
          studentLine: c.error.student_line,
          traceback: c.error.traceback
        } : void 0,
        value: c.value ?? void 0,
        trace: c.trace ? c.trace.map((x) => ({
          event: x.event,
          line: x.line,
          studentLine: x.student_line,
          locals: x.locals
        })) : void 0,
        images: (v = c.images) != null && v.length ? c.images : void 0,
        artifacts: d,
        durationMs: Date.now() - t
      };
    }
  }
  const ze = /call stack|stack overflow|fatally failed/i, Ve = "The Python engine crashed - this usually means unbounded recursion (a function calling itself forever). The engine has been restarted; check your code and run again.", G = () => {
  }, H = (r) => r instanceof Error ? r.message : String(r);
  class Ke {
    constructor(e) {
      g(this, "runner", null);
      g(this, "interrupted", /* @__PURE__ */ new Set());
      /** Per-job settlers for the in-flight interactive input() request. */
      g(this, "pendingInputs", /* @__PURE__ */ new Map());
      /** Remembered from 'init' so crash/restart reloads hit the same base. */
      g(this, "indexURL");
      /**
       * Serializes init/run/restart handling. Without this, a job posted while
       * a crash reload is in flight would execute against the dead interpreter
       * (worker onmessage fires handle() fire-and-forget). input-response and
       * interrupt bypass the chain - a queued run job AWAITS input-response,
       * so serializing those would deadlock.
       */
      g(this, "chain", Promise.resolve());
      this.options = e;
    }
    handle(e) {
      switch (e.kind) {
        case "interrupt":
          return this.interrupted.add(e.jobId), Promise.resolve();
        case "input-response": {
          const n = this.pendingInputs.get(e.jobId);
          return this.pendingInputs.delete(e.jobId), n && (e.eof ? n.reject(new Error("No input available")) : n.resolve(e.value)), Promise.resolve();
        }
        default: {
          const n = this.chain.then(() => this.process(e));
          return this.chain = n.then(G, G), n;
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
        this.runner = null, this.options.post({ kind: "init-error", error: H(e) });
        return;
      }
      this.options.post({ kind: "ready", mode: this.options.mode });
    }
    /**
     * Replace a dead/poisoned interpreter with a fresh one. Reload failures
     * are swallowed - the next run reports "not initialized". The client is
     * always told: installed wheels and the REPL namespace are gone either
     * way (the engine adapter re-arms the Pedal install path on this).
     */
    async reloadRunner() {
      try {
        this.runner = await this.options.loadRunner(this.indexURL);
      } catch {
        this.runner = null;
      }
      this.options.post({ kind: "runner-reloaded" });
    }
    async runJob(e) {
      var t, s, a, i;
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
      let n;
      try {
        n = await this.runner.execute(e, {
          onStdout: (l) => this.options.post({ kind: "stdout", jobId: e.id, chunk: l }),
          onStderr: (l) => this.options.post({ kind: "stderr", jobId: e.id, chunk: l }),
          // Interactive input() (spec §6.5): the run suspends on this
          // promise until an 'input-response' arrives for the job.
          onInput: (l) => new Promise((u, c) => {
            this.pendingInputs.set(e.id, { resolve: u, reject: c }), this.options.post({ kind: "input-request", jobId: e.id, prompt: l });
          })
        });
      } catch (l) {
        this.pendingInputs.delete(e.id);
        const u = H(l), c = ze.test(u);
        (c || ((s = (t = this.runner).healthCheck) == null ? void 0 : s.call(t)) === !1) && await this.reloadRunner(), this.options.post({
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
              message: c ? Ve : u,
              line: null,
              studentLine: null,
              traceback: u + `
`
            },
            artifacts: {},
            durationMs: 0
          }
        });
        return;
      }
      this.pendingInputs.delete(e.id), this.options.post({ kind: "result", result: n }), ((i = (a = this.runner).healthCheck) == null ? void 0 : i.call(a)) === !1 && await this.reloadRunner();
    }
  }
  const Ye = new Ke({
    post: (r) => self.postMessage(r),
    loadRunner: async (r) => {
      const e = await Pe(r ? { indexURL: r } : void 0);
      return W.create(e);
    },
    mode: We(self)
  });
  self.onmessage = (r) => {
    Ye.handle(r.data);
  };
  var Qe = {}, y = /* @__PURE__ */ Object.freeze({
    __proto__: null,
    default: Qe
  });
});
export default Xe();
