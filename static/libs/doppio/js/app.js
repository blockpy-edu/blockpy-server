!function(t) {
    function e(r) {
        if (n[r])
            return n[r].exports;
        var s = n[r] = {
            exports: {},
            id: r,
            loaded: !1
        };
        return t[r].call(s.exports, s, s.exports, e),
        s.loaded = !0,
        s.exports
    }
    var n = {};
    return e.m = t,
    e.c = n,
    e.p = "/js/",
    e(0)
}([function(t, e, n) {
    "use strict";
    function r(t, e) {
        var n = new FileReader;
        n.onerror = function(n) {
            switch (n.target.error.code) {
            case n.target.error.NOT_FOUND_ERR:
                return e("File " + t.name + " not found.");
            case n.target.error.NOT_READABLE_ERR:
                return e("File " + t.name + " is not readable.");
            case n.target.error.SECURITY_ERR:
                return e("Cannot use the FileReader interface. You must launch your browser with --allow-file-access-from-files.")
            }
        }
        ,
        n.onload = function(n) {
            g.writeFile(v.cwd() + "/" + t.name, new b(n.target.result), function(t) {
                t ? e("" + t) : e()
            })
        }
        ,
        n.readAsArrayBuffer(t)
    }
    function s(t, e) {
        if ("undefined" == typeof FileReader || null === FileReader)
            return t.stderr("\nYour browser doesn't support file loading.\nTry using the editor to create files instead.\n"),
            t.prompt();
        var n = e.target.files.length
          , s = 0;
        n > 0 && t.stdout("\nUploading " + n + " files...\n");
        for (var i = e.target.files, o = function(e) {
            var o = i[e];
            r(o, function(e) {
                s++;
                var r = "[" + s + "/" + n + "]: File " + o.name + " ";
                e ? (r += "could not be saved: " + e + ".\n",
                t.stderr(r)) : (r += "successfully saved.\n",
                t.stdout(r)),
                s === n && t.prompt()
            })
        }, a = 0; a < i.length; a++)
            o(a)
    }
    function i() {
        var t = $("#console");
        window._GLOBAL_JAVA_TERMINAL_PROCESS = v;
        v.chdir("/home"),
        t.fadeIn("fast", function() {
            var e = t.get()[0];
            u.disableScroll(e);
            var n = new h["default"](e,[new f.JARCommand("ecj",_ + "ecj-4.5.jar",["-Djdt.compiler.useSingleThread=true"],["java"]), new f.JARCommand("rhino",_ + "rhino1.7.6.jar",[],["js"]), new f.JARCommand("kawa",_ + "kawa-2.0.jar",[],["scm", "ss", "sch"]), new f.JARCommand("clojure",_ + "clojure-1.7.0.jar",[],["clj", "cljs", "cljc", "edn"]), new f.JavaClassCommand("scala","","scala.tools.nsc.MainGenericRunner",["-Xbootclasspath/a:" + ["akka-actor_2.11-2.3.10.jar", "config-1.2.1.jar", "jline-2.12.1.jar", "scala-actors-2.11.0.jar", "scala-actors-migration_2.11-1.1.0.jar", "scala-compiler.jar", "scala-continuations-library_2.11-1.0.2.jar", "scala-continuations-plugin_2.11.7-1.0.2.jar", "scala-library.jar", "scala-parser-combinators_2.11-1.0.4.jar", "scala-reflect.jar", "scala-swing_2.11-1.0.2.jar", "scala-xml_2.11-1.0.4.jar", "scalap-2.11.7.jar"].map(function(t) {
                return _ + "scala-2.11.7/lib/" + t
            }).join(":"), "-Dscala.home=" + _ + "scala-2.11.7", "-Dscala.usejavacp=true", "-Denv.emacs="],[],["scala", "sc"]), new f.JARCommand("groovy",_ + "groovy-all-2.4.5-indy.jar",[],["groovy", "gvy", "gy", "gsh"]), new f.JARCommand("abcl",_ + "abcl-1.3.3.jar",[],["lisp", "cl", "lsp", "l"]), new f.JARCommand("nashorn","/home/vendor/java_home/lib/ext/nashorn.jar",[],["js"]), new f.JARCommand("abandon","/programs/abandon.jar",[],["conf"]), new f.JavaClassCommand("scimark2","/programs/scimark2lib.jar","jnt.scimark2.commandline",[],[],[]), new f.JavaClassCommand("javac",k,"classes.util.Javac",[],[],["java"]), new f.JavaClassCommand("javap",k,"classes.util.Javap",[],[],["class"]), new f.JavaCommand, new d.LSCommand, new p["default"]("source",$("#save_btn"),$("#close_btn"),$("#ide"),$("#console"),$("#filename")), new d.CatCommand, new d.MvCommand, new d.CpCommand, new d.MkdirCommand, new d.CDCommand, new d.RMCommand, new d.RmdirCommand, new d.MountDropboxCommand, new m.TimeCommand, new m.ProfileCommand, new m.TipCommand, new m.HelpCommand],"Please wait while the DoppioJVM demo loads...","/home/.shell_history");
            g.readFile("/home/motd", function(t, e) {
                var r = "";
                t || (r = e.toString()),
                $("#file").change(function(t) {
                    s(n, t)
                }),
                v.stdout.on("data", function(t) {
                    return n.stdout(t.toString())
                }),
                v.stderr.on("data", function(t) {
                    return n.stderr(t.toString())
                }),
                n.loadingCompleted(r)
            })
        })
    }
    function o(t, e) {
        var r = new l.FileSystem.MountableFileSystem;
        l.initialize(r),
        g.mkdirSync("/mnt"),
        r.mount("/home", t),
        r.mount("/tmp", new l.FileSystem.InMemory),
        r.mount("/mnt/localStorage", new l.FileSystem.LocalStorage),
        r.mount("/programs", new l.FileSystem.XmlHttpRequest(n(13),"programs/")),
        e()
    }
    function a(t) {
        if (l.FileSystem.IndexedDB.isAvailable())
            var e = new l.FileSystem.IndexedDB(function(n, r) {
                t(n ? new l.FileSystem.InMemory : e)
            }
            ,"doppio-cache");
        else if (l.FileSystem.HTML5FS.isAvailable()) {
            var n = new l.FileSystem.HTML5FS(104857600);
            n.allocate(function(e) {
                t(e ? new l.FileSystem.InMemory : n)
            })
        } else
            t(new l.FileSystem.InMemory)
    }
    function c(t, e) {
        function n() {
            var t = new XMLHttpRequest
              , e = (new Date).getTime();
            t.open("GET", "../static/libs/doppio/doppio_home.zip"),
            t.responseType = "arraybuffer",
            t.addEventListener("progress", function(t) {
                var n = (new Date).getTime()
                  , r = t.loaded
                  , o = t.total
                  , a = (r >> 10) / ((n - e) / 1e3)
                  , c = o - r >> 10
                  , l = Math.floor(c / a)
                  , u = Math.floor(l / 60)
                  , h = l % 60
                  , f = r / o * 100 | 0;
                s.text("Downloading doppio_home.zip at " + a.toFixed(2) + " KB/s [" + (r >> 10) + " KB / " + (o >> 10) + " KB] (" + u + "m" + h + "s remaining)"),
                i.attr("aria-valuenow", f),
                i.css("width", f + "%")
            }),
            t.addEventListener("load", function(e) {
                r(t.response)
            }),
            t.addEventListener("error", function(t) {
                i.removeClass("active").addClass("progress-bar-danger"),
                s.text("Error downloading doppio_home.zip: " + t.error)
            }),
            t.addEventListener("abort", function(t) {
                i.removeClass("active").addClass("progress-bar-danger"),
                s.text("Error downloading doppio_home.zip: Transfer aborted.")
            }),
            t.send()
        }
        function r(n) {
            var r = new l.FileSystem.MountableFileSystem;
            r.mount("/persist", t),
            r.mount("/doppio_home", new l.FileSystem.ZipFS(new b(n))),
            l.initialize(r),
            u.recursiveCopy("/doppio_home", "/persist", function(t, e, n) {
                s.text("Extracting " + e.slice(e.indexOf("/", 1) + 1) + "...")
            }, function(t) {
                t ? (i.removeClass("active").addClass("progress-bar-danger"),
                s.text("Error extracting doppio_home.zip: " + t)) : e()
            })
        }
        var s = $(".progress-bar span")
          , i = $(".progress-bar")
          , o = l.BFSRequire("fs");
        s.text("Checking browser cache..."),
        l.initialize(t),
        o.readFile("/vendor/java_home/jdk.json", function(t, r) {
            if (t)
                n();
            else
                try {
                    var s = JSON.parse(r.toString())
                      , i = y.VM.JVM.getCompiledJDKURL();
                    s.url === i ? e() : n()
                } catch (o) {
                    n()
                }
        })
    }
    var l = n(1)
      , u = n(2)
      , h = n(5)
      , f = n(7)
      , p = n(10)
      , d = n(11)
      , m = n(12)
      , y = n(9)
      , v = l.BFSRequire("process")
      , b = l.BFSRequire("buffer").Buffer
      , g = l.BFSRequire("fs")
      , _ = (l.BFSRequire("path"),
    "/programs/")
      , k = "/home/classes/";
    null == location.origin && (location.origin = location.protocol + "//" + location.host),
    $(document).ready(window.startJavaMode = function () {
        var t = null;
        a(function(e) {
            t = e,
            l.initialize(e);
            var n = l.BFSRequire("fs");
            n.readdir("/", function(t, e) {
                e && e.length > 0 && $("#clear-demo-button").fadeIn("fast").on("click", function() {
                    $("#clear-demo-button").prop("disabled", !0);
                    var t = $("#reset-status");
                    u.recursiveRm("/", function(e) {
                        t.text("Deleting cached file " + e + "...")
                    }, function(t) {
                        t && console.error("Error removing: " + t),
                        document.location.reload(!0)
                    })
                })
            })
        }),
        $("#demo_button").on("click", function() {
            $("#button-and-warning").fadeOut("fast", function() {
                $("#progress-bar-container").fadeIn("fast", function() {
                    function e() {
                        c(t, function() {
                            o(t, function() {
                                $("#progress-bar-container").fadeOut("fast", function() {
                                    i()
                                })
                            })
                        })
                    }
                    if (t)
                        e();
                    else {
                        var n = $(".progress-bar span");
                        n.text("Waiting for you to grant or deny us access to browser storage....");
                        var r = setInterval(function() {
                            t && (clearInterval(r),
                            e())
                        }, 100)
                    }
                })
            })
        })
    })
}
, function(t, e) {
    t.exports = BrowserFS
}
, function(t, e, n) {
    "use strict";
    function r(t, e) {
        return e.filter(function(e) {
            return e.substr(0, t.length) == t
        })
    }
    function s(t, e) {
        function n(t) {
            return new RegExp("^" + t.replace(/\./g, "\\.").split("*").join("[^/]*") + "$")
        }
        var r = g.normalize(t)
          , s = r.split("/")
          , o = ["/" === t.charAt(0) ? "/" : "."];
        v.eachSeries(s, function(t, e) {
            var r;
            return "" === t ? e() : (r = n(t),
            void i(o, r, function(t) {
                o = t,
                e()
            }))
        }, function(t) {
            e(o)
        })
    }
    function i(t, e, n) {
        var r = [];
        v.each(t, function(t, n) {
            _.readdir(t, function(s, i) {
                var o;
                if (null == s)
                    for (o = 0; o < i.length; o++)
                        e.test(i[o]) && r.push(g.join(t, i[o]));
                n()
            })
        }, function() {
            n(r)
        })
    }
    function o(t, e, n, s) {
        var i, o, a = y.last(e), c = a.lastIndexOf("/");
        c >= 0 ? (i = a.slice(0, c + 1),
        o = a.slice(c + 1)) : (i = "",
        o = a);
        var l = "" == i ? "." : g.resolve(i);
        _.readdir(l, function(t, e) {
            var a = [];
            return null != t ? s(a) : (e = r(o, e),
            void v.each(e, function(t, e) {
                _.stat(g.resolve(i + t), function(r, s) {
                    null != r || (s.isDirectory() && n(t, !0) ? a.push(i + t + "/") : n(t, !1) && a.push(i + t)),
                    e()
                })
            }, function() {
                return s(a)
            }))
        })
    }
    function a(t) {
        return t.join(" ").match(/^(\S*)\S*(?: \1\S*)*$/i)[1]
    }
    function c(t, e) {
        function n(t) {
            return c.filter(function(e) {
                return null != e[t]
            }).map(function(e) {
                return l(e[t], r + 1)
            }).join("")
        }
        for (var r = 0, s = 0; s < t.length; s++) {
            var i = t[s].length;
            i > r && (r = i)
        }
        for (var o = e / (r + 1) | 0, a = Math.ceil(t.length / o), c = [], u = 1; o >= u; u++)
            c.push(t.splice(0, a));
        for (var h = [], s = 0; a > s; s++)
            h.push(n(s));
        return h.join("\n")
    }
    function l(t, e) {
        return t + Array(e - t.length + 1).join(" ")
    }
    function u(t, e, n) {
        function r(t, n) {
            _.readdir(t, function(s, i) {
                return s ? n(s) : void v.each(i, function(n, s) {
                    var i = g.resolve(t, n);
                    _.stat(i, function(t, n) {
                        t ? s(t) : n.isDirectory() ? r(i, function(t) {
                            t ? s(t) : _.rmdir(i, s)
                        }) : (e(i),
                        _.unlink(i, s))
                    })
                }, n)
            })
        }
        r(t, n)
    }
    function h(t, e, n, r) {
        function s(t, e, r) {
            _.mkdir(e, function(i) {
                i && "EEXIST" !== i.code ? r(i) : _.readdir(t, function(i, o) {
                    i ? r(i) : v.each(o, function(i, o) {
                        var a = g.resolve(t, i)
                          , c = g.resolve(e, i);
                        _.stat(a, function(t, e) {
                            t ? r(t) : e.isDirectory() ? s(a, c, o) : (n(a, c, e),
                            f(a, c, o))
                        })
                    }, r)
                })
            })
        }
        s(t, e, r)
    }
    function f(t, e, n) {
        _.readFile(t, function(t, r) {
            t ? n(t) : _.writeFile(e, r, n)
        })
    }
    function p(t) {
        t = t || window.event,
        t.preventDefault && t.preventDefault(),
        t.returnValue = !1
    }
    function d(t) {
        t.addEventListener && t.addEventListener("DOMMouseScroll", p, !1)
    }
    function m(t) {
        t.removeEventListener && t.removeEventListener("DOMMouseScroll", p, !1),
        t.onmousewheel = null,
        t.onwheel = null,
        t.ontouchmove = null
    }
    var y = n(3)
      , v = n(4)
      , b = n(1)
      , g = b.BFSRequire("path")
      , _ = b.BFSRequire("fs");
    e.filterSubstring = r,
    e.processGlob = s,
    e.fileNameCompletions = o,
    e.longestCommmonPrefix = a,
    e.columnize = c,
    e.padRight = l,
    e.recursiveRm = u,
    e.recursiveCopy = h,
    e.copyFile = f;
    e.disableScroll = d,
    e.enableScroll = m
}
, function(t, e, n) {
    var r, s;
    (function() {
        function n(t) {
            function e(e, n, r, s, i, o) {
                for (; i >= 0 && o > i; i += t) {
                    var a = s ? s[i] : i;
                    r = n(r, e[a], a, e)
                }
                return r
            }
            return function(n, r, s, i) {
                r = x(r, i, 4);
                var o = !O(n) && w.keys(n)
                  , a = (o || n).length
                  , c = t > 0 ? 0 : a - 1;
                return arguments.length < 3 && (s = n[o ? o[c] : c],
                c += t),
                e(n, r, s, o, c, a)
            }
        }
        function i(t) {
            return function(e, n, r) {
                n = C(n, r);
                for (var s = R(e), i = t > 0 ? 0 : s - 1; i >= 0 && s > i; i += t)
                    if (n(e[i], i, e))
                        return i;
                return -1
            }
        }
        function o(t, e, n) {
            return function(r, s, i) {
                var o = 0
                  , a = R(r);
                if ("number" == typeof i)
                    t > 0 ? o = i >= 0 ? i : Math.max(i + a, o) : a = i >= 0 ? Math.min(i + 1, a) : i + a + 1;
                else if (n && i && a)
                    return i = n(r, s),
                    r[i] === s ? i : -1;
                if (s !== s)
                    return i = e(d.call(r, o, a), w.isNaN),
                    i >= 0 ? i + o : -1;
                for (i = t > 0 ? o : a - 1; i >= 0 && a > i; i += t)
                    if (r[i] === s)
                        return i;
                return -1
            }
        }
        function a(t, e) {
            var n = D.length
              , r = t.constructor
              , s = w.isFunction(r) && r.prototype || h
              , i = "constructor";
            for (w.has(t, i) && !w.contains(e, i) && e.push(i); n--; )
                i = D[n],
                i in t && t[i] !== s[i] && !w.contains(e, i) && e.push(i)
        }
        var c = this
          , l = c._
          , u = Array.prototype
          , h = Object.prototype
          , f = Function.prototype
          , p = u.push
          , d = u.slice
          , m = h.toString
          , y = h.hasOwnProperty
          , v = Array.isArray
          , b = Object.keys
          , g = f.bind
          , _ = Object.create
          , k = function() {}
          , w = function(t) {
            return t instanceof w ? t : this instanceof w ? void (this._wrapped = t) : new w(t)
        };
        "undefined" != typeof t && t.exports && (e = t.exports = w),
        e._ = w,
        w.VERSION = "1.8.3";
        var x = function(t, e, n) {
            if (void 0 === e)
                return t;
            switch (null == n ? 3 : n) {
            case 1:
                return function(n) {
                    return t.call(e, n)
                }
                ;
            case 2:
                return function(n, r) {
                    return t.call(e, n, r)
                }
                ;
            case 3:
                return function(n, r, s) {
                    return t.call(e, n, r, s)
                }
                ;
            case 4:
                return function(n, r, s, i) {
                    return t.call(e, n, r, s, i)
                }
            }
            return function() {
                return t.apply(e, arguments)
            }
        }
          , C = function(t, e, n) {
            return null == t ? w.identity : w.isFunction(t) ? x(t, e, n) : w.isObject(t) ? w.matcher(t) : w.property(t)
        };
        w.iteratee = function(t, e) {
            return C(t, e, 1 / 0)
        }
        ;
        var S = function(t, e) {
            return function(n) {
                var r = arguments.length;
                if (2 > r || null == n)
                    return n;
                for (var s = 1; r > s; s++)
                    for (var i = arguments[s], o = t(i), a = o.length, c = 0; a > c; c++) {
                        var l = o[c];
                        e && void 0 !== n[l] || (n[l] = i[l])
                    }
                return n
            }
        }
          , A = function(t) {
            if (!w.isObject(t))
                return {};
            if (_)
                return _(t);
            k.prototype = t;
            var e = new k;
            return k.prototype = null,
            e
        }
          , j = function(t) {
            return function(e) {
                return null == e ? void 0 : e[t]
            }
        }
          , E = Math.pow(2, 53) - 1
          , R = j("length")
          , O = function(t) {
            var e = R(t);
            return "number" == typeof e && e >= 0 && E >= e
        };
        w.each = w.forEach = function(t, e, n) {
            e = x(e, n);
            var r, s;
            if (O(t))
                for (r = 0,
                s = t.length; s > r; r++)
                    e(t[r], r, t);
            else {
                var i = w.keys(t);
                for (r = 0,
                s = i.length; s > r; r++)
                    e(t[i[r]], i[r], t)
            }
            return t
        }
        ,
        w.map = w.collect = function(t, e, n) {
            e = C(e, n);
            for (var r = !O(t) && w.keys(t), s = (r || t).length, i = Array(s), o = 0; s > o; o++) {
                var a = r ? r[o] : o;
                i[o] = e(t[a], a, t)
            }
            return i
        }
        ,
        w.reduce = w.foldl = w.inject = n(1),
        w.reduceRight = w.foldr = n(-1),
        w.find = w.detect = function(t, e, n) {
            var r;
            return r = O(t) ? w.findIndex(t, e, n) : w.findKey(t, e, n),
            void 0 !== r && -1 !== r ? t[r] : void 0
        }
        ,
        w.filter = w.select = function(t, e, n) {
            var r = [];
            return e = C(e, n),
            w.each(t, function(t, n, s) {
                e(t, n, s) && r.push(t)
            }),
            r
        }
        ,
        w.reject = function(t, e, n) {
            return w.filter(t, w.negate(C(e)), n)
        }
        ,
        w.every = w.all = function(t, e, n) {
            e = C(e, n);
            for (var r = !O(t) && w.keys(t), s = (r || t).length, i = 0; s > i; i++) {
                var o = r ? r[i] : i;
                if (!e(t[o], o, t))
                    return !1
            }
            return !0
        }
        ,
        w.some = w.any = function(t, e, n) {
            e = C(e, n);
            for (var r = !O(t) && w.keys(t), s = (r || t).length, i = 0; s > i; i++) {
                var o = r ? r[i] : i;
                if (e(t[o], o, t))
                    return !0
            }
            return !1
        }
        ,
        w.contains = w.includes = w.include = function(t, e, n, r) {
            return O(t) || (t = w.values(t)),
            ("number" != typeof n || r) && (n = 0),
            w.indexOf(t, e, n) >= 0
        }
        ,
        w.invoke = function(t, e) {
            var n = d.call(arguments, 2)
              , r = w.isFunction(e);
            return w.map(t, function(t) {
                var s = r ? e : t[e];
                return null == s ? s : s.apply(t, n)
            })
        }
        ,
        w.pluck = function(t, e) {
            return w.map(t, w.property(e))
        }
        ,
        w.where = function(t, e) {
            return w.filter(t, w.matcher(e))
        }
        ,
        w.findWhere = function(t, e) {
            return w.find(t, w.matcher(e))
        }
        ,
        w.max = function(t, e, n) {
            var r, s, i = -(1 / 0), o = -(1 / 0);
            if (null == e && null != t) {
                t = O(t) ? t : w.values(t);
                for (var a = 0, c = t.length; c > a; a++)
                    r = t[a],
                    r > i && (i = r)
            } else
                e = C(e, n),
                w.each(t, function(t, n, r) {
                    s = e(t, n, r),
                    (s > o || s === -(1 / 0) && i === -(1 / 0)) && (i = t,
                    o = s)
                });
            return i
        }
        ,
        w.min = function(t, e, n) {
            var r, s, i = 1 / 0, o = 1 / 0;
            if (null == e && null != t) {
                t = O(t) ? t : w.values(t);
                for (var a = 0, c = t.length; c > a; a++)
                    r = t[a],
                    i > r && (i = r)
            } else
                e = C(e, n),
                w.each(t, function(t, n, r) {
                    s = e(t, n, r),
                    (o > s || s === 1 / 0 && i === 1 / 0) && (i = t,
                    o = s)
                });
            return i
        }
        ,
        w.shuffle = function(t) {
            for (var e, n = O(t) ? t : w.values(t), r = n.length, s = Array(r), i = 0; r > i; i++)
                e = w.random(0, i),
                e !== i && (s[i] = s[e]),
                s[e] = n[i];
            return s
        }
        ,
        w.sample = function(t, e, n) {
            return null == e || n ? (O(t) || (t = w.values(t)),
            t[w.random(t.length - 1)]) : w.shuffle(t).slice(0, Math.max(0, e))
        }
        ,
        w.sortBy = function(t, e, n) {
            return e = C(e, n),
            w.pluck(w.map(t, function(t, n, r) {
                return {
                    value: t,
                    index: n,
                    criteria: e(t, n, r)
                }
            }).sort(function(t, e) {
                var n = t.criteria
                  , r = e.criteria;
                if (n !== r) {
                    if (n > r || void 0 === n)
                        return 1;
                    if (r > n || void 0 === r)
                        return -1
                }
                return t.index - e.index
            }), "value")
        }
        ;
        var M = function(t) {
            return function(e, n, r) {
                var s = {};
                return n = C(n, r),
                w.each(e, function(r, i) {
                    var o = n(r, i, e);
                    t(s, r, o)
                }),
                s
            }
        };
        w.groupBy = M(function(t, e, n) {
            w.has(t, n) ? t[n].push(e) : t[n] = [e]
        }),
        w.indexBy = M(function(t, e, n) {
            t[n] = e
        }),
        w.countBy = M(function(t, e, n) {
            w.has(t, n) ? t[n]++ : t[n] = 1
        }),
        w.toArray = function(t) {
            return t ? w.isArray(t) ? d.call(t) : O(t) ? w.map(t, w.identity) : w.values(t) : []
        }
        ,
        w.size = function(t) {
            return null == t ? 0 : O(t) ? t.length : w.keys(t).length
        }
        ,
        w.partition = function(t, e, n) {
            e = C(e, n);
            var r = []
              , s = [];
            return w.each(t, function(t, n, i) {
                (e(t, n, i) ? r : s).push(t)
            }),
            [r, s]
        }
        ,
        w.first = w.head = w.take = function(t, e, n) {
            return null != t ? null == e || n ? t[0] : w.initial(t, t.length - e) : void 0
        }
        ,
        w.initial = function(t, e, n) {
            return d.call(t, 0, Math.max(0, t.length - (null == e || n ? 1 : e)))
        }
        ,
        w.last = function(t, e, n) {
            return null != t ? null == e || n ? t[t.length - 1] : w.rest(t, Math.max(0, t.length - e)) : void 0
        }
        ,
        w.rest = w.tail = w.drop = function(t, e, n) {
            return d.call(t, null == e || n ? 1 : e)
        }
        ,
        w.compact = function(t) {
            return w.filter(t, w.identity)
        }
        ;
        var I = function(t, e, n, r) {
            for (var s = [], i = 0, o = r || 0, a = R(t); a > o; o++) {
                var c = t[o];
                if (O(c) && (w.isArray(c) || w.isArguments(c))) {
                    e || (c = I(c, e, n));
                    var l = 0
                      , u = c.length;
                    for (s.length += u; u > l; )
                        s[i++] = c[l++]
                } else
                    n || (s[i++] = c)
            }
            return s
        };
        w.flatten = function(t, e) {
            return I(t, e, !1)
        }
        ,
        w.without = function(t) {
            return w.difference(t, d.call(arguments, 1))
        }
        ,
        w.uniq = w.unique = function(t, e, n, r) {
            w.isBoolean(e) || (r = n,
            n = e,
            e = !1),
            null != n && (n = C(n, r));
            for (var s = [], i = [], o = 0, a = R(t); a > o; o++) {
                var c = t[o]
                  , l = n ? n(c, o, t) : c;
                e ? (o && i === l || s.push(c),
                i = l) : n ? w.contains(i, l) || (i.push(l),
                s.push(c)) : w.contains(s, c) || s.push(c)
            }
            return s
        }
        ,
        w.union = function() {
            return w.uniq(I(arguments, !0, !0))
        }
        ,
        w.intersection = function(t) {
            for (var e = [], n = arguments.length, r = 0, s = R(t); s > r; r++) {
                var i = t[r];
                if (!w.contains(e, i)) {
                    for (var o = 1; n > o && w.contains(arguments[o], i); o++)
                        ;
                    o === n && e.push(i)
                }
            }
            return e
        }
        ,
        w.difference = function(t) {
            var e = I(arguments, !0, !0, 1);
            return w.filter(t, function(t) {
                return !w.contains(e, t)
            })
        }
        ,
        w.zip = function() {
            return w.unzip(arguments)
        }
        ,
        w.unzip = function(t) {
            for (var e = t && w.max(t, R).length || 0, n = Array(e), r = 0; e > r; r++)
                n[r] = w.pluck(t, r);
            return n
        }
        ,
        w.object = function(t, e) {
            for (var n = {}, r = 0, s = R(t); s > r; r++)
                e ? n[t[r]] = e[r] : n[t[r][0]] = t[r][1];
            return n
        }
        ,
        w.findIndex = i(1),
        w.findLastIndex = i(-1),
        w.sortedIndex = function(t, e, n, r) {
            n = C(n, r, 1);
            for (var s = n(e), i = 0, o = R(t); o > i; ) {
                var a = Math.floor((i + o) / 2);
                n(t[a]) < s ? i = a + 1 : o = a
            }
            return i
        }
        ,
        w.indexOf = o(1, w.findIndex, w.sortedIndex),
        w.lastIndexOf = o(-1, w.findLastIndex),
        w.range = function(t, e, n) {
            null == e && (e = t || 0,
            t = 0),
            n = n || 1;
            for (var r = Math.max(Math.ceil((e - t) / n), 0), s = Array(r), i = 0; r > i; i++,
            t += n)
                s[i] = t;
            return s
        }
        ;
        var L = function(t, e, n, r, s) {
            if (!(r instanceof e))
                return t.apply(n, s);
            var i = A(t.prototype)
              , o = t.apply(i, s);
            return w.isObject(o) ? o : i
        };
        w.bind = function(t, e) {
            if (g && t.bind === g)
                return g.apply(t, d.call(arguments, 1));
            if (!w.isFunction(t))
                throw new TypeError("Bind must be called on a function");
            var n = d.call(arguments, 2)
              , r = function() {
                return L(t, r, e, this, n.concat(d.call(arguments)))
            };
            return r
        }
        ,
        w.partial = function(t) {
            var e = d.call(arguments, 1)
              , n = function() {
                for (var r = 0, s = e.length, i = Array(s), o = 0; s > o; o++)
                    i[o] = e[o] === w ? arguments[r++] : e[o];
                for (; r < arguments.length; )
                    i.push(arguments[r++]);
                return L(t, n, this, this, i)
            };
            return n
        }
        ,
        w.bindAll = function(t) {
            var e, n, r = arguments.length;
            if (1 >= r)
                throw new Error("bindAll must be passed function names");
            for (e = 1; r > e; e++)
                n = arguments[e],
                t[n] = w.bind(t[n], t);
            return t
        }
        ,
        w.memoize = function(t, e) {
            var n = function(r) {
                var s = n.cache
                  , i = "" + (e ? e.apply(this, arguments) : r);
                return w.has(s, i) || (s[i] = t.apply(this, arguments)),
                s[i]
            };
            return n.cache = {},
            n
        }
        ,
        w.delay = function(t, e) {
            var n = d.call(arguments, 2);
            return setTimeout(function() {
                return t.apply(null, n)
            }, e)
        }
        ,
        w.defer = w.partial(w.delay, w, 1),
        w.throttle = function(t, e, n) {
            var r, s, i, o = null, a = 0;
            n || (n = {});
            var c = function() {
                a = n.leading === !1 ? 0 : w.now(),
                o = null,
                i = t.apply(r, s),
                o || (r = s = null)
            };
            return function() {
                var l = w.now();
                a || n.leading !== !1 || (a = l);
                var u = e - (l - a);
                return r = this,
                s = arguments,
                0 >= u || u > e ? (o && (clearTimeout(o),
                o = null),
                a = l,
                i = t.apply(r, s),
                o || (r = s = null)) : o || n.trailing === !1 || (o = setTimeout(c, u)),
                i
            }
        }
        ,
        w.debounce = function(t, e, n) {
            var r, s, i, o, a, c = function() {
                var l = w.now() - o;
                e > l && l >= 0 ? r = setTimeout(c, e - l) : (r = null,
                n || (a = t.apply(i, s),
                r || (i = s = null)))
            };
            return function() {
                i = this,
                s = arguments,
                o = w.now();
                var l = n && !r;
                return r || (r = setTimeout(c, e)),
                l && (a = t.apply(i, s),
                i = s = null),
                a
            }
        }
        ,
        w.wrap = function(t, e) {
            return w.partial(e, t)
        }
        ,
        w.negate = function(t) {
            return function() {
                return !t.apply(this, arguments)
            }
        }
        ,
        w.compose = function() {
            var t = arguments
              , e = t.length - 1;
            return function() {
                for (var n = e, r = t[e].apply(this, arguments); n--; )
                    r = t[n].call(this, r);
                return r
            }
        }
        ,
        w.after = function(t, e) {
            return function() {
                return --t < 1 ? e.apply(this, arguments) : void 0
            }
        }
        ,
        w.before = function(t, e) {
            var n;
            return function() {
                return --t > 0 && (n = e.apply(this, arguments)),
                1 >= t && (e = null),
                n
            }
        }
        ,
        w.once = w.partial(w.before, 2);
        var T = !{
            toString: null
        }.propertyIsEnumerable("toString")
          , D = ["valueOf", "isPrototypeOf", "toString", "propertyIsEnumerable", "hasOwnProperty", "toLocaleString"];
        w.keys = function(t) {
            if (!w.isObject(t))
                return [];
            if (b)
                return b(t);
            var e = [];
            for (var n in t)
                w.has(t, n) && e.push(n);
            return T && a(t, e),
            e
        }
        ,
        w.allKeys = function(t) {
            if (!w.isObject(t))
                return [];
            var e = [];
            for (var n in t)
                e.push(n);
            return T && a(t, e),
            e
        }
        ,
        w.values = function(t) {
            for (var e = w.keys(t), n = e.length, r = Array(n), s = 0; n > s; s++)
                r[s] = t[e[s]];
            return r
        }
        ,
        w.mapObject = function(t, e, n) {
            e = C(e, n);
            for (var r, s = w.keys(t), i = s.length, o = {}, a = 0; i > a; a++)
                r = s[a],
                o[r] = e(t[r], r, t);
            return o
        }
        ,
        w.pairs = function(t) {
            for (var e = w.keys(t), n = e.length, r = Array(n), s = 0; n > s; s++)
                r[s] = [e[s], t[e[s]]];
            return r
        }
        ,
        w.invert = function(t) {
            for (var e = {}, n = w.keys(t), r = 0, s = n.length; s > r; r++)
                e[t[n[r]]] = n[r];
            return e
        }
        ,
        w.functions = w.methods = function(t) {
            var e = [];
            for (var n in t)
                w.isFunction(t[n]) && e.push(n);
            return e.sort()
        }
        ,
        w.extend = S(w.allKeys),
        w.extendOwn = w.assign = S(w.keys),
        w.findKey = function(t, e, n) {
            e = C(e, n);
            for (var r, s = w.keys(t), i = 0, o = s.length; o > i; i++)
                if (r = s[i],
                e(t[r], r, t))
                    return r
        }
        ,
        w.pick = function(t, e, n) {
            var r, s, i = {}, o = t;
            if (null == o)
                return i;
            w.isFunction(e) ? (s = w.allKeys(o),
            r = x(e, n)) : (s = I(arguments, !1, !1, 1),
            r = function(t, e, n) {
                return e in n
            }
            ,
            o = Object(o));
            for (var a = 0, c = s.length; c > a; a++) {
                var l = s[a]
                  , u = o[l];
                r(u, l, o) && (i[l] = u)
            }
            return i
        }
        ,
        w.omit = function(t, e, n) {
            if (w.isFunction(e))
                e = w.negate(e);
            else {
                var r = w.map(I(arguments, !1, !1, 1), String);
                e = function(t, e) {
                    return !w.contains(r, e)
                }
            }
            return w.pick(t, e, n)
        }
        ,
        w.defaults = S(w.allKeys, !0),
        w.create = function(t, e) {
            var n = A(t);
            return e && w.extendOwn(n, e),
            n
        }
        ,
        w.clone = function(t) {
            return w.isObject(t) ? w.isArray(t) ? t.slice() : w.extend({}, t) : t
        }
        ,
        w.tap = function(t, e) {
            return e(t),
            t
        }
        ,
        w.isMatch = function(t, e) {
            var n = w.keys(e)
              , r = n.length;
            if (null == t)
                return !r;
            for (var s = Object(t), i = 0; r > i; i++) {
                var o = n[i];
                if (e[o] !== s[o] || !(o in s))
                    return !1
            }
            return !0
        }
        ;
        var F = function(t, e, n, r) {
            if (t === e)
                return 0 !== t || 1 / t === 1 / e;
            if (null == t || null == e)
                return t === e;
            t instanceof w && (t = t._wrapped),
            e instanceof w && (e = e._wrapped);
            var s = m.call(t);
            if (s !== m.call(e))
                return !1;
            switch (s) {
            case "[object RegExp]":
            case "[object String]":
                return "" + t == "" + e;
            case "[object Number]":
                return +t !== +t ? +e !== +e : 0 === +t ? 1 / +t === 1 / e : +t === +e;
            case "[object Date]":
            case "[object Boolean]":
                return +t === +e
            }
            var i = "[object Array]" === s;
            if (!i) {
                if ("object" != typeof t || "object" != typeof e)
                    return !1;
                var o = t.constructor
                  , a = e.constructor;
                if (o !== a && !(w.isFunction(o) && o instanceof o && w.isFunction(a) && a instanceof a) && "constructor"in t && "constructor"in e)
                    return !1
            }
            n = n || [],
            r = r || [];
            for (var c = n.length; c--; )
                if (n[c] === t)
                    return r[c] === e;
            if (n.push(t),
            r.push(e),
            i) {
                if (c = t.length,
                c !== e.length)
                    return !1;
                for (; c--; )
                    if (!F(t[c], e[c], n, r))
                        return !1
            } else {
                var l, u = w.keys(t);
                if (c = u.length,
                w.keys(e).length !== c)
                    return !1;
                for (; c--; )
                    if (l = u[c],
                    !w.has(e, l) || !F(t[l], e[l], n, r))
                        return !1
            }
            return n.pop(),
            r.pop(),
            !0
        };
        w.isEqual = function(t, e) {
            return F(t, e)
        }
        ,
        w.isEmpty = function(t) {
            return null == t ? !0 : O(t) && (w.isArray(t) || w.isString(t) || w.isArguments(t)) ? 0 === t.length : 0 === w.keys(t).length
        }
        ,
        w.isElement = function(t) {
            return !(!t || 1 !== t.nodeType)
        }
        ,
        w.isArray = v || function(t) {
            return "[object Array]" === m.call(t)
        }
        ,
        w.isObject = function(t) {
            var e = typeof t;
            return "function" === e || "object" === e && !!t
        }
        ,
        w.each(["Arguments", "Function", "String", "Number", "Date", "RegExp", "Error"], function(t) {
            w["is" + t] = function(e) {
                return m.call(e) === "[object " + t + "]"
            }
        }),
        w.isArguments(arguments) || (w.isArguments = function(t) {
            return w.has(t, "callee")
        }
        ),
        "function" != typeof /./ && "object" != typeof Int8Array && (w.isFunction = function(t) {
            return "function" == typeof t || !1
        }
        ),
        w.isFinite = function(t) {
            return isFinite(t) && !isNaN(parseFloat(t))
        }
        ,
        w.isNaN = function(t) {
            return w.isNumber(t) && t !== +t
        }
        ,
        w.isBoolean = function(t) {
            return t === !0 || t === !1 || "[object Boolean]" === m.call(t)
        }
        ,
        w.isNull = function(t) {
            return null === t
        }
        ,
        w.isUndefined = function(t) {
            return void 0 === t
        }
        ,
        w.has = function(t, e) {
            return null != t && y.call(t, e)
        }
        ,
        w.noConflict = function() {
            return c._ = l,
            this
        }
        ,
        w.identity = function(t) {
            return t
        }
        ,
        w.constant = function(t) {
            return function() {
                return t
            }
        }
        ,
        w.noop = function() {}
        ,
        w.property = j,
        w.propertyOf = function(t) {
            return null == t ? function() {}
            : function(e) {
                return t[e]
            }
        }
        ,
        w.matcher = w.matches = function(t) {
            return t = w.extendOwn({}, t),
            function(e) {
                return w.isMatch(e, t)
            }
        }
        ,
        w.times = function(t, e, n) {
            var r = Array(Math.max(0, t));
            e = x(e, n, 1);
            for (var s = 0; t > s; s++)
                r[s] = e(s);
            return r
        }
        ,
        w.random = function(t, e) {
            return null == e && (e = t,
            t = 0),
            t + Math.floor(Math.random() * (e - t + 1))
        }
        ,
        w.now = Date.now || function() {
            return (new Date).getTime()
        }
        ;
        var P = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#x27;",
            "`": "&#x60;"
        }
          , B = w.invert(P)
          , U = function(t) {
            var e = function(e) {
                return t[e]
            }
              , n = "(?:" + w.keys(t).join("|") + ")"
              , r = RegExp(n)
              , s = RegExp(n, "g");
            return function(t) {
                return t = null == t ? "" : "" + t,
                r.test(t) ? t.replace(s, e) : t
            }
        };
        w.escape = U(P),
        w.unescape = U(B),
        w.result = function(t, e, n) {
            var r = null == t ? void 0 : t[e];
            return void 0 === r && (r = n),
            w.isFunction(r) ? r.call(t) : r
        }
        ;
        var N = 0;
        w.uniqueId = function(t) {
            var e = ++N + "";
            return t ? t + e : e
        }
        ,
        w.templateSettings = {
            evaluate: /<%([\s\S]+?)%>/g,
            interpolate: /<%=([\s\S]+?)%>/g,
            escape: /<%-([\s\S]+?)%>/g
        };
        var q = /(.)^/
          , K = {
            "'": "'",
            "\\": "\\",
            "\r": "r",
            "\n": "n",
            "\u2028": "u2028",
            "\u2029": "u2029"
        }
          , J = /\\|'|\r|\n|\u2028|\u2029/g
          , H = function(t) {
            return "\\" + K[t]
        };
        w.template = function(t, e, n) {
            !e && n && (e = n),
            e = w.defaults({}, e, w.templateSettings);
            var r = RegExp([(e.escape || q).source, (e.interpolate || q).source, (e.evaluate || q).source].join("|") + "|$", "g")
              , s = 0
              , i = "__p+='";
            t.replace(r, function(e, n, r, o, a) {
                return i += t.slice(s, a).replace(J, H),
                s = a + e.length,
                n ? i += "'+\n((__t=(" + n + "))==null?'':_.escape(__t))+\n'" : r ? i += "'+\n((__t=(" + r + "))==null?'':__t)+\n'" : o && (i += "';\n" + o + "\n__p+='"),
                e
            }),
            i += "';\n",
            e.variable || (i = "with(obj||{}){\n" + i + "}\n"),
            i = "var __t,__p='',__j=Array.prototype.join,print=function(){__p+=__j.call(arguments,'');};\n" + i + "return __p;\n";
            try {
                var o = new Function(e.variable || "obj","_",i)
            } catch (a) {
                throw a.source = i,
                a
            }
            var c = function(t) {
                return o.call(this, t, w)
            }
              , l = e.variable || "obj";
            return c.source = "function(" + l + "){\n" + i + "}",
            c
        }
        ,
        w.chain = function(t) {
            var e = w(t);
            return e._chain = !0,
            e
        }
        ;
        var Y = function(t, e) {
            return t._chain ? w(e).chain() : e
        };
        w.mixin = function(t) {
            w.each(w.functions(t), function(e) {
                var n = w[e] = t[e];
                w.prototype[e] = function() {
                    var t = [this._wrapped];
                    return p.apply(t, arguments),
                    Y(this, n.apply(w, t))
                }
            })
        }
        ,
        w.mixin(w),
        w.each(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function(t) {
            var e = u[t];
            w.prototype[t] = function() {
                var n = this._wrapped;
                return e.apply(n, arguments),
                "shift" !== t && "splice" !== t || 0 !== n.length || delete n[0],
                Y(this, n)
            }
        }),
        w.each(["concat", "join", "slice"], function(t) {
            var e = u[t];
            w.prototype[t] = function() {
                return Y(this, e.apply(this._wrapped, arguments))
            }
        }),
        w.prototype.value = function() {
            return this._wrapped
        }
        ,
        w.prototype.valueOf = w.prototype.toJSON = w.prototype.value,
        w.prototype.toString = function() {
            return "" + this._wrapped
        }
        ,
        r = [],
        s = function() {
            return w
        }
        .apply(e, r),
        !(void 0 !== s && (t.exports = s))
    }
    ).call(this)
}
, function(t, e, n) {
    var r, s;
    (function(n) {
        /*!
	 * async
	 * https://github.com/caolan/async
	 *
	 * Copyright 2010-2014 Caolan McMahon
	 * Released under the MIT license
	 */
        !function() {
            function i() {}
            function o(t) {
                return t
            }
            function a(t) {
                return !!t
            }
            function c(t) {
                return !t
            }
            function l(t) {
                return function() {
                    if (null === t)
                        throw new Error("Callback was already called.");
                    t.apply(this, arguments),
                    t = null
                }
            }
            function u(t) {
                return function() {
                    null !== t && (t.apply(this, arguments),
                    t = null)
                }
            }
            function h(t) {
                return q(t) || "number" == typeof t.length && t.length >= 0 && t.length % 1 === 0
            }
            function f(t, e) {
                for (var n = -1, r = t.length; ++n < r; )
                    e(t[n], n, t)
            }
            function p(t, e) {
                for (var n = -1, r = t.length, s = Array(r); ++n < r; )
                    s[n] = e(t[n], n, t);
                return s
            }
            function d(t) {
                return p(Array(t), function(t, e) {
                    return e
                })
            }
            function m(t, e, n) {
                return f(t, function(t, r, s) {
                    n = e(n, t, r, s)
                }),
                n
            }
            function y(t, e) {
                f(J(t), function(n) {
                    e(t[n], n)
                })
            }
            function v(t, e) {
                for (var n = 0; n < t.length; n++)
                    if (t[n] === e)
                        return n;
                return -1
            }
            function b(t) {
                var e, n, r = -1;
                return h(t) ? (e = t.length,
                function() {
                    return r++,
                    e > r ? r : null
                }
                ) : (n = J(t),
                e = n.length,
                function() {
                    return r++,
                    e > r ? n[r] : null
                }
                )
            }
            function g(t, e) {
                return e = null == e ? t.length - 1 : +e,
                function() {
                    for (var n = Math.max(arguments.length - e, 0), r = Array(n), s = 0; n > s; s++)
                        r[s] = arguments[s + e];
                    switch (e) {
                    case 0:
                        return t.call(this, r);
                    case 1:
                        return t.call(this, arguments[0], r)
                    }
                }
            }
            function _(t) {
                return function(e, n, r) {
                    return t(e, r)
                }
            }
            function k(t) {
                return function(e, n, r) {
                    r = u(r || i),
                    e = e || [];
                    var s = b(e);
                    if (0 >= t)
                        return r(null);
                    var o = !1
                      , a = 0
                      , c = !1;
                    !function h() {
                        if (o && 0 >= a)
                            return r(null);
                        for (; t > a && !c; ) {
                            var i = s();
                            if (null === i)
                                return o = !0,
                                void (0 >= a && r(null));
                            a += 1,
                            n(e[i], i, l(function(t) {
                                a -= 1,
                                t ? (r(t),
                                c = !0) : h()
                            }))
                        }
                    }()
                }
            }
            function w(t) {
                return function(e, n, r) {
                    return t(B.eachOf, e, n, r)
                }
            }
            function x(t) {
                return function(e, n, r, s) {
                    return t(k(n), e, r, s)
                }
            }
            function C(t) {
                return function(e, n, r) {
                    return t(B.eachOfSeries, e, n, r)
                }
            }
            function S(t, e, n, r) {
                r = u(r || i),
                e = e || [];
                var s = h(e) ? [] : {};
                t(e, function(t, e, r) {
                    n(t, function(t, n) {
                        s[e] = n,
                        r(t)
                    })
                }, function(t) {
                    r(t, s)
                })
            }
            function A(t, e, n, r) {
                var s = [];
                t(e, function(t, e, r) {
                    n(t, function(n) {
                        n && s.push({
                            index: e,
                            value: t
                        }),
                        r()
                    })
                }, function() {
                    r(p(s.sort(function(t, e) {
                        return t.index - e.index
                    }), function(t) {
                        return t.value
                    }))
                })
            }
            function j(t, e, n, r) {
                A(t, e, function(t, e) {
                    n(t, function(t) {
                        e(!t)
                    })
                }, r)
            }
            function E(t, e, n) {
                return function(r, s, i, o) {
                    function a() {
                        o && o(n(!1, void 0))
                    }
                    function c(t, r, s) {
                        return o ? void i(t, function(r) {
                            o && e(r) && (o(n(!0, t)),
                            o = i = !1),
                            s()
                        }) : s()
                    }
                    arguments.length > 3 ? t(r, s, c, a) : (o = i,
                    i = s,
                    t(r, c, a))
                }
            }
            function R(t, e) {
                return e
            }
            function O(t, e, n) {
                n = n || i;
                var r = h(e) ? [] : {};
                t(e, function(t, e, n) {
                    t(g(function(t, s) {
                        s.length <= 1 && (s = s[0]),
                        r[e] = s,
                        n(t)
                    }))
                }, function(t) {
                    n(t, r)
                })
            }
            function M(t, e, n, r) {
                var s = [];
                t(e, function(t, e, r) {
                    n(t, function(t, e) {
                        s = s.concat(e || []),
                        r(t)
                    })
                }, function(t) {
                    r(t, s)
                })
            }
            function I(t, e, n) {
                function r(t, e, n, r) {
                    if (null != r && "function" != typeof r)
                        throw new Error("task callback must be a function");
                    return t.started = !0,
                    q(e) || (e = [e]),
                    0 === e.length && t.idle() ? B.setImmediate(function() {
                        t.drain()
                    }) : (f(e, function(e) {
                        var s = {
                            data: e,
                            callback: r || i
                        };
                        n ? t.tasks.unshift(s) : t.tasks.push(s),
                        t.tasks.length === t.concurrency && t.saturated()
                    }),
                    void B.setImmediate(t.process))
                }
                function s(t, e) {
                    return function() {
                        o -= 1;
                        var n = !1
                          , r = arguments;
                        f(e, function(t) {
                            f(a, function(e, r) {
                                e !== t || n || (a.splice(r, 1),
                                n = !0)
                            }),
                            t.callback.apply(t, r)
                        }),
                        t.tasks.length + o === 0 && t.drain(),
                        t.process()
                    }
                }
                if (null == e)
                    e = 1;
                else if (0 === e)
                    throw new Error("Concurrency must not be zero");
                var o = 0
                  , a = []
                  , c = {
                    tasks: [],
                    concurrency: e,
                    payload: n,
                    saturated: i,
                    empty: i,
                    drain: i,
                    started: !1,
                    paused: !1,
                    push: function(t, e) {
                        r(c, t, !1, e)
                    },
                    kill: function() {
                        c.drain = i,
                        c.tasks = []
                    },
                    unshift: function(t, e) {
                        r(c, t, !0, e)
                    },
                    process: function() {
                        for (; !c.paused && o < c.concurrency && c.tasks.length; ) {
                            var e = c.payload ? c.tasks.splice(0, c.payload) : c.tasks.splice(0, c.tasks.length)
                              , n = p(e, function(t) {
                                return t.data
                            });
                            0 === c.tasks.length && c.empty(),
                            o += 1,
                            a.push(e[0]);
                            var r = l(s(c, e));
                            t(n, r)
                        }
                    },
                    length: function() {
                        return c.tasks.length
                    },
                    running: function() {
                        return o
                    },
                    workersList: function() {
                        return a
                    },
                    idle: function() {
                        return c.tasks.length + o === 0
                    },
                    pause: function() {
                        c.paused = !0
                    },
                    resume: function() {
                        if (c.paused !== !1) {
                            c.paused = !1;
                            for (var t = Math.min(c.concurrency, c.tasks.length), e = 1; t >= e; e++)
                                B.setImmediate(c.process)
                        }
                    }
                };
                return c
            }
            function L(t) {
                return g(function(e, n) {
                    e.apply(null, n.concat([g(function(e, n) {
                        "object" == typeof console && (e ? console.error && console.error(e) : console[t] && f(n, function(e) {
                            console[t](e)
                        }))
                    })]))
                })
            }
            function T(t) {
                return function(e, n, r) {
                    t(d(e), n, r)
                }
            }
            function D(t) {
                return g(function(e, n) {
                    var r = g(function(n) {
                        var r = this
                          , s = n.pop();
                        return t(e, function(t, e, s) {
                            t.apply(r, n.concat([s]))
                        }, s)
                    });
                    return n.length ? r.apply(this, n) : r
                })
            }
            function F(t) {
                return g(function(e) {
                    var n = e.pop();
                    e.push(function() {
                        var t = arguments;
                        r ? B.setImmediate(function() {
                            n.apply(null, t)
                        }) : n.apply(null, t)
                    });
                    var r = !0;
                    t.apply(this, e),
                    r = !1
                })
            }
            var P, B = {}, U = "object" == typeof self && self.self === self && self || "object" == typeof n && n.global === n && n || this;
            null != U && (P = U.async),
            B.noConflict = function() {
                return U.async = P,
                B
            }
            ;
            var N = Object.prototype.toString
              , q = Array.isArray || function(t) {
                return "[object Array]" === N.call(t)
            }
              , K = function(t) {
                var e = typeof t;
                return "function" === e || "object" === e && !!t
            }
              , J = Object.keys || function(t) {
                var e = [];
                for (var n in t)
                    t.hasOwnProperty(n) && e.push(n);
                return e
            }
              , H = "function" == typeof setImmediate && setImmediate
              , Y = H ? function(t) {
                H(t)
            }
            : function(t) {
                setTimeout(t, 0)
            }
            ;
            "object" == typeof process && "function" == typeof process.nextTick ? B.nextTick = process.nextTick : B.nextTick = Y,
            B.setImmediate = H ? Y : B.nextTick,
            B.forEach = B.each = function(t, e, n) {
                return B.eachOf(t, _(e), n)
            }
            ,
            B.forEachSeries = B.eachSeries = function(t, e, n) {
                return B.eachOfSeries(t, _(e), n)
            }
            ,
            B.forEachLimit = B.eachLimit = function(t, e, n, r) {
                return k(e)(t, _(n), r)
            }
            ,
            B.forEachOf = B.eachOf = function(t, e, n) {
                function r(t) {
                    a--,
                    t ? n(t) : null === s && 0 >= a && n(null)
                }
                n = u(n || i),
                t = t || [];
                for (var s, o = b(t), a = 0; null != (s = o()); )
                    a += 1,
                    e(t[s], s, l(r));
                0 === a && n(null)
            }
            ,
            B.forEachOfSeries = B.eachOfSeries = function(t, e, n) {
                function r() {
                    var i = !0;
                    return null === o ? n(null) : (e(t[o], o, l(function(t) {
                        if (t)
                            n(t);
                        else {
                            if (o = s(),
                            null === o)
                                return n(null);
                            i ? B.setImmediate(r) : r()
                        }
                    })),
                    void (i = !1))
                }
                n = u(n || i),
                t = t || [];
                var s = b(t)
                  , o = s();
                r()
            }
            ,
            B.forEachOfLimit = B.eachOfLimit = function(t, e, n, r) {
                k(e)(t, n, r)
            }
            ,
            B.map = w(S),
            B.mapSeries = C(S),
            B.mapLimit = x(S),
            B.inject = B.foldl = B.reduce = function(t, e, n, r) {
                B.eachOfSeries(t, function(t, r, s) {
                    n(e, t, function(t, n) {
                        e = n,
                        s(t)
                    })
                }, function(t) {
                    r(t, e)
                })
            }
            ,
            B.foldr = B.reduceRight = function(t, e, n, r) {
                var s = p(t, o).reverse();
                B.reduce(s, e, n, r)
            }
            ,
            B.transform = function(t, e, n, r) {
                3 === arguments.length && (r = n,
                n = e,
                e = q(t) ? [] : {}),
                B.eachOf(t, function(t, r, s) {
                    n(e, t, r, s)
                }, function(t) {
                    r(t, e)
                })
            }
            ,
            B.select = B.filter = w(A),
            B.selectLimit = B.filterLimit = x(A),
            B.selectSeries = B.filterSeries = C(A),
            B.reject = w(j),
            B.rejectLimit = x(j),
            B.rejectSeries = C(j),
            B.any = B.some = E(B.eachOf, a, o),
            B.someLimit = E(B.eachOfLimit, a, o),
            B.all = B.every = E(B.eachOf, c, c),
            B.everyLimit = E(B.eachOfLimit, c, c),
            B.detect = E(B.eachOf, o, R),
            B.detectSeries = E(B.eachOfSeries, o, R),
            B.detectLimit = E(B.eachOfLimit, o, R),
            B.sortBy = function(t, e, n) {
                function r(t, e) {
                    var n = t.criteria
                      , r = e.criteria;
                    return r > n ? -1 : n > r ? 1 : 0
                }
                B.map(t, function(t, n) {
                    e(t, function(e, r) {
                        e ? n(e) : n(null, {
                            value: t,
                            criteria: r
                        })
                    })
                }, function(t, e) {
                    return t ? n(t) : void n(null, p(e.sort(r), function(t) {
                        return t.value
                    }))
                })
            }
            ,
            B.auto = function(t, e, n) {
                function r(t) {
                    d.unshift(t)
                }
                function s(t) {
                    var e = v(d, t);
                    e >= 0 && d.splice(e, 1)
                }
                function o() {
                    c--,
                    f(d.slice(0), function(t) {
                        t()
                    })
                }
                "function" == typeof arguments[1] && (n = e,
                e = null),
                n = u(n || i);
                var a = J(t)
                  , c = a.length;
                if (!c)
                    return n(null);
                e || (e = c);
                var l = {}
                  , h = 0
                  , p = !1
                  , d = [];
                r(function() {
                    c || n(null, l)
                }),
                f(a, function(i) {
                    function a() {
                        return e > h && m(b, function(t, e) {
                            return t && l.hasOwnProperty(e)
                        }, !0) && !l.hasOwnProperty(i)
                    }
                    function c() {
                        a() && (h++,
                        s(c),
                        f[f.length - 1](d, l))
                    }
                    if (!p) {
                        for (var u, f = q(t[i]) ? t[i] : [t[i]], d = g(function(t, e) {
                            if (h--,
                            e.length <= 1 && (e = e[0]),
                            t) {
                                var r = {};
                                y(l, function(t, e) {
                                    r[e] = t
                                }),
                                r[i] = e,
                                p = !0,
                                n(t, r)
                            } else
                                l[i] = e,
                                B.setImmediate(o)
                        }), b = f.slice(0, f.length - 1), _ = b.length; _--; ) {
                            if (!(u = t[b[_]]))
                                throw new Error("Has nonexistent dependency in " + b.join(", "));
                            if (q(u) && v(u, i) >= 0)
                                throw new Error("Has cyclic dependencies")
                        }
                        a() ? (h++,
                        f[f.length - 1](d, l)) : r(c)
                    }
                })
            }
            ,
            B.retry = function(t, e, n) {
                function r(t, e) {
                    if ("number" == typeof e)
                        t.times = parseInt(e, 10) || i;
                    else {
                        if ("object" != typeof e)
                            throw new Error("Unsupported argument type for 'times': " + typeof e);
                        t.times = parseInt(e.times, 10) || i,
                        t.interval = parseInt(e.interval, 10) || o
                    }
                }
                function s(t, e) {
                    function n(t, n) {
                        return function(r) {
                            t(function(t, e) {
                                r(!t || n, {
                                    err: t,
                                    result: e
                                })
                            }, e)
                        }
                    }
                    function r(t) {
                        return function(e) {
                            setTimeout(function() {
                                e(null)
                            }, t)
                        }
                    }
                    for (; c.times; ) {
                        var s = !(c.times -= 1);
                        a.push(n(c.task, s)),
                        !s && c.interval > 0 && a.push(r(c.interval))
                    }
                    B.series(a, function(e, n) {
                        n = n[n.length - 1],
                        (t || c.callback)(n.err, n.result)
                    })
                }
                var i = 5
                  , o = 0
                  , a = []
                  , c = {
                    times: i,
                    interval: o
                }
                  , l = arguments.length;
                if (1 > l || l > 3)
                    throw new Error("Invalid arguments - must be either (task), (task, callback), (times, task) or (times, task, callback)");
                return 2 >= l && "function" == typeof t && (n = e,
                e = t),
                "function" != typeof t && r(c, t),
                c.callback = n,
                c.task = e,
                c.callback ? s() : s
            }
            ,
            B.waterfall = function(t, e) {
                function n(t) {
                    return g(function(r, s) {
                        if (r)
                            e.apply(null, [r].concat(s));
                        else {
                            var i = t.next();
                            i ? s.push(n(i)) : s.push(e),
                            F(t).apply(null, s)
                        }
                    })
                }
                if (e = u(e || i),
                !q(t)) {
                    var r = new Error("First argument to waterfall must be an array of functions");
                    return e(r)
                }
                return t.length ? void n(B.iterator(t))() : e()
            }
            ,
            B.parallel = function(t, e) {
                O(B.eachOf, t, e)
            }
            ,
            B.parallelLimit = function(t, e, n) {
                O(k(e), t, n)
            }
            ,
            B.series = function(t, e) {
                O(B.eachOfSeries, t, e)
            }
            ,
            B.iterator = function(t) {
                function e(n) {
                    function r() {
                        return t.length && t[n].apply(null, arguments),
                        r.next()
                    }
                    return r.next = function() {
                        return n < t.length - 1 ? e(n + 1) : null
                    }
                    ,
                    r
                }
                return e(0)
            }
            ,
            B.apply = g(function(t, e) {
                return g(function(n) {
                    return t.apply(null, e.concat(n))
                })
            }),
            B.concat = w(M),
            B.concatSeries = C(M),
            B.whilst = function(t, e, n) {
                if (n = n || i,
                t()) {
                    var r = g(function(s, i) {
                        s ? n(s) : t.apply(this, i) ? e(r) : n.apply(null, [null].concat(i))
                    });
                    e(r)
                } else
                    n(null)
            }
            ,
            B.doWhilst = function(t, e, n) {
                var r = 0;
                return B.whilst(function() {
                    return ++r <= 1 || e.apply(this, arguments)
                }, t, n)
            }
            ,
            B.until = function(t, e, n) {
                return B.whilst(function() {
                    return !t.apply(this, arguments)
                }, e, n)
            }
            ,
            B.doUntil = function(t, e, n) {
                return B.doWhilst(t, function() {
                    return !e.apply(this, arguments)
                }, n)
            }
            ,
            B.during = function(t, e, n) {
                n = n || i;
                var r = g(function(e, r) {
                    e ? n(e) : (r.push(s),
                    t.apply(this, r))
                })
                  , s = function(t, s) {
                    t ? n(t) : s ? e(r) : n(null)
                };
                t(s)
            }
            ,
            B.doDuring = function(t, e, n) {
                var r = 0;
                B.during(function(t) {
                    r++ < 1 ? t(null, !0) : e.apply(this, arguments)
                }, t, n)
            }
            ,
            B.queue = function(t, e) {
                var n = I(function(e, n) {
                    t(e[0], n)
                }, e, 1);
                return n
            }
            ,
            B.priorityQueue = function(t, e) {
                function n(t, e) {
                    return t.priority - e.priority
                }
                function r(t, e, n) {
                    for (var r = -1, s = t.length - 1; s > r; ) {
                        var i = r + (s - r + 1 >>> 1);
                        n(e, t[i]) >= 0 ? r = i : s = i - 1
                    }
                    return r
                }
                function s(t, e, s, o) {
                    if (null != o && "function" != typeof o)
                        throw new Error("task callback must be a function");
                    return t.started = !0,
                    q(e) || (e = [e]),
                    0 === e.length ? B.setImmediate(function() {
                        t.drain()
                    }) : void f(e, function(e) {
                        var a = {
                            data: e,
                            priority: s,
                            callback: "function" == typeof o ? o : i
                        };
                        t.tasks.splice(r(t.tasks, a, n) + 1, 0, a),
                        t.tasks.length === t.concurrency && t.saturated(),
                        B.setImmediate(t.process)
                    })
                }
                var o = B.queue(t, e);
                return o.push = function(t, e, n) {
                    s(o, t, e, n)
                }
                ,
                delete o.unshift,
                o
            }
            ,
            B.cargo = function(t, e) {
                return I(t, 1, e)
            }
            ,
            B.log = L("log"),
            B.dir = L("dir"),
            B.memoize = function(t, e) {
                var n = {}
                  , r = {}
                  , s = Object.prototype.hasOwnProperty;
                e = e || o;
                var i = g(function(i) {
                    var o = i.pop()
                      , a = e.apply(null, i);
                    s.call(n, a) ? B.setImmediate(function() {
                        o.apply(null, n[a])
                    }) : s.call(r, a) ? r[a].push(o) : (r[a] = [o],
                    t.apply(null, i.concat([g(function(t) {
                        n[a] = t;
                        var e = r[a];
                        delete r[a];
                        for (var s = 0, i = e.length; i > s; s++)
                            e[s].apply(null, t)
                    })])))
                });
                return i.memo = n,
                i.unmemoized = t,
                i
            }
            ,
            B.unmemoize = function(t) {
                return function() {
                    return (t.unmemoized || t).apply(null, arguments)
                }
            }
            ,
            B.times = T(B.map),
            B.timesSeries = T(B.mapSeries),
            B.timesLimit = function(t, e, n, r) {
                return B.mapLimit(d(t), e, n, r)
            }
            ,
            B.seq = function() {
                var t = arguments;
                return g(function(e) {
                    var n = this
                      , r = e[e.length - 1];
                    "function" == typeof r ? e.pop() : r = i,
                    B.reduce(t, e, function(t, e, r) {
                        e.apply(n, t.concat([g(function(t, e) {
                            r(t, e)
                        })]))
                    }, function(t, e) {
                        r.apply(n, [t].concat(e))
                    })
                })
            }
            ,
            B.compose = function() {
                return B.seq.apply(null, Array.prototype.reverse.call(arguments))
            }
            ,
            B.applyEach = D(B.eachOf),
            B.applyEachSeries = D(B.eachOfSeries),
            B.forever = function(t, e) {
                function n(t) {
                    return t ? r(t) : void s(n)
                }
                var r = l(e || i)
                  , s = F(t);
                n()
            }
            ,
            B.ensureAsync = F,
            B.constant = g(function(t) {
                var e = [null].concat(t);
                return function(t) {
                    return t.apply(this, e)
                }
            }),
            B.wrapSync = B.asyncify = function(t) {
                return g(function(e) {
                    var n, r = e.pop();
                    try {
                        n = t.apply(this, e)
                    } catch (s) {
                        return r(s)
                    }
                    K(n) && "function" == typeof n.then ? n.then(function(t) {
                        r(null, t)
                    })["catch"](function(t) {
                        r(t.message ? t : new Error(t))
                    }) : r(null, n)
                })
            }
            ,
            "object" == typeof t && t.exports ? t.exports = B : (r = [],
            s = function() {
                return B
            }
            .apply(e, r),
            !(void 0 !== s && (t.exports = s)))
        }()
    }
    ).call(e, function() {
        return this
    }())
}
, function(t, e, n) {
    (function(t) {
        "use strict";
        var r = n(4)
          , s = n(2)
          , i = n(3)
          , o = n(1)
          , a = n(6)
          , c = o.BFSRequire("process")
          , l = o.BFSRequire("buffer").Buffer
          , u = o.BFSRequire("fs");
        t.globalTerm = null;
        var h = function() {
            function t() {}
            return t.CURSOR_POSITION = function(t, e, n) {
                return "[" + (n + 1 - t.ybase) + ";" + (e + 1) + "H"
            }
            ,
            t.SAVE_CURSOR = "7",
            t.RESTORE_CURSOR = "8",
            t.UP_ARROW = "[A",
            t.RIGHT_ARROW = "[C",
            t.LEFT_ARROW = "[D",
            t.SHOW_CURSOR = "[?25h",
            t
        }()
          , f = function() {
            function t(t, e, n, r) {
                var s = this;
                this._terminal = null,
                this._commands = {},
                this._activeCommand = null,
                this._shellEnabled = !1,
                this._psX = 0,
                this._psY = 0,
                this._endX = 0,
                this._endY = 0,
                this._history = [],
                this._historyOffset = 0,
                this._disableInput = !0,
                this._savedCommand = "",
                this._bufferedInput = "",
                this._shellHistoryFile = r,
                e.forEach(function(t) {
                    s._commands[t.getCommand()] = t
                });
                var i = 12
                  , o = this._terminal = globalTerm = new a({
                    cols: 80,
                    rows: i,
                    cancelEvents: !0
                });
                o.open(t),
                o.cursorHidden = !0,
                o.on("key", function(t, e) {
                    if (!s._disableInput) {
                        var n = e.keyCode
                          , r = !1;
                        if (e.ctrlKey)
                            switch (n) {
                            case 65:
                                s._shellEnabled && (r = !0,
                                s._moveToStart());
                                break;
                            case 67:
                                r = !0,
                                s.killProgram();
                                break;
                            case 68:
                                s._shellEnabled && (r = !0,
                                s._forwardDelete());
                                break;
                            case 69:
                                s._shellEnabled && (r = !0,
                                s._moveToEnd());
                                break;
                            case 78:
                                s._shellEnabled && (r = !0,
                                s._nextHistory());
                                break;
                            case 80:
                                s._shellEnabled && (r = !0,
                                s._prevHistory());
                                break;
                            case 66:
                                s._shellEnabled && (r = !0,
                                s._cursorLeft());
                                break;
                            case 70:
                                s._shellEnabled && (r = !0,
                                s._cursorRight());
                                break;
                            case 75:
                                if (s._shellEnabled) {
                                    r = !0;
                                    for (var i = s._getEnteredText().length - s._getCursorOffset(), o = 0; i > o; o++)
                                        s._forwardDelete()
                                }
                                break;
                            default:
                                r = !1
                            }
                        else if (e.altKey)
                            switch (n) {
                            case 70:
                                break;
                            case 66:
                                break;
                            case 68:
                            }
                        else {
                            switch (n) {
                            case 38:
                                s._shellEnabled && (r = !0,
                                s._prevHistory());
                                break;
                            case 40:
                                s._shellEnabled && (r = !0,
                                s._nextHistory());
                                break;
                            case 37:
                                s._shellEnabled && (r = !0,
                                s._cursorLeft());
                                break;
                            case 39:
                                s._shellEnabled && (r = !0,
                                s._cursorRight());
                                break;
                            case 8:
                                r = !0,
                                s.stdin("\b");
                                break;
                            case 9:
                                if (s._shellEnabled) {
                                    r = !0,
                                    s._disableInput = !0;
                                    var a = s._getEnteredText();
                                    s._tabComplete(a, s._getArgs(a), function() {
                                        s._disableInput = !1
                                    })
                                }
                                break;
                            case 46:
                                s._shellEnabled && "keydown" === e.type && (r = !0,
                                s._forwardDelete());
                                break;
                            case 35:
                                s._shellEnabled && (r = !0,
                                s._moveToEnd());
                                break;
                            case 36:
                                s._shellEnabled && (r = !0,
                                s._moveToStart());
                                break;
                            case 13:
                                if (s._shellEnabled) {
                                    r = !0;
                                    var a = s._getEnteredText();
                                    s.stdout(h.CURSOR_POSITION(s._terminal, s._endX, s._endY) + "\n"),
                                    s._runCommand(a, s._getArgs(a))
                                }
                            }
                            r || s.stdin(t)
                        }
                    }
                }),
                this._terminal
            }
            return t.prototype.cols = function() {
                return this._terminal.cols
            }
            ,
            t.prototype._cursorX = function() {
                return this._terminal.x
            }
            ,
            t.prototype._cursorY = function() {
                return this._terminal.ybase + this._terminal.y
            }
            ,
            t.prototype.loadingCompleted = function(t) {
                var e = this;
                u.readFile(this._shellHistoryFile, function(n, r) {
                    n || (e._history = r.toString().split("\n"),
                    e._historyOffset = e._history.length),
                    "\n" !== t[t.length - 1] && (t += "\n"),
                    e._disableInput = !1,
                    e.backspace(e.cols()),
                    e._commands.edit.run(e._commands.edit, ["answer.java"]),
                    console.log(e, u, t, h, n)/*,
                    e.stdout(t),
                    e.prompt()*/
                })
            }
            ,
            t.prototype._cursorLeft = function() {
                0 === this._cursorX() && this._cursorY() > 0 ? this.stdout(h.CURSOR_POSITION(this._terminal, this._terminal.cols - 1, this._cursorY() - 1)) : this.stdout(h.LEFT_ARROW)
            }
            ,
            t.prototype._cursorRight = function() {
                this._cursorX() === this._terminal.cols - 1 && this._endY > this._cursorY() ? this.stdout(h.CURSOR_POSITION(this._terminal, 0, this._cursorY() + 1)) : this.stdout(h.RIGHT_ARROW)
            }
            ,
            t.prototype._prevHistory = function() {
                this._history.length > 0 && this._historyOffset > 0 && (this._historyOffset === this._history.length && (this._savedCommand = this._getEnteredText()),
                this._historyOffset--,
                this._redrawPrompt(this._history[this._historyOffset]))
            }
            ,
            t.prototype._nextHistory = function() {
                this._history.length > 0 && this._historyOffset < this._history.length && (this._historyOffset++,
                this._historyOffset === this._history.length ? this._redrawPrompt(this._savedCommand) : this._redrawPrompt(this._history[this._historyOffset]))
            }
            ,
            t.prototype._moveToStart = function() {
                this.stdin(h.CURSOR_POSITION(this._terminal, this._psX, this._psY))
            }
            ,
            t.prototype._moveToEnd = function() {
                this.stdin(h.CURSOR_POSITION(this._terminal, this._endX, this._endY))
            }
            ,
            t.prototype._forwardDelete = function() {
                this._cursorRight(),
                this.stdin("\b")
            }
            ,
            t.prototype._getCursorOffset = function() {
                var t = this._terminal
                  , e = this._psX
                  , n = this._psY
                  , r = t.cols
                  , s = n * r + e
                  , i = this._cursorX()
                  , o = this._cursorY()
                  , a = o * r + i;
                return a - s
            }
            ,
            t.prototype._getEnteredText = function() {
                for (var t = "", e = this._terminal, n = (e.cols,
                e.lines), r = this._psY, s = this._endY, i = this._endX, o = r; s >= o; o++)
                    for (var a = n[o], c = o === r ? this._psX : 0; c < (o === s ? i : a.length); c++)
                        t += a[c][1];
                return t
            }
            ,
            t.prototype._updateEndLocation = function(t) {
                var e = this._terminal.cols;
                if (this._endX += t,
                this._endX > e) {
                    var n = Math.floor(this._endX / e);
                    this._endX -= e * n,
                    this._endY += n
                } else if (this._endX < 0) {
                    var n = Math.ceil(Math.abs(this._endX) / e);
                    this._endY -= n,
                    this._endX += e * n
                }
            }
            ,
            t.prototype.stdin = function(t) {
                if (this._shellEnabled)
                    if ("\b" === t) {
                        var e = this._getEnteredText()
                          , n = this._getCursorOffset();
                        n > 0 && (this._cursorLeft(),
                        this.stdout("" + h.SAVE_CURSOR + e.slice(n) + " " + h.RESTORE_CURSOR),
                        this._updateEndLocation(-1))
                    } else {
                        var r = null;
                        switch (t[0]) {
                        case "":
                        case "":
                        case "":
                        case "":
                            break;
                        default:
                            r = "" + h.SAVE_CURSOR + this._getEnteredText().slice(this._getCursorOffset()) + h.RESTORE_CURSOR,
                            this._updateEndLocation(1)
                        }
                        this.stdout(t),
                        this._terminal.x === this._terminal.cols && (this._terminal.x--,
                        this._cursorRight());
                        var s = this._cursorY();
                        r && this.stdout(r);
                        var i = this._cursorY();
                        i !== s && this.stdout(h.UP_ARROW),
                        this._updatePrompt()
                    }
                else
                    "\b" === t ? this._bufferedInput.length > 0 && (this._cursorLeft(),
                    this.stdout(" "),
                    this._cursorLeft(),
                    this._bufferedInput = this._bufferedInput.slice(0, this._bufferedInput.length - 1)) : "\r" === t ? (this.stdout("\r\n"),
                    this._bufferedInput += "\n",
                    c.stdin.write(this._bufferedInput),
                    this._bufferedInput = "") : "" !== t[0] && (this._bufferedInput += t,
                    this.stdout(t))
            }
            ,
            t.prototype.stdout = function(t) {
                var e = this._terminal;
                e.write(t.replace(/\n/g, "\r\n"))
            }
            ,
            t.prototype.stderr = function(t) {
                this.stdout(t)
            }
            ,
            t.prototype._getArgs = function(t) {
                return this._getEnteredText().trim().split(/\s+/g)
            }
            ,
            t.prototype._runCommand = function(t, e) {
                var n = this;
                if (this._bufferedInput = "",
                this._shellEnabled = !1,
                this._historyOffset = this._history.push(t),
                u.writeFile(this._shellHistoryFile, new l(this._history.join("\n")), function() {}),
                "" === e[0])
                    return void this.prompt();
                if (this._activeCommand)
                    return void this.stderr("ERROR: Already running a command!\n");
                var r = this._commands[e[0]];
                r ? this._expandArguments(e.slice(1), function(t, e) {
                    e ? (n.stderr(r.getCommand() + ": " + e + "\n"),
                    n.prompt()) : (n._activeCommand = r,
                    r.run(n, t, function() {
                        n.exitProgram()
                    }))
                }) : (this.stderr("Unknown command " + e[0] + '. Type "help" for a list of commands.\n'),
                this.prompt())
            }
            ,
            t.prototype.killProgram = function() {
                this._activeCommand && (this._activeCommand.kill(),
                this.exitProgram())
            }
            ,
            t.prototype.exitProgram = function() {
                this._activeCommand && (this._activeCommand = null,
                0 !== this._cursorX() && this.stdout("\n"),
                this.prompt())
            }
            ,
            t.prototype.focus = function() {
                this._terminal.focus()
            }
            ,
            t.prototype._ps = function() {
                return c.cwd() + " $"
            }
            ,
            t.prototype.getAvailableCommands = function() {
                return i.clone(this._commands)
            }
            ,
            t.prototype._boundCursor = function() {
                var t = (this._terminal,
                this._cursorX())
                  , e = this._cursorY()
                  , n = this._psX
                  , r = this._psY
                  , s = this._endX
                  , i = this._endY
                  , o = this._terminal.cols
                  , a = e * o + t
                  , c = r * o + n
                  , l = i * o + s;
                c > a ? this.stdout(h.CURSOR_POSITION(this._terminal, n, r)) : a > l && this.stdout(h.CURSOR_POSITION(this._terminal, s, i))
            }
            ,
            t.prototype._expandArguments = function(t, e) {
                var n = [];
                r.each(t, function(t, e) {
                    -1 == t.indexOf("*") ? (n.push(t),
                    e()) : s.processGlob(t, function(r) {
                        r.length > 0 ? (n = n.concat(r),
                        e()) : e(t + ": No such file or directory")
                    })
                }, function(t) {
                    e(n, t)
                })
            }
            ,
            t.prototype.getCompletions = function(t, e) {
                if (1 == t.length)
                    e(s.filterSubstring(t[0], Object.keys(this.getAvailableCommands())));
                else if ("time" === t[0])
                    this.getCompletions(t.slice(1), e);
                else {
                    var n = this.getAvailableCommands()[t[0]]
                      , r = function() {
                        return !0
                    };
                    null != n && (r = n.getAutocompleteFilter()),
                    s.fileNameCompletions(t[0], t, r, e)
                }
            }
            ,
            t.prototype.backspace = function(t) {
                for (var e = "", n = 0; t > n; n++)
                    e += "\b \b";
                this._terminal.write(e)
            }
            ,
            t.prototype.prompt = function() {
                c.stdin.setRawMode(!1),
                this._shellEnabled = !0,
                this._terminal.write(this._ps() + " "),
                this._psX = this._endX = this._cursorX(),
                this._psY = this._endY = this._cursorY(),
                this.stdout(h.SHOW_CURSOR)
            }
            ,
            t.prototype._updatePrompt = function() {
                this._boundCursor()
            }
            ,
            t.prototype._redrawPrompt = function(t) {
                this._shellEnabled = !0;
                var e = this._getEnteredText();
                this.stdout(h.CURSOR_POSITION(this._terminal, this._endX, this._endY));
                for (var n = 0; n < e.length; n++)
                    this.stdin("\b");
                this._terminal.write(t),
                this._updateEndLocation(t.length)
            }
            ,
            t.prototype._tabComplete = function(t, e, n) {
                var r = this
                  , o = this._terminal
                  , a = i.last(e);
                this.getCompletions(e, function(i) {
                    if (1 == i.length) {
                        var c = i[0];
                        e[e.length - 1] = c;
                        var l = e.join(" ") + ("/" !== c[c.length - 1] ? " " : "");
                        r._redrawPrompt(l)
                    } else if (i.length > 0) {
                        var u = s.longestCommmonPrefix(i);
                        if ("" === u || u === a) {
                            var h = a.lastIndexOf("/") + 1
                              , f = i.map(function(t) {
                                return t.slice(h)
                            });
                            f.sort(),
                            r.stdout("\n" + s.columnize(f, o.cols) + "\n"),
                            r.prompt(),
                            r._redrawPrompt(t)
                        } else
                            e[e.length - 1] = u,
                            r._redrawPrompt(e.join(" "))
                    }
                    n()
                })
            }
            ,
            t
        }();
        e.__esModule = !0,
        e["default"] = f
    }
    ).call(e, function() {
        return this
    }())
}
, function(t, e, n) {
    !function(e) {
        t.exports = e.call(this)
    }(function() {
        "use strict";
        function t() {
            this._events = this._events || {}
        }
        function e(n) {
            var r = this;
            if (!(this instanceof e))
                return new e(arguments[0],arguments[1],arguments[2]);
            r.cancel = e.cancel,
            t.call(this),
            "number" == typeof n && (n = {
                cols: arguments[0],
                rows: arguments[1],
                handler: arguments[2]
            }),
            n = n || {},
            Object.keys(e.defaults).forEach(function(t) {
                null == n[t] && (n[t] = e.options[t],
                e[t] !== e.defaults[t] && (n[t] = e[t])),
                r[t] = n[t]
            }),
            8 === n.colors.length ? n.colors = n.colors.concat(e._colors.slice(8)) : 16 === n.colors.length ? n.colors = n.colors.concat(e._colors.slice(16)) : 10 === n.colors.length ? n.colors = n.colors.slice(0, -2).concat(e._colors.slice(8, -2), n.colors.slice(-2)) : 18 === n.colors.length && (n.colors = n.colors.concat(e._colors.slice(16, -2), n.colors.slice(-2))),
            this.colors = n.colors,
            this.options = n,
            this.parent = n.body || n.parent || (h ? h.getElementsByTagName("body")[0] : null),
            this.cols = n.cols || n.geometry[0],
            this.rows = n.rows || n.geometry[1],
            n.handler && this.on("data", n.handler),
            this.ybase = 0,
            this.ydisp = 0,
            this.x = 0,
            this.y = 0,
            this.cursorState = 0,
            this.cursorHidden = !1,
            this.convertEol,
            this.state = 0,
            this.queue = "",
            this.scrollTop = 0,
            this.scrollBottom = this.rows - 1,
            this.applicationKeypad = !1,
            this.applicationCursor = !1,
            this.originMode = !1,
            this.insertMode = !1,
            this.wraparoundMode = !1,
            this.normal = null,
            this.charset = null,
            this.gcharset = null,
            this.glevel = 0,
            this.charsets = [null],
            this.decLocator,
            this.x10Mouse,
            this.vt200Mouse,
            this.vt300Mouse,
            this.normalMouse,
            this.mouseEvents,
            this.sendFocus,
            this.utfMouse,
            this.sgrMouse,
            this.urxvtMouse,
            this.element,
            this.children,
            this.refreshStart,
            this.refreshEnd,
            this.savedX,
            this.savedY,
            this.savedCols,
            this.readable = !0,
            this.writable = !0,
            this.defAttr = 131840,
            this.curAttr = this.defAttr,
            this.params = [],
            this.currentParam = 0,
            this.prefix = "",
            this.postfix = "",
            this.lines = [];
            for (var s = this.rows; s--; )
                this.lines.push(this.blankLine());
            this.tabs,
            this.setupStops()
        }
        function n(t, e, n, r) {
            Array.isArray(t) || (t = [t]),
            t.forEach(function(t) {
                t.addEventListener(e, n, r || !1)
            })
        }
        function r(t, e, n, r) {
            t.removeEventListener(e, n, r || !1)
        }
        function s(t, e) {
            return this.cancelEvents || e ? (t.preventDefault(),
            t.stopPropagation(),
            !1) : void 0
        }
        function i(t, e) {
            function n() {
                this.constructor = t
            }
            n.prototype = e.prototype,
            t.prototype = new n
        }
        function o(t) {
            var e = t.getElementsByTagName("body")[0]
              , n = t.createElement("span");
            n.innerHTML = "hello world",
            e.appendChild(n);
            var r = n.scrollWidth;
            n.style.fontWeight = "bold";
            var s = n.scrollWidth;
            return e.removeChild(n),
            r !== s
        }
        function a(t) {
            return "＀" >= t ? !1 : t >= "！" && "ﾾ" >= t || t >= "ￂ" && "ￇ" >= t || t >= "ￊ" && "ￏ" >= t || t >= "ￒ" && "ￗ" >= t || t >= "ￚ" && "ￜ" >= t || t >= "￠" && "￦" >= t || t >= "￨" && "￮" >= t
        }
        function c(t, n, r) {
            var s = t << 16 | n << 8 | r;
            if (null != c._cache[s])
                return c._cache[s];
            for (var i, o, a, l, u, h = 1 / 0, f = -1, p = 0; p < e.vcolors.length; p++) {
                if (i = e.vcolors[p],
                o = i[0],
                a = i[1],
                l = i[2],
                u = c.distance(t, n, r, o, a, l),
                0 === u) {
                    f = p;
                    break
                }
                h > u && (h = u,
                f = p)
            }
            return c._cache[s] = f
        }
        function l(t, e, n) {
            if (t.forEach)
                return t.forEach(e, n);
            for (var r = 0; r < t.length; r++)
                e.call(n, t[r], r, t)
        }
        function u(t) {
            if (Object.keys)
                return Object.keys(t);
            var e, n = [];
            for (e in t)
                Object.prototype.hasOwnProperty.call(t, e) && n.push(e);
            return n
        }
        var h = this.document;
        t.prototype.addListener = function(t, e) {
            this._events[t] = this._events[t] || [],
            this._events[t].push(e)
        }
        ,
        t.prototype.on = t.prototype.addListener,
        t.prototype.removeListener = function(t, e) {
            if (this._events[t])
                for (var n = this._events[t], r = n.length; r--; )
                    if (n[r] === e || n[r].listener === e)
                        return void n.splice(r, 1)
        }
        ,
        t.prototype.off = t.prototype.removeListener,
        t.prototype.removeAllListeners = function(t) {
            this._events[t] && delete this._events[t]
        }
        ,
        t.prototype.once = function(t, e) {
            function n() {
                var r = Array.prototype.slice.call(arguments);
                return this.removeListener(t, n),
                e.apply(this, r)
            }
            return n.listener = e,
            this.on(t, n)
        }
        ,
        t.prototype.emit = function(t) {
            if (this._events[t])
                for (var e = Array.prototype.slice.call(arguments, 1), n = this._events[t], r = n.length, s = 0; r > s; s++)
                    n[s].apply(this, e)
        }
        ,
        t.prototype.listeners = function(t) {
            return this._events[t] = this._events[t] || []
        }
        ;
        var f = 0
          , p = 1
          , d = 2
          , m = 3
          , y = 4
          , v = 5
          , b = 6;
        i(e, t),
        e.prototype.eraseAttr = function() {
            return -512 & this.defAttr | 511 & this.curAttr
        }
        ,
        e.tangoColors = ["#2e3436", "#cc0000", "#4e9a06", "#c4a000", "#3465a4", "#75507b", "#06989a", "#d3d7cf", "#555753", "#ef2929", "#8ae234", "#fce94f", "#729fcf", "#ad7fa8", "#34e2e2", "#eeeeec"],
        e.colors = function() {
            function t(t, e, r) {
                s.push("#" + n(t) + n(e) + n(r))
            }
            function n(t) {
                return t = t.toString(16),
                t.length < 2 ? "0" + t : t
            }
            var r, s = e.tangoColors.slice(), i = [0, 95, 135, 175, 215, 255];
            for (r = 0; 216 > r; r++)
                t(i[r / 36 % 6 | 0], i[r / 6 % 6 | 0], i[r % 6]);
            for (r = 0; 24 > r; r++)
                i = 8 + 10 * r,
                t(i, i, i);
            return s
        }(),
        e._colors = e.colors.slice(),
        e.vcolors = function() {
            for (var t, n = [], r = e.colors, s = 0; 256 > s; s++)
                t = parseInt(r[s].substring(1), 16),
                n.push([t >> 16 & 255, t >> 8 & 255, 255 & t]);
            return n
        }(),
        e.defaults = {
            colors: e.colors,
            theme: "default",
            convertEol: !1,
            termName: "xterm",
            geometry: [80, 12],
            cursorBlink: !1,
            visualBell: !1,
            popOnBell: !1,
            scrollback: 1e3,
            screenKeys: !1,
            debug: !1,
            cancelEvents: !1
        },
        e.options = {},
        e.focus = null,
        l(u(e.defaults), function(t) {
            e[t] = e.defaults[t],
            e.options[t] = e.defaults[t]
        }),
        e.prototype.focus = function() {
            h.activeElement !== this.textarea && (this.sendFocus && this.send("[I"),
            this.showCursor(),
            this.textarea.focus(),
            e.focus = this)
        }
        ,
        e.prototype.blur = function() {
            e.focus === this && (this.cursorState = 0,
            this.refresh(this.y, this.y),
            this.textarea.blur(),
            this.sendFocus && this.send("[O"),
            e.focus = null)
        }
        ,
        e.prototype.initGlobal = function() {
            e.bindPaste(this),
            e.bindKeys(this),
            e.bindCopy(this)
        }
        ,
        e.bindPaste = function(t) {
            n([t.textarea, t.element], "paste", function(e) {
                if (e.stopPropagation(),
                e.clipboardData) {
                    var n = e.clipboardData.getData("text/plain");
                    t.handler(n)
                }
                return t.textarea.value = "",
                t.cancel(e)
            })
        }
        ,
        e.bindKeys = function(t) {
            n(t.element, "keydown", function(e) {
                h.activeElement == this && t.keyDown(e)
            }, !0),
            n(t.element, "keypress", function(e) {
                h.activeElement == this && t.keyPress(e)
            }, !0),
            n(t.element, "keyup", t.focus.bind(t)),
            n(t.textarea, "keydown", function(e) {
                t.keyDown(e)
            }, !0),
            n(t.textarea, "keypress", function(e) {
                t.keyPress(e),
                this.value = ""
            }, !0)
        }
        ,
        e.bindCopy = function(t) {
            n(t.element, "copy", function(t) {})
        }
        ,
        e.prototype.insertRow = function(t) {
            return "object" != typeof t && (t = h.createElement("div")),
            this.rowContainer.appendChild(t),
            this.children.push(t),
            t
        }
        ,
        e.prototype.open = function(t) {
            var r = this
              , s = 0;
            if (this.parent = t || this.parent,
            !this.parent)
                throw new Error("Terminal requires a parent element.");
            for (this.context = this.parent.ownerDocument.defaultView,
            this.document = this.parent.ownerDocument,
            this.body = this.document.getElementsByTagName("body")[0],
            this.context.navigator && this.context.navigator.userAgent && (this.isMac = !!~this.context.navigator.userAgent.indexOf("Mac"),
            this.isIpad = !!~this.context.navigator.userAgent.indexOf("iPad"),
            this.isIphone = !!~this.context.navigator.userAgent.indexOf("iPhone"),
            this.isMSIE = !!~this.context.navigator.userAgent.indexOf("MSIE")),
            this.element = this.document.createElement("div"),
            this.element.classList.add("terminal"),
            this.element.classList.add("xterm"),
            this.element.classList.add("xterm-theme-" + this.theme),
            this.element.setAttribute("tabindex", 0),
            this.rowContainer = h.createElement("div"),
            this.rowContainer.classList.add("xterm-rows"),
            this.element.appendChild(this.rowContainer),
            this.children = [],
            this.helperContainer = h.createElement("div"),
            this.helperContainer.classList.add("xterm-helpers"),
            this.element.appendChild(this.helperContainer),
            this.textarea = h.createElement("textarea"),
            this.textarea.classList.add("xterm-helper-textarea"),
            this.textarea.setAttribute("autocorrect", "off"),
            this.textarea.setAttribute("autocapitalize", "off"),
            this.textarea.setAttribute("spellcheck", "false"),
            this.textarea.tabIndex = 0,
            this.textarea.onfocus = function() {
                r.emit("focus", {
                    terminal: r
                })
            }
            ,
            this.textarea.onblur = function() {
                r.emit("blur", {
                    terminal: r
                })
            }
            ,
            this.helperContainer.appendChild(this.textarea); s < this.rows; s++)
                this.insertRow();
            this.parent.appendChild(this.element),
            this.refresh(0, this.rows - 1),
            this.initGlobal(),
            this.focus(),
            this.startBlink(),
            n(this.element, "mouseup", function() {
                var t = h.getSelection()
                  , e = t.isCollapsed
                  , n = "boolean" == typeof e ? !e : "Range" == t.type;
                n || r.focus()
            }),
            this.bindMouse(),
            null == e.brokenBold && (e.brokenBold = o(this.document)),
            this.emit("open")
        }
        ,
        e.prototype.bindMouse = function() {
            function t(t) {
                var e, n;
                if (e = o(t),
                n = a(t))
                    switch (i(e, n),
                    t.type) {
                    case "mousedown":
                        u = e;
                        break;
                    case "mouseup":
                        u = 32;
                        break;
                    case h:
                    }
            }
            function e(t) {
                var e, n = u;
                e = a(t),
                e && (n += 32,
                i(n, e))
            }
            function s(t, e) {
                if (l.utfMouse) {
                    if (2047 === e)
                        return t.push(0);
                    127 > e ? t.push(e) : (e > 2047 && (e = 2047),
                    t.push(192 | e >> 6),
                    t.push(128 | 63 & e))
                } else {
                    if (255 === e)
                        return t.push(0);
                    e > 127 && (e = 127),
                    t.push(e)
                }
            }
            function i(t, e) {
                if (l.vt300Mouse) {
                    t &= 3,
                    e.x -= 32,
                    e.y -= 32;
                    var n = "[24";
                    if (0 === t)
                        n += "1";
                    else if (1 === t)
                        n += "3";
                    else if (2 === t)
                        n += "5";
                    else {
                        if (3 === t)
                            return;
                        n += "0"
                    }
                    return n += "~[" + e.x + "," + e.y + "]\r",
                    void l.send(n)
                }
                if (l.decLocator)
                    return t &= 3,
                    e.x -= 32,
                    e.y -= 32,
                    0 === t ? t = 2 : 1 === t ? t = 4 : 2 === t ? t = 6 : 3 === t && (t = 3),
                    void l.send("[" + t + ";" + (3 === t ? 4 : 0) + ";" + e.y + ";" + e.x + ";" + (e.page || 0) + "&w");
                if (l.urxvtMouse)
                    return e.x -= 32,
                    e.y -= 32,
                    e.x++,
                    e.y++,
                    void l.send("[" + t + ";" + e.x + ";" + e.y + "M");
                if (l.sgrMouse)
                    return e.x -= 32,
                    e.y -= 32,
                    void l.send("[<" + (3 === (3 & t) ? -4 & t : t) + ";" + e.x + ";" + e.y + (3 === (3 & t) ? "m" : "M"));
                var n = [];
                s(n, t),
                s(n, e.x),
                s(n, e.y),
                l.send("[M" + g.fromCharCode.apply(g, n))
            }
            function o(t) {
                var e, n, r, s, i;
                switch (t.type) {
                case "mousedown":
                    e = null != t.button ? +t.button : null != t.which ? t.which - 1 : null,
                    l.isMSIE && (e = 1 === e ? 0 : 4 === e ? 1 : e);
                    break;
                case "mouseup":
                    e = 3;
                    break;
                case "DOMMouseScroll":
                    e = t.detail < 0 ? 64 : 65;
                    break;
                case "mousewheel":
                    e = t.wheelDeltaY > 0 ? 64 : 65
                }
                return n = t.shiftKey ? 4 : 0,
                r = t.metaKey ? 8 : 0,
                s = t.ctrlKey ? 16 : 0,
                i = n | r | s,
                l.vt200Mouse ? i &= s : l.normalMouse || (i = 0),
                e = 32 + (i << 2) + e
            }
            function a(t) {
                var e, n, r, s, i;
                if (null != t.pageX) {
                    for (e = t.pageX,
                    n = t.pageY,
                    i = l.element; i && i !== l.document.documentElement; )
                        e -= i.offsetLeft,
                        n -= i.offsetTop,
                        i = "offsetParent"in i ? i.offsetParent : i.parentNode;
                    return r = l.element.clientWidth,
                    s = l.element.clientHeight,
                    e = Math.round(e / r * l.cols),
                    n = Math.round(n / s * l.rows),
                    0 > e && (e = 0),
                    e > l.cols && (e = l.cols),
                    0 > n && (n = 0),
                    n > l.rows && (n = l.rows),
                    e += 32,
                    n += 32,
                    {
                        x: e,
                        y: n,
                        type: t.type === h ? "mousewheel" : t.type
                    }
                }
            }
            var c = this.element
              , l = this
              , u = 32
              , h = "onmousewheel"in this.context ? "mousewheel" : "DOMMouseScroll";
            n(c, "mousedown", function(s) {
                return l.mouseEvents ? (t(s),
                l.focus(),
                l.vt200Mouse ? (t({
                    __proto__: s,
                    type: "mouseup"
                }),
                l.cancel(s)) : (l.normalMouse && n(l.document, "mousemove", e),
                l.x10Mouse || n(l.document, "mouseup", function i(n) {
                    return t(n),
                    l.normalMouse && r(l.document, "mousemove", e),
                    r(l.document, "mouseup", i),
                    l.cancel(n)
                }),
                l.cancel(s))) : void 0
            }),
            n(c, h, function(e) {
                return l.mouseEvents && !(l.x10Mouse || l.vt300Mouse || l.decLocator) ? (t(e),
                l.cancel(e)) : void 0
            }),
            n(c, h, function(t) {
                return l.mouseEvents || l.applicationKeypad ? void 0 : ("DOMMouseScroll" === t.type ? l.scrollDisp(t.detail < 0 ? -1 : 1) : l.scrollDisp(t.wheelDeltaY > 0 ? -1 : 1),
                l.cancel(t))
            })
        }
        ,
        e.prototype.destroy = function() {
            this.readable = !1,
            this.writable = !1,
            this._events = {},
            this.handler = function() {}
            ,
            this.write = function() {}
            ,
            this.element.parentNode && this.element.parentNode.removeChild(this.element)
        }
        ,
        e.prototype.refresh = function(t, n) {
            var r, s, i, o, c, l, u, f, p, d, m, y, v, b, g = h.activeElement;
            for (n - t >= this.rows / 2 && (b = this.element.parentNode,
            b && b.removeChild(this.element)),
            u = this.cols,
            s = t,
            n >= this.lines.length && (this.log("`end` is too large. Most likely a bad CSR."),
            n = this.lines.length - 1); n >= s; s++) {
                for (v = s + this.ydisp,
                o = this.lines[v],
                c = "",
                r = s === this.y && this.cursorState && this.ydisp === this.ybase && !this.cursorHidden ? this.x : -1,
                p = this.defAttr,
                i = 0; u > i; i++) {
                    switch (f = o[i][0],
                    l = o[i][1],
                    i === r && (f = -1),
                    f !== p && (p !== this.defAttr && (c += "</span>"),
                    f !== this.defAttr && (-1 === f ? c += '<span class="reverse-video terminal-cursor">' : (c += '<span class="',
                    d = 511 & f,
                    m = f >> 9 & 511,
                    y = f >> 18,
                    1 & y && (e.brokenBold || (c += " xterm-bold "),
                    8 > m && (m += 8)),
                    2 & y && (c += " xterm-underline "),
                    4 & y && (c += " xterm-blink "),
                    8 & y && (d = f >> 9 & 511,
                    m = 511 & f,
                    1 & y && 8 > m && (m += 8)),
                    16 & y && (c += " xterm-hidden "),
                    256 !== d && (c += " xterm-bg-color-" + d + " "),
                    257 !== m && (c += " xterm-color-" + m + " "),
                    c += '">'))),
                    l) {
                    case "&":
                        c += "&amp;";
                        break;
                    case "<":
                        c += "&lt;";
                        break;
                    case ">":
                        c += "&gt;";
                        break;
                    default:
                        " " >= l ? c += "&nbsp;" : (a(l) && i++,
                        c += l)
                    }
                    p = f
                }
                p !== this.defAttr && (c += "</span>"),
                this.children[s].innerHTML = c
            }
            b && b.appendChild(this.element),
            g.focus(),
            this.emit("refresh", {
                element: this.element,
                start: t,
                end: n
            })
        }
        ,
        e.prototype._cursorBlink = function() {
            e.focus === this && (this.cursorState ^= 1,
            this.refresh(this.y, this.y))
        }
        ,
        e.prototype.showCursor = function() {
            this.cursorState || (this.cursorState = 1,
            this.refresh(this.y, this.y))
        }
        ,
        e.prototype.startBlink = function() {
            if (this.cursorBlink) {
                var t = this;
                this._blinker = function() {
                    t._cursorBlink()
                }
                ,
                this._blink = k(this._blinker, 500)
            }
        }
        ,
        e.prototype.refreshBlink = function() {
            this.cursorBlink && (clearInterval(this._blink),
            this._blink = k(this._blinker, 500))
        }
        ,
        e.prototype.scroll = function() {
            var t;
            ++this.ybase === this.scrollback && (this.ybase = this.ybase / 2 | 0,
            this.lines = this.lines.slice(-(this.ybase + this.rows) + 1)),
            this.ydisp = this.ybase,
            t = this.ybase + this.rows - 1,
            t -= this.rows - 1 - this.scrollBottom,
            t === this.lines.length ? this.lines.push(this.blankLine()) : this.lines.splice(t, 0, this.blankLine()),
            0 !== this.scrollTop && (0 !== this.ybase && (this.ybase--,
            this.ydisp = this.ybase),
            this.lines.splice(this.ybase + this.scrollTop, 1)),
            this.updateRange(this.scrollTop),
            this.updateRange(this.scrollBottom)
        }
        ,
        e.prototype.scrollDisp = function(t) {
            this.ydisp += t,
            this.ydisp > this.ybase ? this.ydisp = this.ybase : this.ydisp < 0 && (this.ydisp = 0),
            this.refresh(0, this.rows - 1)
        }
        ,
        e.prototype.write = function(t) {
            var n, r, s, i = t.length, o = 0;
            for (this.refreshStart = this.y,
            this.refreshEnd = this.y,
            this.ybase !== this.ydisp && (this.ydisp = this.ybase,
            this.maxRange()); i > o; o++)
                switch (s = t[o],
                this.state) {
                case f:
                    switch (s) {
                    case "":
                        this.bell();
                        break;
                    case "\n":
                    case "\x0B":
                    case "\f":
                        this.convertEol && (this.x = 0),
                        this.y++,
                        this.y > this.scrollBottom && (this.y--,
                        this.scroll());
                        break;
                    case "\r":
                        this.x = 0;
                        break;
                    case "\b":
                        this.x > 0 && this.x--;
                        break;
                    case "	":
                        this.x = this.nextStop();
                        break;
                    case "":
                        this.setgLevel(1);
                        break;
                    case "":
                        this.setgLevel(0);
                        break;
                    case "":
                        this.state = p;
                        break;
                    default:
                        if (s >= " " && (this.charset && this.charset[s] && (s = this.charset[s]),
                        this.x >= this.cols && (this.x = 0,
                        this.y++,
                        this.y > this.scrollBottom && (this.y--,
                        this.scroll())),
                        this.lines[this.y + this.ybase][this.x] = [this.curAttr, s],
                        this.x++,
                        this.updateRange(this.y),
                        a(s))) {
                            if (n = this.y + this.ybase,
                            this.cols < 2 || this.x >= this.cols) {
                                this.lines[n][this.x - 1] = [this.curAttr, " "];
                                break
                            }
                            this.lines[n][this.x] = [this.curAttr, " "],
                            this.x++
                        }
                    }
                    break;
                case p:
                    switch (s) {
                    case "[":
                        this.params = [],
                        this.currentParam = 0,
                        this.state = d;
                        break;
                    case "]":
                        this.params = [],
                        this.currentParam = 0,
                        this.state = m;
                        break;
                    case "P":
                        this.params = [],
                        this.currentParam = 0,
                        this.state = v;
                        break;
                    case "_":
                        this.state = b;
                        break;
                    case "^":
                        this.state = b;
                        break;
                    case "c":
                        this.reset();
                        break;
                    case "E":
                        this.x = 0;
                    case "D":
                        this.index();
                        break;
                    case "M":
                        this.reverseIndex();
                        break;
                    case "%":
                        this.setgLevel(0),
                        this.setgCharset(0, e.charsets.US),
                        this.state = f,
                        o++;
                        break;
                    case "(":
                    case ")":
                    case "*":
                    case "+":
                    case "-":
                    case ".":
                        switch (s) {
                        case "(":
                            this.gcharset = 0;
                            break;
                        case ")":
                            this.gcharset = 1;
                            break;
                        case "*":
                            this.gcharset = 2;
                            break;
                        case "+":
                            this.gcharset = 3;
                            break;
                        case "-":
                            this.gcharset = 1;
                            break;
                        case ".":
                            this.gcharset = 2
                        }
                        this.state = y;
                        break;
                    case "/":
                        this.gcharset = 3,
                        this.state = y,
                        o--;
                        break;
                    case "N":
                        break;
                    case "O":
                        break;
                    case "n":
                        this.setgLevel(2);
                        break;
                    case "o":
                        this.setgLevel(3);
                        break;
                    case "|":
                        this.setgLevel(3);
                        break;
                    case "}":
                        this.setgLevel(2);
                        break;
                    case "~":
                        this.setgLevel(1);
                        break;
                    case "7":
                        this.saveCursor(),
                        this.state = f;
                        break;
                    case "8":
                        this.restoreCursor(),
                        this.state = f;
                        break;
                    case "#":
                        this.state = f,
                        o++;
                        break;
                    case "H":
                        this.tabSet();
                        break;
                    case "=":
                        this.log("Serial port requested application keypad."),
                        this.applicationKeypad = !0,
                        this.state = f;
                        break;
                    case ">":
                        this.log("Switching back to normal keypad."),
                        this.applicationKeypad = !1,
                        this.state = f;
                        break;
                    default:
                        this.state = f,
                        this.error("Unknown ESC control: %s.", s)
                    }
                    break;
                case y:
                    switch (s) {
                    case "0":
                        r = e.charsets.SCLD;
                        break;
                    case "A":
                        r = e.charsets.UK;
                        break;
                    case "B":
                        r = e.charsets.US;
                        break;
                    case "4":
                        r = e.charsets.Dutch;
                        break;
                    case "C":
                    case "5":
                        r = e.charsets.Finnish;
                        break;
                    case "R":
                        r = e.charsets.French;
                        break;
                    case "Q":
                        r = e.charsets.FrenchCanadian;
                        break;
                    case "K":
                        r = e.charsets.German;
                        break;
                    case "Y":
                        r = e.charsets.Italian;
                        break;
                    case "E":
                    case "6":
                        r = e.charsets.NorwegianDanish;
                        break;
                    case "Z":
                        r = e.charsets.Spanish;
                        break;
                    case "H":
                    case "7":
                        r = e.charsets.Swedish;
                        break;
                    case "=":
                        r = e.charsets.Swiss;
                        break;
                    case "/":
                        r = e.charsets.ISOLatin,
                        o++;
                        break;
                    default:
                        r = e.charsets.US
                    }
                    this.setgCharset(this.gcharset, r),
                    this.gcharset = null,
                    this.state = f;
                    break;
                case m:
                    if ("" === s || "" === s) {
                        switch ("" === s && o++,
                        this.params.push(this.currentParam),
                        this.params[0]) {
                        case 0:
                        case 1:
                        case 2:
                            this.params[1] && (this.title = this.params[1],
                            this.handleTitle(this.title));
                            break;
                        case 3:
                            break;
                        case 4:
                        case 5:
                            break;
                        case 10:
                        case 11:
                        case 12:
                        case 13:
                        case 14:
                        case 15:
                        case 16:
                        case 17:
                        case 18:
                        case 19:
                            break;
                        case 46:
                            break;
                        case 50:
                            break;
                        case 51:
                            break;
                        case 52:
                            break;
                        case 104:
                        case 105:
                        case 110:
                        case 111:
                        case 112:
                        case 113:
                        case 114:
                        case 115:
                        case 116:
                        case 117:
                        case 118:
                        }
                        this.params = [],
                        this.currentParam = 0,
                        this.state = f
                    } else
                        this.params.length ? this.currentParam += s : s >= "0" && "9" >= s ? this.currentParam = 10 * this.currentParam + s.charCodeAt(0) - 48 : ";" === s && (this.params.push(this.currentParam),
                        this.currentParam = "");
                    break;
                case d:
                    if ("?" === s || ">" === s || "!" === s) {
                        this.prefix = s;
                        break
                    }
                    if (s >= "0" && "9" >= s) {
                        this.currentParam = 10 * this.currentParam + s.charCodeAt(0) - 48;
                        break
                    }
                    if ("$" === s || '"' === s || " " === s || "'" === s) {
                        this.postfix = s;
                        break
                    }
                    if (this.params.push(this.currentParam),
                    this.currentParam = 0,
                    ";" === s)
                        break;
                    switch (this.state = f,
                    s) {
                    case "A":
                        this.cursorUp(this.params);
                        break;
                    case "B":
                        this.cursorDown(this.params);
                        break;
                    case "C":
                        this.cursorForward(this.params);
                        break;
                    case "D":
                        this.cursorBackward(this.params);
                        break;
                    case "H":
                        this.cursorPos(this.params);
                        break;
                    case "J":
                        this.eraseInDisplay(this.params);
                        break;
                    case "K":
                        this.eraseInLine(this.params);
                        break;
                    case "m":
                        this.prefix || this.charAttributes(this.params);
                        break;
                    case "n":
                        this.prefix || this.deviceStatus(this.params);
                        break;
                    case "@":
                        this.insertChars(this.params);
                        break;
                    case "E":
                        this.cursorNextLine(this.params);
                        break;
                    case "F":
                        this.cursorPrecedingLine(this.params);
                        break;
                    case "G":
                        this.cursorCharAbsolute(this.params);
                        break;
                    case "L":
                        this.insertLines(this.params);
                        break;
                    case "M":
                        this.deleteLines(this.params);
                        break;
                    case "P":
                        this.deleteChars(this.params);
                        break;
                    case "X":
                        this.eraseChars(this.params);
                        break;
                    case "`":
                        this.charPosAbsolute(this.params);
                        break;
                    case "a":
                        this.HPositionRelative(this.params);
                        break;
                    case "c":
                        this.sendDeviceAttributes(this.params);
                        break;
                    case "d":
                        this.linePosAbsolute(this.params);
                        break;
                    case "e":
                        this.VPositionRelative(this.params);
                        break;
                    case "f":
                        this.HVPosition(this.params);
                        break;
                    case "h":
                        this.setMode(this.params);
                        break;
                    case "l":
                        this.resetMode(this.params);
                        break;
                    case "r":
                        this.setScrollRegion(this.params);
                        break;
                    case "s":
                        this.saveCursor(this.params);
                        break;
                    case "u":
                        this.restoreCursor(this.params);
                        break;
                    case "I":
                        this.cursorForwardTab(this.params);
                        break;
                    case "S":
                        this.scrollUp(this.params);
                        break;
                    case "T":
                        this.params.length < 2 && !this.prefix && this.scrollDown(this.params);
                        break;
                    case "Z":
                        this.cursorBackwardTab(this.params);
                        break;
                    case "b":
                        this.repeatPrecedingCharacter(this.params);
                        break;
                    case "g":
                        this.tabClear(this.params);
                        break;
                    case "p":
                        switch (this.prefix) {
                        case "!":
                            this.softReset(this.params)
                        }
                        break;
                    default:
                        this.error("Unknown CSI code: %s.", s)
                    }
                    this.prefix = "",
                    this.postfix = "";
                    break;
                case v:
                    if ("" === s || "" === s) {
                        switch ("" === s && o++,
                        this.prefix) {
                        case "":
                            break;
                        case "$q":
                            var c = this.currentParam
                              , l = !1;
                            switch (c) {
                            case '"q':
                                c = '0"q';
                                break;
                            case '"p':
                                c = '61"p';
                                break;
                            case "r":
                                c = "" + (this.scrollTop + 1) + ";" + (this.scrollBottom + 1) + "r";
                                break;
                            case "m":
                                c = "0m";
                                break;
                            default:
                                this.error("Unknown DCS Pt: %s.", c),
                                c = ""
                            }
                            this.send("P" + +l + "$r" + c + "\\");
                            break;
                        case "+p":
                            break;
                        case "+q":
                            var c = this.currentParam
                              , l = !1;
                            this.send("P" + +l + "+r" + c + "\\");
                            break;
                        default:
                            this.error("Unknown DCS prefix: %s.", this.prefix)
                        }
                        this.currentParam = 0,
                        this.prefix = "",
                        this.state = f
                    } else
                        this.currentParam ? this.currentParam += s : this.prefix || "$" === s || "+" === s ? 2 === this.prefix.length ? this.currentParam = s : this.prefix += s : this.currentParam = s;
                    break;
                case b:
                    "" !== s && "" !== s || ("" === s && o++,
                    this.state = f)
                }
            this.updateRange(this.y),
            this.refresh(this.refreshStart, this.refreshEnd)
        }
        ,
        e.prototype.writeln = function(t) {
            this.write(t + "\r\n")
        }
        ,
        e.prototype.keyDown = function(t) {
            var e;
            switch (t.keyCode) {
            case 8:
                if (t.shiftKey) {
                    e = "\b";
                    break
                }
                e = "";
                break;
            case 9:
                if (t.shiftKey) {
                    e = "[Z";
                    break
                }
                e = "	",
                this.cancel(t, !0);
                break;
            case 13:
                e = "\r",
                this.cancel(t, !0);
                break;
            case 27:
                e = "",
                this.cancel(t, !0);
                break;
            case 37:
                if (t.altKey) {
                    this.cancel(t, !0),
                    e = "b";
                    break
                }
                if (this.applicationCursor) {
                    e = "OD";
                    break
                }
                e = "[D";
                break;
            case 39:
                if (t.altKey) {
                    this.cancel(t, !0),
                    e = "f";
                    break
                }
                if (this.applicationCursor) {
                    e = "OC";
                    break
                }
                e = "[C";
                break;
            case 38:
                if (this.applicationCursor) {
                    e = "OA";
                    break
                }
                if (t.ctrlKey)
                    return this.scrollDisp(-1),
                    this.cancel(t);
                e = "[A";
                break;
            case 40:
                if (this.applicationCursor) {
                    e = "OB";
                    break
                }
                if (t.ctrlKey)
                    return this.scrollDisp(1),
                    this.cancel(t);
                e = "[B";
                break;
            case 46:
                e = "[3~";
                break;
            case 45:
                e = "[2~";
                break;
            case 36:
                if (this.applicationKeypad) {
                    e = "OH";
                    break
                }
                e = "OH";
                break;
            case 35:
                if (this.applicationKeypad) {
                    e = "OF";
                    break
                }
                e = "OF";
                break;
            case 33:
                if (t.shiftKey)
                    return this.scrollDisp(-(this.rows - 1)),
                    this.cancel(t);
                e = "[5~";
                break;
            case 34:
                if (t.shiftKey)
                    return this.scrollDisp(this.rows - 1),
                    this.cancel(t);
                e = "[6~";
                break;
            case 112:
                e = "OP";
                break;
            case 113:
                e = "OQ";
                break;
            case 114:
                e = "OR";
                break;
            case 115:
                e = "OS";
                break;
            case 116:
                e = "[15~";
                break;
            case 117:
                e = "[17~";
                break;
            case 118:
                e = "[18~";
                break;
            case 119:
                e = "[19~";
                break;
            case 120:
                e = "[20~";
                break;
            case 121:
                e = "[21~";
                break;
            case 122:
                e = "[23~";
                break;
            case 123:
                e = "[24~";
                break;
            default:
                !t.ctrlKey || t.shiftKey || t.altKey || t.metaKey ? (!this.isMac && t.altKey || this.isMac && t.metaKey) && (t.keyCode >= 65 && t.keyCode <= 90 ? e = "" + g.fromCharCode(t.keyCode + 32) : 192 === t.keyCode ? e = "`" : t.keyCode >= 48 && t.keyCode <= 57 && (e = "" + (t.keyCode - 48))) : t.keyCode >= 65 && t.keyCode <= 90 ? e = g.fromCharCode(t.keyCode - 64) : 32 === t.keyCode ? e = g.fromCharCode(0) : t.keyCode >= 51 && t.keyCode <= 55 ? e = g.fromCharCode(t.keyCode - 51 + 27) : 56 === t.keyCode ? e = g.fromCharCode(127) : 219 === t.keyCode ? e = g.fromCharCode(27) : 221 === t.keyCode && (e = g.fromCharCode(29))
            }
            return !e || this.isMac && t.metaKey ? !0 : (this.emit("keydown", t),
            this.emit("key", e, t),
            this.showCursor(),
            this.handler(e),
            this.cancel(t))
        }
        ,
        e.prototype.setgLevel = function(t) {
            this.glevel = t,
            this.charset = this.charsets[t]
        }
        ,
        e.prototype.setgCharset = function(t, e) {
            this.charsets[t] = e,
            this.glevel === t && (this.charset = e)
        }
        ,
        e.prototype.keyPress = function(t) {
            var e;
            if (this.cancel(t),
            t.charCode)
                e = t.charCode;
            else if (null == t.which)
                e = t.keyCode;
            else {
                if (0 === t.which || 0 === t.charCode)
                    return !1;
                e = t.which
            }
            return !e || t.ctrlKey || t.altKey || t.metaKey ? !1 : (e = g.fromCharCode(e),
            this.emit("keypress", e, t),
            this.emit("key", e, t),
            this.showCursor(),
            this.handler(e),
            !1)
        }
        ,
        e.prototype.send = function(t) {
            var e = this;
            this.queue || _(function() {
                e.handler(e.queue),
                e.queue = ""
            }, 1),
            this.queue += t
        }
        ,
        e.prototype.bell = function() {
            if (this.visualBell) {
                var t = this;
                this.element.style.borderColor = "white",
                _(function() {
                    t.element.style.borderColor = ""
                }, 10),
                this.popOnBell && this.focus()
            }
        }
        ,
        e.prototype.log = function() {
            if (this.debug && this.context.console && this.context.console.log) {
                var t = Array.prototype.slice.call(arguments);
                this.context.console.log.apply(this.context.console, t)
            }
        }
        ,
        e.prototype.error = function() {
            if (this.debug && this.context.console && this.context.console.error) {
                var t = Array.prototype.slice.call(arguments);
                this.context.console.error.apply(this.context.console, t)
            }
        }
        ,
        e.prototype.resize = function(t, e) {
            var n, r, s, i;
            if (1 > t && (t = 1),
            1 > e && (e = 1),
            s = this.cols,
            t > s)
                for (i = [this.defAttr, " "],
                r = this.lines.length; r--; )
                    for (; this.lines[r].length < t; )
                        this.lines[r].push(i);
            else if (s > t)
                for (r = this.lines.length; r--; )
                    for (; this.lines[r].length > t; )
                        this.lines[r].pop();
            if (this.setupStops(s),
            this.cols = t,
            s = this.rows,
            e > s)
                for (n = this.element; s++ < e; )
                    this.lines.length < e + this.ybase && this.lines.push(this.blankLine()),
                    this.children.length < e && this.insertRow();
            else if (s > e)
                for (; s-- > e; )
                    if (this.lines.length > e + this.ybase && this.lines.shift(),
                    this.children.length > e) {
                        if (n = this.children.shift(),
                        !n)
                            continue;
                        n.parentNode.removeChild(n)
                    }
            this.rows = e,
            this.y >= e && (this.y = e - 1),
            this.x >= t && (this.x = t - 1),
            this.scrollTop = 0,
            this.scrollBottom = e - 1,
            this.refresh(0, this.rows - 1),
            this.normal = null,
            this.emit("resize", {
                terminal: this,
                cols: t,
                rows: e
            })
        }
        ,
        e.prototype.updateRange = function(t) {
            t < this.refreshStart && (this.refreshStart = t),
            t > this.refreshEnd && (this.refreshEnd = t)
        }
        ,
        e.prototype.maxRange = function() {
            this.refreshStart = 0,
            this.refreshEnd = this.rows - 1
        }
        ,
        e.prototype.setupStops = function(t) {
            for (null != t ? this.tabs[t] || (t = this.prevStop(t)) : (this.tabs = {},
            t = 0); t < this.cols; t += 8)
                this.tabs[t] = !0
        }
        ,
        e.prototype.prevStop = function(t) {
            for (null == t && (t = this.x); !this.tabs[--t] && t > 0; )
                ;
            return t >= this.cols ? this.cols - 1 : 0 > t ? 0 : t
        }
        ,
        e.prototype.nextStop = function(t) {
            for (null == t && (t = this.x); !this.tabs[++t] && t < this.cols; )
                ;
            return t >= this.cols ? this.cols - 1 : 0 > t ? 0 : t
        }
        ,
        e.prototype.eraseRight = function(t, e) {
            for (var n = this.lines[this.ybase + e], r = [this.eraseAttr(), " "]; t < this.cols; t++)
                n[t] = r;
            this.updateRange(e)
        }
        ,
        e.prototype.eraseLeft = function(t, e) {
            var n = this.lines[this.ybase + e]
              , r = [this.eraseAttr(), " "];
            for (t++; t--; )
                n[t] = r;
            this.updateRange(e)
        }
        ,
        e.prototype.eraseLine = function(t) {
            this.eraseRight(0, t)
        }
        ,
        e.prototype.blankLine = function(t) {
            for (var e = t ? this.eraseAttr() : this.defAttr, n = [e, " "], r = [], s = 0; s < this.cols; s++)
                r[s] = n;
            return r
        }
        ,
        e.prototype.ch = function(t) {
            return t ? [this.eraseAttr(), " "] : [this.defAttr, " "]
        }
        ,
        e.prototype.is = function(t) {
            var e = this.termName;
            return 0 === (e + "").indexOf(t)
        }
        ,
        e.prototype.handler = function(t) {
            this.emit("data", t)
        }
        ,
        e.prototype.handleTitle = function(t) {
            this.emit("title", t)
        }
        ,
        e.prototype.index = function() {
            this.y++,
            this.y > this.scrollBottom && (this.y--,
            this.scroll()),
            this.state = f
        }
        ,
        e.prototype.reverseIndex = function() {
            var t;
            this.y--,
            this.y < this.scrollTop && (this.y++,
            this.lines.splice(this.y + this.ybase, 0, this.blankLine(!0)),
            t = this.rows - 1 - this.scrollBottom,
            this.lines.splice(this.rows - 1 + this.ybase - t + 1, 1),
            this.updateRange(this.scrollTop),
            this.updateRange(this.scrollBottom)),
            this.state = f
        }
        ,
        e.prototype.reset = function() {
            this.options.rows = this.rows,
            this.options.cols = this.cols,
            e.call(this, this.options),
            this.refresh(0, this.rows - 1)
        }
        ,
        e.prototype.tabSet = function() {
            this.tabs[this.x] = !0,
            this.state = f
        }
        ,
        e.prototype.cursorUp = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y -= e,
            this.y < 0 && (this.y = 0)
        }
        ,
        e.prototype.cursorDown = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y += e,
            this.y >= this.rows && (this.y = this.rows - 1)
        }
        ,
        e.prototype.cursorForward = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.x += e,
            this.x >= this.cols && (this.x = this.cols - 1)
        }
        ,
        e.prototype.cursorBackward = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.x -= e,
            this.x < 0 && (this.x = 0)
        }
        ,
        e.prototype.cursorPos = function(t) {
            var e, n;
            e = t[0] - 1,
            n = t.length >= 2 ? t[1] - 1 : 0,
            0 > e ? e = 0 : e >= this.rows && (e = this.rows - 1),
            0 > n ? n = 0 : n >= this.cols && (n = this.cols - 1),
            this.x = n,
            this.y = e
        }
        ,
        e.prototype.eraseInDisplay = function(t) {
            var e;
            switch (t[0]) {
            case 0:
                for (this.eraseRight(this.x, this.y),
                e = this.y + 1; e < this.rows; e++)
                    this.eraseLine(e);
                break;
            case 1:
                for (this.eraseLeft(this.x, this.y),
                e = this.y; e--; )
                    this.eraseLine(e);
                break;
            case 2:
                for (e = this.rows; e--; )
                    this.eraseLine(e);
                break;
            case 3:
            }
        }
        ,
        e.prototype.eraseInLine = function(t) {
            switch (t[0]) {
            case 0:
                this.eraseRight(this.x, this.y);
                break;
            case 1:
                this.eraseLeft(this.x, this.y);
                break;
            case 2:
                this.eraseLine(this.y)
            }
        }
        ,
        e.prototype.charAttributes = function(t) {
            if (1 === t.length && 0 === t[0])
                return void (this.curAttr = this.defAttr);
            for (var e, n = t.length, r = 0, s = this.curAttr >> 18, i = this.curAttr >> 9 & 511, o = 511 & this.curAttr; n > r; r++)
                e = t[r],
                e >= 30 && 37 >= e ? i = e - 30 : e >= 40 && 47 >= e ? o = e - 40 : e >= 90 && 97 >= e ? (e += 8,
                i = e - 90) : e >= 100 && 107 >= e ? (e += 8,
                o = e - 100) : 0 === e ? (s = this.defAttr >> 18,
                i = this.defAttr >> 9 & 511,
                o = 511 & this.defAttr) : 1 === e ? s |= 1 : 4 === e ? s |= 2 : 5 === e ? s |= 4 : 7 === e ? s |= 8 : 8 === e ? s |= 16 : 22 === e ? s &= -2 : 24 === e ? s &= -3 : 25 === e ? s &= -5 : 27 === e ? s &= -9 : 28 === e ? s &= -17 : 39 === e ? i = this.defAttr >> 9 & 511 : 49 === e ? o = 511 & this.defAttr : 38 === e ? 2 === t[r + 1] ? (r += 2,
                i = c(255 & t[r], 255 & t[r + 1], 255 & t[r + 2]),
                -1 === i && (i = 511),
                r += 2) : 5 === t[r + 1] && (r += 2,
                e = 255 & t[r],
                i = e) : 48 === e ? 2 === t[r + 1] ? (r += 2,
                o = c(255 & t[r], 255 & t[r + 1], 255 & t[r + 2]),
                -1 === o && (o = 511),
                r += 2) : 5 === t[r + 1] && (r += 2,
                e = 255 & t[r],
                o = e) : 100 === e ? (i = this.defAttr >> 9 & 511,
                o = 511 & this.defAttr) : this.error("Unknown SGR attribute: %d.", e);
            this.curAttr = s << 18 | i << 9 | o
        }
        ,
        e.prototype.deviceStatus = function(t) {
            if (this.prefix) {
                if ("?" === this.prefix)
                    switch (t[0]) {
                    case 6:
                        this.send("[?" + (this.y + 1) + ";" + (this.x + 1) + "R");
                        break;
                    case 15:
                        break;
                    case 25:
                        break;
                    case 26:
                        break;
                    case 53:
                    }
            } else
                switch (t[0]) {
                case 5:
                    this.send("[0n");
                    break;
                case 6:
                    this.send("[" + (this.y + 1) + ";" + (this.x + 1) + "R")
                }
        }
        ,
        e.prototype.insertChars = function(t) {
            var e, n, r, s;
            for (e = t[0],
            1 > e && (e = 1),
            n = this.y + this.ybase,
            r = this.x,
            s = [this.eraseAttr(), " "]; e-- && r < this.cols; )
                this.lines[n].splice(r++, 0, s),
                this.lines[n].pop()
        }
        ,
        e.prototype.cursorNextLine = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y += e,
            this.y >= this.rows && (this.y = this.rows - 1),
            this.x = 0
        }
        ,
        e.prototype.cursorPrecedingLine = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y -= e,
            this.y < 0 && (this.y = 0),
            this.x = 0
        }
        ,
        e.prototype.cursorCharAbsolute = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.x = e - 1
        }
        ,
        e.prototype.insertLines = function(t) {
            var e, n, r;
            for (e = t[0],
            1 > e && (e = 1),
            n = this.y + this.ybase,
            r = this.rows - 1 - this.scrollBottom,
            r = this.rows - 1 + this.ybase - r + 1; e--; )
                this.lines.splice(n, 0, this.blankLine(!0)),
                this.lines.splice(r, 1);
            this.updateRange(this.y),
            this.updateRange(this.scrollBottom)
        }
        ,
        e.prototype.deleteLines = function(t) {
            var e, n, r;
            for (e = t[0],
            1 > e && (e = 1),
            n = this.y + this.ybase,
            r = this.rows - 1 - this.scrollBottom,
            r = this.rows - 1 + this.ybase - r; e--; )
                this.lines.splice(r + 1, 0, this.blankLine(!0)),
                this.lines.splice(n, 1);
            this.updateRange(this.y),
            this.updateRange(this.scrollBottom)
        }
        ,
        e.prototype.deleteChars = function(t) {
            var e, n, r;
            for (e = t[0],
            1 > e && (e = 1),
            n = this.y + this.ybase,
            r = [this.eraseAttr(), " "]; e--; )
                this.lines[n].splice(this.x, 1),
                this.lines[n].push(r)
        }
        ,
        e.prototype.eraseChars = function(t) {
            var e, n, r, s;
            for (e = t[0],
            1 > e && (e = 1),
            n = this.y + this.ybase,
            r = this.x,
            s = [this.eraseAttr(), " "]; e-- && r < this.cols; )
                this.lines[n][r++] = s
        }
        ,
        e.prototype.charPosAbsolute = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.x = e - 1,
            this.x >= this.cols && (this.x = this.cols - 1)
        }
        ,
        e.prototype.HPositionRelative = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.x += e,
            this.x >= this.cols && (this.x = this.cols - 1)
        }
        ,
        e.prototype.sendDeviceAttributes = function(t) {
            t[0] > 0 || (this.prefix ? ">" === this.prefix && (this.is("xterm") ? this.send("[>0;276;0c") : this.is("rxvt-unicode") ? this.send("[>85;95;0c") : this.is("linux") ? this.send(t[0] + "c") : this.is("screen") && this.send("[>83;40003;0c")) : this.is("xterm") || this.is("rxvt-unicode") || this.is("screen") ? this.send("[?1;2c") : this.is("linux") && this.send("[?6c"))
        }
        ,
        e.prototype.linePosAbsolute = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y = e - 1,
            this.y >= this.rows && (this.y = this.rows - 1)
        }
        ,
        e.prototype.VPositionRelative = function(t) {
            var e = t[0];
            1 > e && (e = 1),
            this.y += e,
            this.y >= this.rows && (this.y = this.rows - 1)
        }
        ,
        e.prototype.HVPosition = function(t) {
            t[0] < 1 && (t[0] = 1),
            t[1] < 1 && (t[1] = 1),
            this.y = t[0] - 1,
            this.y >= this.rows && (this.y = this.rows - 1),
            this.x = t[1] - 1,
            this.x >= this.cols && (this.x = this.cols - 1)
        }
        ,
        e.prototype.setMode = function(t) {
            if ("object" != typeof t)
                if (this.prefix) {
                    if ("?" === this.prefix)
                        switch (t) {
                        case 1:
                            this.applicationCursor = !0;
                            break;
                        case 2:
                            this.setgCharset(0, e.charsets.US),
                            this.setgCharset(1, e.charsets.US),
                            this.setgCharset(2, e.charsets.US),
                            this.setgCharset(3, e.charsets.US);
                            break;
                        case 3:
                            this.savedCols = this.cols,
                            this.resize(132, this.rows);
                            break;
                        case 6:
                            this.originMode = !0;
                            break;
                        case 7:
                            this.wraparoundMode = !0;
                            break;
                        case 12:
                            break;
                        case 66:
                            this.log("Serial port requested application keypad."),
                            this.applicationKeypad = !0;
                            break;
                        case 9:
                        case 1e3:
                        case 1002:
                        case 1003:
                            this.x10Mouse = 9 === t,
                            this.vt200Mouse = 1e3 === t,
                            this.normalMouse = t > 1e3,
                            this.mouseEvents = !0,
                            this.element.style.cursor = "default",
                            this.log("Binding to mouse events.");
                            break;
                        case 1004:
                            this.sendFocus = !0;
                            break;
                        case 1005:
                            this.utfMouse = !0;
                            break;
                        case 1006:
                            this.sgrMouse = !0;
                            break;
                        case 1015:
                            this.urxvtMouse = !0;
                            break;
                        case 25:
                            this.cursorHidden = !1;
                            break;
                        case 1049:
                        case 47:
                        case 1047:
                            if (!this.normal) {
                                var n = {
                                    lines: this.lines,
                                    ybase: this.ybase,
                                    ydisp: this.ydisp,
                                    x: this.x,
                                    y: this.y,
                                    scrollTop: this.scrollTop,
                                    scrollBottom: this.scrollBottom,
                                    tabs: this.tabs
                                };
                                this.reset(),
                                this.normal = n,
                                this.showCursor()
                            }
                        }
                } else
                    switch (t) {
                    case 4:
                        this.insertMode = !0;
                        break;
                    case 20:
                    }
            else
                for (var r = t.length, s = 0; r > s; s++)
                    this.setMode(t[s])
        }
        ,
        e.prototype.resetMode = function(t) {
            if ("object" != typeof t)
                if (this.prefix) {
                    if ("?" === this.prefix)
                        switch (t) {
                        case 1:
                            this.applicationCursor = !1;
                            break;
                        case 3:
                            132 === this.cols && this.savedCols && this.resize(this.savedCols, this.rows),
                            delete this.savedCols;
                            break;
                        case 6:
                            this.originMode = !1;
                            break;
                        case 7:
                            this.wraparoundMode = !1;
                            break;
                        case 12:
                            break;
                        case 66:
                            this.log("Switching back to normal keypad."),
                            this.applicationKeypad = !1;
                            break;
                        case 9:
                        case 1e3:
                        case 1002:
                        case 1003:
                            this.x10Mouse = !1,
                            this.vt200Mouse = !1,
                            this.normalMouse = !1,
                            this.mouseEvents = !1,
                            this.element.style.cursor = "";
                            break;
                        case 1004:
                            this.sendFocus = !1;
                            break;
                        case 1005:
                            this.utfMouse = !1;
                            break;
                        case 1006:
                            this.sgrMouse = !1;
                            break;
                        case 1015:
                            this.urxvtMouse = !1;
                            break;
                        case 25:
                            this.cursorHidden = !0;
                            break;
                        case 1049:
                        case 47:
                        case 1047:
                            this.normal && (this.lines = this.normal.lines,
                            this.ybase = this.normal.ybase,
                            this.ydisp = this.normal.ydisp,
                            this.x = this.normal.x,
                            this.y = this.normal.y,
                            this.scrollTop = this.normal.scrollTop,
                            this.scrollBottom = this.normal.scrollBottom,
                            this.tabs = this.normal.tabs,
                            this.normal = null,
                            this.refresh(0, this.rows - 1),
                            this.showCursor())
                        }
                } else
                    switch (t) {
                    case 4:
                        this.insertMode = !1;
                        break;
                    case 20:
                    }
            else
                for (var e = t.length, n = 0; e > n; n++)
                    this.resetMode(t[n])
        }
        ,
        e.prototype.setScrollRegion = function(t) {
            this.prefix || (this.scrollTop = (t[0] || 1) - 1,
            this.scrollBottom = (t[1] || this.rows) - 1,
            this.x = 0,
            this.y = 0)
        }
        ,
        e.prototype.saveCursor = function(t) {
            this.savedX = this.x,
            this.savedY = this.y
        }
        ,
        e.prototype.restoreCursor = function(t) {
            this.x = this.savedX || 0,
            this.y = this.savedY || 0
        }
        ,
        e.prototype.cursorForwardTab = function(t) {
            for (var e = t[0] || 1; e--; )
                this.x = this.nextStop()
        }
        ,
        e.prototype.scrollUp = function(t) {
            for (var e = t[0] || 1; e--; )
                this.lines.splice(this.ybase + this.scrollTop, 1),
                this.lines.splice(this.ybase + this.scrollBottom, 0, this.blankLine());
            this.updateRange(this.scrollTop),
            this.updateRange(this.scrollBottom)
        }
        ,
        e.prototype.scrollDown = function(t) {
            for (var e = t[0] || 1; e--; )
                this.lines.splice(this.ybase + this.scrollBottom, 1),
                this.lines.splice(this.ybase + this.scrollTop, 0, this.blankLine());
            this.updateRange(this.scrollTop),
            this.updateRange(this.scrollBottom)
        }
        ,
        e.prototype.initMouseTracking = function(t) {}
        ,
        e.prototype.resetTitleModes = function(t) {}
        ,
        e.prototype.cursorBackwardTab = function(t) {
            for (var e = t[0] || 1; e--; )
                this.x = this.prevStop()
        }
        ,
        e.prototype.repeatPrecedingCharacter = function(t) {
            for (var e = t[0] || 1, n = this.lines[this.ybase + this.y], r = n[this.x - 1] || [this.defAttr, " "]; e--; )
                n[this.x++] = r
        }
        ,
        e.prototype.tabClear = function(t) {
            var e = t[0];
            0 >= e ? delete this.tabs[this.x] : 3 === e && (this.tabs = {})
        }
        ,
        e.prototype.mediaCopy = function(t) {}
        ,
        e.prototype.setResources = function(t) {}
        ,
        e.prototype.disableModifiers = function(t) {}
        ,
        e.prototype.setPointerMode = function(t) {}
        ,
        e.prototype.softReset = function(t) {
            this.cursorHidden = !1,
            this.insertMode = !1,
            this.originMode = !1,
            this.wraparoundMode = !1,
            this.applicationKeypad = !1,
            this.applicationCursor = !1,
            this.scrollTop = 0,
            this.scrollBottom = this.rows - 1,
            this.curAttr = this.defAttr,
            this.x = this.y = 0,
            this.charset = null,
            this.glevel = 0,
            this.charsets = [null]
        }
        ,
        e.prototype.requestAnsiMode = function(t) {}
        ,
        e.prototype.requestPrivateMode = function(t) {}
        ,
        e.prototype.setConformanceLevel = function(t) {}
        ,
        e.prototype.loadLEDs = function(t) {}
        ,
        e.prototype.setCursorStyle = function(t) {}
        ,
        e.prototype.setCharProtectionAttr = function(t) {}
        ,
        e.prototype.restorePrivateValues = function(t) {}
        ,
        e.prototype.setAttrInRectangle = function(t) {
            for (var e, n, r = t[0], s = t[1], i = t[2], o = t[3], a = t[4]; i + 1 > r; r++)
                for (e = this.lines[this.ybase + r],
                n = s; o > n; n++)
                    e[n] = [a, e[n][1]];
            this.updateRange(t[0]),
            this.updateRange(t[2])
        }
        ,
        e.prototype.fillRectangle = function(t) {
            for (var e, n, r = t[0], s = t[1], i = t[2], o = t[3], a = t[4]; o + 1 > s; s++)
                for (e = this.lines[this.ybase + s],
                n = i; a > n; n++)
                    e[n] = [e[n][0], g.fromCharCode(r)];
            this.updateRange(t[1]),
            this.updateRange(t[3])
        }
        ,
        e.prototype.enableLocatorReporting = function(t) {
            t[0] > 0
        }
        ,
        e.prototype.eraseRectangle = function(t) {
            var e, n, r, s = t[0], i = t[1], o = t[2], a = t[3];
            for (r = [this.eraseAttr(), " "]; o + 1 > s; s++)
                for (e = this.lines[this.ybase + s],
                n = i; a > n; n++)
                    e[n] = r;
            this.updateRange(t[0]),
            this.updateRange(t[2])
        }
        ,
        e.prototype.insertColumns = function() {
            for (var t, e = params[0], n = this.ybase + this.rows, r = [this.eraseAttr(), " "]; e--; )
                for (t = this.ybase; n > t; t++)
                    this.lines[t].splice(this.x + 1, 0, r),
                    this.lines[t].pop();
            this.maxRange()
        }
        ,
        e.prototype.deleteColumns = function() {
            for (var t, e = params[0], n = this.ybase + this.rows, r = [this.eraseAttr(), " "]; e--; )
                for (t = this.ybase; n > t; t++)
                    this.lines[t].splice(this.x, 1),
                    this.lines[t].push(r);
            this.maxRange()
        }
        ,
        e.prototype.copyBuffer = function(t) {
            for (var t = t || this.lines, e = [], n = 0; n < t.length; n++) {
                e[n] = [];
                for (var r = 0; r < t[n].length; r++)
                    e[n][r] = [t[n][r][0], t[n][r][1]]
            }
            return e
        }
        ,
        e.prototype.getCopyTextarea = function(t) {
            var e = this._copyTextarea
              , n = this.document;
            return e || (e = n.createElement("textarea"),
            e.style.position = "absolute",
            e.style.left = "-32000px",
            e.style.top = "-32000px",
            e.style.width = "0px",
            e.style.height = "0px",
            e.style.opacity = "0",
            e.style.backgroundColor = "transparent",
            e.style.borderStyle = "none",
            e.style.outlineStyle = "none",
            n.getElementsByTagName("body")[0].appendChild(e),
            this._copyTextarea = e),
            e
        }
        ,
        e.prototype.copyText = function(t) {
            var e = this
              , n = this.getCopyTextarea();
            this.emit("copy", t),
            n.focus(),
            n.textContent = t,
            n.value = t,
            n.setSelectionRange(0, t.length),
            _(function() {
                e.element.focus(),
                e.focus()
            }, 1)
        }
        ,
        e.prototype.keyPrefix = function(t, e) {
            "k" === e || "&" === e ? this.destroy() : "p" === e || "]" === e ? this.emit("request paste") : "c" === e ? this.emit("request create") : e >= "0" && "9" >= e ? (e = +e - 1,
            ~e || (e = 9),
            this.emit("request term", e)) : "n" === e ? this.emit("request term next") : "P" === e ? this.emit("request term previous") : ":" === e && this.emit("request command mode")
        }
        ,
        e.prototype.keySelect = function(t, e) {
            if (this.showCursor(),
            "" === e) {
                var n = this.ydisp + this.y;
                return void (this.ydisp === this.ybase ? (this.y = Math.min(this.y + (this.rows - 1) / 2 | 0, this.rows - 1),
                this.refresh(0, this.rows - 1)) : this.scrollDisp((this.rows - 1) / 2 | 0))
            }
            if ("" === e) {
                var n = this.ydisp + this.y;
                return void (0 === this.ydisp ? (this.y = Math.max(this.y - (this.rows - 1) / 2 | 0, 0),
                this.refresh(0, this.rows - 1)) : this.scrollDisp(-(this.rows - 1) / 2 | 0))
            }
            if ("" === e) {
                var n = this.ydisp + this.y;
                return void this.scrollDisp(this.rows - 1)
            }
            if ("" === e) {
                var n = this.ydisp + this.y;
                return void this.scrollDisp(-(this.rows - 1))
            }
            if ("k" === e || "[A" === e) {
                var n = this.ydisp + this.y;
                return this.y--,
                this.y < 0 && (this.y = 0,
                this.scrollDisp(-1)),
                void this.refresh(this.y, this.y + 1)
            }
            if ("j" === e || "[B" === e) {
                var n = this.ydisp + this.y;
                return this.y++,
                this.y >= this.rows && (this.y = this.rows - 1,
                this.scrollDisp(1)),
                void this.refresh(this.y - 1, this.y)
            }
            if ("h" === e || "[D" === e) {
                var r = this.x;
                return this.x--,
                this.x < 0 && (this.x = 0),
                void this.refresh(this.y, this.y)
            }
            if ("l" === e || "[C" === e) {
                var r = this.x;
                return this.x++,
                this.x >= this.cols && (this.x = this.cols - 1),
                void this.refresh(this.y, this.y)
            }
            if ("w" === e || "W" === e) {
                for (var s = (this.x,
                this.y), r = (this.ydisp,
                this.x), n = this.y, i = this.ydisp, o = !1; ; ) {
                    for (var a = this.lines[i + n]; r < this.cols; ) {
                        if (a[r][1] <= " ")
                            o = !0;
                        else if (o)
                            break;
                        r++
                    }
                    if (r >= this.cols && (r = this.cols - 1),
                    !(r === this.cols - 1 && a[r][1] <= " "))
                        break;
                    if (r = 0,
                    ++n >= this.rows && (n--,
                    ++i > this.ybase)) {
                        i = this.ybase,
                        r = this.x;
                        break
                    }
                }
                return this.x = r,
                this.y = n,
                void this.scrollDisp(-this.ydisp + i)
            }
            if ("b" === e || "B" === e) {
                for (var s = (this.x,
                this.y), r = (this.ydisp,
                this.x), n = this.y, i = this.ydisp; ; ) {
                    for (var a = this.lines[i + n], o = r > 0 && a[r][1] > " " && a[r - 1][1] > " "; r >= 0; ) {
                        if (a[r][1] <= " ") {
                            if (o && r + 1 < this.cols && a[r + 1][1] > " ") {
                                r++;
                                break
                            }
                            o = !0
                        }
                        r--
                    }
                    if (0 > r && (r = 0),
                    0 !== r || !(a[r][1] <= " ") && o)
                        break;
                    if (r = this.cols - 1,
                    --n < 0 && (n++,
                    --i < 0)) {
                        i++,
                        r = 0;
                        break
                    }
                }
                return this.x = r,
                this.y = n,
                void this.scrollDisp(-this.ydisp + i)
            }
            if ("e" === e || "E" === e) {
                var r = this.x + 1
                  , n = this.y
                  , i = this.ydisp;
                for (r >= this.cols && r--; ; ) {
                    for (var a = this.lines[i + n]; r < this.cols && a[r][1] <= " "; )
                        r++;
                    for (; r < this.cols; ) {
                        if (a[r][1] <= " " && r - 1 >= 0 && a[r - 1][1] > " ") {
                            r--;
                            break
                        }
                        r++
                    }
                    if (r >= this.cols && (r = this.cols - 1),
                    !(r === this.cols - 1 && a[r][1] <= " "))
                        break;
                    if (r = 0,
                    ++n >= this.rows && (n--,
                    ++i > this.ybase)) {
                        i = this.ybase;
                        break
                    }
                }
                return this.x = r,
                this.y = n,
                void this.scrollDisp(-this.ydisp + i)
            }
            if ("^" === e || "0" === e) {
                this.x;
                if ("0" === e)
                    this.x = 0;
                else if ("^" === e) {
                    for (var a = this.lines[this.ydisp + this.y], r = 0; r < this.cols && !(a[r][1] > " "); )
                        r++;
                    r >= this.cols && (r = this.cols - 1),
                    this.x = r
                }
                return void this.refresh(this.y, this.y)
            }
            if ("$" === e) {
                for (var a = (this.x,
                this.lines[this.ydisp + this.y]), r = this.cols - 1; r >= 0; )
                    r--;
                return 0 > r && (r = 0),
                this.x = r,
                void this.refresh(this.y, this.y)
            }
            if ("g" === e || "G" === e) {
                var s = (this.x,
                this.y);
                this.ydisp;
                return void ("g" === e ? (this.x = 0,
                this.y = 0,
                this.scrollDisp(-this.ydisp)) : "G" === e && (this.x = 0,
                this.y = this.rows - 1,
                this.scrollDisp(this.ybase)))
            }
            if ("H" === e || "M" === e || "L" === e) {
                var s = (this.x,
                this.y);
                return "H" === e ? (this.x = 0,
                this.y = 0) : "M" === e ? (this.x = 0,
                this.y = this.rows / 2 | 0) : "L" === e && (this.x = 0,
                this.y = this.rows - 1),
                this.refresh(s, s),
                void this.refresh(this.y, this.y)
            }
            if ("{" === e || "}" === e) {
                var a, c, s = (this.x,
                this.y), l = (this.ydisp,
                !1), u = !1, h = -1, n = this.y + ("{" === e ? -1 : 1), i = this.ydisp;
                for ("{" === e ? 0 > n && (n++,
                i > 0 && i--) : "}" === e && n >= this.rows && (n--,
                i < this.ybase && i++); ; ) {
                    for (a = this.lines[i + n],
                    c = 0; c < this.cols; c++) {
                        if (a[c][1] > " ") {
                            -1 === h && (h = 0),
                            l = !0;
                            break
                        }
                        if (c === this.cols - 1) {
                            -1 === h ? h = 1 : 0 === h ? u = !0 : 1 === h && l && (u = !0);
                            break
                        }
                    }
                    if (u)
                        break;
                    if ("{" === e) {
                        if (n--,
                        0 > n) {
                            if (n++,
                            !(i > 0))
                                break;
                            i--
                        }
                    } else if ("}" === e && (n++,
                    n >= this.rows)) {
                        if (n--,
                        !(i < this.ybase))
                            break;
                        i++
                    }
                }
                return u || ("{" === e ? (n = 0,
                i = 0) : "}" === e && (n = this.rows - 1,
                i = this.ybase)),
                this.x = 0,
                this.y = n,
                void this.scrollDisp(-this.ydisp + i)
            }
            return !1
        }
        ,
        e.charsets = {},
        e.charsets.SCLD = {
            "`": "◆",
            a: "▒",
            b: "	",
            c: "\f",
            d: "\r",
            e: "\n",
            f: "°",
            g: "±",
            h: "␤",
            i: "\x0B",
            j: "┘",
            k: "┐",
            l: "┌",
            m: "└",
            n: "┼",
            o: "⎺",
            p: "⎻",
            q: "─",
            r: "⎼",
            s: "⎽",
            t: "├",
            u: "┤",
            v: "┴",
            w: "┬",
            x: "│",
            y: "≤",
            z: "≥",
            "{": "π",
            "|": "≠",
            "}": "£",
            "~": "·"
        },
        e.charsets.UK = null,
        e.charsets.US = null,
        e.charsets.Dutch = null,
        e.charsets.Finnish = null,
        e.charsets.French = null,
        e.charsets.FrenchCanadian = null,
        e.charsets.German = null,
        e.charsets.Italian = null,
        e.charsets.NorwegianDanish = null,
        e.charsets.Spanish = null,
        e.charsets.Swedish = null,
        e.charsets.Swiss = null,
        e.charsets.ISOLatin = null;
        var g = this.String
          , _ = this.setTimeout
          , k = this.setInterval;
        return c._cache = {},
        c.distance = function(t, e, n, r, s, i) {
            return Math.pow(30 * (t - r), 2) + Math.pow(59 * (e - s), 2) + Math.pow(11 * (n - i), 2)
        }
        ,
        e.EventEmitter = t,
        e.inherits = i,
        e.on = n,
        e.off = r,
        e.cancel = s,
        e
    })
}
, function(t, e, n) {
    "use strict";
    function r(t) {
        return void 0 === t && (t = {}),
        c.extend(t, a.VM.JVM.getDefaultOptions("/home"), {
            classpath: []
        })
    }
    var s = this && this.__extends || function(t, e) {
        function n() {
            this.constructor = t
        }
        for (var r in e)
            e.hasOwnProperty(r) && (t[r] = e[r]);
        t.prototype = null === e ? Object.create(e) : (n.prototype = e.prototype,
        new n)
    }
      , i = n(8)
      , o = n(1)
      , a = n(9)
      , c = n(3)
      , l = o.BFSRequire("path")
      , u = function(t) {
        function e() {
            t.apply(this, arguments),
            this._jvm = null,
            this._killed = !1
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "java"
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            return function(t, e) {
                if (e)
                    return !0;
                var n = t.lastIndexOf(".")
                  , r = -1 === n ? "" : t.slice(n + 1);
                return "class" === r || "jar" === r
            }
        }
        ,
        e.prototype.translateFileToArg = function(t) {
            var e = l.extname(t);
            return ".class" == e ? t.slice(0, t.lastIndexOf(".")).replace(/\//g, ".") : t
        }
        ,
        e.prototype.run = function(t, e, n) {
            var s = this;
            a.VM.CLI(e, r({
                launcherName: this.getCommand()
            }), function() {
                s._jvm = null,
                s._killed = !1,
                n()
            }, function(t) {
                s._jvm = t,
                s._killed && s._jvm.halt(0)
            })
        }
        ,
        e.prototype.kill = function() {
            this._killed || (this._killed = !0,
            this._jvm && this._jvm.halt(0))
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.JavaCommand = u;
    var h = function(t) {
        function e(e, n, r, s) {
            void 0 === r && (r = []),
            void 0 === s && (s = []),
            t.call(this),
            this._cmd = e,
            this._jarPath = n,
            this._extraArgs = r,
            this._validExts = s
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return this._cmd
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            var t = this;
            return function(e, n) {
                if (n)
                    return !0;
                for (var r = e.lastIndexOf("."), s = -1 === r ? "" : e.slice(r + 1), i = 0; i < t._validExts.length; i++)
                    if (s === t._validExts[i])
                        return !0;
                return !1
            }
        }
        ,
        e.prototype.run = function(e, n, r) {
            e.stdout("Please be patient; this command may need to download resources from the network.\n");
            var s = ["-jar", this._jarPath].concat(this._extraArgs, n);
            t.prototype.run.call(this, e, s, r)
        }
        ,
        e
    }(u);
    e.JARCommand = h;
    var f = function(t) {
        function e(e, n, r, s, i, o) {
            void 0 === s && (s = []),
            void 0 === i && (i = []),
            void 0 === o && (o = []),
            t.call(this),
            this._cmd = e,
            this._classpath = n,
            this._className = r,
            this._extraProgArgs = i,
            this._extraJvmArgs = s,
            this._validExts = o
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return this._cmd
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            var t = this;
            return function(e, n) {
                if (n)
                    return !0;
                for (var r = e.lastIndexOf("."), s = -1 === r ? "" : e.slice(r + 1), i = 0; i < t._validExts.length; i++)
                    if (s === t._validExts[i])
                        return !0;
                return !1
            }
        }
        ,
        e.prototype.run = function(e, n, r) {
            e.stdout("Please be patient; this command may need to download resources from the network.\n");
            var s = [].concat(this._extraJvmArgs, ["-cp", ".:" + this._classpath, this._className], this._extraProgArgs, n);
            t.prototype.run.call(this, e, s, r)
        }
        ,
        e
    }(u);
    e.JavaClassCommand = f
}
, function(t, e) {
    "use strict";
    var n = this && this.__extends || function(t, e) {
        function n() {
            this.constructor = t
        }
        for (var r in e)
            e.hasOwnProperty(r) && (t[r] = e[r]);
        t.prototype = null === e ? Object.create(e) : (n.prototype = e.prototype,
        new n)
    }
      , r = function() {
        function t() {}
        return t.prototype.getAutocompleteFilter = function() {
            return function(t, e) {
                return !0
            }
        }
        ,
        t.prototype.translateFileToArg = function(t) {
            return t
        }
        ,
        t.prototype.kill = function() {}
        ,
        t
    }();
    e.AbstractShellCommand = r;
    var s = function(t) {
        function e(e, n) {
            t.call(this),
            this._command = e,
            this._runCommand = n
        }
        return n(e, t),
        e.prototype.getCommand = function() {
            return this._command
        }
        ,
        e.prototype.run = function(t, e, n) {
            this._runCommand(t, e, n)
        }
        ,
        e
    }(r);
    e.SimpleCommand = s
}
, function(t, e) {
    t.exports = Doppio
}
, function(t, e, n) {
    "use strict";
    var r = this && this.__extends || function(t, e) {
        function n() {
            this.constructor = t
        }
        for (var r in e)
            e.hasOwnProperty(r) && (t[r] = e[r]);
        t.prototype = null === e ? Object.create(e) : (n.prototype = e.prototype,
        new n)
    }
      , s = n(8)
      , i = n(1)
      , o = i.BFSRequire("fs")
      , a = function(t) {
        function e(e, n, r, s, i, o) {
            t.call(this),
            this._isInitialized = !1,
            this._consoleElement = i,
            this._filenameElement = o,
            this._editorContainer = s,
            this._saveButtonElement = n,
            this._closeButtonElement = r,
            this._editor = ace.edit(e)/*,
            this._editor.setTheme("ace/theme/twilight")*/
        }
        return r(e, t),
        e.prototype.initialize = function(t) {
            var e = this;
            this._isInitialized || (this._isInitialized = !0,
            this._saveButtonElement.click(function(n) {
                var r = e._filenameElement.val()
                  , s = e._editor.getSession().getValue();
                "\n" !== s[s.length - 1] && (s += "\n"),
                o.writeFile(r, s, function(n) {
                    n ? t.stderr("File could not be saved: " + n + "\n") : t.stdout("File saved as '" + r + "'.\n"),
                    null != e._lastCb && (e._lastCb(),
                    e._lastCb = null)
                }),
                //e.closeEditor(),
                n.preventDefault()
            }),
            this._closeButtonElement.click(function(t) {
                e.closeEditor(),
                null != e._lastCb && (e._lastCb(),
                e._lastCb = null),
                t.preventDefault()
            }))
        }
        ,
        e.prototype.closeEditor = function() {
            var t = this;
            this._editorContainer.fadeOut("fast", function() {
                t._consoleElement.fadeIn("fast").click()
            })
        }
        ,
        e.prototype.getCommand = function() {
            return "edit"
        }
        ,
        e.prototype.run = function(t, e, n) {
            var r = this;
            this.initialize(t);
            var s = function(t) {
                var n = r._consoleElement.height();
                /*r._consoleElement.fadeOut("fast", */(function() {
                    if (r._filenameElement.val(e[0]),
                    r._editorContainer.height(n),
                    r._editorContainer.fadeIn("fast"),
                    null == e[0] || "java" === e[0].split(".")[1]) {
                        var s = ace.require("ace/mode/java").Mode;
                        r._editor.getSession().setMode(new s)
                    } else {
                        var i = ace.require("ace/mode/text").Mode;
                        r._editor.getSession().setMode(new i)
                    }
                    r._editor.getSession().setValue(t)
                })()/*)*/
            };
            null == e[0] ? (s(this.defaultFile("Test.java")),
            this._lastCb = n) : o.readFile(e[0], "utf8", function(t, i) {
                s(t ? r.defaultFile(e[0]) : i),
                r._lastCb = n
            })
        }
        ,
        e.prototype.defaultFile = function(t) {
            if (-1 != t.indexOf(".java", t.length - 5)) {
                var e = t.lastIndexOf("/");
                return "class " + t.substring(e + 1, t.length - 5) + " {\n  public static void main(String[] args) {\n    // enter code here\n  }\n}"
            }
            return ""
        }
        ,
        e
    }(s.AbstractShellCommand);
    e.__esModule = !0,
    e["default"] = a
}
, function(t, e, n) {
    "use strict";
    function r(t, e, n, r, s) {
        u.readdir(l.resolve(t), function(i, a) {
            if (i || 0 == a.length)
                return s("");
            if (a = a.sort(),
            !e)
                return s(a.join("\n"));
            var l = [];
            o.each(a, function(e, n) {
                u.stat(t + "/" + e, function(t, r) {
                    null == t && (r.isDirectory() && (e += "/"),
                    l.push(e)),
                    n()
                })
            }, function() {
                s(n ? c.columnize(l, r) : l.join("\n"))
            })
        })
    }
    var s = this && this.__extends || function(t, e) {
        function n() {
            this.constructor = t
        }
        for (var r in e)
            e.hasOwnProperty(r) && (t[r] = e[r]);
        t.prototype = null === e ? Object.create(e) : (n.prototype = e.prototype,
        new n)
    }
      , i = n(8)
      , o = n(4)
      , a = n(1)
      , c = n(2)
      , l = a.BFSRequire("path")
      , u = a.BFSRequire("fs")
      , h = a.BFSRequire("process")
      , f = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "ls"
        }
        ,
        e.prototype.run = function(t, e, n) {
            var s = t.cols();
            0 === e.length ? r(".", !0, !0, s, function(e) {
                t.stdout(e + "\n"),
                n()
            }) : 1 === e.length ? r(e[0], !0, !0, s, function(e) {
                t.stdout(e + "\n"),
                n()
            }) : o.each(e, function(e, n) {
                r(e, !0, !0, s, function(r) {
                    t.stdout(e + ":\n" + r + "\n\n"),
                    n()
                })
            }, n)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.LSCommand = f;
    var p = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "cat"
        }
        ,
        e.prototype.run = function(t, e, n) {
            return 0 == e.length ? (t.stdout("Usage: cat <file>\n"),
            n()) : void o.eachSeries(e, function(e, n) {
                u.readFile(e, "utf8", function(r, s) {
                    r ? t.stderr("Could not open file '" + e + "': " + r + "\n") : t.stdout(s),
                    n()
                })
            }, n)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.CatCommand = p;
    var d = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "mv"
        }
        ,
        e.prototype.run = function(t, e, n) {
            return e.length < 2 ? (t.stdout("Usage: mv <from-file> <to-file>\n"),
            n()) : void u.rename(e[0], e[1], function(r) {
                r && t.stderr("Could not rename " + e[0] + " to " + e[1] + ": " + r + "\n"),
                n()
            })
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.MvCommand = d;
    var m = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "cp"
        }
        ,
        e.prototype.run = function(t, e, n) {
            if (e.length < 2)
                return t.stdout("Usage: cp <from-file> <to-file>\n"),
                n();
            var r = e.pop();
            r.lastIndexOf("/") == r.length - 1 && (r = r.substr(0, r.length - 1)),
            u.stat(r, function(s, i) {
                s && "ENOENT" !== s.code ? (t.stderr("Invalid destination: " + r + ": " + s + "\n"),
                n()) : null != i && i.isDirectory() ? o.each(e, function(e, n) {
                    c.copyFile(e, l.resolve(r, l.basename(e)), function(r) {
                        r && t.stderr("Copy failed for " + e + ": " + r + "\n"),
                        n()
                    })
                }, n) : e.length > 1 ? (t.stderr("Too many arguments for file target.\n"),
                n()) : e[0] == r ? (t.stderr("Source and target are identical.\n"),
                n()) : c.copyFile(e[0], r, function(e) {
                    e && t.stderr("Copy failed: " + e + "\n"),
                    n()
                })
            })
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.CpCommand = m;
    var y = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "mkdir"
        }
        ,
        e.prototype.run = function(t, e, n) {
            return e.length < 1 ? (t.stdout("Usage: mkdir <dirname>\n"),
            n()) : void o.each(e, function(e, n) {
                u.mkdir(e, function(r) {
                    r && t.stderr("Could not make directory " + e + ": " + r + "\n"),
                    n()
                })
            }, n)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.MkdirCommand = y;
    var v = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "cd"
        }
        ,
        e.prototype.run = function(t, e, n) {
            if (e.length > 1)
                t.stdout("Usage: cd <directory>\n"),
                n();
            else {
                var r;
                r = 0 == e.length || "~" == e[0] ? "/home" : l.resolve(e[0]),
                u.exists(r, function(e) {
                    e ? h.chdir(r) : t.stderr("Directory " + r + " does not exist.\n"),
                    n()
                })
            }
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.CDCommand = v;
    var b = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "rm"
        }
        ,
        e.prototype.run = function(t, e, n) {
            null == e[0] ? (t.stdout("Usage: rm <file>\n"),
            n()) : o.each(e, function(e, n) {
                u.unlink(e, function(r) {
                    r && t.stderr("Could not remove file " + e + ": " + r + "\n"),
                    n()
                })
            }, n)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.RMCommand = b;
    var g = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "rmdir"
        }
        ,
        e.prototype.run = function(t, e, n) {
            null == e[0] ? (t.stdout("Usage: rmdir <dir>\n"),
            n()) : o.each(e, function(e, n) {
                u.rmdir(e, function(r) {
                    r && t.stderr("Could not remove directory " + e + ": " + r + "\n"),
                    n()
                })
            }, n)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.RmdirCommand = g;
    var _ = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "mount_dropbox"
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            return function() {
                return !1
            }
        }
        ,
        e.prototype.run = function(t, e, n) {
            var r = "j07r6fxu4dyd08r"
              , s = window.document.URL ? window.document.URL : location.href;
            if (0 === s.indexOf("http:") && -1 === s.indexOf("http://localhost"))
                t.stdout("You are currently accessing the demo from a non-secure URL:\n\n" + document.URL + "\n\nDropbox only allows authentication over a secure connection. Please access the\ndemo from the following HTTPS URL and try again:\n\n" + document.URL.replace(/^http:/, "https:") + "\n"),
                n();
            else if (e.length < 1 || "Y" !== e[0])
                t.stdout('This command may redirect you to Dropbox\'s site for authentication.\nIf you would like to proceed with mounting Dropbox into the in-browser\nfilesystem, please type "mount_dropbox Y".\n\nOnce you have successfully authenticated with Dropbox and the page reloads,\nyou will need to type "mount_dropbox Y" again to finish mounting.\n(If you would like to use your own API key, please type "mount_dropbox Y your_api_key_here".)\n'),
                n();
            else {
                2 == e.length && 15 === e[1].length && (r = e[1],
                t.stdout("Using API key " + r + "...\n"));
                var i = new Dropbox.Client({
                    key: r
                });
                i.authenticate(function(e, r) {
                    if (e)
                        t.stderr("Unable to connect to Dropbox: " + e + "\n");
                    else {
                        var s = u.getRootFS();
                        s.mount("/mnt/dropbox", new a.FileSystem.Dropbox(i)),
                        t.stdout("Successfully connected to your Dropbox account. You can now access files in the /Apps/DoppioJVM folder of your Dropbox account at /mnt/dropbox.\n")
                    }
                    n()
                })
            }
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.MountDropboxCommand = _
}
, function(t, e, n) {
    "use strict";
    function r() {
        var t = 0
          , e = l.length;
        return l[Math.floor(Math.random() * (e - t))]
    }
    var s = this && this.__extends || function(t, e) {
        function n() {
            this.constructor = t
        }
        for (var r in e)
            e.hasOwnProperty(r) && (t[r] = e[r]);
        t.prototype = null === e ? Object.create(e) : (n.prototype = e.prototype,
        new n)
    }
      , i = n(8)
      , o = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "time"
        }
        ,
        e.prototype.run = function(t, e, n) {
            var r = e[0]
              , s = t.getAvailableCommands()[r];
            if (0 == e.length)
                t.stdout("Usage: time [program] [args]"),
                n();
            else if (void 0 === s)
                t.stderr("Undefined command: " + r + "\n"),
                n();
            else {
                var i = (new Date).getTime();
                console.profile(r),
                s.run(t, e.slice(1), function() {
                    console.profileEnd();
                    var e = (new Date).getTime();
                    t.stdout("\nTime elapsed: " + (e - i) + " ms.\n"),
                    n()
                })
            }
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.TimeCommand = o;
    var a = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "profile"
        }
        ,
        e.prototype.run = function(t, e, n) {
            function r(l) {
                var u = (new Date).getTime();
                c.run(t, e.slice(1), function() {
                    if (!l) {
                        var e = (new Date).getTime();
                        o += e - u
                    }
                    i > s ? r(!1) : (t.stdout("\n" + a + " took an average of " + o / i + " ms to run.\n"),
                    n())
                })
            }
            var s = 0
              , i = 5
              , o = 0
              , a = e[0]
              , c = t.getAvailableCommands()[a];
            void 0 === c ? (t.stdout("Undefined command: " + a + "\n"),
            n()) : r(!0)
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.ProfileCommand = a;
    var c = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "help"
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            return function() {
                return !1
            }
        }
        ,
        e.prototype.run = function(t, e, n) {
            t.stdout("Use Ctrl-C for SIGINT, tab for autocomplete, and the upload button to upload\nfiles into the current virtual filesystem directory.\n\n[1mStandard commands:[0m\n  cat <file>     ls <dir>       mv <src> <dst>    time <command>\n  edit <file>    cd <dir>       cp <src> <dst>\n  rm <file>      rmdir <dir>\n                 mkdir <dir>\n\n[1mREPLs and Compilers:[0m (WARNING: These trigger downloads!)\n  nashorn (JavaScript)    scala (Scala)         groovy (Groovy)\n  rhino (JavaScript)      abcl (Common LISP)    clojure (Clojure)\n  kawa (Scheme)\n\n[1mSpecial commands:[0m\n  mount_dropbox           -- Mount a Dropbox folder into the file system.\n  profile <command>       -- Profile a command with 5 runs.\n  tip                     -- Get a random idea to try out in the demo.\n\n[1mJava-related commands:[0m\n  javac <source file>     -- Invoke the Java 8 compiler.\n  ecj <source file>       -- Invoke the Eclipse Java compiler.\n  java <class> [args...]  -- Run with command-line arguments.\n  javap [args...] <class> -- Run the Java 8 disassembler.\n\n[1mPrograms and Demos:[0m\n  abandon   Double-entry accounting software written in Scala.\n            Try 'abandon -c /home/files/abandon/examples/complete/accounts.conf'\n  scimark2  An old-school Java benchmark for JVMs. Measures JVM speed for\n            scientific and numerical computing. May freeze up the browser,\n            as the program has a number of long-running loops.\n\n  Small Java demos are located in /home/classes/demo, along with their source\n  code.\n\n"),
            n()
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.HelpCommand = c;
    var l = ['Upload a JAR using the "Upload Files" button, and run it in DoppioJVM with\njava -jar [file.jar]', "Mount a Dropbox folder into the in-browser filesystem with mount_dropbox, sync\nJava programs to Dropbox, and watch them appear in the in-browser filesystem!", "Edit one of the built-in demos at /home/classes/demo, re-compile it with javac,\nand re-run it with java!", "Ever use Java 8? Try experimenting with new Java 8 features! DoppioJVM\nsupports them.", "Try random JAR files in DoppioJVM and see what works. If it seems\ninteresting, file an issue at https://github.com/plasma-umass/doppio-demo and\nwe may include it in a demo update!", "Run the abandon accounting software on the example input:\nabandon -c /home/files/abandon/examples/complete/accounts.conf\nModify the input, and try it again."]
      , u = function(t) {
        function e() {
            t.apply(this, arguments)
        }
        return s(e, t),
        e.prototype.getCommand = function() {
            return "tip"
        }
        ,
        e.prototype.getAutocompleteFilter = function() {
            return function() {
                return !1
            }
        }
        ,
        e.prototype.run = function(t, e, n) {
            t.stdout(r() + "\n"),
            n()
        }
        ,
        e
    }(i.AbstractShellCommand);
    e.TipCommand = u
}
, function(t, e) {
    t.exports = {
        "Bench.class": null,
        "Bench.java": null,
        "FrozenCompile.class": null,
        "FrozenCompile.java": null,
        "NashornBenchmark.class": null,
        "NashornBenchmark.java": null,
        "abandon.jar": null,
        "abcl-1.3.3.jar": null,
        "clojure-1.7.0.jar": null,
        "ecj-4.5.jar": null,
        "groovy-all-2.4.5-indy.jar": null,
        "jruby-complete-9.0.1.0.jar": null,
        "jython-standalone-2.7.0.jar": null,
        "kawa-2.0.jar": null,
        "listings.json": null,
        "rhino1.7.6.jar": null,
        "scala-2.11.7": {
            bin: {
                fsc: null,
                "fsc.bat": null,
                scala: null,
                "scala.bat": null,
                scalac: null,
                "scalac.bat": null,
                scaladoc: null,
                "scaladoc.bat": null,
                scalap: null,
                "scalap.bat": null
            },
            doc: {
                "LICENSE.md": null,
                "License.rtf": null,
                README: null,
                licenses: {
                    "apache_jansi.txt": null,
                    "bsd_asm.txt": null,
                    "bsd_jline.txt": null,
                    "mit_jquery-layout.txt": null,
                    "mit_jquery-ui.txt": null,
                    "mit_jquery.txt": null,
                    "mit_sizzle.txt": null,
                    "mit_tools.tooltip.txt": null
                },
                tools: {
                    css: {
                        "style.css": null
                    },
                    "fsc.html": null,
                    images: {
                        "external.gif": null,
                        "scala_logo.png": null
                    },
                    "index.html": null,
                    "scala.html": null,
                    "scalac.html": null,
                    "scaladoc.html": null,
                    "scalap.html": null
                }
            },
            lib: {
                "akka-actor_2.11-2.3.10.jar": null,
                "config-1.2.1.jar": null,
                "jline-2.12.1.jar": null,
                "scala-actors-2.11.0.jar": null,
                "scala-actors-migration_2.11-1.1.0.jar": null,
                "scala-compiler.jar": null,
                "scala-continuations-library_2.11-1.0.2.jar": null,
                "scala-continuations-plugin_2.11.7-1.0.2.jar": null,
                "scala-library.jar": null,
                "scala-parser-combinators_2.11-1.0.4.jar": null,
                "scala-reflect.jar": null,
                "scala-swing_2.11-1.0.2.jar": null,
                "scala-xml_2.11-1.0.4.jar": null,
                "scalap-2.11.7.jar": null
            },
            man: {
                man1: {
                    "fsc.1": null,
                    "scala.1": null,
                    "scalac.1": null,
                    "scaladoc.1": null,
                    "scalap.1": null
                }
            }
        },
        "scimark2lib.jar": null
    }
}
]);
//# sourceMappingURL=app.js.map
