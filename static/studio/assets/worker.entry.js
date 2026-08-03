var Re=Object.defineProperty;var Se=(t,e,n)=>e in t?Re(t,e,{enumerable:!0,configurable:!0,writable:!0,value:n}):t[e]=n;var Oe=(t,e)=>()=>(e||t((e={exports:{}}).exports,e),e.exports);var E=(t,e,n)=>Se(t,typeof e!="symbol"?e+"":e,n);var Ge=Oe((Ke,C)=>{var Ie=Object.defineProperty,o=(t,e)=>Ie(t,"name",{value:e,configurable:!0}),$=(t=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(t,{get:(e,n)=>(typeof require<"u"?require:e)[n]}):t)(function(t){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+t+'" is not supported')}),Pe=(()=>{for(var t=new Uint8Array(128),e=0;e<64;e++)t[e<26?e+65:e<52?e+71:e<62?e-4:e*4-205]=e;return n=>{for(var r=n.length,s=new Uint8Array((r-(n[r-1]=="=")-(n[r-2]=="="))*3/4|0),a=0,i=0;a<r;){var l=t[n.charCodeAt(a++)],c=t[n.charCodeAt(a++)],u=t[n.charCodeAt(a++)],d=t[n.charCodeAt(a++)];s[i++]=l<<2|c>>4,s[i++]=c<<4|u>>2,s[i++]=u<<6|d}return s}})();function J(t){return!isNaN(parseFloat(t))&&isFinite(t)}o(J,"_isNumber");function g(t){return t.charAt(0).toUpperCase()+t.substring(1)}o(g,"_capitalize");function P(t){return function(){return this[t]}}o(P,"_getter");var k=["isConstructor","isEval","isNative","isToplevel"],N=["columnNumber","lineNumber"],x=["fileName","functionName","source"],Ae=["args"],Te=["evalOrigin"],I=k.concat(N,x,Ae,Te);function m(t){if(t)for(var e=0;e<I.length;e++)t[I[e]]!==void 0&&this["set"+g(I[e])](t[I[e]])}o(m,"StackFrame");m.prototype={getArgs:o(function(){return this.args},"getArgs"),setArgs:o(function(t){if(Object.prototype.toString.call(t)!=="[object Array]")throw new TypeError("Args must be an Array");this.args=t},"setArgs"),getEvalOrigin:o(function(){return this.evalOrigin},"getEvalOrigin"),setEvalOrigin:o(function(t){if(t instanceof m)this.evalOrigin=t;else if(t instanceof Object)this.evalOrigin=new m(t);else throw new TypeError("Eval Origin must be an Object or StackFrame")},"setEvalOrigin"),toString:o(function(){var t=this.getFileName()||"",e=this.getLineNumber()||"",n=this.getColumnNumber()||"",r=this.getFunctionName()||"";return this.getIsEval()?t?"[eval] ("+t+":"+e+":"+n+")":"[eval]:"+e+":"+n:r?r+" ("+t+":"+e+":"+n+")":t+":"+e+":"+n},"toString")};m.fromString=o(function(t){var e=t.indexOf("("),n=t.lastIndexOf(")"),r=t.substring(0,e),s=t.substring(e+1,n).split(","),a=t.substring(n+1);if(a.indexOf("@")===0)var i=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(a,""),l=i[1],c=i[2],u=i[3];return new m({functionName:r,args:s||void 0,fileName:l,lineNumber:c||void 0,columnNumber:u||void 0})},"StackFrame$$fromString");for(h=0;h<k.length;h++)m.prototype["get"+g(k[h])]=P(k[h]),m.prototype["set"+g(k[h])]=(function(t){return function(e){this[t]=!!e}})(k[h]);var h;for(v=0;v<N.length;v++)m.prototype["get"+g(N[v])]=P(N[v]),m.prototype["set"+g(N[v])]=(function(t){return function(e){if(!J(e))throw new TypeError(t+" must be a Number");this[t]=Number(e)}})(N[v]);var v;for(b=0;b<x.length;b++)m.prototype["get"+g(x[b])]=P(x[b]),m.prototype["set"+g(x[b])]=(function(t){return function(e){this[t]=String(e)}})(x[b]);var b,A=m;function G(){var t=/^\s*at .*(\S+:\d+|\(native\))/m,e=/^(eval@)?(\[native code])?$/;return{parse:o(function(n){if(n.stack&&n.stack.match(t))return this.parseV8OrIE(n);if(n.stack)return this.parseFFOrSafari(n);throw new Error("Cannot parse given Error object")},"ErrorStackParser$$parse"),extractLocation:o(function(n){if(n.indexOf(":")===-1)return[n];var r=/(.+?)(?::(\d+))?(?::(\d+))?$/,s=r.exec(n.replace(/[()]/g,""));return[s[1],s[2]||void 0,s[3]||void 0]},"ErrorStackParser$$extractLocation"),parseV8OrIE:o(function(n){var r=n.stack.split(`
`).filter(function(s){return!!s.match(t)},this);return r.map(function(s){s.indexOf("(eval ")>-1&&(s=s.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(,.*$)/g,""));var a=s.replace(/^\s+/,"").replace(/\(eval code/g,"(").replace(/^.*?\s+/,""),i=a.match(/ (\(.+\)$)/);a=i?a.replace(i[0],""):a;var l=this.extractLocation(i?i[1]:a),c=i&&a||void 0,u=["eval","<anonymous>"].indexOf(l[0])>-1?void 0:l[0];return new A({functionName:c,fileName:u,lineNumber:l[1],columnNumber:l[2],source:s})},this)},"ErrorStackParser$$parseV8OrIE"),parseFFOrSafari:o(function(n){var r=n.stack.split(`
`).filter(function(s){return!s.match(e)},this);return r.map(function(s){if(s.indexOf(" > eval")>-1&&(s=s.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),s.indexOf("@")===-1&&s.indexOf(":")===-1)return new A({functionName:s});var a=/((.*".+"[^@]*)?[^@]*)(?:@)/,i=s.match(a),l=i&&i[1]?i[1]:void 0,c=this.extractLocation(s.replace(a,""));return new A({functionName:l,fileName:c[0],lineNumber:c[1],columnNumber:c[2],source:s})},this)},"ErrorStackParser$$parseFFOrSafari")}}o(G,"ErrorStackParser");var Le=new G,Fe=Le;function H(){var i;if(typeof API<"u"&&API!==globalThis.API)return API.runtimeEnv;let t=typeof Bun<"u",e=typeof Deno<"u",n=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser,r=typeof navigator=="object"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome")===-1&&navigator.userAgent.indexOf("Safari")>-1,s=typeof read=="function"&&typeof load=="function",a=typeof navigator=="object"&&((i=navigator.userAgent)==null?void 0:i.includes("Cloudflare-Workers"));return K({IN_BUN:t,IN_DENO:e,IN_NODE:n,IN_SAFARI:r,IN_SHELL:s,IN_WORKERD:a})}o(H,"getGlobalRuntimeEnv");var _=H();function K(t){let e=t.IN_NODE&&typeof C<"u"&&C.exports&&typeof $=="function"&&typeof __dirname=="string",n=t.IN_NODE&&!e,r=!t.IN_NODE&&!t.IN_DENO&&!t.IN_BUN,s=r&&typeof window<"u"&&typeof window.document<"u"&&typeof document.createElement=="function"&&"sessionStorage"in window&&typeof globalThis.importScripts!="function",a=r&&typeof globalThis.WorkerGlobalScope<"u"&&typeof globalThis.self<"u"&&globalThis.self instanceof globalThis.WorkerGlobalScope;if(a&&z())throw new Error("Classic web workers are not supported");let i={...t,IN_BROWSER:r,IN_BROWSER_MAIN_THREAD:s,IN_BROWSER_WEB_WORKER:a,IN_NODE_COMMONJS:e,IN_NODE_ESM:n};if(!(i.IN_BROWSER_MAIN_THREAD||i.IN_BROWSER_WEB_WORKER||i.IN_NODE||i.IN_SHELL||i.IN_WORKERD))throw new Error(`Cannot determine runtime environment: ${JSON.stringify(i)}`);return i}o(K,"calculateDerivedFlags");function z(){try{return globalThis.importScripts("data:text/javascript,"),!0}catch{return!1}}o(z,"isClassicWorker");var V,L,W,M;async function U(){if(!_.IN_NODE||(V=(await import("./__vite-browser-external-9wXp6ZBx.js")).default,W=await import("./__vite-browser-external-9wXp6ZBx.js"),M=await import("./__vite-browser-external-9wXp6ZBx.js"),(await import("./__vite-browser-external-9wXp6ZBx.js")).default,L=await import("./__vite-browser-external-9wXp6ZBx.js"),j=L.sep,typeof $<"u"))return;let t=W,e=await import("./__vite-browser-external-9wXp6ZBx.js"),n=await import("./__vite-browser-external-9wXp6ZBx.js"),r=await import("./__vite-browser-external-9wXp6ZBx.js"),s={fs:t,crypto:e,ws:n,child_process:r};globalThis.require=function(a){return s[a]}}o(U,"initNodeModules");function X(t,e){return L.resolve(e||".",t)}o(X,"node_resolvePath");function Y(t,e){return e===void 0&&(e=location),new URL(t,e).toString()}o(Y,"browser_resolvePath");var S;_.IN_NODE?S=X:_.IN_SHELL?S=o(t=>t,"resolvePath"):S=Y;var j;_.IN_NODE||(j="/");function Q(t,e){return t.startsWith("file://")&&(t=t.slice(7)),t.includes("://")?{response:fetch(t)}:{binary:M.readFile(t).then(n=>new Uint8Array(n.buffer,n.byteOffset,n.byteLength))}}o(Q,"node_getBinaryResponse");function Z(t,e){if(t.startsWith("file://")&&(t=t.slice(7)),t.includes("://"))throw new Error("Shell cannot fetch urls");return{binary:Promise.resolve(new Uint8Array(readbuffer(t)))}}o(Z,"shell_getBinaryResponse");function ee(t,e){let n=new URL(t,location);return{response:fetch(n,e?{integrity:e}:{})}}o(ee,"browser_getBinaryResponse");var O;_.IN_NODE?O=Q:_.IN_SHELL?O=Z:O=ee;async function te(t,e){let{response:n,binary:r}=O(t,e);if(r)return r;let s=await n;if(!s.ok)throw new Error(`Failed to load '${t}': request failed.`);return new Uint8Array(await s.arrayBuffer())}o(te,"loadBinaryFile");var F;_.IN_NODE?F=ne:F=o(async t=>await import(t),"loadScript");async function ne(t){return t.startsWith("file://")&&(t=t.slice(7)),t.includes("://")?await import(t):await import(V.pathToFileURL(t).href)}o(ne,"nodeLoadScript");async function re(t){if(_.IN_NODE){await U();let e=await M.readFile(t,{encoding:"utf8"});return JSON.parse(e)}else if(_.IN_SHELL){let e=read(t);return JSON.parse(e)}else return await(await fetch(t)).json()}o(re,"loadLockFile");async function se(){if(_.IN_NODE_COMMONJS)return __dirname;let t;try{throw new Error}catch(r){t=r}let e=Fe.parse(t)[0].fileName;if(_.IN_NODE&&!e.startsWith("file://")&&(e=`file://${e}`),_.IN_NODE_ESM){let r=await import("./__vite-browser-external-9wXp6ZBx.js");return(await import("./__vite-browser-external-9wXp6ZBx.js")).fileURLToPath(r.dirname(e))}let n=e.lastIndexOf(j);if(n===-1)throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");return e.slice(0,n)}o(se,"calculateDirname");function ie(t){var e;return t.substring(0,t.lastIndexOf("/")+1)||((e=globalThis.location)==null?void 0:e.toString())||"."}o(ie,"calculateInstallBaseUrl");function ae(t){let e=t.FS,n=t.FS.filesystems.MEMFS,r=t.PATH,s={DIR_MODE:16895,FILE_MODE:33279,mount:o(function(a){if(!a.opts.fileSystemHandle)throw new Error("opts.fileSystemHandle is required");return n.mount.apply(null,arguments)},"mount"),syncfs:o(async(a,i,l)=>{try{let c=s.getLocalSet(a),u=await s.getRemoteSet(a),d=i?u:c,f=i?c:u;await s.reconcile(a,d,f),l(null)}catch(c){l(c)}},"syncfs"),getLocalSet:o(a=>{let i=Object.create(null);function l(d){return d!=="."&&d!==".."}o(l,"isRealDir");function c(d){return f=>r.join2(d,f)}o(c,"toAbsolute");let u=e.readdir(a.mountpoint).filter(l).map(c(a.mountpoint));for(;u.length;){let d=u.pop(),f=e.stat(d);e.isDir(f.mode)&&u.push.apply(u,e.readdir(d).filter(l).map(c(d))),i[d]={timestamp:f.mtime,mode:f.mode}}return{type:"local",entries:i}},"getLocalSet"),getRemoteSet:o(async a=>{let i=Object.create(null),l=await De(a.opts.fileSystemHandle);for(let[c,u]of l)c!=="."&&(i[r.join2(a.mountpoint,c)]={timestamp:u.kind==="file"?new Date((await u.getFile()).lastModified):new Date,mode:u.kind==="file"?s.FILE_MODE:s.DIR_MODE});return{type:"remote",entries:i,handles:l}},"getRemoteSet"),loadLocalEntry:o(a=>{let i=e.lookupPath(a,{}).node,l=e.stat(a);if(e.isDir(l.mode))return{timestamp:l.mtime,mode:l.mode};if(e.isFile(l.mode))return i.contents=n.getFileDataAsTypedArray(i),{timestamp:l.mtime,mode:l.mode,contents:i.contents};throw new Error("node type not supported")},"loadLocalEntry"),storeLocalEntry:o((a,i)=>{if(e.isDir(i.mode))e.mkdirTree(a,i.mode);else if(e.isFile(i.mode))e.writeFile(a,i.contents,{canOwn:!0});else throw new Error("node type not supported");e.chmod(a,i.mode),e.utime(a,i.timestamp,i.timestamp)},"storeLocalEntry"),removeLocalEntry:o(a=>{var i=e.stat(a);e.isDir(i.mode)?e.rmdir(a):e.isFile(i.mode)&&e.unlink(a)},"removeLocalEntry"),loadRemoteEntry:o(async a=>{if(a.kind==="file"){let i=await a.getFile();return{contents:new Uint8Array(await i.arrayBuffer()),mode:s.FILE_MODE,timestamp:new Date(i.lastModified)}}else{if(a.kind==="directory")return{mode:s.DIR_MODE,timestamp:new Date};throw new Error("unknown kind: "+a.kind)}},"loadRemoteEntry"),storeRemoteEntry:o(async(a,i,l)=>{let c=a.get(r.dirname(i)),u=e.isFile(l.mode)?await c.getFileHandle(r.basename(i),{create:!0}):await c.getDirectoryHandle(r.basename(i),{create:!0});if(u.kind==="file"){let d=await u.createWritable();await d.write(l.contents),await d.close()}a.set(i,u)},"storeRemoteEntry"),removeRemoteEntry:o(async(a,i)=>{await a.get(r.dirname(i)).removeEntry(r.basename(i)),a.delete(i)},"removeRemoteEntry"),reconcile:o(async(a,i,l)=>{let c=0,u=[];Object.keys(i.entries).forEach(function(p){let y=i.entries[p],w=l.entries[p];(!w||e.isFile(y.mode)&&y.timestamp.getTime()>w.timestamp.getTime())&&(u.push(p),c++)}),u.sort();let d=[];if(Object.keys(l.entries).forEach(function(p){i.entries[p]||(d.push(p),c++)}),d.sort().reverse(),!c)return;let f=i.type==="remote"?i.handles:l.handles;for(let p of u){let y=r.normalize(p.replace(a.mountpoint,"/")).substring(1);if(l.type==="local"){let w=f.get(y),xe=await s.loadRemoteEntry(w);s.storeLocalEntry(p,xe)}else{let w=s.loadLocalEntry(p);await s.storeRemoteEntry(f,y,w)}}for(let p of d)if(l.type==="local")s.removeLocalEntry(p);else{let y=r.normalize(p.replace(a.mountpoint,"/")).substring(1);await s.removeRemoteEntry(f,y)}},"reconcile")};t.FS.filesystems.NATIVEFS_ASYNC=s}o(ae,"initializeNativeFS");var De=o(async t=>{let e=[];async function n(s){for await(let a of s.values())e.push(a),a.kind==="directory"&&await n(a)}o(n,"collect"),await n(t);let r=new Map;r.set(".",t);for(let s of e){let a=(await t.resolve(s)).join("/");r.set(a,s)}return r},"getFsHandles"),Ce=Pe("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL"),Me=(async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&typeof navigator.maxTouchPoints<"u"&&navigator.maxTouchPoints>1)))try{let t=await WebAssembly.compile(Ce);return await WebAssembly.instantiate(t)}catch(t){if(t instanceof WebAssembly.CompileError)return;throw t}})();async function oe(){let t=await Me;if(t)return t.exports;let e=Symbol("error marker");return{Jsv_GetError_import:o(()=>e,"Jsv_GetError_import"),JsvError_Check:o(n=>n===e,"JsvError_Check")}}o(oe,"getJsvErrorImport");function le(t){let e={config:t,runtimeEnv:_},n={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:me(t),print:t.stdout,printErr:t.stderr,onExit(r){n.exitCode=r},thisProgram:t._sysExecutable,arguments:t.args,API:e,locateFile:o(r=>t.indexURL+r,"locateFile"),instantiateWasm:_e(t.indexURL)};return n}o(le,"createSettings");function ce(t){return function(e){let n="/";try{e.FS.mkdirTree(t)}catch(r){console.error(`Error occurred while making a home directory '${t}':`),console.error(r),console.error(`Using '${n}' for a home directory instead`),t=n}e.FS.chdir(t)}}o(ce,"createHomeDirectory");function ue(t){return function(e){Object.assign(e.ENV,t)}}o(ue,"setEnvironment");function de(t){return t?[async e=>{e.addRunDependency("fsInitHook");try{await t(e.FS,{sitePackages:e.API.sitePackages})}finally{e.removeRunDependency("fsInitHook")}}]:[]}o(de,"callFsInitHook");function pe(t){let e=t.HEAPU32[t._Py_Version>>>2],n=e>>>24&255,r=e>>>16&255,s=e>>>8&255;return[n,r,s]}o(pe,"computeVersionTuple");function fe(t){let e=te(t);return async n=>{n.API.pyVersionTuple=pe(n);let[r,s]=n.API.pyVersionTuple;n.FS.mkdirTree("/lib"),n.API.sitePackages=`/lib/python${r}.${s}/site-packages`,n.FS.mkdirTree(n.API.sitePackages),n.addRunDependency("install-stdlib");try{let a=await e;n.FS.writeFile(`/lib/python${r}${s}.zip`,a)}catch(a){console.error("Error occurred while installing the standard library:"),console.error(a)}finally{n.removeRunDependency("install-stdlib")}}}o(fe,"installStdlib");function me(t){let e;return t.stdLibURL!=null?e=t.stdLibURL:e=t.indexURL+"python_stdlib.zip",[fe(e),ce(t.env.HOME),ue(t.env),ae,...de(t.fsInit)]}o(me,"getFileSystemInitializationFuncs");function _e(t){if(typeof WasmOffsetConverter<"u")return;let{binary:e,response:n}=O(t+"pyodide.asm.wasm"),r=oe();return function(s,a){return(async function(){let{Jsv_GetError_import:i,JsvError_Check:l}=await r;s.env.Jsv_GetError_import=i,s.env.JsvError_Check=l;try{let c;n?c=await WebAssembly.instantiateStreaming(n,s):c=await WebAssembly.instantiate(await e,s);let{instance:u,module:d}=c;a(u,d)}catch(c){console.warn("wasm instantiation failed!"),console.warn(c)}})(),{}}}o(_e,"getInstantiateWasmFunc");var Ue="314.0.2";function R(t){return t===void 0||t.endsWith("/")?t:t+"/"}o(R,"withTrailingSlash");var D=Ue;async function ge(t={}){var s,a;if(await U(),t.lockFileContents&&t.lockFileURL)throw new Error("Can't pass both lockFileContents and lockFileURL");let e=t.indexURL||await se();if(e=R(S(e)),t.packageBaseUrl=R(t.packageBaseUrl),t.cdnUrl=R(t.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v${D}/full/`),!t.lockFileContents){let i=t.lockFileURL??e+"pyodide-lock.json";t.lockFileContents=re(i),t.packageBaseUrl??(t.packageBaseUrl=ie(i))}t.indexURL=e,t.packageCacheDir&&(t.packageCacheDir=R(S(t.packageCacheDir)));let n={jsglobals:globalThis,stdin:globalThis.prompt?()=>globalThis.prompt():void 0,args:[],env:{},packages:[],packageCacheDir:t.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:"a4189f0fe3d610ecd603639c08596362b70a34b106c58c9a93486c22df4c89a5"},r=Object.assign(n,t);return(s=r.env).HOME??(s.HOME="/home/pyodide"),(a=r.env).PYTHONINSPECT??(a.PYTHONINSPECT="1"),r}o(ge,"initializeConfiguration");function ye(t){let e=le(t),n=e.API;return n.lockFilePromise=Promise.resolve(t.lockFileContents),e}o(ye,"createEmscriptenSettings");async function he(t){if(t.createPyodideModule)return t.createPyodideModule;let e=`${t.indexURL}pyodide.asm.mjs`;return(await F(e)).default}o(he,"loadWasmScript");async function ve(t,e){if(!t._loadSnapshot)return;let n=await t._loadSnapshot,r=ArrayBuffer.isView(n)?n:new Uint8Array(n);return e.noInitialRun=!0,e.INITIAL_MEMORY=r.length,r}o(ve,"prepareSnapshot");async function be(t,e){let n=await t(e);if(e.exitCode!==void 0)throw new n.ExitStatus(e.exitCode);return n}o(be,"instantiatePyodideModule");function we(t,e){let n=t.API;if(e.pyproxyToStringRepr&&n.setPyProxyToStringMethod(!0),e.convertNullToNone&&n.setCompatNullToNone(!0),e.toJsLiteralMap&&n.setCompatToJsLiteralMap(!0),n.version!==D&&e.checkAPIVersion)throw new Error(`Pyodide version does not match: '${D}' <==> '${n.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);t.locateFile=r=>{throw r.endsWith(".so")?new Error(`Failed to find dynamic library "${r}"`):new Error(`Unexpected call to locateFile("${r}")`)}}o(we,"configureAPI");function Ee(t,e,n){let r=t.API,s;return e&&(s=r.restoreSnapshot(e)),r.finalizeBootstrap(s,n._snapshotDeserializer)}o(Ee,"bootstrapPyodide");async function ke(t,e){let n=t._api;return n.sys.path.insert(0,""),n._pyodide.set_excepthook(),await n.packageIndexReady,n.initializeStreams(e.stdin,e.stdout,e.stderr),t}o(ke,"finalizeSetup");async function Ne(t={}){let e=await ge(t),n=ye(e),r=await he(e),s=await ve(e,n),a=await be(r,n);we(a,e);let i=Ee(a,s,e);return await ke(i,e)}o(Ne,"loadPyodide");function je(t){return t.crossOriginIsolated===!0&&typeof t.SharedArrayBuffer=="function"?"isolated":"compat"}var Be=`# The in-worker Python runtime, installed into Pyodide once at boot
# (bundled as a string via a Vite \`?raw\` import — see raw.d.ts). Implements
# per-job isolation (spec 6.2): fresh __main__ module dict per job,
# sys.modules snapshot/restore, FS staging under /mnt/blockpy with artifact
# diff-back (spec 7.5, LD-3x), scripted stdin, student-relative traceback
# line mapping (spec 6.3 — instructor answer_prefix lines are subtracted, as
# legacy Skulpt did), live stdout/stderr tee streaming, and opt-in
# sys.settrace tracing whose step counter doubles as the instruction limit
# (E3, spec 6.2).
import builtins
import contextlib
import io
import json
import os
import sys
import traceback
import types
import warnings

MOUNT = '/mnt/blockpy'
TRACE_STORAGE_CAP = 10000

# Plot capture (spec 10.2): headless Agg backend — figures are snapshotted
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
        # JS null arrives as JsNull (not None) — guard on callability.
        if text and callable(self.callback):
            self.callback(text)
        return super().write(text)


class StudioRuntime:
    def __init__(self):
        self.baseline_modules = set(sys.modules)
        self.last_globals = None
        self.staged = {}

    # -- filesystem staging (spec 7.5) --------------------------------------

    def stage_files(self, files):
        os.makedirs(MOUNT, exist_ok=True)
        for root, dirs, names in os.walk(MOUNT, topdown=False):
            for name in names:
                os.remove(os.path.join(root, name))
            for d in dirs:
                os.rmdir(os.path.join(root, d))
        self.staged = dict(files)
        for name, contents in files.items():
            path = os.path.join(MOUNT, name)
            parent = os.path.dirname(path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(contents)
        os.chdir(MOUNT)

    def collect_artifacts(self):
        artifacts = {}
        for root, _dirs, names in os.walk(MOUNT):
            for name in names:
                path = os.path.join(root, name)
                rel = os.path.relpath(path, MOUNT).replace(os.sep, '/')
                try:
                    with open(path, 'r', encoding='utf-8') as handle:
                        contents = handle.read()
                except (OSError, UnicodeDecodeError):
                    continue
                if self.staged.get(rel) != contents:
                    artifacts[rel] = contents
        return artifacts

    # -- per-job isolation (spec 6.2) ----------------------------------------

    def restore_modules(self):
        for name in list(sys.modules):
            if name in self.baseline_modules:
                continue
            module = sys.modules[name]
            file = getattr(module, '__file__', '') or ''
            if '/site-packages/' in file:
                # Installed packages (loadPackage/micropip) are expensive to
                # re-initialize (matplotlib takes seconds) and stateless per
                # job in practice — adopt into the baseline. Per-job figure
                # state is reset by capture_figures (plt.close('all')).
                self.baseline_modules.add(name)
                continue
            # Stdlib, student/staged (/mnt/blockpy), and dynamic modules stay
            # per-job (§6.2): purge so the next run reimports fresh state.
            del sys.modules[name]

    # -- mock URLs (spec 10.4, legacy configurations.js openURL) -------------

    def install_requests_mock(self):
        """Install a per-job \`requests\` shim resolving \`?mock_urls.blockpy\`.

        Legacy parity: ALL url access goes through the mock table — the map
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

    def run(self, code, filename='answer.py', prefix='', suffix='',
            inputs=None, mode='exec', extract_result=False,
            trace=False, trace_limit=None, on_stdout=None, on_stderr=None,
            allow_real_requests=False):
        full = (prefix or '') + code + (suffix or '')
        prefix_lines = (prefix or '').count('\\n')
        # JS null arrives as JsNull (not None) — normalize scalar options.
        if not isinstance(trace_limit, int):
            trace_limit = None

        module = types.ModuleType('__main__')
        module.__dict__['__file__'] = filename

        input_values = iter(inputs or [])

        def scripted_input(prompt=''):
            print(prompt, end='')
            try:
                return next(input_values)
            except StopIteration:
                raise EOFError('No scripted input available') from None

        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)
        steps = []
        old_input = builtins.input
        old_main = sys.modules.get('__main__')
        builtins.input = scripted_input
        sys.modules['__main__'] = module
        # Legacy parity (spec 10.4): requests resolves through the mock-urls
        # table, never the network — unless the allow_real_requests setting
        # is on (M3.5), in which case the REAL requests package (installed
        # host-side with pyodide-http patching) stays importable.
        if not allow_real_requests:
            self.install_requests_mock()
        error = None
        value = None
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
                elif extract_result and 'result' in module.__dict__:
                    value = json.dumps(module.__dict__['result'])
        except BaseException as exc:  # noqa: BLE001 - full error report needed
            error = self.format_error(exc, filename, prefix_lines)
        finally:
            # Snapshot plots BEFORE the module restore unloads matplotlib —
            # figures drawn before an error still surface (spec 10.2).
            images = self.capture_figures()
            builtins.input = old_input
            if old_main is not None:
                sys.modules['__main__'] = old_main
            self.restore_modules()

        self.last_globals = module.__dict__
        return {
            'error': error,
            'value': value,
            'stdout': stdout.getvalue(),
            'stderr': stderr.getvalue(),
            'trace': steps if trace else None,
            'images': images,
        }

    def evaluate(self, expression, on_stdout=None, on_stderr=None):
        """Persistent REPL bound to the last run's namespace (spec 6.4)."""
        target = self.last_globals if self.last_globals is not None else {}
        stdout, stderr = _Tee(on_stdout), _Tee(on_stderr)
        error = None
        value = None
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                compiled = compile(expression, 'evaluations', 'eval')
                value = repr(eval(compiled, target))
        except BaseException as exc:  # noqa: BLE001
            error = self.format_error(exc, 'evaluations', 0)
        finally:
            self.restore_modules()
        return {
            'error': error,
            'value': value,
            'stdout': stdout.getvalue(),
            'stderr': stderr.getvalue(),
            'trace': None,
        }

    def clear_namespace(self):
        self.last_globals = None

    # -- error shaping (spec 6.3) ----------------------------------------------

    def format_error(self, exc, filename, prefix_lines):
        line = None
        if isinstance(exc, SyntaxError) and exc.filename == filename:
            line = exc.lineno
        else:
            for frame, lineno in traceback.walk_tb(exc.__traceback__):
                if frame.f_code.co_filename == filename:
                    line = lineno
        formatted = ''.join(
            traceback.format_exception(type(exc), exc, exc.__traceback__),
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
`,qe=`# The Pedal "blockpy environment" contract for Studio (spec 10.1) — a
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
import importlib
import json
import os
import shutil
import sys

_INSTRUCTOR_PKG = '_instructor'
_PREFIXES = '!^?&$*#'


def _studio_pedal_stage(files):
    if os.path.isdir(_INSTRUCTOR_PKG):
        shutil.rmtree(_INSTRUCTOR_PKG)
    os.makedirs(_INSTRUCTOR_PKG, exist_ok=True)
    with open(os.path.join(_INSTRUCTOR_PKG, '__init__.py'), 'w') as handle:
        handle.write('')
    for name, contents in files.items():
        prefix = name[0] if name[:1] in _PREFIXES else ''
        base = name[1:] if prefix else name
        if prefix in ('^', '$', '#'):
            continue  # never mounted for grading (A1: editor metadata/wire)
        parent = os.path.dirname(base)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(base, 'w', encoding='utf-8') as handle:
            handle.write(contents)
        if prefix in ('!', '?', '&') and base.endswith('.py'):
            with open(os.path.join(_INSTRUCTOR_PKG, base), 'w', encoding='utf-8') as handle:
                handle.write(contents)
    # fresh imports of _instructor.* each grading pass
    for module_name in list(sys.modules):
        if module_name == _INSTRUCTOR_PKG or module_name.startswith(_INSTRUCTOR_PKG + '.'):
            del sys.modules[module_name]
    importlib.invalidate_caches()


# The names legacy preloaded into the instructor script's namespace
# (on_run.js:33-36 / on_eval.js:15-18) — graders may use parse_program and
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
    # DATA['location'].line) — drives the editor-error-line highlight.
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
    # formatter breaks on Python 3.14 when SyntaxError.text is None —
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


def _studio_pedal_grade(student_code, on_run, files_json, inputs, options_json):
    from pedal.core.report import MAIN_REPORT

    MAIN_REPORT.clear()
    options = json.loads(options_json) if options_json else {}
    _studio_pedal_stage(json.loads(files_json) if files_json else {})

    try:
        # bakery's module-level student_tests ledger lives in site-packages
        # and survives across runs — legacy reset it every grading pass
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

        # The submission carries the STUDENT-visible files: answer.py +
        # chomped ?/& instructor extras + student extras (legacy
        # getAllStudentFiles, instructor.js:69-83). The instructor staging
        # view lives on DISK (open() + _instructor imports), not here.
        student_files = dict(options.get('student_files') or {})
        student_files['answer.py'] = student_code

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
        # (report['questions']['seed']) — pools were never actually seeded.
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


def _studio_pedal_evaluate(evaluation, on_eval, options_json):
    # Console-evaluation grading (on_eval.js): KEEP the last grading pass's
    # report and sandbox; clear the presented feedback (legacy "backed up"
    # MAIN_REPORT.feedback into a local it never read again — the effective
    # behavior is a plain clear, on_eval.js:20-24); pedal-\`evaluate\` the
    # console expression inside the student's sandbox; exec the instructor's
    # on_eval script; re-resolve.
    from pedal.core.report import MAIN_REPORT

    del options_json  # reserved (parity with _studio_pedal_grade)
    try:
        MAIN_REPORT.feedback.clear()
        from pedal.sandbox.commands import evaluate, get_sandbox
        student = get_sandbox(report=MAIN_REPORT)
        evaluate(evaluation, report=MAIN_REPORT)
        exec(compile(on_eval, 'on_eval.py', 'exec'),
             _studio_instructor_globals(student, evaluation))
        return _studio_pedal_resolve()
    except BaseException:  # noqa: BLE001 - grading must fail soft
        return _studio_fail_soft()
`;const We=["pedal","curriculum-sneks","bakery"];class B{constructor(e,n){this.grade_=e,this.evaluate_=n}static async install(e,n=We){await e.loadPackage("micropip"),await e.runPythonAsync(`import micropip
await micropip.install(${JSON.stringify(n)})`),e.runPython(qe);const r=e.globals.get("_studio_pedal_grade"),s=e.globals.get("_studio_pedal_evaluate");return new B(r,s)}grade(e){const n=this.grade_(e.studentCode,e.onRun,JSON.stringify(e.files??{}),e.inputs??[],JSON.stringify({skip_tifa:e.skipTifa??!1,skip_run:e.skipRun??!1,seed:e.seed??null,student_files:e.studentFiles??{}})),r=n.toJs({dict_converter:Object.fromEntries});return n.destroy(),r}evaluateGrade(e){const n=this.evaluate_(e.evaluation,e.onEval,"{}"),r=n.toJs({dict_converter:Object.fromEntries});return n.destroy(),r}}const T=t=>{const e=t.toJs({dict_converter:Object.fromEntries});return t.destroy(),e};class q{constructor(e,n){E(this,"runtime");E(this,"pedalEnv",null);E(this,"realRequestsReady",!1);this.pyodide=e,this.runtime=n}static create(e){e.runPython(Be);const n=e.globals.get("_studio_runtime");return new q(e,n)}clearNamespace(){this.runtime.clear_namespace()}async ensureRealRequests(){if(this.realRequestsReady)return;const e=this.pyodide;await e.loadPackage("micropip"),await e.runPythonAsync(`import micropip
await micropip.install(['requests', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()`),this.realRequestsReady=!0}async ensurePedal(e){return this.pedalEnv===null&&(this.pedalEnv=await B.install(this.pyodide,e)),this.pedalEnv}async executePedal(e,n){const r=e.pedal;try{const s=await this.ensurePedal(r.packages),a=r.evaluation!==void 0?s.evaluateGrade({evaluation:r.evaluation,onEval:r.onRun}):s.grade({studentCode:e.code,onRun:r.onRun,files:e.files,inputs:r.inputs??e.inputsPrefill,studentFiles:r.studentFiles,skipTifa:r.skipTifa,skipRun:r.skipRun,seed:r.seed});return{jobId:e.id,success:!0,stdout:"",stderr:"",artifacts:{},feedback:a,durationMs:Date.now()-n}}catch(s){const a=s instanceof Error?s.message:String(s);return{jobId:e.id,success:!1,stdout:"",stderr:"",error:{type:"PedalEnvironmentError",message:a,line:null,studentLine:null,traceback:a+`
`},artifacts:{},durationMs:Date.now()-n}}}async execute(e,n={}){var c,u,d,f;const r=Date.now();if(e.pedal)return this.executePedal(e,r);try{await((u=(c=this.pyodide).loadPackagesFromImports)==null?void 0:u.call(c,e.code))}catch{}if(e.allowRealRequests)try{await this.ensureRealRequests()}catch{}this.pyodide.runPython(`_studio_runtime.stage_files(__import__('json').loads(${JSON.stringify(JSON.stringify(e.files))}))`);const s=n.onStdout??null,a=n.onStderr??null,i=e.phase==="student.eval"||e.phase==="instructor.on_eval"?T(this.runtime.evaluate(e.code,s,a)):T(this.runtime.run(e.code,e.filename??"answer.py",e.answerPrefix??"",e.answerSuffix??"",e.inputsPrefill??[],"exec",e.phase==="quiz.preprocess",e.trace??!1,((d=e.limits)==null?void 0:d.traceSteps)??null,s,a,e.allowRealRequests??!1)),l=T(this.runtime.collect_artifacts());return{jobId:e.id,success:!i.error,stdout:i.stdout,stderr:i.stderr,error:i.error?{type:i.error.type,message:i.error.message,line:i.error.line,studentLine:i.error.student_line,traceback:i.error.traceback}:void 0,value:i.value??void 0,trace:i.trace?i.trace.map(p=>({event:p.event,line:p.line,studentLine:p.student_line,locals:p.locals})):void 0,images:(f=i.images)!=null&&f.length?i.images:void 0,artifacts:l,durationMs:Date.now()-r}}}class $e{constructor(e){E(this,"runner",null);E(this,"interrupted",new Set);this.options=e}async handle(e){switch(e.kind){case"init":{this.runner=await this.options.loadRunner(e.indexURL),this.options.post({kind:"ready",mode:this.options.mode});return}case"run":{if(!this.runner)throw new Error("Engine worker not initialized");const{job:n}=e;if(this.interrupted.delete(n.id)){this.options.post({kind:"result",result:{jobId:n.id,success:!1,stdout:"",stderr:"",error:{type:"KeyboardInterrupt",message:"Execution interrupted",line:null,studentLine:null,traceback:`KeyboardInterrupt: Execution interrupted
`},artifacts:{},durationMs:0}});return}const r=await this.runner.execute(n,{onStdout:s=>this.options.post({kind:"stdout",jobId:n.id,chunk:s}),onStderr:s=>this.options.post({kind:"stderr",jobId:n.id,chunk:s})});this.options.post({kind:"result",result:r});return}case"interrupt":{this.interrupted.add(e.jobId);return}case"restart-kernel":{this.runner=await this.options.loadRunner(),this.options.post({kind:"ready",mode:this.options.mode});return}case"input-response":return}}}const Je=new $e({post:t=>self.postMessage(t),loadRunner:async t=>{const e=await Ne(t?{indexURL:t}:void 0);return q.create(e)},mode:je(self)});self.onmessage=t=>{Je.handle(t.data)}});export default Ge();
