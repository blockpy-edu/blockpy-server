var Re=Object.defineProperty;var Se=(n,e,t)=>e in n?Re(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t;var Ie=(n,e)=>()=>(e||n((e={exports:{}}).exports,e),e.exports);var y=(n,e,t)=>Se(n,typeof e!="symbol"?e+"":e,t);var Ke=Ie((Ye,M)=>{var Oe=Object.defineProperty,o=(n,e)=>Oe(n,"name",{value:e,configurable:!0}),$=(n=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(n,{get:(e,t)=>(typeof require<"u"?require:e)[t]}):n)(function(n){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+n+'" is not supported')}),Pe=(()=>{for(var n=new Uint8Array(128),e=0;e<64;e++)n[e<26?e+65:e<52?e+71:e<62?e-4:e*4-205]=e;return t=>{for(var s=t.length,i=new Uint8Array((s-(t[s-1]=="=")-(t[s-2]=="="))*3/4|0),r=0,a=0;r<s;){var l=n[t.charCodeAt(r++)],u=n[t.charCodeAt(r++)],c=n[t.charCodeAt(r++)],d=n[t.charCodeAt(r++)];i[a++]=l<<2|u>>4,i[a++]=u<<4|c>>2,i[a++]=c<<6|d}return i}})();function G(n){return!isNaN(parseFloat(n))&&isFinite(n)}o(G,"_isNumber");function v(n){return n.charAt(0).toUpperCase()+n.substring(1)}o(v,"_capitalize");function T(n){return function(){return this[n]}}o(T,"_getter");var x=["isConstructor","isEval","isNative","isToplevel"],N=["columnNumber","lineNumber"],R=["fileName","functionName","source"],Te=["args"],Ae=["evalOrigin"],P=x.concat(N,R,Te,Ae);function m(n){if(n)for(var e=0;e<P.length;e++)n[P[e]]!==void 0&&this["set"+v(P[e])](n[P[e]])}o(m,"StackFrame");m.prototype={getArgs:o(function(){return this.args},"getArgs"),setArgs:o(function(n){if(Object.prototype.toString.call(n)!=="[object Array]")throw new TypeError("Args must be an Array");this.args=n},"setArgs"),getEvalOrigin:o(function(){return this.evalOrigin},"getEvalOrigin"),setEvalOrigin:o(function(n){if(n instanceof m)this.evalOrigin=n;else if(n instanceof Object)this.evalOrigin=new m(n);else throw new TypeError("Eval Origin must be an Object or StackFrame")},"setEvalOrigin"),toString:o(function(){var n=this.getFileName()||"",e=this.getLineNumber()||"",t=this.getColumnNumber()||"",s=this.getFunctionName()||"";return this.getIsEval()?n?"[eval] ("+n+":"+e+":"+t+")":"[eval]:"+e+":"+t:s?s+" ("+n+":"+e+":"+t+")":n+":"+e+":"+t},"toString")};m.fromString=o(function(n){var e=n.indexOf("("),t=n.lastIndexOf(")"),s=n.substring(0,e),i=n.substring(e+1,t).split(","),r=n.substring(t+1);if(r.indexOf("@")===0)var a=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(r,""),l=a[1],u=a[2],c=a[3];return new m({functionName:s,args:i||void 0,fileName:l,lineNumber:u||void 0,columnNumber:c||void 0})},"StackFrame$$fromString");for(b=0;b<x.length;b++)m.prototype["get"+v(x[b])]=T(x[b]),m.prototype["set"+v(x[b])]=(function(n){return function(e){this[n]=!!e}})(x[b]);var b;for(w=0;w<N.length;w++)m.prototype["get"+v(N[w])]=T(N[w]),m.prototype["set"+v(N[w])]=(function(n){return function(e){if(!G(e))throw new TypeError(n+" must be a Number");this[n]=Number(e)}})(N[w]);var w;for(k=0;k<R.length;k++)m.prototype["get"+v(R[k])]=T(R[k]),m.prototype["set"+v(R[k])]=(function(n){return function(e){this[n]=String(e)}})(R[k]);var k,A=m;function H(){var n=/^\s*at .*(\S+:\d+|\(native\))/m,e=/^(eval@)?(\[native code])?$/;return{parse:o(function(t){if(t.stack&&t.stack.match(n))return this.parseV8OrIE(t);if(t.stack)return this.parseFFOrSafari(t);throw new Error("Cannot parse given Error object")},"ErrorStackParser$$parse"),extractLocation:o(function(t){if(t.indexOf(":")===-1)return[t];var s=/(.+?)(?::(\d+))?(?::(\d+))?$/,i=s.exec(t.replace(/[()]/g,""));return[i[1],i[2]||void 0,i[3]||void 0]},"ErrorStackParser$$extractLocation"),parseV8OrIE:o(function(t){var s=t.stack.split(`
`).filter(function(i){return!!i.match(n)},this);return s.map(function(i){i.indexOf("(eval ")>-1&&(i=i.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(,.*$)/g,""));var r=i.replace(/^\s+/,"").replace(/\(eval code/g,"(").replace(/^.*?\s+/,""),a=r.match(/ (\(.+\)$)/);r=a?r.replace(a[0],""):r;var l=this.extractLocation(a?a[1]:r),u=a&&r||void 0,c=["eval","<anonymous>"].indexOf(l[0])>-1?void 0:l[0];return new A({functionName:u,fileName:c,lineNumber:l[1],columnNumber:l[2],source:i})},this)},"ErrorStackParser$$parseV8OrIE"),parseFFOrSafari:o(function(t){var s=t.stack.split(`
`).filter(function(i){return!i.match(e)},this);return s.map(function(i){if(i.indexOf(" > eval")>-1&&(i=i.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),i.indexOf("@")===-1&&i.indexOf(":")===-1)return new A({functionName:i});var r=/((.*".+"[^@]*)?[^@]*)(?:@)/,a=i.match(r),l=a&&a[1]?a[1]:void 0,u=this.extractLocation(i.replace(r,""));return new A({functionName:l,fileName:u[0],lineNumber:u[1],columnNumber:u[2],source:i})},this)},"ErrorStackParser$$parseFFOrSafari")}}o(H,"ErrorStackParser");var Fe=new H,Le=Fe;function z(){var a;if(typeof API<"u"&&API!==globalThis.API)return API.runtimeEnv;let n=typeof Bun<"u",e=typeof Deno<"u",t=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser,s=typeof navigator=="object"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome")===-1&&navigator.userAgent.indexOf("Safari")>-1,i=typeof read=="function"&&typeof load=="function",r=typeof navigator=="object"&&((a=navigator.userAgent)==null?void 0:a.includes("Cloudflare-Workers"));return K({IN_BUN:n,IN_DENO:e,IN_NODE:t,IN_SAFARI:s,IN_SHELL:i,IN_WORKERD:r})}o(z,"getGlobalRuntimeEnv");var _=z();function K(n){let e=n.IN_NODE&&typeof M<"u"&&M.exports&&typeof $=="function"&&typeof __dirname=="string",t=n.IN_NODE&&!e,s=!n.IN_NODE&&!n.IN_DENO&&!n.IN_BUN,i=s&&typeof window<"u"&&typeof window.document<"u"&&typeof document.createElement=="function"&&"sessionStorage"in window&&typeof globalThis.importScripts!="function",r=s&&typeof globalThis.WorkerGlobalScope<"u"&&typeof globalThis.self<"u"&&globalThis.self instanceof globalThis.WorkerGlobalScope;if(r&&V())throw new Error("Classic web workers are not supported");let a={...n,IN_BROWSER:s,IN_BROWSER_MAIN_THREAD:i,IN_BROWSER_WEB_WORKER:r,IN_NODE_COMMONJS:e,IN_NODE_ESM:t};if(!(a.IN_BROWSER_MAIN_THREAD||a.IN_BROWSER_WEB_WORKER||a.IN_NODE||a.IN_SHELL||a.IN_WORKERD))throw new Error(`Cannot determine runtime environment: ${JSON.stringify(a)}`);return a}o(K,"calculateDerivedFlags");function V(){try{return globalThis.importScripts("data:text/javascript,"),!0}catch{return!1}}o(V,"isClassicWorker");var Y,L,W,U;async function j(){if(!_.IN_NODE||(Y=(await import("./__vite-browser-external-9wXp6ZBx.js")).default,W=await import("./__vite-browser-external-9wXp6ZBx.js"),U=await import("./__vite-browser-external-9wXp6ZBx.js"),(await import("./__vite-browser-external-9wXp6ZBx.js")).default,L=await import("./__vite-browser-external-9wXp6ZBx.js"),B=L.sep,typeof $<"u"))return;let n=W,e=await import("./__vite-browser-external-9wXp6ZBx.js"),t=await import("./__vite-browser-external-9wXp6ZBx.js"),s=await import("./__vite-browser-external-9wXp6ZBx.js"),i={fs:n,crypto:e,ws:t,child_process:s};globalThis.require=function(r){return i[r]}}o(j,"initNodeModules");function Q(n,e){return L.resolve(e||".",n)}o(Q,"node_resolvePath");function X(n,e){return e===void 0&&(e=location),new URL(n,e).toString()}o(X,"browser_resolvePath");var I;_.IN_NODE?I=Q:_.IN_SHELL?I=o(n=>n,"resolvePath"):I=X;var B;_.IN_NODE||(B="/");function Z(n,e){return n.startsWith("file://")&&(n=n.slice(7)),n.includes("://")?{response:fetch(n)}:{binary:U.readFile(n).then(t=>new Uint8Array(t.buffer,t.byteOffset,t.byteLength))}}o(Z,"node_getBinaryResponse");function ee(n,e){if(n.startsWith("file://")&&(n=n.slice(7)),n.includes("://"))throw new Error("Shell cannot fetch urls");return{binary:Promise.resolve(new Uint8Array(readbuffer(n)))}}o(ee,"shell_getBinaryResponse");function ne(n,e){let t=new URL(n,location);return{response:fetch(t,e?{integrity:e}:{})}}o(ne,"browser_getBinaryResponse");var O;_.IN_NODE?O=Z:_.IN_SHELL?O=ee:O=ne;async function te(n,e){let{response:t,binary:s}=O(n,e);if(s)return s;let i=await t;if(!i.ok)throw new Error(`Failed to load '${n}': request failed.`);return new Uint8Array(await i.arrayBuffer())}o(te,"loadBinaryFile");var D;_.IN_NODE?D=re:D=o(async n=>await import(n),"loadScript");async function re(n){return n.startsWith("file://")&&(n=n.slice(7)),n.includes("://")?await import(n):await import(Y.pathToFileURL(n).href)}o(re,"nodeLoadScript");async function se(n){if(_.IN_NODE){await j();let e=await U.readFile(n,{encoding:"utf8"});return JSON.parse(e)}else if(_.IN_SHELL){let e=read(n);return JSON.parse(e)}else return await(await fetch(n)).json()}o(se,"loadLockFile");async function ie(){if(_.IN_NODE_COMMONJS)return __dirname;let n;try{throw new Error}catch(s){n=s}let e=Le.parse(n)[0].fileName;if(_.IN_NODE&&!e.startsWith("file://")&&(e=`file://${e}`),_.IN_NODE_ESM){let s=await import("./__vite-browser-external-9wXp6ZBx.js");return(await import("./__vite-browser-external-9wXp6ZBx.js")).fileURLToPath(s.dirname(e))}let t=e.lastIndexOf(B);if(t===-1)throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");return e.slice(0,t)}o(ie,"calculateDirname");function ae(n){var e;return n.substring(0,n.lastIndexOf("/")+1)||((e=globalThis.location)==null?void 0:e.toString())||"."}o(ae,"calculateInstallBaseUrl");function oe(n){let e=n.FS,t=n.FS.filesystems.MEMFS,s=n.PATH,i={DIR_MODE:16895,FILE_MODE:33279,mount:o(function(r){if(!r.opts.fileSystemHandle)throw new Error("opts.fileSystemHandle is required");return t.mount.apply(null,arguments)},"mount"),syncfs:o(async(r,a,l)=>{try{let u=i.getLocalSet(r),c=await i.getRemoteSet(r),d=a?c:u,f=a?u:c;await i.reconcile(r,d,f),l(null)}catch(u){l(u)}},"syncfs"),getLocalSet:o(r=>{let a=Object.create(null);function l(d){return d!=="."&&d!==".."}o(l,"isRealDir");function u(d){return f=>s.join2(d,f)}o(u,"toAbsolute");let c=e.readdir(r.mountpoint).filter(l).map(u(r.mountpoint));for(;c.length;){let d=c.pop(),f=e.stat(d);e.isDir(f.mode)&&c.push.apply(c,e.readdir(d).filter(l).map(u(d))),a[d]={timestamp:f.mtime,mode:f.mode}}return{type:"local",entries:a}},"getLocalSet"),getRemoteSet:o(async r=>{let a=Object.create(null),l=await De(r.opts.fileSystemHandle);for(let[u,c]of l)u!=="."&&(a[s.join2(r.mountpoint,u)]={timestamp:c.kind==="file"?new Date((await c.getFile()).lastModified):new Date,mode:c.kind==="file"?i.FILE_MODE:i.DIR_MODE});return{type:"remote",entries:a,handles:l}},"getRemoteSet"),loadLocalEntry:o(r=>{let a=e.lookupPath(r,{}).node,l=e.stat(r);if(e.isDir(l.mode))return{timestamp:l.mtime,mode:l.mode};if(e.isFile(l.mode))return a.contents=t.getFileDataAsTypedArray(a),{timestamp:l.mtime,mode:l.mode,contents:a.contents};throw new Error("node type not supported")},"loadLocalEntry"),storeLocalEntry:o((r,a)=>{if(e.isDir(a.mode))e.mkdirTree(r,a.mode);else if(e.isFile(a.mode))e.writeFile(r,a.contents,{canOwn:!0});else throw new Error("node type not supported");e.chmod(r,a.mode),e.utime(r,a.timestamp,a.timestamp)},"storeLocalEntry"),removeLocalEntry:o(r=>{var a=e.stat(r);e.isDir(a.mode)?e.rmdir(r):e.isFile(a.mode)&&e.unlink(r)},"removeLocalEntry"),loadRemoteEntry:o(async r=>{if(r.kind==="file"){let a=await r.getFile();return{contents:new Uint8Array(await a.arrayBuffer()),mode:i.FILE_MODE,timestamp:new Date(a.lastModified)}}else{if(r.kind==="directory")return{mode:i.DIR_MODE,timestamp:new Date};throw new Error("unknown kind: "+r.kind)}},"loadRemoteEntry"),storeRemoteEntry:o(async(r,a,l)=>{let u=r.get(s.dirname(a)),c=e.isFile(l.mode)?await u.getFileHandle(s.basename(a),{create:!0}):await u.getDirectoryHandle(s.basename(a),{create:!0});if(c.kind==="file"){let d=await c.createWritable();await d.write(l.contents),await d.close()}r.set(a,c)},"storeRemoteEntry"),removeRemoteEntry:o(async(r,a)=>{await r.get(s.dirname(a)).removeEntry(s.basename(a)),r.delete(a)},"removeRemoteEntry"),reconcile:o(async(r,a,l)=>{let u=0,c=[];Object.keys(a.entries).forEach(function(p){let h=a.entries[p],g=l.entries[p];(!g||e.isFile(h.mode)&&h.timestamp.getTime()>g.timestamp.getTime())&&(c.push(p),u++)}),c.sort();let d=[];if(Object.keys(l.entries).forEach(function(p){a.entries[p]||(d.push(p),u++)}),d.sort().reverse(),!u)return;let f=a.type==="remote"?a.handles:l.handles;for(let p of c){let h=s.normalize(p.replace(r.mountpoint,"/")).substring(1);if(l.type==="local"){let g=f.get(h),E=await i.loadRemoteEntry(g);i.storeLocalEntry(p,E)}else{let g=i.loadLocalEntry(p);await i.storeRemoteEntry(f,h,g)}}for(let p of d)if(l.type==="local")i.removeLocalEntry(p);else{let h=s.normalize(p.replace(r.mountpoint,"/")).substring(1);await i.removeRemoteEntry(f,h)}},"reconcile")};n.FS.filesystems.NATIVEFS_ASYNC=i}o(oe,"initializeNativeFS");var De=o(async n=>{let e=[];async function t(i){for await(let r of i.values())e.push(r),r.kind==="directory"&&await t(r)}o(t,"collect"),await t(n);let s=new Map;s.set(".",n);for(let i of e){let r=(await n.resolve(i)).join("/");s.set(r,i)}return s},"getFsHandles"),Ce=Pe("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECBygCE0pzdl9HZXRFcnJvcl9pbXBvcnQAAA5Kc3ZFcnJvcl9DaGVjawABChMCBwD7AQD7GwsJACAA+xr7FAAL"),Me=(async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&typeof navigator.maxTouchPoints<"u"&&navigator.maxTouchPoints>1)))try{let n=await WebAssembly.compile(Ce);return await WebAssembly.instantiate(n)}catch(n){if(n instanceof WebAssembly.CompileError)return;throw n}})();async function le(){let n=await Me;if(n)return n.exports;let e=Symbol("error marker");return{Jsv_GetError_import:o(()=>e,"Jsv_GetError_import"),JsvError_Check:o(t=>t===e,"JsvError_Check")}}o(le,"getJsvErrorImport");function ce(n){let e={config:n,runtimeEnv:_},t={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:_e(n),print:n.stdout,printErr:n.stderr,onExit(s){t.exitCode=s},thisProgram:n._sysExecutable,arguments:n.args,API:e,locateFile:o(s=>n.indexURL+s,"locateFile"),instantiateWasm:he(n.indexURL)};return t}o(ce,"createSettings");function ue(n){return function(e){let t="/";try{e.FS.mkdirTree(n)}catch(s){console.error(`Error occurred while making a home directory '${n}':`),console.error(s),console.error(`Using '${t}' for a home directory instead`),n=t}e.FS.chdir(n)}}o(ue,"createHomeDirectory");function de(n){return function(e){Object.assign(e.ENV,n)}}o(de,"setEnvironment");function pe(n){return n?[async e=>{e.addRunDependency("fsInitHook");try{await n(e.FS,{sitePackages:e.API.sitePackages})}finally{e.removeRunDependency("fsInitHook")}}]:[]}o(pe,"callFsInitHook");function fe(n){let e=n.HEAPU32[n._Py_Version>>>2],t=e>>>24&255,s=e>>>16&255,i=e>>>8&255;return[t,s,i]}o(fe,"computeVersionTuple");function me(n){let e=te(n);return async t=>{t.API.pyVersionTuple=fe(t);let[s,i]=t.API.pyVersionTuple;t.FS.mkdirTree("/lib"),t.API.sitePackages=`/lib/python${s}.${i}/site-packages`,t.FS.mkdirTree(t.API.sitePackages),t.addRunDependency("install-stdlib");try{let r=await e;t.FS.writeFile(`/lib/python${s}${i}.zip`,r)}catch(r){console.error("Error occurred while installing the standard library:"),console.error(r)}finally{t.removeRunDependency("install-stdlib")}}}o(me,"installStdlib");function _e(n){let e;return n.stdLibURL!=null?e=n.stdLibURL:e=n.indexURL+"python_stdlib.zip",[me(e),ue(n.env.HOME),de(n.env),oe,...pe(n.fsInit)]}o(_e,"getFileSystemInitializationFuncs");function he(n){if(typeof WasmOffsetConverter<"u")return;let{binary:e,response:t}=O(n+"pyodide.asm.wasm"),s=le();return function(i,r){return(async function(){let{Jsv_GetError_import:a,JsvError_Check:l}=await s;i.env.Jsv_GetError_import=a,i.env.JsvError_Check=l;try{let u;t?u=await WebAssembly.instantiateStreaming(t,i):u=await WebAssembly.instantiate(await e,i);let{instance:c,module:d}=u;r(c,d)}catch(u){console.warn("wasm instantiation failed!"),console.warn(u)}})(),{}}}o(he,"getInstantiateWasmFunc");var Ue="314.0.2";function S(n){return n===void 0||n.endsWith("/")?n:n+"/"}o(S,"withTrailingSlash");var C=Ue;async function ge(n={}){var i,r;if(await j(),n.lockFileContents&&n.lockFileURL)throw new Error("Can't pass both lockFileContents and lockFileURL");let e=n.indexURL||await ie();if(e=S(I(e)),n.packageBaseUrl=S(n.packageBaseUrl),n.cdnUrl=S(n.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v${C}/full/`),!n.lockFileContents){let a=n.lockFileURL??e+"pyodide-lock.json";n.lockFileContents=se(a),n.packageBaseUrl??(n.packageBaseUrl=ae(a))}n.indexURL=e,n.packageCacheDir&&(n.packageCacheDir=S(I(n.packageCacheDir)));let t={jsglobals:globalThis,stdin:globalThis.prompt?()=>globalThis.prompt():void 0,args:[],env:{},packages:[],packageCacheDir:n.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:"a4189f0fe3d610ecd603639c08596362b70a34b106c58c9a93486c22df4c89a5"},s=Object.assign(t,n);return(i=s.env).HOME??(i.HOME="/home/pyodide"),(r=s.env).PYTHONINSPECT??(r.PYTHONINSPECT="1"),s}o(ge,"initializeConfiguration");function ye(n){let e=ce(n),t=e.API;return t.lockFilePromise=Promise.resolve(n.lockFileContents),e}o(ye,"createEmscriptenSettings");async function ve(n){if(n.createPyodideModule)return n.createPyodideModule;let e=`${n.indexURL}pyodide.asm.mjs`;return(await D(e)).default}o(ve,"loadWasmScript");async function be(n,e){if(!n._loadSnapshot)return;let t=await n._loadSnapshot,s=ArrayBuffer.isView(t)?t:new Uint8Array(t);return e.noInitialRun=!0,e.INITIAL_MEMORY=s.length,s}o(be,"prepareSnapshot");async function we(n,e){let t=await n(e);if(e.exitCode!==void 0)throw new t.ExitStatus(e.exitCode);return t}o(we,"instantiatePyodideModule");function ke(n,e){let t=n.API;if(e.pyproxyToStringRepr&&t.setPyProxyToStringMethod(!0),e.convertNullToNone&&t.setCompatNullToNone(!0),e.toJsLiteralMap&&t.setCompatToJsLiteralMap(!0),t.version!==C&&e.checkAPIVersion)throw new Error(`Pyodide version does not match: '${C}' <==> '${t.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);n.locateFile=s=>{throw s.endsWith(".so")?new Error(`Failed to find dynamic library "${s}"`):new Error(`Unexpected call to locateFile("${s}")`)}}o(ke,"configureAPI");function Ee(n,e,t){let s=n.API,i;return e&&(i=s.restoreSnapshot(e)),s.finalizeBootstrap(i,t._snapshotDeserializer)}o(Ee,"bootstrapPyodide");async function xe(n,e){let t=n._api;return t.sys.path.insert(0,""),t._pyodide.set_excepthook(),await t.packageIndexReady,t.initializeStreams(e.stdin,e.stdout,e.stderr),n}o(xe,"finalizeSetup");async function Ne(n={}){let e=await ge(n),t=ye(e),s=await ve(e),i=await be(e,t),r=await we(s,t);ke(r,e);let a=Ee(r,i,e);return await xe(a,e)}o(Ne,"loadPyodide");function je(n){return n.crossOriginIsolated===!0&&typeof n.SharedArrayBuffer=="function"?"isolated":"compat"}var Be=`# The in-worker Python runtime, installed into Pyodide once at boot\r
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
    def stage_files(self, files):\r
        os.makedirs(MOUNT, exist_ok=True)\r
        for root, dirs, names in os.walk(MOUNT, topdown=False):\r
            for name in names:\r
                os.remove(os.path.join(root, name))\r
            for d in dirs:\r
                os.rmdir(os.path.join(root, d))\r
        self.staged = dict(files)\r
        for name, contents in files.items():\r
            path = os.path.join(MOUNT, name)\r
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
                return str(run_sync(on_input(str(prompt))))\r
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
                elif extract_result and 'result' in module.__dict__:\r
                    value = json.dumps(module.__dict__['result'])\r
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
`,qe=`# The Pedal "blockpy environment" contract for Studio (spec 10.1) - a
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
import linecache
import os
import shutil
import sys

_INSTRUCTOR_PKG = '_instructor'
_PREFIXES = '!^?&$*#'


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


def _studio_pedal_grade(student_code, on_run, files_json, inputs, options_json):
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

        # The submission carries the STUDENT-visible files: answer.py +
        # chomped ?/& instructor extras + student extras (legacy
        # getAllStudentFiles, instructor.js:69-83). The instructor staging
        # view lives on DISK (open() + _instructor imports), not here.
        student_files = dict(options.get('student_files') or {})
        student_files['answer.py'] = student_code

        # Real source files for every compiled name: Python 3.13+ recovers
        # traceback/SyntaxError source lines through linecache, so grading
        # against purely-synthetic filenames loses the offending line (and
        # the FakeFrame patch above falls back to linecache). Written AFTER
        # the instructor staging so answer.py always carries THIS pass's
        # student code.
        for _name, _contents in list(student_files.items()) + [('on_run.py', on_run)]:
            try:
                _parent = os.path.dirname(_name)
                if _parent:
                    os.makedirs(_parent, exist_ok=True)
                with open(_name, 'w', encoding='utf-8') as _handle:
                    _handle.write(_contents)
            except (OSError, TypeError):
                pass  # odd names/contents: grading proceeds, lines degrade
        linecache.clearcache()

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


def _studio_pedal_evaluate(evaluation, on_eval, options_json):
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
        from pedal.sandbox.commands import evaluate, get_sandbox
        student = get_sandbox(report=MAIN_REPORT)
        evaluate(evaluation, report=MAIN_REPORT)
        exec(compile(on_eval, 'on_eval.py', 'exec'),
             _studio_instructor_globals(student, evaluation))
        return _studio_pedal_resolve()
    except BaseException:  # noqa: BLE001 - grading must fail soft
        return _studio_fail_soft()
`;const Je=["pedal","curriculum-sneks","bakery"];class q{constructor(e,t){this.grade_=e,this.evaluate_=t}static async install(e,t=Je){await e.loadPackage("micropip"),await e.runPythonAsync(`import micropip
await micropip.install(${JSON.stringify(t)})`),e.runPython(qe);const s=e.globals.get("_studio_pedal_grade"),i=e.globals.get("_studio_pedal_evaluate");return new q(s,i)}grade(e){const t=this.grade_(e.studentCode,e.onRun,JSON.stringify(e.files??{}),e.inputs??[],JSON.stringify({skip_tifa:e.skipTifa??!1,skip_run:e.skipRun??!1,seed:e.seed??null,student_files:e.studentFiles??{}})),s=t.toJs({dict_converter:Object.fromEntries});return t.destroy(),s}evaluateGrade(e){const t=this.evaluate_(e.evaluation,e.onEval,"{}"),s=t.toJs({dict_converter:Object.fromEntries});return t.destroy(),s}}const We=()=>typeof WebAssembly.Suspending=="function",F=n=>{const e=n.toJs({dict_converter:Object.fromEntries});return n.destroy(),e};class J{constructor(e,t){y(this,"runtime");y(this,"pedalEnv",null);y(this,"realRequestsReady",!1);this.pyodide=e,this.runtime=t}static create(e){e.runPython(Be);const t=e.globals.get("_studio_runtime");return new J(e,t)}clearNamespace(){this.runtime.clear_namespace()}healthCheck(){try{return this.runtime.stack_canary(),!0}catch{return!1}}async ensureRealRequests(){if(this.realRequestsReady)return;const e=this.pyodide;await e.loadPackage("micropip"),await e.runPythonAsync(`import micropip
await micropip.install(['requests', 'pyodide-http'])
import pyodide_http
pyodide_http.patch_all()`),this.realRequestsReady=!0}async ensurePedal(e){return this.pedalEnv===null&&(this.pedalEnv=await q.install(this.pyodide,e)),this.pedalEnv}async executePedal(e,t){const s=e.pedal;try{const i=await this.ensurePedal(s.packages),r=s.evaluation!==void 0?i.evaluateGrade({evaluation:s.evaluation,onEval:s.onRun}):i.grade({studentCode:e.code,onRun:s.onRun,files:e.files,inputs:s.inputs??e.inputsPrefill,studentFiles:s.studentFiles,skipTifa:s.skipTifa,skipRun:s.skipRun,seed:s.seed});return{jobId:e.id,success:!0,stdout:"",stderr:"",artifacts:{},feedback:r,durationMs:Date.now()-t}}catch(i){const r=i instanceof Error?i.message:String(i);return{jobId:e.id,success:!1,stdout:"",stderr:"",error:{type:"PedalEnvironmentError",message:r,line:null,studentLine:null,traceback:r+`
`},artifacts:{},durationMs:Date.now()-t}}}async execute(e,t={}){var f,p,h,g;const s=Date.now();if(e.pedal)return this.executePedal(e,s);try{await((p=(f=this.pyodide).loadPackagesFromImports)==null?void 0:p.call(f,e.code))}catch{}if(e.allowRealRequests)try{await this.ensureRealRequests()}catch{}this.pyodide.runPython(`_studio_runtime.stage_files(__import__('json').loads(${JSON.stringify(JSON.stringify(e.files))}))`);const i=t.onStdout??null,r=t.onStderr??null,a=(e.interactiveInput?t.onInput:void 0)??null,l=[e.code,e.filename??"answer.py",e.answerPrefix??"",e.answerSuffix??"",e.inputsPrefill??[],"exec",e.phase==="quiz.preprocess",e.trace??!1,((h=e.limits)==null?void 0:h.traceSteps)??null,i,r,e.allowRealRequests??!1,a],u=this.runtime.run,c=e.phase==="student.eval"||e.phase==="instructor.on_eval"?F(this.runtime.evaluate(e.code,i,r)):F(a!==null&&We()&&typeof u.callPromising=="function"?await u.callPromising(...l):u(...l)),d=F(this.runtime.collect_artifacts());return{jobId:e.id,success:!c.error,stdout:c.stdout,stderr:c.stderr,error:c.error?{type:c.error.type,message:c.error.message,line:c.error.line,studentLine:c.error.student_line,traceback:c.error.traceback}:void 0,value:c.value??void 0,trace:c.trace?c.trace.map(E=>({event:E.event,line:E.line,studentLine:E.student_line,locals:E.locals})):void 0,images:(g=c.images)!=null&&g.length?c.images:void 0,artifacts:d,durationMs:Date.now()-s}}}const $e=/call stack|stack overflow|fatally failed/i,Ge="The Python engine crashed - this usually means unbounded recursion (a function calling itself forever). The engine has been restarted; check your code and run again.";class He{constructor(e){y(this,"runner",null);y(this,"interrupted",new Set);y(this,"pendingInputs",new Map);y(this,"indexURL");y(this,"chain",Promise.resolve());this.options=e}handle(e){switch(e.kind){case"interrupt":return this.interrupted.add(e.jobId),Promise.resolve();case"input-response":{const t=this.pendingInputs.get(e.jobId);return this.pendingInputs.delete(e.jobId),t==null||t(e.value),Promise.resolve()}default:return this.chain=this.chain.then(()=>this.process(e)),this.chain}}async process(e){switch(e.kind){case"init":{this.indexURL=e.indexURL,this.runner=await this.options.loadRunner(e.indexURL),this.options.post({kind:"ready",mode:this.options.mode});return}case"run":{await this.runJob(e.job);return}case"restart-kernel":{this.runner=await this.options.loadRunner(this.indexURL),this.options.post({kind:"ready",mode:this.options.mode});return}}}async reloadRunner(){try{this.runner=await this.options.loadRunner(this.indexURL)}catch{this.runner=null}this.options.post({kind:"runner-reloaded"})}async runJob(e){var s,i;if(!this.runner){this.options.post({kind:"result",result:{jobId:e.id,success:!1,stdout:"",stderr:"",error:{type:"EngineError",message:"Engine worker not initialized",line:null,studentLine:null,traceback:`Engine worker not initialized
`},artifacts:{},durationMs:0}});return}if(this.interrupted.delete(e.id)){this.options.post({kind:"result",result:{jobId:e.id,success:!1,stdout:"",stderr:"",error:{type:"KeyboardInterrupt",message:"Execution interrupted",line:null,studentLine:null,traceback:`KeyboardInterrupt: Execution interrupted
`},artifacts:{},durationMs:0}});return}let t;try{t=await this.runner.execute(e,{onStdout:r=>this.options.post({kind:"stdout",jobId:e.id,chunk:r}),onStderr:r=>this.options.post({kind:"stderr",jobId:e.id,chunk:r}),onInput:r=>new Promise(a=>{this.pendingInputs.set(e.id,a),this.options.post({kind:"input-request",jobId:e.id,prompt:r})})})}catch(r){this.pendingInputs.delete(e.id);const a=r instanceof Error?r.message:String(r);await this.reloadRunner();const l=$e.test(a);this.options.post({kind:"result",result:{jobId:e.id,success:!1,stdout:"",stderr:"",error:{type:l?"EngineCrash":"EngineError",message:l?Ge:a,line:null,studentLine:null,traceback:a+`
`},artifacts:{},durationMs:0}});return}this.pendingInputs.delete(e.id),this.options.post({kind:"result",result:t}),((i=(s=this.runner).healthCheck)==null?void 0:i.call(s))===!1&&await this.reloadRunner()}}const ze=new He({post:n=>self.postMessage(n),loadRunner:async n=>{const e=await Ne(n?{indexURL:n}:void 0);return J.create(e)},mode:je(self)});self.onmessage=n=>{ze.handle(n.data)}});export default Ke();
