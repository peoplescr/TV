/* ============================================================
   Watch Party — main app
   Vanilla JS, no frameworks, no backend.
   PeerJS star topology: host registers wp-{room}, viewers connect to it.
   ============================================================ */
(function () {
  "use strict";

  /* ============================================================
     ICE SERVERS — STUN + TURN.
     STUN lets same-network peers find each other.
     TURN relays traffic for peers on different networks / behind strict
     NATs / on VPNs — this is what makes cross-network connections work.
     Without a working TURN server, connections only succeed when both
     peers can reach each other directly (e.g. same WiFi).

     Uses ExpressTURN free public TURN servers — STATIC long-term credentials,
     no signup, no API call, no CORS. Works from any browser or the APK.
     Multiple credentials can be listed in TURN_CREDENTIALS below — the ICE
     layer tries each relay and fails over automatically, so more entries =
     more aggregate monthly quota + redundancy. Get/refresh free credentials
     at https://www.expressturn.com/ (the shared free password rotates
     periodically — when the relay badge goes red, grab fresh username/
     password pairs and add/replace entries in TURN_CREDENTIALS).
     ============================================================ */

  // ExpressTURN free credentials (no account / no credit card).
  // Add as many as you like — the browser tries each TURN server and uses
  // whichever is reachable. More entries = more aggregate monthly quota +
  // redundancy (if one relay's quota runs dry or it's down, traffic moves
  // to the next). Get/refresh free creds at https://www.expressturn.com/.
  var TURN_CREDENTIALS = [
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624274", password: "zzimPJlNoA4aljizhjQxFnrQrS4=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624278", password: "Ky8w4nAYj850oRSpNbGM598v2Qc=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624281", password: "wpa14OD57Y/QlQ55Uv7vInyAlYA=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624284", password: "zxPoHjQNeWd4Urlq+tXQ9PC+89U=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624286", password: "Lsq6QuYT/VLujg29NpyowUU24Hk=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624288", password: "F/8zyj2mtw8fqSfd5sIG1fK65OE=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624292", password: "lhZeDUSPnVsn5TJaecmGcI0SGzc=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624295", password: "oPTCl4lKOAt/66PoSRLg2Ku019w=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624298", password: "VeANckAlbRbp6929kmhNdE7TrcA=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624301", password: "VyCVaCHyeyBKano7shPFsjJCwp4=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624335", password: "gVydSj5P7w4qToV14Hr7A6jVtqc=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624338", password: "/xg42d+qJlRlUNTwdEtskwX2BJs=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624340", password: "L/SuFXdB5ocfHahC2DgWjqtrnfE=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624343", password: "sp/WHK7MTbfrCfFrE1E0V26dBtk=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624346", password: "IDla1xD+M5Cgyaz2FNRl5knEr/o=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624348", password: "Q3FVeMOC7+HLtY/bVpho0Q8TvwQ=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624352", password: "y2trJhtzk/KHxuPeG/EpZXCvBP8=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624355", password: "yoDyOl1XZPlpxZWiH8zYLbY8WwQ=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624357", password: "PoWFr4sdUTnslCejg9A3gE9LvmU=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624359", password: "sz9Oatcrk0s8+yeCI6G/kRTbGfg=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624396", password: "5Hr7SQmHuqizNFDhAwLxPoTHTwE=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624400", password: "Vv0p22VbNG/clGItduNvfTtvEo4=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624402", password: "N+o+v3zeUmsGuvS+N6GvaTGmXZA=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624405", password: "TtnKneM1AIWv8S/ilAoCHBCDyek=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097624408", password: "eScW88vbx3bmqKnFBwkgDavqXlY=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625881", password: "Og7qLAJgvZTMY8ltmvRNtXGWTv0=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625886", password: "KzkCJScgvlwZ9v0se6paOOSHnLc=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625890", password: "mPw0v+VauOOjjxZQCaG2HvCDHN8=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625894", password: "aWjqHd0MdojEKNO1x3bCq+r9lFw=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625897", password: "sStvjzzQicVU2MaKgPRhdQnDpRM=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625905", password: "TNjkE/2dTl0x2BfI260+Vap6/bc=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625909", password: "i7aEkor8d3kkxkWJuEa+5LFbXSw=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625912", password: "COzx/g4nlwZYbw8UHAKaxRAB0mA=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625916", password: "lj8CkOj8m6my2tbz0uGrbHdq4lM=" },
    { host: "free.expressturn.com", port: 3478,
      username: "000000002097625921", password: "zrNJVcK9A0TY0kxg1Q+K/8zJ6TQ=" }
  ];

  // Where the web app is publicly hosted. Inside the Android APK the WebView
  // origin is https://localhost, so location.href can't be used as a share link.
  // Set this to the real PWA URL (GitHub Pages, Netlify, etc.). Share/invite
  // links are built from this so they work for anyone — APK, browser, any phone.
  // Leave "" to fall back to location.href (fine when served from a real URL).
  var PUBLIC_URL = "https://foralt67672-maker.github.io/watch-party";

  // Build a shareable invite link for a room code. Uses PUBLIC_URL whenever it's
  // set (so APK / localhost origins produce real links). Falls back to the live
  // location only if PUBLIC_URL is empty.
  function shareUrl(code) {
    var base = PUBLIC_URL;
    if (!base) {
      // No public URL configured — use the real origin (works when served live).
      base = location.origin + location.pathname;
    }
    // strip any existing hash/query, then add our room hash
    base = base.split("#")[0].split("?")[0];
    return base + "#room=" + encodeURIComponent(code || "");
  }

  // True when running inside the Capacitor native shell (the APK / app).
  function isNativeApp() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  // ICE servers: STUN (for same-network/direct paths) + TURN relay (the part
  // that makes cross-network viewing work). Credentials are STATIC, so no
  // fetch is needed — both host and viewer can open their Peer immediately.
  // Every credential in TURN_CREDENTIALS is expanded into a UDP + a TCP TURN
  // entry; the ICE layer tries them in order and fails over automatically —
  // if one relay is unreachable or its quota is exhausted, it moves to the
  // next. More credentials = more aggregate monthly quota + redundancy.
  function iceServers() {
    var servers = [];
    // Cloud TURN (ExpressTURN)
    if (LocalTurn.cloudOn) {
      for (var i = 0; i < TURN_CREDENTIALS.length; i++) {
        var c = TURN_CREDENTIALS[i];
        servers.push({ urls: "turn:" + c.host + ":" + c.port,
                       username: c.username, credential: c.password });
        servers.push({ urls: "turn:" + c.host + ":" + c.port + "?transport=tcp",
                       username: c.username, credential: c.password });
      }
    }
    // Local phone TURN
    var d = LocalTurn.get();
    if (d.enabled && d.host && d.username && d.password) {
      var p = d.port || 3478;
      servers.push({ urls: "turn:" + d.host + ":" + p,
                     username: d.username, credential: d.password });
      servers.push({ urls: "turn:" + d.host + ":" + p + "?transport=tcp",
                     username: d.username, credential: d.password });
    }
    // STUN fallbacks (always included)
    servers.push({ urls: "stun:stun.l.google.com:19302" });
    servers.push({ urls: "stun:stun.cloudflare.com:3478" });
    return servers;
  }

  // With static TURN credentials there's nothing to fetch, so TURN is always
  // "ready". We keep the gate so existing call sites don't need to change.
  var _turnReady = true;
  var TURN_CONFIGURED = true;
  function whenXirsysReady(cb) { cb(true); }
  function _resolveTurn() { updateTurnBadge(); }

  /* ============================================================
     Local Phone TURN — user-configurable, saved in localStorage.
     ============================================================ */
  var LT_KEY = "wp-local-turn";
  var LocalTurn = {
    _d: { enabled: false, host: "", port: 3478, username: "", password: "" },
    cloudOn: true,
    load: function () {
      try {
        var raw = localStorage.getItem(LT_KEY);
        if (raw) {
          var saved = JSON.parse(raw);
          this._d.enabled = !!saved.enabled;
          this._d.host    = saved.host || "";
          this._d.port    = saved.port || 3478;
          this._d.username = saved.username || "";
          this._d.password = saved.password || "";
        }
        this.cloudOn = localStorage.getItem(LT_KEY + "-cloud") !== "off";
      } catch (e) {}
    },
    save: function () {
      try {
        localStorage.setItem(LT_KEY, JSON.stringify(this._d));
        localStorage.setItem(LT_KEY + "-cloud", this.cloudOn ? "on" : "off");
      } catch (e) {}
    },
    get: function ()  { return this._d; },
    isConfigured: function () {
      var d = this._d;
      return d.enabled && d.host && d.username && d.password;
    }
  };
  LocalTurn.load();

  /* TURN relay monitor state */
  var TurnMonitor = {
    relayHost: "—",
    relayCount: 0,
    localStatus: "Not configured",
    localClass: "",
    update: function () {
      var el;
      el = $("tm-relay"); if (el) el.textContent = this.relayHost;
      el = $("tm-count"); if (el) el.textContent = this.relayCount;
      el = $("tm-local");
      if (el) {
        el.textContent = this.localStatus;
        el.className = "tm-value tm-status " + this.localClass;
      }
    }
  };

  /* Poll active peer connections for TURN relay stats */
  var _tmTimer = null;
  function startTurnMonitor() {
    if (_tmTimer) return;
    _tmTimer = setInterval(pollTurnStats, 5000);
  }
  function pollTurnStats() {
    var peer = state.peer;
    if (!peer) return;
    var activeConn = peer.connections;
    if (!activeConn) return;
    var count = 0;
    var seenHosts = [];
    Object.keys(activeConn).forEach(function (key) {
      var arr = activeConn[key];
      for (var i = 0; i < arr.length; i++) {
        var pc = arr[i] && arr[i].peerConnection;
        if (!pc) continue;
        try {
          pc.getStats().then(function (stats) {
            stats.forEach(function (report) {
              if (report.type === "candidate-pair" && report.state === "succeeded") {
                var local = stats.get(report.localCandidateId);
                if (local && local.candidateType === "relay") {
                  var host = local.relayProtocol ? "Relay (" + local.relayProtocol + ")" : "Relay";
                  // extract relay host from candidate if available
                  if (local.candidate) {
                    var m = local.candidate.match(/relay ([\w.\-]+)/);
                    if (m) host = m[1];
                  }
                  if (TurnMonitor.relayHost !== host) {
                    TurnMonitor.relayHost = host;
                  }
                }
              }
            });
          }).catch(function () {});
        } catch (e) {}
      }
    });
    // Count total connected peers as a proxy for relayed connections
    Object.keys(activeConn).forEach(function (key) {
      var arr = activeConn[key];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].open) count++;
      }
    });
    if (TurnMonitor.relayCount !== count) TurnMonitor.relayCount = count;
    TurnMonitor.update();
  }

  /* Quick reachability probe for the local TURN server */
  function probeLocalTurn(cb) {
    var d = LocalTurn.get();
    if (!d.enabled || !d.host || !d.username) {
      TurnMonitor.localStatus = "Not configured";
      TurnMonitor.localClass = "";
      TurnMonitor.update();
      if (cb) cb(false);
      return;
    }
    TurnMonitor.localStatus = "Checking…";
    TurnMonitor.localClass = "tm-warn";
    TurnMonitor.update();
    // Create a temporary RTCPeerConnection to probe TURN allocation
    var pc = new RTCPeerConnection({
      iceServers: [{
        urls: "turn:" + d.host + ":" + d.port,
        username: d.username,
        credential: d.password
      }]
    });
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; pc.close(); fail("Timeout"); }
    }, 6000);
    function fail(msg) {
      TurnMonitor.localStatus = msg;
      TurnMonitor.localClass = "tm-err";
      TurnMonitor.update();
      if (cb) cb(false);
    }
    function ok() {
      if (!done) { done = true; clearTimeout(timer); pc.close(); }
      TurnMonitor.localStatus = "Reachable";
      TurnMonitor.localClass = "tm-ok";
      TurnMonitor.update();
      if (cb) cb(true);
    }
    pc.onicecandidate = function (e) {
      if (!e || !e.candidate) return;
      var c = e.candidate.candidate;
      if (c && c.indexOf("typ relay") !== -1) { ok(); }
    };
    pc.createDataChannel("probe");
    pc.createOffer().then(function (offer) { return pc.setLocalDescription(offer); }).catch(function () { fail("Error"); });
  }

  var PEER_PREFIX = "wp-";           // host peer id = PEER_PREFIX + room
  var DRIFT_HARD = 1.5;              // seconds — hard seek above this
  var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

  /* ============================================================
     Tiny DOM helpers
     ============================================================ */
  function $(id) { return document.getElementById(id); }

  var state = {
    isHost: false,
    room: null,
    name: "",
    pfp: null,         // data-URL of the local profile picture (or null)
    peer: null,
    peers: {},         // peerId -> { conn, name, pfp, status, rtt }
    fileName: null,    // name of the locally-loaded file (for sync-position matching)
    srcType: null,     // "file" | "screen"
    sharingScreen: false,
    subTrack: null,
    syncTimer: null,
    pingTimer: null,
    call: null,        // active media call (screen/camera)
    remoteStream: null,
    chatHistory: [],   // persistent chat log sent to new/reconnecting viewers
    adminPerms: { allowPlayPause: true, allowSeek: true, allowFullscreen: true }, // host-side viewer permissions
    wakeLock: null,    // Wake Lock sentinel (prevents OS throttling in background)
    _lastSeekTime: 0  // viewer: last allowed seek position (for admin perm enforcement)
  };

  var player = $("player");

  // PFP size budget — avatars are tiny, so downscale before persisting/sending
  // to keep localStorage and peer messages small.
  var PFP_MAX = 256;          // px (square)
  var PFP_QUALITY = 0.8;      // JPEG quality
  var PFP_STORE_LIMIT = 60000; // chars in localStorage (~45KB)

  /* ============================================================
     Utilities
     ============================================================ */
  function genCode(len) {
    len = len || 6;
    var s = "";
    for (var i = 0; i < len; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }
  function peerIdFor(code) { return PEER_PREFIX + String(code).toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function nowHHMM() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  /* ---- PFP helpers ---- */
  // Deterministic color from a name, used as the avatar background when no
  // image is set. Same name -> same color across all peers.
  var PFP_COLORS = [
    "#6c8cff", "#3ddc84", "#ffcc4d", "#ff5d5d", "#c084fc",
    "#22d3ee", "#fb7185", "#a3e635", "#f59e0b", "#34d399"
  ];
  function colorForName(name) {
    var s = 0;
    for (var i = 0; i < name.length; i++) s = (s * 31 + name.charCodeAt(i)) >>> 0;
    return PFP_COLORS[s % PFP_COLORS.length];
  }
  function initialFor(name) {
    var n = (name || "?").trim();
    return n ? n.charAt(0).toUpperCase() : "?";
  }

  // Build an avatar element. If pfp data-URL is provided, show it; otherwise
  // a colored circle with the initial. Used in chat + peers list.
  function makeAvatar(name, pfp) {
    var a = document.createElement("span");
    a.className = "avatar";
    if (pfp) {
      a.style.backgroundImage = "url(" + pfp + ")";
    } else {
      a.style.backgroundColor = colorForName(name);
      a.textContent = initialFor(name);
    }
    return a;
  }

  // Read an image File, downscale to PFP_MAX, return a JPEG data-URL via cb.
  function readPfp(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(new Error("not an image")); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          var size = Math.min(img.width, img.height);   // crop to square
          canvas.width = PFP_MAX; canvas.height = PFP_MAX;
          var ctx = canvas.getContext("2d");
          // center-crop
          var sx = (img.width - size) / 2;
          var sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, PFP_MAX, PFP_MAX);
          cb(null, canvas.toDataURL("image/jpeg", PFP_QUALITY));
        } catch (e) { cb(e); }
      };
      img.onerror = function () { cb(new Error("bad image")); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(new Error("read failed")); };
    reader.readAsDataURL(file);
  }

  // Persist/restore the local PFP. Kept small via downscaling above.
  function loadPfp() {
    try {
      var v = localStorage.getItem("wp-pfp");
      if (v && v.length < PFP_STORE_LIMIT) { state.pfp = v; return true; }
    } catch (e) {}
    return false;
  }
  function savePfp(dataUrl) {
    state.pfp = dataUrl;
    try {
      if (dataUrl && dataUrl.length < PFP_STORE_LIMIT) localStorage.setItem("wp-pfp", dataUrl);
      else localStorage.removeItem("wp-pfp");
    } catch (e) {}
  }
  function clearPfp() {
    state.pfp = null;
    try { localStorage.removeItem("wp-pfp"); } catch (e) {}
  }

  // Render the lobby PFP control to match current state.
  function renderLobbyPfp() {
    var btn = $("pfp-btn");
    var init = $("pfp-initial");
    var clr = $("pfp-clear");
    if (state.pfp) {
      btn.style.backgroundImage = "url(" + state.pfp + ")";
      btn.classList.add("has-img");
      init.textContent = "";
      clr.classList.remove("hidden");
    } else {
      btn.style.backgroundImage = "";
      btn.classList.remove("has-img");
      btn.style.backgroundColor = colorForName(state.name || "?");
      init.textContent = initialFor(state.name || "?");
      clr.classList.add("hidden");
    }
  }

  /* ---- floating video reactions ---- */
  // Spawn an emoji that rises up the video and fades. Purely cosmetic,
  // mirrored on all peers via the {t:"react"} message.
  function floatEmoji(emoji) {
    var layer = $("float-layer");
    if (!layer) return;
    var span = document.createElement("span");
    span.className = "float-emoji";
    span.textContent = emoji;
    // random-ish horizontal position, slight rotation/drift
    span.style.left = (10 + Math.random() * 80) + "%";
    var drift = (Math.random() * 40 - 20);
    span.style.setProperty("--drift", drift + "px");
    span.style.fontSize = (26 + Math.random() * 18) + "px";
    layer.appendChild(span);
    // remove after the animation finishes
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 2200);
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function canScreenShare() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  var toastTimer;
  function toast(msg, kind) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast" + (kind ? " " + kind : "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2600);
  }
  var tipTimer;
  function showTip(msg, ms) {
    var t = $("tip");
    t.textContent = msg;
    t.classList.remove("hidden");
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(function () { t.classList.add("hidden"); }, ms || 4000);
  }

  // TURN status badge — gives an unambiguous "relay ready" indicator so
  // cross-network problems never fail silently. With static ExpressTURN
  // credentials the relay is always configured, so this shows ✅ on entry.
  function updateTurnBadge() {
    var b = $("turn-badge");
    if (!b) return;   // element only exists in the room UI
    if (_turnReady) {
      b.textContent = "Relay ✅";
      b.className = "badge turn-ok";
      b.title = "TURN relay (ExpressTURN) configured — cross-network viewing works.";
    } else {
      b.textContent = "Relay ⚠";
      b.className = "badge turn-fail";
      b.title = "TURN relay not configured — only same-network viewing will work. Update the ExpressTURN credentials in app.js.";
    }
  }

  /* ============================================================
     ONLINE status pill — mirrors buddy-watch's connection indicator.
     kind: "connecting" | "connected" | "offline"
     ============================================================ */
  function setOnline(kind) {
    var pill = $("online-pill");
    if (!pill) return;
    var labels = { connecting: "Connecting…", connected: "", offline: "Offline" };

    // For "connected", append the live "N online" count (like the old site).
    var label = labels[kind];
    if (kind === "connected") {
      var n = Object.keys(state.peers).length + 1;   // peers + me
      label = n + " online";
    }
    $("conn-status").textContent = label;
    pill.className = "online-pill online-" + kind;
  }

  /* ============================================================
     RELAY button — manual reconnect.
     Tears down the current Peer and re-establishes it (re-hosts or
     re-joins the same room). With static ExpressTURN credentials there's
     no TURN fetch to retry — this is the escape hatch when signaling
     drops or the connection silently stalls.
     ============================================================ */
  function reconnectRelay() {
    var btn = $("relay-btn");
    if (!state.room) { toast("Join a room first.", "err"); return; }
    if (btn) { btn.classList.add("spinning"); btn.disabled = true; }
    setOnline("connecting");
    toast("Reconnecting relay…", "");

    // With static TURN credentials there's no fetch to retry — just tear
    // down the current Peer and re-establish it (re-host or re-join).
    var wasHost = state.isHost;
    var code = state.room;
    try { if (state.peer) state.peer.destroy(); } catch (e) {}
    state.peer = null;
    state.peers = {};
    state.hostConn = null;
    if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }

    // give the spin a beat to be visible, then rebuild
    setTimeout(function () {
      if (btn) { btn.classList.remove("spinning"); btn.disabled = false; }
      if (wasHost) {
        createRoom(code);          // re-register as host on wp-{room}
      } else {
        joinRoom(code);            // re-connect to the host
      }
    }, 700);
  }

  /* ============================================================
     Screen switching (lobby <-> room)
     ============================================================ */
  function showScreen(name) {
    $("lobby").classList.toggle("hidden", name !== "lobby");
    $("room").classList.toggle("hidden", name !== "room");
  }

  /* ============================================================
     Name handling
     ============================================================ */
  function loadName() {
    var n = localStorage.getItem("wp-name");
    if (!n) n = "User" + Math.floor(100 + Math.random() * 900);
    state.name = n;
    $("name-input").value = n;
  }
  function saveName() {
    var v = $("name-input").value.trim();
    if (v) { state.name = v; localStorage.setItem("wp-name", v); }
    renderLobbyPfp();   // the placeholder avatar follows the name's initial
  }

  /* ============================================================
     Lobby wiring
     ============================================================ */
  function initLobby() {
    loadName();
    loadPfp();
    renderLobbyPfp();

    // PFP picker
    $("pfp-btn").addEventListener("click", function () { $("pfp-input").click(); });
    $("pfp-clear").addEventListener("click", function () {
      clearPfp();
      renderLobbyPfp();
    });
    $("pfp-input").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      readPfp(f, function (err, dataUrl) {
        if (err) { toast("Couldn't use that image.", "err"); return; }
        savePfp(dataUrl);
        renderLobbyPfp();
        toast("Profile picture set!", "ok");
      });
    });

    $("name-input").addEventListener("input", function () {
      // live-update the placeholder initial/color as they type
      if (!state.pfp) {
        $("pfp-btn").style.backgroundColor = colorForName($("name-input").value || "?");
        $("pfp-initial").textContent = initialFor($("name-input").value || "?");
      }
    });
    $("name-input").addEventListener("change", saveName);
    $("name-input").addEventListener("blur", saveName);

    $("create-btn").addEventListener("click", function () {
      saveName();
      var code = genCode();
      // Host explicitly. Setting the hash is for shareability only;
      // we pass a flag so the hashchange handler knows not to treat it as a join.
      state._intent = "host";
      location.hash = "room=" + code;
      createRoom(code);
    });

    $("join-btn").addEventListener("click", function () {
      saveName();
      var code = $("join-input").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code.length < 4) { lobbyMsg("Enter a valid room code.", "err"); return; }
      state._intent = "join";
      location.hash = "room=" + code;
      joinRoom(code);
    });

    $("join-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") $("join-btn").click();
    });
  }
  function lobbyMsg(msg, kind) {
    var el = $("lobby-msg");
    el.textContent = msg;
    el.className = "lobby-msg" + (kind ? " " + kind : "");
  }

  /* ============================================================
     Routing — hash drives everything
     ============================================================ */
  function parseHash() {
    var h = location.hash || "";
    var m = h.match(/room=([A-Za-z0-9]+)/);
    return m ? m[1].toUpperCase() : null;
  }
  function onHash() {
    var code = parseHash();
    if (!code) { return; }
    // If we just set the hash ourselves (Create/Join buttons already acted),
    // don't re-trigger a connection.
    if (state._intent === "host" || state._intent === "join") {
      state._intent = null;
      return;
    }
    // Fresh load with a #room= link, or the user pasted a URL: treat as JOIN.
    joinRoom(code);
  }

  /* ============================================================
     Peer lifecycle
     ============================================================ */
  function newPeer(myId) {
    var peer = new Peer(myId || undefined, {
      debug: 1,
      config: { iceServers: iceServers() }
    });
    peer.on("error", onPeerError);
    peer.on("disconnected", function () {
      try { peer.reconnect(); } catch (e) {}
    });
    return peer;
  }

  function onPeerError(err) {
    console.warn("peer error", err);
    if (err.type === "peer-unavailable") {
      // Tried to join but no host is there yet — offer to become the host.
      setOnline("offline");
      toast("No host yet. Tap \"Become host\" to start the room, or Relay to retry.", "err");
      offerBecomeHost();
    } else if (err.type === "unavailable-id") {
      // You tried to host a room id someone already owns.
      toast("That room already has a host. Use Join instead.", "err");
      leaveRoom();
    } else {
      setOnline("offline");
      toast("Connection issue (" + err.type + "). Hit Relay to reconnect.", "err");
    }
  }

  /* -------- HOST -------- */
  function createRoom(code) {
    state.room = code;
    state.isHost = true;
    enterRoomUI(code);
    setRole(true);

    // TURN relay is configured statically, so this resolves immediately.
    whenXirsysReady(function (ok) {
      var peer = newPeer(peerIdFor(code));
      state.peer = peer;

    peer.on("open", function () {
      toast("Room created! Share the link.", "ok");
      sysMsg("Room " + code + " created.");
      sysMsg("Share the link with friends to watch together.");
      startHostSync();
      startPing();
      startTurnMonitor();
      if (LocalTurn.isConfigured()) probeLocalTurn();
      setOnline("connecting");   // host is on the network, waiting for viewers
    });

    peer.on("connection", function (conn) {
      bindIncomingConn(conn);
    });

    peer.on("call", function (call) {
      // a viewer is sharing their screen/camera — answer & display
      call.answer();
      attachRemoteCall(call);
    });

    peer.on("disconnected", function () {
      setOnline("offline");
    });
    }); // whenXirsysReady
  }

  // host: a viewer connected
  function bindIncomingConn(conn) {
    DataMeter.wrapConn(conn);   // count outgoing bytes on this connection
    conn.on("open", function () {
      var entry = { conn: conn, name: "Viewer", pfp: null, status: "on", rtt: 0 };
      state.peers[conn.peer] = entry;
      renderPeers();
      setOnline("connected");
      conn.send({ t: "hello", name: state.name, hostName: state.name, pfp: state.pfp, srcType: state.srcType, fileName: state.fileName, perms: state.adminPerms });

      // Send chat history so rejoining viewers see past messages
      if (state.chatHistory.length) {
        try { conn.send({ t: "chat-history", messages: state.chatHistory }); } catch (e) {}
      }

      // If host already has a file/screen running, bring the new viewer up to speed
      if (state.srcType === "file" && state.fileName) {
        conn.send({ t: "src", srcType: "file", fileName: state.fileName });
        conn.send({ t: "sync", playing: !player.paused, time: player.currentTime || 0 });
      } else if (state.srcType === "screen" && state.sharingScreen) {
        conn.send({ t: "src", srcType: "screen" });
        conn.send({ t: "sync", playing: !player.paused, time: player.currentTime || 0 });
      }
    });

    conn.on("data", function (data) {
      // sync-position-only: no binary file chunks. Only JSON messages.
      handleData(data, conn);
    });

    conn.on("close", function () {
      var e = state.peers[conn.peer];
      var who = e ? e.name : "A viewer";
      delete state.peers[conn.peer];
      renderPeers();
      setOnline(Object.keys(state.peers).length ? "connected" : "connecting");
      sysMsg(who + " left.");
    });

    conn.on("error", function (e) { console.warn("conn err", e); });
  }

  /* -------- VIEWER -------- */
  function joinRoom(code) {
    // Only one viewer peer should ever be active; tear down any prior one.
    if (state.peer) { try { state.peer.destroy(); } catch (e) {} state.peer = null; }
    state.peers = {};

    state.room = code;
    state.isHost = false;
    enterRoomUI(code);
    setRole(false);

    // TURN relay is configured statically, so this resolves immediately.
    whenXirsysReady(function (ok) {
      var peer = newPeer();   // random id for viewer
      state.peer = peer;

      peer.on("open", function () {
        setOverlayWaiting();
        setOnline("connecting");
        startTurnMonitor();
        if (LocalTurn.isConfigured()) probeLocalTurn();
        var conn = peer.connect(peerIdFor(code), { reliable: true });
        DataMeter.wrapConn(conn);   // count outgoing bytes on this connection
        conn.on("open", function () {
          hideOverlay();
          state.peers[conn.peer] = { conn: conn, name: "Host", pfp: null, status: "on", rtt: 0 };
          state.hostConn = conn;     // remember the host connection (viewer)
          conn.send({ t: "join", name: state.name, pfp: state.pfp });
          renderPeers();
          setOnline("connected");
          startPing();
        });
        conn.on("data", function (data) {
          // sync-position-only: no binary file chunks, only JSON messages
          handleData(data, conn);
        });
        conn.on("close", function () {
          delete state.peers[conn.peer];
          renderPeers();
          setOnline("offline");
          sysMsg("Disconnected from host.");
          // host may be gone — offer to take over
          offerBecomeHost();
        });
        conn.on("error", function (e) { console.warn("conn err", e); });

        peer.on("disconnected", function () {
          setOnline("offline");
        });

        // If the connection never opens, give the user a clear message
        // (no auto-fallback to hosting — that caused "code taken" races).
        setTimeout(function () {
          if (!conn.open) {
            setOnline("offline");
            toast("Couldn't reach the room. Tap \u201cBecome host\u201d to start it, or hit Relay to retry.", "err");
            offerBecomeHost();
          }
        }, 10000);
      });

      peer.on("call", function (call) {
        call.answer();
        attachRemoteCall(call);
      });
    }); // whenXirsysReady
  }

  /* ============================================================
     Broadcast helper (host)
     ============================================================ */
  function broadcast(msg) {
    var keys = Object.keys(state.peers);
    for (var i = 0; i < keys.length; i++) {
      var c = state.peers[keys[i]].conn;
      if (c && c.open) { try { c.send(msg); } catch (e) {} }
    }
  }

  // Host-only: forward a message to every peer EXCEPT the originator.
  // This is what lets viewers in a 3+ person room see each other's
  // chat + reactions (the star topology means viewers never connect
  // directly to each other; everything routes through the host).
  function relayToOthers(fromConn, msg) {
    var keys = Object.keys(state.peers);
    for (var i = 0; i < keys.length; i++) {
      var c = state.peers[keys[i]].conn;
      if (c && c.open && c !== fromConn) { try { c.send(msg); } catch (e) {} }
    }
  }

  /* ============================================================
     Sync-position-only: no file bytes are sent over the network.
     Each person opens the same file on their own device.
     Only play/pause/seek/state is synced via small messages.
     Zero buffering, instant playback.
     ============================================================ */

  /* ============================================================
     Sync (host broadcasts, viewer follows)
     ============================================================ */
  function startHostSync() {
    if (state.syncTimer) clearInterval(state.syncTimer);
    state.syncTimer = setInterval(function () {
      if (!state.isHost) return;
      if (state.srcType !== "file") return;       // only file playback is syncable here
      broadcast({ t: "sync", playing: !player.paused, time: player.currentTime || 0 });
    }, DataSaver.syncMs());   // 4s normally, 8s under Data Saver
  }

  // host-side playback events -> broadcast immediately
  function wirePlayerEvents() {
    player.addEventListener("play", function () {
      if (state.isHost && state.srcType === "file") {
        broadcast({ t: "play", time: player.currentTime });
      }
    });
    player.addEventListener("pause", function () {
      if (state.isHost && state.srcType === "file") {
        broadcast({ t: "pause", time: player.currentTime });
      }
    });
    var seekTO;
    player.addEventListener("seeked", function () {
      if (state.isHost && state.srcType === "file") {
        clearTimeout(seekTO);
        seekTO = setTimeout(function () {
          broadcast({ t: "seek", time: player.currentTime });
        }, 120);
      }
    });
    // viewer: drift correction visual nudge is implicit via hard-seek
  }

  function applySync(data) {
    if (state.isHost) return;          // host drives, never follows
    if (state.srcType !== "file") return;
    if (!player.src) return;
    if (typeof data.time !== "number") return;
    var drift = Math.abs(player.currentTime - data.time);
    if (data.playing != null) {
      if (data.playing && player.paused) player.play().catch(function () {});
      if (!data.playing && !player.paused) player.pause();
    }
    if (drift > DRIFT_HARD) {
      try { player.currentTime = data.time; } catch (e) {}
    }
  }

  /* ============================================================
     Message handling
     ============================================================ */
  function handleData(data, conn) {
    if (!data || typeof data !== "object") return;
    // account for received bytes (observation only; never alters payload)
    try { DataMeter.addRecv(data); } catch (e) {}
    switch (data.t) {

      case "hello":
        // host -> viewer greeting (carries host name + pfp + current src type)
        if (data.hostName) { if (state.peers[conn.peer]) state.peers[conn.peer].name = data.hostName; }
        if (data.pfp && state.peers[conn.peer]) state.peers[conn.peer].pfp = data.pfp;
        if (data.srcType === "screen") {
          state.srcType = "screen";
          hideEmpty();
          showOverlay(true, "Host is sharing their screen…", true);
        }
        // apply admin permissions from host
        if (data.perms) {
          state.adminPerms = data.perms;
          applyAdminRestrictions();
        }
        renderPeers();
        break;

      case "join":
        // viewer -> host
        if (state.peers[conn.peer]) {
          state.peers[conn.peer].name = data.name || "Viewer";
          if (data.pfp) state.peers[conn.peer].pfp = data.pfp;
          renderPeers();
          sysMsg((data.name || "Someone") + " joined.");
        }
        break;

      case "chat":
        // Rich chat. {mid, name, pfp, text|kind:"sticker"+sticker, reply?:{name,text}}
        addChat({
          name: data.name || "Peer",
          pfp: data.pfp,
          text: data.text,
          kind: data.kind || null,
          sticker: data.sticker || null,
          mid: data.mid,
          reply: data.reply || null
        });
        // bump the FAB unread badge if the drawer is closed (mobile)
        try { ChatDrawer.onIncoming(); } catch (e) {}
        // mirror into the fullscreen overlay (toast + panel)
        try { FsChat.onNewMessage({ name: data.name || "Peer", text: data.text || (data.sticker && data.sticker.emoji) || "" }); } catch (e) {}
        // HOST RELAY: a viewer sent a chat — rebroadcast to every OTHER peer
        // so 3+ person rooms all see each other's messages.
        if (state.isHost) relayToOthers(conn, data);
        break;

      case "chat-history":
        // host sends past messages when a viewer joins/rejoins
        if (data.messages && Array.isArray(data.messages)) {
          var existingMids = {};
          var existingEls = ($("chat-msgs") || {}).children;
          if (existingEls) {
            for (var ei = 0; ei < existingEls.length; ei++) {
              var em = existingEls[ei].getAttribute("data-mid");
              if (em) existingMids[em] = true;
            }
          }
          for (var hi = 0; hi < data.messages.length; hi++) {
            var hm = data.messages[hi];
            // skip messages already rendered
            if (hm.mid && existingMids[hm.mid]) continue;
            addChat(hm);
          }
        }
        break;

      case "admin-perms":
        // host -> viewers: permission changes
        if (data.allowPlayPause != null) state.adminPerms.allowPlayPause = data.allowPlayPause;
        if (data.allowSeek != null)     state.adminPerms.allowSeek = data.allowSeek;
        if (data.allowFullscreen != null) state.adminPerms.allowFullscreen = data.allowFullscreen;
        applyAdminRestrictions();
        break;

      case "react":
        // {mid, emoji, name} — attach to a message AND/OR float on the video.
        if (data.emoji) {
          applyReaction(data.mid, data.emoji, data.name || "Someone");
          // mirror the floating animation locally — suppressed under Data Saver
          // to save redraws (the reaction still attaches to the bubble above)
          if (DataSaver.floatRemote()) floatEmoji(data.emoji);
        }
        if (state.isHost) relayToOthers(conn, data);
        break;

      case "doodle":
        // {op:"start"|"pt"|"end"|"clear", id, name?, color?, x?, y?, pts?}
        // freehand strokes on the doodle layer; fade after 7s.
        try { Doodles.onRemote(data); } catch (e) {}
        if (state.isHost) relayToOthers(conn, data);
        break;

      case "sys":
        sysMsg(data.text);
        break;

      case "subs":
        // host -> viewers: shared subtitle text (already VTT)
        if (window.WPSubs && data.vtt) {
          WPSubs.loadInto(player, data.vtt, { label: "Subtitles" });
          state.subTrack = player.querySelector("track[data-wp]");
          toast("Subtitles loaded.", "ok");
        }
        break;

      case "f-meta":
      case "f-done":
        // legacy chunked-transfer messages — ignore (we use sync-position-only now)
        break;

      case "sync":
      case "play":
      case "pause":
      case "seek":
        applySync(data);
        break;

      case "src":
        // peer changed source type
        state.srcType = data.srcType;
        if (data.srcType === "file") {
          // sync-position: the peer loaded a file — tell the viewer to load the same one
          if (data.fileName) {
            state.fileName = data.fileName;
            if (!player.src || player.src === "") {
              // viewer hasn't loaded a file yet — prompt them
              showEmpty("Open: " + data.fileName, "Load the same file on your device, then you'll sync automatically.");
              toast("Host loaded " + data.fileName + " — open the same file to watch together.", "ok");
            }
          }
        } else if (data.srcType === "screen") {
          showOverlay(true, "Host is sharing their screen…", true);
        } else if (data.srcType === "none") {
          showEmpty("Nothing playing yet", "Open a video file or share your screen.");
        }
        break;

      case "screen-stop":
        detachRemoteStream();
        showEmpty("Host stopped sharing", "Waiting for host…");
        break;

      case "ping":
        try { conn.send({ t: "pong", ts: data.ts }); } catch (e) {}
        break;
      case "pong":
        if (state.peers[conn.peer]) {
          var rtt = Date.now() - data.ts;
          state.peers[conn.peer].rtt = rtt;
          renderLatency();
        }
        break;
    }
  }

  /* ============================================================
     UI helpers — overlay, empty, peers, latency, transfer
     ============================================================ */
  function showOverlay(show, text, spinner) {
    var o = $("video-overlay");
    if (show === false) { o.classList.add("hidden"); return; }
    o.classList.remove("hidden");
    if (text) $("overlay-text").textContent = text;
    $("overlay-spinner").classList.toggle("hidden", !spinner);
  }
  function hideOverlay() { $("video-overlay").classList.add("hidden"); }

  // viewer-side: show a "connecting…" overlay while waiting for the host
  function setOverlayWaiting() {
    showOverlay(true, "Connecting to room…", true);
  }

  function showEmpty(title, sub) {
    var e = $("video-empty");
    e.classList.remove("hidden");
    if (title) $("ve-title").textContent = title;
    if (sub) $("ve-sub").textContent = sub;
  }
  function hideEmpty() { $("video-empty").classList.add("hidden"); }

  function renderPeers() {
    var box = $("peers");
    // clear chips but keep the label
    var label = box.querySelector(".peers-label");
    box.innerHTML = "";
    box.appendChild(label);

    var keys = Object.keys(state.peers);
    if (keys.length === 0) {
      var empty = document.createElement("span");
      empty.className = "peers-empty";
      empty.textContent = state.isHost ? "waiting for viewers…" : "connecting…";
      box.appendChild(empty);
      return;
    }
    for (var i = 0; i < keys.length; i++) {
      var p = state.peers[keys[i]];
      var chip = document.createElement("span");
      chip.className = "peer-chip";
      var dot = document.createElement("span");
      dot.className = "pdot " + (p.status || "on");
      chip.appendChild(dot);
      var nm = document.createElement("span");
      nm.textContent = p.name || "Peer";
      chip.appendChild(nm);
      if (p.rtt) {
        var r = document.createElement("span");
        r.style.opacity = "0.6";
        r.textContent = p.rtt + "ms";
        chip.appendChild(r);
      }
      box.appendChild(chip);
    }
    // also show "you" (with avatar if set)
    var me = document.createElement("span");
    me.className = "peer-chip you";
    var meAvatar = makeAvatar(state.name, state.pfp);
    meAvatar.classList.add("avatar-sm");
    me.appendChild(meAvatar);
    var meLabel = document.createElement("span");
    meLabel.textContent = state.name + " (you)";
    me.appendChild(meLabel);
    box.appendChild(me);

    // warn if TURN isn't configured (cross-network won't work)
    if (!TURN_CONFIGURED) {
      var warn = document.createElement("span");
      warn.className = "turn-warn";
      warn.textContent = "⚠ TURN not set — only same-network works";
      warn.title = "Cross-network connections need a TURN relay. ExpressTURN credentials are in app.js.";
      box.appendChild(warn);
    }
  }

  function renderLatency() {
    var keys = Object.keys(state.peers);
    if (!keys.length) { $("latency").textContent = "--"; return; }
    // average rtt
    var sum = 0, n = 0;
    for (var i = 0; i < keys.length; i++) {
      var r = state.peers[keys[i]].rtt;
      if (r) { sum += r; n++; }
    }
    $("latency").textContent = n ? (Math.round(sum / n) + " ms") : "--";
  }

  function setRole(isHost) {
    state.isHost = isHost;
    var b = $("role-badge");
    if (isHost) {
      b.textContent = "Host";
      b.className = "badge badge-host";
    } else {
      b.textContent = "Viewer";
      b.className = "badge badge-viewer";
    }
    // everyone can open files (sync-position — each loads their own copy)
    $("file-btn").style.display = "";
    $("become-host").classList.add("hidden");
  }

  function enterRoomUI(code) {
    showScreen("room");
    $("room-code").textContent = code;
    // Tap the room code to copy the code itself (handy for "tell me the code").
    var rc = $("room-code");
    if (rc && !rc.dataset.wired) {
      rc.dataset.wired = "1";
      rc.style.cursor = "pointer";
      rc.title = "Tap to copy code";
      rc.addEventListener("click", function () {
        var c = state.room || rc.textContent;
        if (!c) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(c).then(function(){ toast("Code " + c + " copied", "ok"); }, function(){ fallbackCopy(c) && toast("Code " + c + " copied", "ok"); });
        } else { fallbackCopy(c) && toast("Code " + c + " copied", "ok"); }
      });
    }
    renderPeers();
    DataMeter.render();          // zero the chip on (re)entry
    try { ChatDrawer.showInitial(); } catch (e) {}   // show FAB on mobile

    // Request Wake Lock so the OS doesn't throttle/sleep the tab while in a room.
    // This keeps the WebRTC connection alive and video playing in the background.
    requestWakeLock();
  }

  /* ---- Wake Lock: prevent OS from sleeping/throttling the tab ---- */
  function requestWakeLock() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (lock) {
      state.wakeLock = lock;
      // if Wake Lock is released (e.g. tab goes background on some browsers), re-request
      lock.addEventListener("release", function () { state.wakeLock = null; });
    }).catch(function () { /* Wake Lock not available or denied — no-op */ });
  }
  function releaseWakeLock() {
    if (state.wakeLock) {
      try { state.wakeLock.release(); } catch (e) {}
      state.wakeLock = null;
    }
  }

  function offerBecomeHost() {
    // shown when the viewer loses the host — let them take over
    $("become-host").classList.remove("hidden");
  }

  /* ============================================================
     DataMeter — tracks bytes sent/received over PeerJS connections
     and exposes Network Information API context + a Data Saver mode.
     Observation only: it never alters message payloads.
     ============================================================ */
  var DataMeter = (function () {
    var sent = 0, recv = 0;
    // per-bucket byte totals, keyed by message type (chat/sync/ping/...)
    var buckets = {
      sent: { chat: 0, react: 0, sync: 0, ping: 0, subs: 0, other: 0 },
      recv: { chat: 0, react: 0, sync: 0, ping: 0, subs: 0, other: 0 }
    };
    var KNOWN = { chat: 1, react: 1, sync: 1, play: 1, pause: 1, seek: 1,
                  ping: 1, pong: 1, subs: 1, hello: 1, join: 1, sys: 1,
                  src: 1, "screen-stop": 1, "f-meta": 1, "f-done": 1 };

    function bucketName(t) { return KNOWN[t] ? t : "other"; }

    // Rough byte cost of a message — string length is a good approximation
    // for the JSON that goes on the wire. Wrapped in try/catch so a
    // non-serializable payload never breaks sending.
    function byteCost(msg) {
      try { return JSON.stringify(msg).length; } catch (e) { return 0; }
    }

    function addSent(msg) {
      var n = byteCost(msg); if (!n) return;
      sent += n;
      var t = msg && msg.t ? msg.t : "other";
      buckets.sent[bucketName(t)] += n;
      scheduleRender();
    }
    function addRecv(msg) {
      var n = byteCost(msg); if (!n) return;
      recv += n;
      var t = msg && msg.t ? msg.t : "other";
      buckets.recv[bucketName(t)] += n;
      scheduleRender();
    }

    // wrap a PeerJS data connection so every send() is accounted for.
    function wrapConn(conn) {
      if (!conn || conn.__wpMetered) return conn;
      conn.__wpMetered = true;
      var orig = conn.send;
      conn.send = function (msg) {
        try { addSent(msg); } catch (e) {}
        return orig.apply(conn, arguments);
      };
      return conn;
    }

    function human(n) {
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
      return (n / (1024 * 1024)).toFixed(n < 1048576 ? 2 : 1) + " MB";
    }

    // throttle DOM updates so a burst of messages doesn't thrash the chip
    var _rTO = null;
    function scheduleRender() {
      if (_rTO) return;
      _rTO = setTimeout(function () { _rTO = null; render(); }, 250);
    }

    function render() {
      // combine JSON message bytes + WebRTC media bytes for total
      var mt = typeof MediaMeter !== "undefined" ? MediaMeter.totals() : { mediaSent: 0, mediaRecv: 0 };
      var totalSent = sent + mt.mediaSent;
      var totalRecv = recv + mt.mediaRecv;
      var up = $("data-up"), down = $("data-down");
      if (up) up.textContent = human(totalSent);
      if (down) down.textContent = human(totalRecv);
      var su = $("set-data-up"), sd = $("set-data-down");
      if (su) su.textContent = human(totalSent);
      if (sd) sd.textContent = human(totalRecv);
      renderDetail(mt);
    }

    function renderDetail(mt) {
      if (!mt) mt = typeof MediaMeter !== "undefined" ? MediaMeter.totals() : { mediaSent: 0, mediaRecv: 0 };
      var box = $("data-detail");
      if (!box) return;
      // group buckets into a friendly set: chat, sync, react, ping, subs, other
      var GROUPS = [
        { name: "chat",  types: ["chat", "sys", "hello", "join"] },
        { name: "sync",  types: ["sync", "play", "pause", "seek", "src", "screen-stop"] },
        { name: "react", types: ["react"] },
        { name: "ping",  types: ["ping", "pong"] },
        { name: "subs",  types: ["subs"] },
        { name: "other", types: ["other", "f-meta", "f-done"] }
      ];
      box.innerHTML = "";
      for (var i = 0; i < GROUPS.length; i++) {
        var g = GROUPS[i];
        var s = 0, r = 0;
        for (var j = 0; j < g.types.length; j++) {
          s += buckets.sent[g.types[j]] || 0;
          r += buckets.recv[g.types[j]] || 0;
        }
        if (!s && !r) continue;       // hide empty buckets
        var total = s + r;
        var row = document.createElement("div");
        row.className = "data-row";
        var nm = document.createElement("span"); nm.className = "data-row-name"; nm.textContent = g.name; row.appendChild(nm);
        var barWrap = document.createElement("span"); barWrap.className = "data-bar";
        var sentPct = total ? (s / total) * 100 : 0;
        // sent portion (accent) on the left, recv portion (ok) on the right
        barWrap.innerHTML =
          '<span class="data-bar-fill" style="width:' + sentPct + '%"></span>' +
          '<span class="data-bar-fill recv" style="width:' + (100 - sentPct) + '%; position:absolute; right:0;"></span>';
        barWrap.style.position = "relative";
        row.appendChild(barWrap);
        var val = document.createElement("span"); val.className = "data-row-val";
        val.textContent = human(total);
        row.appendChild(val);
        box.appendChild(row);
      }
      // media (video/audio) row from WebRTC transport stats
      if (mt.mediaSent || mt.mediaRecv) {
        var mtTotal = mt.mediaSent + mt.mediaRecv;
        var mRow = document.createElement("div");
        mRow.className = "data-row";
        var mNm = document.createElement("span"); mNm.className = "data-row-name"; mNm.textContent = "media (video/audio)"; mRow.appendChild(mNm);
        var mBar = document.createElement("span"); mBar.className = "data-bar";
        var mSentPct = mtTotal ? (mt.mediaSent / mtTotal) * 100 : 0;
        mBar.innerHTML =
          '<span class="data-bar-fill" style="width:' + mSentPct + '%"></span>' +
          '<span class="data-bar-fill recv" style="width:' + (100 - mSentPct) + '%; position:absolute; right:0;"></span>';
        mBar.style.position = "relative";
        mRow.appendChild(mBar);
        var mVal = document.createElement("span"); mVal.className = "data-row-val";
        mVal.textContent = human(mtTotal);
        mRow.appendChild(mVal);
        box.appendChild(mRow);
      }
      if (!box.children.length) {
        var empty = document.createElement("div");
        empty.className = "set-note";
        empty.textContent = "No peer traffic yet — counts start when you create or join a room.";
        box.appendChild(empty);
      }
    }

    function reset() {
      sent = 0; recv = 0;
      buckets = {
        sent: { chat: 0, react: 0, sync: 0, ping: 0, subs: 0, other: 0 },
        recv: { chat: 0, react: 0, sync: 0, ping: 0, subs: 0, other: 0 }
      };
      render();
    }

    return {
      wrapConn: wrapConn,
      addSent: addSent,
      addRecv: addRecv,
      render: render,
      scheduleRender: scheduleRender,
      reset: reset,
      totals: function () { return { sent: sent, recv: recv }; }
    };
  })();

  /* ---- MediaMeter: WebRTC transport-level byte counter ---- */
  // Tracks actual media bytes (video/audio screen share) via getStats().
  // PeerJS exposes the raw RTCPeerConnection on MediaConnection.peerConnection.
  var MediaMeter = (function () {
    var mediaSent = 0, mediaRecv = 0;
    var _timer = null, _prevSent = {}, _prevRecv = {};
    var POLL_MS = 2000;

    function start(pc) {
      if (!pc || typeof pc.getStats !== "function") return;
      if (_timer) clearInterval(_timer);
      _prevSent = {}; _prevRecv = {};
      _timer = setInterval(function () { poll(pc); }, POLL_MS);
    }

    function poll(pc) {
      if (!pc || pc.connectionState === "closed") { stop(); return; }
      try {
        pc.getStats().then(function (report) {
          var totalS = 0, totalR = 0;
          report.forEach(function (stat) {
            // Prefer candidate-pair (the active transport pair) for most
            // accurate aggregate byte counts. Fall back to summing all
            // outbound/inbound-rtp streams.
            if (stat.type === "candidate-pair" && stat.state === "succeeded") {
              if (typeof stat.bytesSent === "number") totalS += stat.bytesSent;
              if (typeof stat.bytesReceived === "number") totalR += stat.bytesReceived;
            } else if (stat.type === "outbound-rtp" && typeof stat.bytesSent === "number") {
              totalS += stat.bytesSent;
            } else if (stat.type === "inbound-rtp" && typeof stat.bytesReceived === "number") {
              totalR += stat.bytesReceived;
            }
          });
          // accumulate deltas (counters may reset on renegotiation)
          var id = pc.id || "_main";
          if (_prevSent[id] !== undefined) {
            var ds = totalS - _prevSent[id];
            var dr = totalR - _prevRecv[id];
            if (ds > 0) mediaSent += ds;
            if (dr > 0) mediaRecv += dr;
          }
          _prevSent[id] = totalS;
          _prevRecv[id] = totalR;
          DataMeter.scheduleRender();
        }).catch(function () {});
      } catch (e) {}
    }

    function stop() {
      if (_timer) { clearInterval(_timer); _timer = null; }
    }

    function reset() {
      stop();
      mediaSent = 0; mediaRecv = 0;
      _prevSent = {}; _prevRecv = {};
    }

    function totals() { return { mediaSent: mediaSent, mediaRecv: mediaRecv }; }

    return { start: start, stop: stop, reset: reset, totals: totals };
  })();

  /* ---- Network Information API + Data Saver ---- */
  // DataSaver changes how often the host syncs + how often we ping, and
  // suppresses the cosmetic floating-reaction animation. Honored live.
  var DataSaver = {
    ON: false,
    PING_MS: 3000,
    PING_MS_SAVE: 10000,
    SYNC_MS: 4000,
    SYNC_MS_SAVE: 8000,
    pingMs: function () { return this.ON ? this.PING_MS_SAVE : this.PING_MS; },
    syncMs: function () { return this.ON ? this.SYNC_MS_SAVE : this.SYNC_MS; },
    // when on, remote reactions still attach to bubbles but skip the float
    floatRemote: function () { return !this.ON; },
    set: function (on) {
      this.ON = !!on;
      try { localStorage.setItem("wp-datasaver", this.ON ? "1" : "0"); } catch (e) {}
      // rebuild the timers so the new interval takes effect immediately
      try { if (state.isHost) startHostSync(); } catch (e) {}
      try { startPing(); } catch (e) {}
    },
    load: function () {
      try { this.ON = localStorage.getItem("wp-datasaver") === "1"; } catch (e) {}
      return this.ON;
    }
  };

  /* ---- DoodleBar — whether the drawing toolbar is shown ---- */
  var DoodleBar = {
    KEY: "wp-doodlebar",
    ON: true,         // default: toolbar visible when drawing
    load: function () {
      try {
        var v = localStorage.getItem(this.KEY);
        if (v === "off") this.ON = false;
        else this.ON = true;
      } catch (e) {}
      return this.ON;
    },
    set: function (on) {
      this.ON = !!on;
      try { localStorage.setItem(this.KEY, this.ON ? "on" : "off"); } catch (e) {}
      // apply immediately if currently drawing
      try { applyDoodleBarVisibility(); } catch (e) {}
    }
  };
  DoodleBar.load();

  function applyDoodleBarVisibility() {
    var bar = $("doodle-bar");
    var hideBtn = $("fs-hidebar-btn");
    if (!bar) return;
    // only visible when: drawing mode is ON AND DoodleBar.ON is true
    var show = Doodles.isOn() && DoodleBar.ON;
    bar.hidden = !show;
    if (hideBtn) hideBtn.hidden = !show;
  }

  /* ------------------------------------------------------------
     ChatOpacity — message & background opacity for the FULLSCREEN
     chat overlay (0–100%). Persisted in localStorage, written to
     the CSS vars --fs-chat-text-op / --fs-chat-bg-op on :root.
       text = opacity of each message as a unit (bubble + text)
       bg   = opacity of the panel sheet behind the messages
     The CSS only consumes them inside the FS overlay, so the
     normal (non-fullscreen) chat is untouched.
     ------------------------------------------------------------ */
  var ChatOpacity = {
    KEY: "wp-chat-opacity",
    DEF_TEXT: 80,
    DEF_BG: 100,
    text: 80,
    bg: 100,
    clamp: function (n) {
      n = parseInt(n, 10);
      if (isNaN(n)) n = 0;
      if (n < 0) n = 0;
      if (n > 100) n = 100;
      return n;
    },
    // push current values into the CSS custom properties
    apply: function () {
      var root = document.documentElement;
      root.style.setProperty("--fs-chat-text-op", (this.text / 100).toString());
      root.style.setProperty("--fs-chat-bg-op", (this.bg / 100).toString());
    },
    set: function (text, bg) {
      this.text = this.clamp(text);
      this.bg = this.clamp(bg);
      try {
        localStorage.setItem(this.KEY, JSON.stringify({ text: this.text, bg: this.bg }));
      } catch (e) {}
      this.apply();
    },
    load: function () {
      try {
        var raw = localStorage.getItem(this.KEY);
        if (raw) {
          var o = JSON.parse(raw);
          this.text = this.clamp(o.text != null ? o.text : this.DEF_TEXT);
          this.bg = this.clamp(o.bg != null ? o.bg : this.DEF_BG);
        }
      } catch (e) {}
      this.apply();
      return { text: this.text, bg: this.bg };
    }
  };

  function getConnection() {
    return (navigator.connection || navigator.mozConnection || navigator.webkitConnection) || null;
  }

  function renderNetInfo() {
    var box = $("net-info");
    if (!box) return;
    var c = getConnection();
    if (!c) {
      box.innerHTML =
        '<div class="net-info-row"><span>Network API</span><span>Not available</span></div>' +
        '<div class="net-info-row"><span>Browser</span><span>' + esc(navigator.userAgent.split(") ")[0].split("(").pop() || "unknown") + '</span></div>';
      return;
    }
    var rows = [];
    var et = c.effectiveType;
    if (et) rows.push(['Effective type', et.toUpperCase()]);
    var tp = c.type;
    if (tp) rows.push(['Connection', tp]);
    if (c.downlink != null) rows.push(['Downlink', c.downlink + ' Mbps']);
    if (c.rtt != null) rows.push(['RTT (est.)', c.rtt + ' ms']);
    if (c.saveData) rows.push(['Save-Data', 'requested']);
    rows.push(['Data Saver', DataSaver.ON ? 'On' : 'Off']);
    box.innerHTML = "";
    for (var i = 0; i < rows.length; i++) {
      var r = document.createElement("div");
      r.className = "net-info-row";
      r.innerHTML = '<span>' + esc(rows[i][0]) + '</span><span>' + esc(String(rows[i][1])) + '</span>';
      box.appendChild(r);
    }
  }

  /* ============================================================
     ChatDrawer — mobile slide-in chat panel + FAB + auto-hide.
     On desktop it's a no-op (chat is a static column there).
     ============================================================ */
  var ChatDrawer = (function () {
    var panel, backdrop, fab, badge, input;
    var isOpen = false;
    var unread = 0;
    var idleTO = null;
    var IDLE_MS = 8000;     // auto-hide after this long idle while video plays
    var isMobile = null;    // cached; recomputed on resize
    var lastInteract = 0;

    function mobile() {
      if (isMobile === null || true) {
        isMobile = window.matchMedia("(max-width: 1023px)").matches &&
                   !window.matchMedia("(max-width: 1023px) and (orientation: landscape) and (max-height: 500px)").matches;
      }
      return isMobile;
    }

    function init() {
      panel = $("chat");
      backdrop = $("chat-backdrop");
      fab = null;        // FAB removed — chat is opened from the action bar
      badge = $("chat-act-badge");
      input = $("chat-input");
      isMobile = window.matchMedia("(max-width: 1023px)").matches;

      // Chat action button (in the controls tray) toggles the sheet
      var chatBtn = $("chat-btn");
      if (chatBtn) chatBtn.addEventListener("click", function () { toggle(); });

      // backdrop closes
      if (backdrop) backdrop.addEventListener("click", function () { close(); });

      // ESC closes (desktop convenience / hardware keyboards)
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isOpen) close();
      });

      // refresh mobile flag on resize/orientation change
      window.addEventListener("resize", function () {
        isMobile = window.matchMedia("(max-width: 1023px)").matches;
        if (!mobile()) {
          // desktop: ensure clean state
          if (panel) panel.style.transform = "";
          hideBackdrop();
        }
      });

      // user activity inside the chat postpones auto-hide
      ["click", "touchstart", "input"].forEach(function (ev) {
        if (panel) panel.addEventListener(ev, bumpIdle, { passive: true });
      });

      wireSwipe();
    }

    function bumpIdle() {
      lastInteract = Date.now();
      scheduleHide();
    }

    function scheduleHide() {
      if (idleTO) clearTimeout(idleTO);
      // only auto-hide on mobile, when open, while a video is actually playing
      if (!mobile() || !isOpen) return;
      idleTO = setTimeout(function () {
        try {
          if (player && !player.paused && player.src) {
            // don't hide if the user is actively typing / input is focused
            if (document.activeElement !== input) close();
            else scheduleHide();   // try again later
          }
        } catch (e) {}
      }, IDLE_MS);
    }

    function showBackdrop() { if (backdrop) backdrop.classList.remove("hidden"); }
    function hideBackdrop() { if (backdrop) backdrop.classList.add("hidden"); }

    function open() {
      if (!mobile()) return;        // desktop: nothing to do
      isOpen = true;
      panel.classList.add("open");
      showBackdrop();
      clearUnread();
      // focus the input so typing is instant — one tap to text
      setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 280);
      bumpIdle();
    }
    function close() {
      if (!mobile()) return;
      isOpen = false;
      panel.classList.remove("open");
      panel.classList.remove("dragging");
      panel.style.transform = "";
      hideBackdrop();
      if (idleTO) { clearTimeout(idleTO); idleTO = null; }
      try { input.blur(); } catch (e) {}
    }
    function toggle() { if (isOpen) close(); else open(); }

    // incoming chat while closed => increment the badge
    function onIncoming() {
      if (!mobile()) return;        // desktop always shows chat
      if (isOpen) { clearUnread(); return; }
      unread++;
      if (badge) {
        badge.textContent = unread > 99 ? "99+" : String(unread);
        badge.classList.remove("hidden");
      }
    }
    function clearUnread() {
      unread = 0;
      if (badge) badge.classList.add("hidden");
    }

    // drag handle: drag the sheet down by its top knob to dismiss it
    function wireSwipe() {
      if (!panel) return;
      var knob = $("chat-swipe");
      var start = null, height = 0, dragging = false;

      function begin(clientY) {
        if (!isOpen) return;
        height = panel.getBoundingClientRect().height;
        start = clientY;
        dragging = true;
        panel.classList.add("dragging");
      }
      function move(clientY) {
        if (!dragging) return;
        var dy = Math.max(0, clientY - start);   // only allow dragging downward
        panel.style.transform = "translateY(" + dy + "px)";
      }
      function end() {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove("dragging");
        var cur = panel.getBoundingClientRect().top;
        var openTop = window.innerHeight - height;
        // if dragged more than ~35% of the way shut, close
        if (cur - openTop > height * 0.35) {
          panel.style.transform = "";
          close();
        } else {
          panel.style.transform = "";
        }
      }

      if (knob) {
        knob.addEventListener("touchstart", function (e) {
          begin(e.touches[0].clientY);
        }, { passive: true });
        knob.addEventListener("touchmove", function (e) {
          move(e.touches[0].clientY);
        }, { passive: true });
        knob.addEventListener("touchend", end);
        // mouse support (desktop testing of mobile width)
        knob.addEventListener("mousedown", function (e) { begin(e.clientY); });
      }
      window.addEventListener("mousemove", function (e) { if (dragging) move(e.clientY); });
      window.addEventListener("mouseup", function () { if (dragging) end(); });
      window.addEventListener("touchmove", function (e) { if (dragging) move(e.touches[0].clientY); }, { passive: true });
      window.addEventListener("touchend", function () { if (dragging) end(); });
    }

    function showInitial() {
      // nothing to show now that the FAB is gone — kept for API compatibility
    }

    return {
      init: init,
      open: open,
      close: close,
      toggle: toggle,
      onIncoming: onIncoming,
      showInitial: showInitial,
      isOpen: function () { return isOpen; },
      isMobile: mobile
    };
  })();

  /* ============================================================
     Chat — avatars, replies, per-message reactions
     ============================================================ */

  var REPLY_TO = null;   // when set: { name, text } — the message we're replying to

  // Monotonic message id, scoped to this peer. Used so reactions land on the
  // right bubble across the relay.
  var _msgSeq = 0;
  function newMid() { _msgSeq++; return state.peer ? (state.peer.id.slice(-4) + "-" + _msgSeq) : ("m" + _msgSeq); }

  function addChat(opts) {
    // opts: { name, pfp, text, mid, reply, sys }
    var box = $("chat-msgs");
    var div = document.createElement("div");

    if (opts.sys) {
      div.className = "msg sys";
      div.textContent = opts.text;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
      while (box.children.length > 200) box.removeChild(box.firstChild);
      // persist system messages to chat history
      if (state.chatHistory.length < 500) {
        state.chatHistory.push({ sys: true, text: opts.text, ts: Date.now() });
      }
      return;
    }

    var mine = (opts.name === state.name);
    div.className = "msg" + (mine ? " me" : "");
    if (opts.mid) div.dataset.mid = opts.mid;

    // ---- message grouping (Discord-like) ----
    // consecutive messages from the same sender within GROUP_MS collapse:
    // avatar + meta hidden, tighter spacing.
    var GROUP_MS = 60000;
    var last = box.lastElementChild;
    var groupable = false;
    if (last && last.classList.contains("msg") && !last.classList.contains("sys")) {
      var lw = last.querySelector(".meta .who");
      var lt = last.querySelector(".meta .time");
      if (lw && lw.textContent === opts.name) {
        // rough: rely on a stored timestamp on the node
        var ts = parseInt(last.getAttribute("data-ts") || "0", 10);
        if (ts && (Date.now() - ts) < GROUP_MS) groupable = true;
      }
    }
    if (groupable) {
      div.classList.add("grouped");
      // carry the timestamp forward so the group window keeps extending
      div.setAttribute("data-ts", last.getAttribute("data-ts"));
    } else {
      div.setAttribute("data-ts", String(Date.now()));
    }

    // avatar
    var av = makeAvatar(opts.name, opts.pfp);
    div.appendChild(av);

    var content = document.createElement("div");
    content.className = "msg-content";

    // meta line
    var meta = document.createElement("div");
    meta.className = "meta";
    var who = document.createElement("span");
    who.className = "who";
    who.textContent = opts.name;
    meta.appendChild(who);
    var t = document.createElement("span");
    t.className = "time";
    t.textContent = nowHHMM();
    meta.appendChild(t);
    content.appendChild(meta);

    // quoted reply block
    if (opts.reply && opts.reply.text) {
      var q = document.createElement("div");
      q.className = "reply-quote";
      var qn = document.createElement("span");
      qn.className = "reply-quote-name";
      qn.textContent = "↳ " + (opts.reply.name || "");
      q.appendChild(qn);
      var qt = document.createElement("span");
      qt.className = "reply-quote-text";
      qt.textContent = opts.reply.text;
      q.appendChild(qt);
      content.appendChild(q);
    }

    // body
    var body = document.createElement("div");
    body.className = "body";
    if (opts.kind === "sticker" && opts.sticker) {
      // sticker message: render a glyph or image instead of text.
      body.classList.add("sticker-msg");
      if (opts.sticker.emoji) {
        var sp = document.createElement("span");
        sp.className = "sticker-emoji";
        sp.textContent = opts.sticker.emoji;   // textContent = safe
        body.appendChild(sp);
        // keep a hidden text twin so copy/search/reply-preview still see it
        opts.text = opts.sticker.emoji;
      } else if (opts.sticker.img) {
        var im = document.createElement("img");
        im.className = "sticker-img";
        im.src = opts.sticker.img;
        im.alt = "sticker";
        im.loading = "lazy";
        // hint text used by reply previews / toasts
        opts.text = "🖼️ sticker";
        body.appendChild(im);
      }
    } else {
      body.textContent = opts.text;     // textContent = safe (no HTML injection)
    }
    content.appendChild(body);

    // reactions row (filled by applyReaction)
    var reactRow = document.createElement("div");
    reactRow.className = "react-row";
    content.appendChild(reactRow);

    div.appendChild(content);

    // long-press / hover to open the reaction picker for this message
    attachReactPicker(div, opts.mid);

    // tap reply-quote or message to reply
    attachReply(div, opts);

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    // cap history
    while (box.children.length > 200) box.removeChild(box.firstChild);
    // persist to chat history (for rejoining viewers)
    if (state.chatHistory.length < 500) {
      state.chatHistory.push({
        name: opts.name, pfp: opts.pfp, text: opts.text, mid: opts.mid,
        kind: opts.kind || null, sticker: opts.sticker || null,
        reply: opts.reply || null, ts: Date.now()
      });
    }
  }
  function sysMsg(text) { addChat({ sys: true, text: text }); }

  // Reactions accumulator: mid -> { emoji -> { count, names:[] } }
  var _reactions = {};
  function applyReaction(mid, emoji, name) {
    if (!mid || !emoji) return;
    var node = mid ? document.querySelector('.msg[data-mid="' + cssEscape(mid) + '"]') : null;
    if (!node) return;
    var row = node.querySelector(".react-row");
    if (!row) return;
    _reactions[mid] = _reactions[mid] || {};
    var bucket = _reactions[mid][emoji] || { count: 0, names: [] };
    if (bucket.names.indexOf(name) === -1) {
      bucket.names.push(name);
      bucket.count++;
    }
    _reactions[mid][emoji] = bucket;

    // (re)render the reactions row
    row.innerHTML = "";
    var emojis = Object.keys(_reactions[mid]);
    for (var i = 0; i < emojis.length; i++) {
      var e = emojis[i];
      var chip = document.createElement("span");
      chip.className = "react-chip";
      // highlight chips the local user has contributed to
      if (_reactions[mid][e].names.indexOf(state.name) !== -1) chip.classList.add("mine");
      chip.title = _reactions[mid][e].names.join(", ");
      chip.innerHTML = esc(e) + " <b>" + _reactions[mid][e].count + "</b>";
      (function (emoji, mid) {
        chip.addEventListener("click", function () {
          // tapping your own reaction toggles it off locally (cosmetic only)
          sendReaction(mid, emoji);
        });
      })(e, mid);
      row.appendChild(chip);
    }
  }

  // Minimal CSS selector escape (mid is short + alphanumeric/dash, so this is
  // mostly belt-and-braces).
  function cssEscape(s) {
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) {
      return "\\" + c;
    });
  }

  // Per-message reaction picker: long-press (mobile) or hover (desktop) shows
  // a small emoji popover anchored to the message.
  var _activePicker = null;
  function attachReactPicker(node, mid) {
    if (!mid) return;
    var pressTimer = null, started = false;

    function open(ev) {
      if (_activePicker) { _activePicker.remove(); _activePicker = null; }
      var tpl = $("react-picker-tpl");
      var pick = tpl.cloneNode(true);
      pick.id = "";
      pick.removeAttribute("aria-hidden");
      pick.classList.remove("hidden");
      pick.classList.add("react-picker-open");
      // anchor under the message
      pick.style.position = "absolute";
      node.style.position = "relative";
      node.appendChild(pick);
      _activePicker = pick;
      ev.preventDefault();
      ev.stopPropagation();
      var btns = pick.querySelectorAll("button");
      for (var i = 0; i < btns.length; i++) {
        (function (b) {
          b.addEventListener("click", function (e2) {
            e2.stopPropagation();
            sendReaction(mid, b.getAttribute("data-e"));
            if (_activePicker) { _activePicker.remove(); _activePicker = null; }
          });
        })(btns[i]);
      }
      // close on outside tap
      setTimeout(function () {
        document.addEventListener("click", closeOnOutside, true);
      }, 0);
    }
    function closeOnOutside(ev) {
      if (_activePicker && !_activePicker.contains(ev.target)) {
        _activePicker.remove(); _activePicker = null;
        document.removeEventListener("click", closeOnOutside, true);
      }
    }

    // long-press for touch
    node.addEventListener("touchstart", function (e) {
      started = true;
      pressTimer = setTimeout(function () {
        if (started) open(e);
      }, 450);
    }, { passive: true });
    node.addEventListener("touchend", function () { started = false; clearTimeout(pressTimer); });
    node.addEventListener("touchmove", function () { started = false; clearTimeout(pressTimer); });

    // right-click / contextmenu for desktop & mouse
    node.addEventListener("contextmenu", function (e) { open(e); });
    // a dedicated "react" button is also rendered for discoverability on mobile
    var reactBtn = document.createElement("button");
    reactBtn.className = "msg-react-btn";
    reactBtn.type = "button";
    reactBtn.title = "React";
    reactBtn.setAttribute("aria-label", "React to message");
    reactBtn.innerHTML = "😀";
    reactBtn.addEventListener("click", function (e) { e.stopPropagation(); open(e); });
    var content = node.querySelector(".msg-content");
    if (content) content.appendChild(reactBtn);
  }

  // Reply wiring: tap a message to set it as the reply target.
  function attachReply(node, opts) {
    if (!opts.mid) return;
    var replyHit = node.querySelector(".reply-quote") || node.querySelector(".body");
    if (!replyHit) return;
    replyHit.style.cursor = "pointer";
    replyHit.addEventListener("click", function (e) {
      // don't hijack taps on reaction chips or the react button
      if (e.target.closest(".react-chip") || e.target.closest(".msg-react-btn")) return;
      setReply({ name: opts.name, text: opts.text });
    });
  }

  function setReply(target) {
    REPLY_TO = target;
    var box = $("reply-preview");
    if (!target) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    $("reply-preview-name").textContent = target.name + "";
    $("reply-preview-text").textContent = (target.text || "").slice(0, 80);
    $("chat-input").focus();
  }

  function sendReaction(mid, emoji) {
    if (!mid || !emoji) return;
    applyReaction(mid, emoji, state.name);
    floatEmoji(emoji);
    var msg = { t: "react", mid: mid, emoji: emoji, name: state.name };
    broadcast(msg);
  }

  function sendChat(text) {
    if (!text.trim()) return;
    var mid = newMid();
    var opts = {
      name: state.name,
      pfp: state.pfp,
      text: text,
      mid: mid,
      reply: REPLY_TO ? { name: REPLY_TO.name, text: (REPLY_TO.text || "").slice(0, 120) } : null
    };
    addChat(opts);
    // send to peers (host broadcasts; viewer sends to host who relays)
    var payload = { t: "chat", name: state.name, pfp: state.pfp, text: text, mid: mid };
    if (opts.reply) payload.reply = opts.reply;
    broadcast(payload);
    setReply(null);   // clear reply target after sending
    // mirror our own message into the fullscreen overlay
    try { FsChat.onNewMessage({ name: state.name, text: text }); } catch (e) {}
  }

  function wireChat() {
    // initialize the mobile drawer / FAB / swipe / auto-hide
    ChatDrawer.init();

    $("chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var inp = $("chat-input");
      var v = inp.value;
      inp.value = "";
      sendChat(v);
      // typing activity: keep the drawer open a moment longer
      try { ChatDrawer.open(); } catch (e2) {}
    });

    // cancel reply
    $("reply-cancel").addEventListener("click", function () { setReply(null); });

    // quick-reaction bar: tapping a fire emoji floats it on the video + sends
    var quicks = document.querySelectorAll(".react-quick");
    for (var i = 0; i < quicks.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var emoji = btn.getAttribute("data-emoji");
          floatEmoji(emoji);
          broadcast({ t: "react", mid: null, emoji: emoji, name: state.name });
        });
      })(quicks[i]);
    }

    // desktop-only close button (kept for keyboard accessibility)
    var toggle = $("chat-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        // on desktop chat is always visible; this is a no-op affordance there.
        // (Real mobile control is the FAB / swipe.)
      });
    }
  }

  /* ============================================================
     Settings sheet + data chip wiring
     ============================================================ */
  function openSettings() {
    document.body.classList.add("sheet-open");
    $("settings-backdrop").classList.remove("hidden");
    $("settings-sheet").classList.remove("hidden");
    DataMeter.render();
    renderNetInfo();
    TurnMonitor.update();
  }
  function closeSettings() {
    $("settings-backdrop").classList.add("hidden");
    $("settings-sheet").classList.add("hidden");
    document.body.classList.remove("sheet-open");
  }
  function wireSettings() {
    $("settings-btn").addEventListener("click", openSettings);
    $("settings-close").addEventListener("click", closeSettings);
    $("settings-backdrop").addEventListener("click", closeSettings);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("settings-sheet").classList.contains("hidden")) closeSettings();
    });
    // data chip is also a shortcut into settings
    $("data-chip").addEventListener("click", openSettings);

    // data saver toggle — honored live (timers rebuilt on change)
    var saved = DataSaver.load();
    var tog = $("datasaver-toggle");
    if (saved) tog.checked = true;
    tog.addEventListener("change", function () {
      DataSaver.set(tog.checked);
      renderNetInfo();
      toast("Data Saver " + (tog.checked ? "on — syncing less often." : "off."), tog.checked ? "ok" : "");
    });

    // doodle bar visibility toggle
    var dbTog = $("doodlebar-toggle");
    if (dbTog) {
      dbTog.checked = DoodleBar.ON;
      dbTog.addEventListener("change", function () {
        DoodleBar.set(dbTog.checked);
        toast("Doodle toolbar " + (dbTog.checked ? "shown." : "hidden."), dbTog.checked ? "ok" : "");
      });
    }

    // ---- Chat opacity (fullscreen) — two range sliders, live ----
    var op = ChatOpacity.load();
    var textSlider = $("fs-text-op");
    var bgSlider = $("fs-bg-op");
    var textVal = $("fs-text-op-val");
    var bgVal = $("fs-bg-op-val");
    textSlider.value = op.text;
    bgSlider.value = op.bg;
    textVal.textContent = op.text + "%";
    bgVal.textContent = op.bg + "%";
    var syncOpacity = function () {
      ChatOpacity.set(textSlider.value, bgSlider.value);
      textVal.textContent = ChatOpacity.text + "%";
      bgVal.textContent = ChatOpacity.bg + "%";
    };
    textSlider.addEventListener("input", syncOpacity);
    bgSlider.addEventListener("input", syncOpacity);

    // react to live network changes (e.g. switch wifi -> cellular)
    var c = getConnection();
    if (c && c.addEventListener) {
      c.addEventListener("change", function () {
        // honor the OS saveData hint automatically on a new connection
        if (c.saveData && !DataSaver.ON) {
          DataSaver.set(true);
          tog.checked = true;
          toast("Data Saver auto-enabled (Save-Data requested).", "ok");
        }
        renderNetInfo();
      });
    }

    // ---- Cloud TURN toggle ----
    var cloudTog = $("cloud-turn-toggle");
    cloudTog.checked = LocalTurn.cloudOn;
    cloudTog.addEventListener("change", function () {
      if (!cloudTog.checked && !$("local-turn-toggle").checked) {
        cloudTog.checked = true;
        toast("At least one TURN source must be active.", "warn");
        return;
      }
      LocalTurn.cloudOn = cloudTog.checked;
      LocalTurn.save();
      toast("Cloud TURN " + (cloudTog.checked ? "enabled." : "disabled."), cloudTog.checked ? "ok" : "");
    });

    // ---- Local Phone TURN toggle ----
    var localTog = $("local-turn-toggle");
    var ltfFields = $("local-turn-fields");
    var d = LocalTurn.get();
    localTog.checked = d.enabled;
    if (d.enabled) ltfFields.classList.remove("hidden");

    // populate saved fields
    $("ltf-host").value = d.host;
    $("ltf-port").value = d.port || 3478;
    $("ltf-user").value = d.username;
    $("ltf-pass").value = d.password;

    localTog.addEventListener("change", function () {
      if (!localTog.checked && !cloudTog.checked) {
        localTog.checked = true;
        toast("At least one TURN source must be active.", "warn");
        return;
      }
      d.enabled = localTog.checked;
      LocalTurn.save();
      if (localTog.checked) {
        ltfFields.classList.remove("hidden");
      } else {
        ltfFields.classList.add("hidden");
      }
      toast("Local Phone TURN " + (localTog.checked ? "enabled — fill in your server details." : "disabled."),
            localTog.checked ? "ok" : "");
      if (localTog.checked) probeLocalTurn();
      else {
        TurnMonitor.localStatus = "Not configured";
        TurnMonitor.localClass = "";
        TurnMonitor.update();
      }
    });

    // ---- Save local TURN fields ----
    $("ltf-save").addEventListener("click", function () {
      d.host     = $("ltf-host").value.trim();
      d.port     = parseInt($("ltf-port").value, 10) || 3478;
      d.username = $("ltf-user").value.trim();
      d.password = $("ltf-pass").value.trim();
      if (!d.host || !d.username || !d.password) {
        toast("Host, username, and password are required.", "warn");
        return;
      }
      LocalTurn.save();
      toast("Local TURN saved! (takes effect on next connection)", "ok");
      probeLocalTurn();
    });

    // ---- Tenor sticker API key ----
    Stickers.loadKey();
    var tenorIn = $("tenor-key");
    if (tenorIn) tenorIn.value = Stickers.getKey();
    $("tenor-save").addEventListener("click", function () {
      var k = (tenorIn.value || "").trim();
      Stickers.saveKey(k);
      toast(k ? "Tenor key saved — search tab unlocked." : "Tenor key cleared.", k ? "ok" : "");
    });
  }

  /* ============================================================
     Action buttons — file / screen / subtitles / fullscreen
     ============================================================ */
  function wireActions() {

    /* ---- Open local file (everyone) ---- */
    $("file-btn").addEventListener("click", function () { $("file-input").click(); });
    $("file-input").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      loadLocalFile(f);
    });

    /* ---- Share screen / camera ---- */
    $("screen-btn").addEventListener("click", function () { toggleScreenShare(); });

    /* ---- Subtitles ---- */
    $("sub-btn").addEventListener("click", function () {
      // if subs already loaded, toggle; otherwise open picker
      if (window.WPSubs && WPSubs.hasSubs(player)) {
        var on = WPSubs.toggle(player);
        toast("Subtitles " + (on ? "on" : "off"));
      } else {
        $("sub-input").click();
      }
    });
    $("sub-input").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      loadSubsFile(f);
    });

    /* ---- Fullscreen ---- */
    $("fullscreen-btn").addEventListener("click", toggleFullscreen);

    /* ---- Draw (doodle mode toggle) ---- */
    $("draw-action-btn").addEventListener("click", function () { Doodles.toggle(); });

    /* ---- Hide / show the controls tray (action bar + peers) ---- */
    (function () {
      var trayToggle = $("tray-toggle");
      var videoCol = document.querySelector(".video-col");
      var trayLabel = trayToggle ? trayToggle.querySelector(".tray-label") : null;
      if (trayToggle && videoCol) {
        trayToggle.addEventListener("click", function () {
          var collapsed = videoCol.classList.toggle("tray-collapsed");
          if (trayLabel) trayLabel.textContent = collapsed ? "Show" : "Hide";
          trayToggle.setAttribute("aria-label", collapsed ? "Show controls" : "Hide controls");
          trayToggle.title = collapsed ? "Show controls" : "Hide controls";
        });
      }
    })();

    /* ---- Hide / show the top bar (badges / relay / room code / settings) ---- */
    (function () {
      var topToggle = $("topbar-toggle");
      var room = $("room");
      var topLabel = topToggle ? topToggle.querySelector(".tray-label") : null;
      if (topToggle && room) {
        topToggle.addEventListener("click", function () {
          var collapsed = room.classList.toggle("topbar-collapsed");
          if (topLabel) topLabel.textContent = collapsed ? "Show" : "Hide";
          topToggle.setAttribute("aria-label", collapsed ? "Show top bar" : "Hide top bar");
          topToggle.title = collapsed ? "Show top bar" : "Hide top bar";
        });
      }
    })();

    /* ---- Become host (viewer takeover) ---- */
    $("become-host").addEventListener("click", function () {
      if (!state.room) return;
      var code = state.room;
      // tear down current peer, re-host
      try { if (state.peer) state.peer.destroy(); } catch (e) {}
      state.peers = {};
      createRoom(code);
      toast("You are now the host.", "ok");
    });

    /* ---- Copy link / Share invite ---- */
    $("copy-link").addEventListener("click", function () {
      if (!state.room) { toast("Join a room first.", "err"); return; }
      var url = shareUrl(state.room);
      var label = "Watch Party — room " + state.room;
      var shareText = "Join my Watch Party! Room code: " + state.room + "\n" + url;
      var done = function () { toast("Link copied!", "ok"); };

      // Native share sheet (WhatsApp, SMS, etc.) when available — best on mobile.
      if (navigator.share) {
        navigator.share({ title: label, text: shareText, url: url })
          .catch(function () { /* user cancelled — no-op */ });
        return;
      }
      // Otherwise copy the link to the clipboard.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url) && done(); });
      } else { fallbackCopy(url) && done(); }
    });

    /* ---- Leave ---- */
    $("leave-btn").addEventListener("click", leaveRoom);

    /* ---- Relay: manual reconnect (re-fetch TURN + rebuild peer) ---- */
    $("relay-btn").addEventListener("click", reconnectRelay);
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  /* ============================================================
     Load local file (sync-position-only)
     Everyone opens the SAME file on their own device.
     Only play/pause/seek is synced — zero buffering, ever.
     ============================================================ */
  function loadLocalFile(file) {
    // stop screen share if active
    if (state.sharingScreen) stopScreenShare();

    state.fileName = file.name;
    state.srcType = "file";

    // play locally from own disk
    if (player.src && player.src.indexOf("blob:") === 0) URL.revokeObjectURL(player.src);
    player.src = URL.createObjectURL(file);
    player.load();
    hideEmpty();
    hideOverlay();
    // best-effort autoplay
    player.play().catch(function () {});
    toast("Loaded: " + file.name, "ok");

    // tell peers the file name so they can load the same one on their device
    broadcast({ t: "src", srcType: "file", fileName: file.name });
    // sync current position shortly after
    setTimeout(function () {
      broadcast({ t: "sync", playing: !player.paused, time: player.currentTime || 0 });
    }, 400);
  }

  /* ============================================================
     Subtitles
     ============================================================ */
  function loadSubsFile(file) {
    if (!window.WPSubs) { toast("Subtitle module not loaded.", "err"); return; }
    WPSubs.read(file, function (err, res) {
      if (err) { toast("Couldn't read subtitle file.", "err"); return; }
      WPSubs.loadInto(player, res.vtt, { label: res.name || "Subtitles" });
      state.subTrack = player.querySelector("track[data-wp]");
      toast("Subtitles loaded.", "ok");
      // share to viewers
      broadcast({ t: "subs", vtt: res.vtt, name: res.name });
    });
  }

  /* ============================================================
     Screen / camera share
     ============================================================ */
  async function toggleScreenShare() {
    if (state.sharingScreen) { stopScreenShare(); return; }

    var stream;
    if (canScreenShare()) {
      // PC + Android
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true
        });
      } catch (e) {
        if (e.name === "NotAllowedError") return; // user cancelled
        toast("Screen share failed: " + e.message, "err");
        return;
      }
    } else if (isIOS()) {
      // iOS cannot capture the screen — fall back to camera, with an honest note
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        showTip("iOS doesn't allow screen capture — sharing camera instead.", 5000);
      } catch (e) {
        if (e.name === "NotAllowedError") return;
        toast("Camera unavailable: " + e.message, "err");
        return;
      }
    } else {
      toast("Screen share isn't supported in this browser.", "err");
      return;
    }

    state.sharingScreen = true;
    state.srcType = "screen";
    state.screenStream = stream;

    // show locally: pause any file, attach stream
    if (player.src && player.src.indexOf("blob:") === 0) { URL.revokeObjectURL(player.src); player.removeAttribute("src"); player.load(); }
    player.srcObject = stream;
    // Mute the host's local player so audio doesn't double-play (you hear
    // the original tab directly, not through the <video> element). The stream
    // itself keeps its audio tracks intact, so viewers still get audio.
    player.muted = true;
    hideEmpty(); hideOverlay();
    try { await player.play(); } catch (e) {}

    // share the stream with all peers via media call
    var keys = Object.keys(state.peers);
    for (var i = 0; i < keys.length; i++) {
      var p = state.peers[keys[i]];
      if (p.conn && p.conn.open) {
        try { state.peer.call(p.conn.peer, stream); } catch (e) {}
      }
    }
    broadcast({ t: "src", srcType: "screen" });

    // start tracking WebRTC media bytes for the sender
    // PeerJS's Peer keeps internal connections; we grab the first media
    // connection's underlying RTCPeerConnection. If not available yet,
    // that's fine — MediaMeter will pick it up on the receiver side.
    try {
      var conns = state.peer._connections || {};
      var peerIds = Object.keys(conns);
      for (var ci = 0; ci < peerIds.length; ci++) {
        var arr = conns[peerIds[ci]];
        for (var cj = 0; cj < arr.length; cj++) {
          if (arr[cj] && arr[cj].peerConnection && arr[cj].type === "media") {
            MediaMeter.start(arr[cj].peerConnection);
          }
        }
      }
    } catch (e) {}

    // when the user stops via browser UI
    var vt = stream.getVideoTracks()[0];
    if (vt) vt.addEventListener("ended", function () { stopScreenShare(); });

    // label button as active
    $("screen-btn").classList.add("btn-primary");
    $("screen-btn").classList.remove("btn-ghost");
  }

  function stopScreenShare() {
    if (!state.sharingScreen) return;
    state.sharingScreen = false;
    MediaMeter.stop();
    state.srcType = state.fileName ? "file" : null;
    if (state.screenStream) {
      state.screenStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      state.screenStream = null;
    }
    player.srcObject = null;
    player.muted = false;
    if (state.fileName) {
      // file was loaded before screen share — show the placeholder; viewer
      // can re-load their file. The blob URL was revoked when screen started.
      showEmpty("Screen share stopped", "Open your file again to resume.");
    } else {
      showEmpty("Screen share stopped", "Open a file or share your screen.");
    }
    $("screen-btn").classList.remove("btn-primary");
    $("screen-btn").classList.add("btn-ghost");
    broadcast({ t: "screen-stop" });
  }

  function attachRemoteCall(call) {
    state.call = call;
    call.on("stream", function (stream) {
      state.remoteStream = stream;
      player.srcObject = stream;
      // drop any blob src
      if (player.src && player.src.indexOf("blob:") === 0 && state.srcType !== "file") {
        URL.revokeObjectURL(player.src); player.removeAttribute("src");
      }
      state.srcType = "screen";
      hideEmpty(); hideOverlay();
      player.play().catch(function () {});
      toast("Host is sharing their screen 🖥️", "ok");
      // start tracking WebRTC media bytes for the receiver
      try { if (call.peerConnection) MediaMeter.start(call.peerConnection); } catch (e) {}
    });
    call.on("close", function () {
      MediaMeter.stop();
      if (player.srcObject === state.remoteStream) {
        player.srcObject = null;
        showEmpty("Host stopped sharing", "Waiting for host…");
      }
    });
  }
  function detachRemoteStream() {
    if (state.remoteStream) {
      state.remoteStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      state.remoteStream = null;
    }
    if (player.srcObject) { player.srcObject = null; }
  }

  /* ============================================================
     Fullscreen (with iOS CSS fallback)
     ============================================================ */
  function toggleFullscreen() {
    var wrap = $("video-wrap");
    var isFS = document.fullscreenElement || document.webkitFullscreenElement || wrap.classList.contains("cfs");
    if (isFS) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () { cssFs(false); });
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else cssFs(false);
    } else {
      var el = wrap;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () { cssFs(true); });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else cssFs(true); // iOS Safari fallback
    }
  }
  function cssFs(on) {
    $("video-wrap").classList.toggle("cfs", on);
    $("room").classList.toggle("is-fullscreen", on);
    FsChat.setFs(on);
  }
  // React to the browser's own fullscreen changes (Esc key, etc.) so the
  // overlay's visibility stays in sync even when we didn't initiate the change.
  document.addEventListener("fullscreenchange", function () {
    $("room").classList.toggle("is-fullscreen", !!document.fullscreenElement);
    FsChat.setFs(!!document.fullscreenElement);
  });
  document.addEventListener("webkitfullscreenchange", function () {
    $("room").classList.toggle("is-fullscreen", !!document.webkitFullscreenElement);
    FsChat.setFs(!!document.webkitFullscreenElement);
  });

  /* ============================================================
     FsChat — chat overlay that lives INSIDE #video-wrap so it stays
     visible in native fullscreen (where the rest of the page is
     hidden by the browser chrome). Provides:
       • a right-middle FAB to open the panel
       • a top toast that auto-fades on each incoming message
       • a slide-in panel that mirrors #chat-msgs + has its own
         composer and reply path
     ============================================================ */
  var FsChat = (function () {
    var wrap, btn, panel, msgs, input, form, badge, toastLayer,
        replyBox, replyName, replyText;
    var ready = false, inFs = false, open = false;
    var unread = 0, replyTo = null;
    var idleTimer = null, IDLE_MS = 3500;
    var vvHandler = null, kbTimer = null;

    // ---- mobile keyboard handling ------------------------------------------------
    // On phones the soft keyboard overlays the page and would cover the composer.
    // visualViewport.resize fires when the keyboard opens/closes; we compute how
    // much of the viewport is eaten and push the panel's bottom up by that amount
    // (via the --kb-offset CSS var), then re-pin the message list to the bottom so
    // the newest text stays visible while typing.
    function applyKbOffset() {
      var vv = window.visualViewport;
      var kb = 0;
      if (vv) {
        kb = Math.max(0, window.innerHeight - vv.height);
      }
      // ignore the harmless sub-pixel jitter
      if (kb < 8) kb = 0;
      panel.style.setProperty("--kb-offset", kb + "px");
      // keep the latest message on screen after the panel shrinks
      if (kbTimer) cancelAnimationFrame(kbTimer);
      kbTimer = requestAnimationFrame(function () {
        try { msgs.scrollTop = msgs.scrollHeight; } catch (e) {}
      });
    }
    function attachViewport() {
      var vv = window.visualViewport;
      if (!vv || vvHandler) return;
      vvHandler = function () { if (open) applyKbOffset(); };
      vv.addEventListener("resize", vvHandler);
      vv.addEventListener("scroll", vvHandler);
    }

    function ensure() {
      if (ready) return;
      wrap = $("video-wrap");
      btn = $("fs-chat-btn");
      panel = $("fs-chat-panel");
      msgs = $("fs-chat-msgs");
      input = $("fs-chat-input");
      form = $("fs-chat-form");
      badge = $("fs-chat-badge");
      toastLayer = $("fs-toast-layer");
      replyBox = $("fs-reply-preview");
      replyName = $("fs-reply-name");
      replyText = $("fs-reply-text");

      btn.addEventListener("click", function () { toggle(); bumpIdle(); });
      $("fs-chat-close").addEventListener("click", close);
      $("fs-reply-cancel").addEventListener("click", function () { setReply(null); });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = input.value;
        input.value = "";
        // route through the existing sendChat so it broadcasts + renders
        // in the main list (and therefore gets cloned back here).
        try {
          // preserve any in-flight reply target set in the main composer
          sendChatWithReply(v, replyTo);
        } catch (err) { sendChat(v); }
        setReply(null);
        bumpIdle();
      });

      // keyboard follows: when the input gains focus, pin the panel above the
      // soft keyboard; on blur, drop it back down. (focus/blur are the most
      // reliable cross-browser signal — visualViewport.resize can lag.)
      input.addEventListener("focus", function () {
        attachViewport();
        // give the keyboard a beat to animate in before measuring
        setTimeout(function () { if (open) applyKbOffset(); }, 120);
        setTimeout(function () { if (open) applyKbOffset(); }, 320);
      });
      input.addEventListener("blur", function () {
        setTimeout(function () {
          if (open && document.activeElement !== input) {
            panel.style.setProperty("--kb-offset", "0px");
          }
        }, 120);
      });

      // any pointer/keyboard activity over the wrap postpones the auto-hide
      ["mousemove", "touchstart", "pointerdown", "keydown"].forEach(function (ev) {
        wrap.addEventListener(ev, bumpIdle, { passive: true });
      });

      ready = true;
    }

    // sendChat always clears REPLY_TO; to send a reply from the FS panel we
    // temporarily set REPLY_TO first, then call sendChat.
    function sendChatWithReply(text, reply) {
      if (reply) setMainReply(reply);
      sendChat(text);
    }
    function setMainReply(target) {
      try {
        if (target) { REPLY_TO = { name: target.name, text: target.text }; syncMainReplyPreview(); }
        else { REPLY_TO = null; syncMainReplyPreview(); }
      } catch (e) {}
    }
    function syncMainReplyPreview() {
      // mirror REPLY_TO into the main reply-preview UI
      try {
        var box = $("reply-preview");
        if (!REPLY_TO) { box.classList.add("hidden"); return; }
        box.classList.remove("hidden");
        $("reply-preview-name").textContent = REPLY_TO.name + "";
        $("reply-preview-text").textContent = (REPLY_TO.text || "").slice(0, 80);
      } catch (e) {}
    }

    function setFs(on) {
      ensure();
      inFs = on;
      wrap.classList.toggle("fschat-on", on);
      if (on) {
        btn.hidden = false;
        bumpIdle();
      } else {
        // leaving fullscreen: tear down
        close();
        btn.hidden = true;
        wrap.classList.remove("fschat-idle");
        clearToasts();
        clearUnread();
      }
    }

    function bumpIdle() {
      if (!inFs) return;
      wrap.classList.remove("fschat-idle");
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function tick() {
        // don't auto-hide while the panel is open or input is focused
        if (open) return;
        if (document.activeElement === input) { idleTimer = setTimeout(tick, IDLE_MS); return; }
        wrap.classList.add("fschat-idle");
      }, IDLE_MS);
    }

    function openPanel() {
      ensure();
      open = true;
      panel.hidden = false;
      panel.classList.add("open");
      clearUnread();
      syncFromMain();
      wrap.classList.remove("fschat-idle");
      attachViewport();
      setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 240);
    }
    function close() {
      if (!open) return;
      open = false;
      panel.classList.remove("open");
      try { input.blur(); } catch (e) {}
      panel.style.setProperty("--kb-offset", "0px");
      setTimeout(function () { if (!open) panel.hidden = true; }, 280);
    }
    function toggle() { if (open) close(); else openPanel(); }

    // clone the current main chat list into the FS panel
    function syncFromMain() {
      var main = $("chat-msgs");
      msgs.innerHTML = "";
      var kids = main.children;
      for (var i = 0; i < kids.length; i++) {
        var clone = cloneMsg(kids[i]);
        if (clone) msgs.appendChild(clone);
      }
      msgs.scrollTop = msgs.scrollHeight;
      requestAnimationFrame(function () { msgs.scrollTop = msgs.scrollHeight; });
    }

    // deep-clone a .msg node, stripping interactivity (reaction picker,
    // reply handlers) so the clone is read-only display.
    function cloneMsg(node) {
      if (!node) return null;
      var c = node.cloneNode(true);
      // remove interactive bits that don't belong in the overlay
      var rm = c.querySelectorAll(".msg-react-btn, .react-picker-open, .react-picker");
      for (var i = 0; i < rm.length; i++) rm[i].parentNode && rm[i].parentNode.removeChild(rm[i]);
      return c;
    }

    // Called after every new message lands in the main list. We clone it
    // into the FS panel and, if the panel is closed, pop a toast.
    function onNewMessage(opts) {
      if (!inFs) return;
      // append the latest message to the panel
      var main = $("chat-msgs");
      if (main.lastElementChild) {
        var clone = cloneMsg(main.lastElementChild);
        if (clone) {
          msgs.appendChild(clone);
          while (msgs.children.length > 200) msgs.removeChild(msgs.firstChild);
          if (open) {
            // pin to the bottom now, and again after the layout settles so a
            // freshly-opened soft keyboard can't hide the newest message
            msgs.scrollTop = msgs.scrollHeight;
            requestAnimationFrame(function () {
              msgs.scrollTop = msgs.scrollHeight;
            });
          }
        }
      }
      // toast only for OTHER people's messages, and only when panel is closed
      var mine = (opts && opts.name === state.name);
      if (!mine && !open) {
        unread++;
        if (badge) {
          badge.textContent = unread > 99 ? "99+" : String(unread);
          badge.classList.remove("hidden");
        }
        showToast(opts.name || "Someone", opts.text || "");
        // a new message is activity — reveal the FAB briefly
        wrap.classList.remove("fschat-idle");
        bumpIdle();
      }
    }

    function showToast(name, text) {
      var t = document.createElement("div");
      t.className = "fs-toast";
      var n = document.createElement("span"); n.className = "fs-toast-name"; n.textContent = name;
      var x = document.createElement("span"); x.className = "fs-toast-text"; x.textContent = text;
      t.appendChild(n); t.appendChild(x);
      toastLayer.appendChild(t);
      // cap stack
      while (toastLayer.children.length > 4) toastLayer.removeChild(toastLayer.firstChild);
      // reveal
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { t.classList.add("show"); });
      });
      // auto-fade
      setTimeout(function () {
        t.classList.remove("show");
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
      }, 3200);
    }
    function clearToasts() { if (toastLayer) toastLayer.innerHTML = ""; }

    function clearUnread() {
      unread = 0;
      if (badge) badge.classList.add("hidden");
    }

    // reply path: clicking a cloned message sets the reply target
    function setReply(target) {
      replyTo = target;
      if (!target) {
        replyBox.classList.add("hidden");
        return;
      }
      replyBox.classList.remove("hidden");
      replyName.textContent = target.name + "";
      replyText.textContent = (target.text || "").slice(0, 80);
      try { input.focus({ preventScroll: true }); } catch (e) {}
    }

    // wire delegated clicks on the cloned message list: tap a bubble to reply
    function wireMsgList() {
      msgs.addEventListener("click", function (e) {
        var msg = e.target.closest(".msg");
        if (!msg || msg.classList.contains("sys")) return;
        if (e.target.closest(".react-chip")) return;
        var who = msg.querySelector(".meta .who");
        var body = msg.querySelector(".body");
        if (!who || !body) return;
        setReply({ name: who.textContent, text: body.textContent });
      });
    }

    return {
      setFs: setFs,
      onNewMessage: onNewMessage,
      isOpen: function () { return open; },
      init: function () { ensure(); wireMsgList(); }
    };
  })();

  /* ============================================================
     Doodles — freehand strokes drawn over the whole screen.
     Lives inside #video-wrap so it survives native + iOS-CSS
     fullscreen. Strokes auto-fade after 7s. Points stream live
     to peers (throttled ~50ms). Rides the existing PeerJS data
     channel via { t:"doodle", op, id, name, color, x, y, pts }.
     ============================================================ */
  var Doodles = (function () {
    var canvas, ctx, wrap, bar, colorDot, sizeInput, sizeDot, hideBtn;
    var DPR = 1;                    // device pixel ratio for crisp strokes
    var strokes = [];               // active/recent strokes: { id, color, w, pts:[{x,y}], born, done }
    var drawing = false;            // is the user's finger/pen currently down?
    var cur = null;                 // the stroke currently being drawn (local)
    var mode = false;               // is draw mode on (canvas capturing input)?
    var raf = 0;                    // current rAF handle (0 = loop stopped)
    var lastFlush = 0;              // ts of last streamed point batch
    var FLUSH_MS = 50;              // throttle for live point streaming
    var LIFE_MS = 7000;             // total stroke lifetime
    var FADE_MS = 2000;             // ramp 1 -> 0 over the last 2s
    var lineW = 3;                  // current brush width in CSS px
    var userColor = null;           // if set, overrides colorForName(name)
    var colorInput = null;          // hidden <input type=color> for the swatch
    var barCollapsed = false;       // user-collapsed the draw toolbar?

    // pick the active stroke color: user override beats name-based default
    function activeColor() {
      return userColor || colorForName(state.name);
    }

    function $(id) { return document.getElementById(id); }

    // translate a pointer event into canvas-space (CSS px, 0..W/H)
    function ptOf(e) {
      return { x: e.clientX, y: e.clientY };
    }

    // (re)size the canvas backing store to the viewport; cheap, runs
    // on init + resize + mode toggle.
    function fit() {
      if (!canvas) return;
      DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
      var w = window.innerWidth, h = window.innerHeight;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      if (ctx) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); requestDraw(); }
    }

    // ---- redraw loop: only runs while there are strokes on screen ----
    function requestDraw() {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    }
    function loop() {
      raf = 0;
      render();
      // keep looping only while something still needs painting
      if (strokes.length) requestDraw();
    }
    function render() {
      if (!ctx) return;
      var w = canvas.width / DPR, h = canvas.height / DPR;
      ctx.clearRect(0, 0, w, h);
      var now = Date.now();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (var i = 0; i < strokes.length; i++) {
        var s = strokes[i];
        var age = now - s.born;
        var alpha;
        if (age >= LIFE_MS) { strokes.splice(i, 1); i--; continue; }
        if (age > LIFE_MS - FADE_MS) {
          alpha = (LIFE_MS - age) / FADE_MS;     // 1 -> 0 over the tail
        } else {
          alpha = 1;
        }
        if (alpha <= 0) { strokes.splice(i, 1); i--; continue; }
        var pts = s.pts;
        if (pts.length < 1) continue;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.w || lineW;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 1) {
          // single dot — draw a small round cap so a tap still shows
          ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
        } else {
          for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ---- pointer handlers (attached to canvas, active only in mode) ----
    function onDown(e) {
      if (!mode) return;
      e.preventDefault();
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      drawing = true;
      var p = ptOf(e);
      var col = activeColor();
      // _sent counts points already streamed to peers — starts at 1 because
      // the start message carries the first point. Without it the flush math
      // below computes slice(pts.length - undefined) and ships nothing.
      cur = { id: newStrokeId(), color: col, w: lineW, pts: [p], born: Date.now(), done: false, _sent: 1 };
      strokes.push(cur);
      requestDraw();
      broadcast({ t: "doodle", op: "start", id: cur.id, name: state.name, color: col, w: lineW, x: p.x, y: p.y });
      lastFlush = Date.now();
    }
    function onMove(e) {
      if (!mode || !drawing || !cur) return;
      e.preventDefault();
      var p = ptOf(e);
      cur.pts.push(p);
      requestDraw();
      var now = Date.now();
      if (now - lastFlush >= FLUSH_MS) {
        // send only the points added since the last flush to keep messages small
        var batch = cur.pts.slice(cur._sent);
        broadcast({ t: "doodle", op: "pt", id: cur.id, pts: batch });
        cur._sent = cur.pts.length;
        lastFlush = now;
      }
    }
    function onUp(e) {
      if (!mode || !drawing || !cur) return;
      e.preventDefault();
      drawing = false;
      cur.done = true;
      // flush any trailing points not yet streamed
      if (cur._sent < cur.pts.length) {
        var batch = cur.pts.slice(cur._sent);
        broadcast({ t: "doodle", op: "pt", id: cur.id, pts: batch });
        cur._sent = cur.pts.length;
      }
      broadcast({ t: "doodle", op: "end", id: cur.id });
      cur = null;
    }

    var strokeSeq = 0;
    function newStrokeId() {
      strokeSeq = (strokeSeq + 1) >>> 0;
      // include the peer id suffix so two peers can't collide on ids
      return (state.peer && state.peer.id ? state.peer.id.slice(-4) : "self") + "-" + strokeSeq;
    }

    // ---- incoming remote doodle messages ----
    function onRemote(data) {
      if (!data || !data.op) return;
      var id = data.id;
      if (data.op === "clear") { strokes = []; requestDraw(); return; }
      if (data.op === "start") {
        // recolor from the sender's name so a peer can't spoof colors
        var color = colorForName(data.name || "Someone");
        strokes.push({ id: id, color: color, w: data.w || 3, pts: [{ x: data.x, y: data.y }], born: Date.now(), done: false, _sent: 1 });
        requestDraw();
        return;
      }
      if (data.op === "pt") {
        var s = findStroke(id);
        if (s && data.pts && data.pts.length) {
          for (var i = 0; i < data.pts.length; i++) s.pts.push(data.pts[i]);
          requestDraw();
        }
        return;
      }
      if (data.op === "end") {
        var s2 = findStroke(id);
        if (s2) s2.done = true;
        return;
      }
    }
    function findStroke(id) {
      for (var i = strokes.length - 1; i >= 0; i--) if (strokes[i].id === id) return strokes[i];
      return null;
    }

    // ---- mode toggle (button press) ----
    function setMode(on) {
      mode = on;
      if (!wrap) return;
      wrap.classList.toggle("draw-on", mode);
      // bar visibility: use DoodleBar setting (respects both draw mode + user pref)
      try { applyDoodleBarVisibility(); } catch (e) {}
      // restore an expanded bar whenever (re)entering draw mode so the
      // user isn't stuck with a collapsed pill from a previous session.
      if (on && barCollapsed) setBarCollapsed(false);
      // keep both composer buttons in sync (normal + fullscreen)
      setBtns(mode);
      // keep the action-bar Draw button highlighted when drawing is active
      var drawBtn = $("draw-action-btn");
      if (drawBtn) drawBtn.classList.toggle("act-btn-accent", mode);
      if (mode) {
        fit();              // ensure crisp sizing when entering
        if (colorDot) colorDot.style.background = activeColor();
      } else {
        // exiting mid-stroke: finalize cleanly
        drawing = false; cur = null;
      }
    }
    function toggle() { setMode(!mode); }

    // ---- collapse the draw toolbar: the bottom-left #fs-hidebar-btn hides
    //      the whole doodle bar; the button itself stays so it can re-expand. ----
    function setBarCollapsed(on) {
      barCollapsed = !!on;
      if (!bar || !wrap) return;
      bar.classList.toggle("collapsed", barCollapsed);
      wrap.classList.toggle("draw-collapsed", barCollapsed);
      if (hideBtn) hideBtn.setAttribute("aria-expanded", barCollapsed ? "false" : "true");
      if (hideBtn) hideBtn.title = barCollapsed ? "Show toolbar" : "Hide toolbar";
    }
    function toggleBar() { setBarCollapsed(!barCollapsed); }

    function setBtns(on) {
      var b1 = $("doodle-btn"), b2 = $("fs-doodle-btn");
      if (b1) { b1.setAttribute("aria-pressed", on ? "true" : "false"); }
      if (b2) { b2.setAttribute("aria-pressed", on ? "true" : "false"); }
    }

    function clearAll() {
      strokes = [];
      cur = null; drawing = false;
      requestDraw();
      broadcast({ t: "doodle", op: "clear" });
    }

    // ---- color picker: swatch click opens the native color input ----
    function syncColorDot() {
      if (colorDot) colorDot.style.background = activeColor();
      if (colorInput) colorInput.value = activeColor();
    }
    function setColor(c) {
      if (!c) return;
      userColor = c;
      syncColorDot();
    }
    function openColorPicker() {
      // the hidden <input type=color> (see index.html) drives the OS picker
      if (colorInput) colorInput.click();
    }
    function clearColor() {
      userColor = null;
      syncColorDot();
    }

    // ---- brush size: slider drives lineW + a live dot preview ----
    function syncSizeDot() {
      if (!sizeDot) return;
      // cap the preview so big sizes don't overflow the 16px well
      var px = Math.min(14, Math.max(2, lineW));
      sizeDot.style.setProperty("--doodle-size", px + "px");
    }
    function setSize(v) {
      var n = parseInt(v, 10);
      if (isNaN(n)) return;
      lineW = Math.max(1, Math.min(16, n));
      if (sizeInput) sizeInput.value = String(lineW);
      syncSizeDot();
    }

    function init() {
      canvas = $("doodle-canvas");
      wrap = $("video-wrap");
      bar = $("doodle-bar");
      colorDot = $("doodle-color");
      colorInput = $("doodle-color-input");
      sizeInput = $("doodle-size");
      sizeDot = $("doodle-size-dot");
      hideBtn = $("fs-hidebar-btn");
      if (!canvas || !wrap) return;
      ctx = canvas.getContext("2d");
      fit();
      // pointer events: unified mouse/touch/pen
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      canvas.addEventListener("pointerleave", function (e) { if (drawing) onUp(e); });
      // color swatch -> native color input
      if (colorDot && colorInput) {
        colorDot.addEventListener("click", openColorPicker);
        colorInput.addEventListener("input", function (e) { setColor(e.target.value); });
      }
      // brush size slider
      if (sizeInput) {
        sizeInput.addEventListener("input", function (e) { setSize(e.target.value); });
        setSize(sizeInput.value);
      } else {
        syncSizeDot();
      }
      // collapse toggle (top-left hide button)
      if (hideBtn) hideBtn.addEventListener("click", toggleBar);
      // keep the backing store matched to the viewport
      window.addEventListener("resize", fit);
      window.addEventListener("orientationchange", fit);
      // redraw after entering fullscreen (dimensions may change)
      document.addEventListener("fullscreenchange", fit);
      document.addEventListener("webkitfullscreenchange", fit);
      syncColorDot();
    }

    return {
      init: init,
      toggle: toggle,
      setMode: setMode,
      clear: clearAll,
      setColor: setColor,
      setSize: setSize,
      openColorPicker: openColorPicker,
      clearColor: clearColor,
      onRemote: onRemote,
      isOn: function () { return mode; }
    };
  })();

  /* ============================================================
     Stickers — emoji, uploaded images, and Tenor search.
     ------------------------------------------------------------
     Stickers are sent as ordinary chat messages (kind:"sticker")
     so they stream over the existing chat channel, render inline
     in the message list, and react/reply like any other message.
     A sticker body is one of:
       { emoji: "🎉" }              — a glyph rendered large
       { img:  "data:..."|"https:..." } — a raster sticker
     The picker sheet has three tabs:
       Emoji  — built-in curated pack (no network needed)
       Mine   — uploads from this device (downscaled, room-synced
                automatically because they ship as the chat body)
       Tenor  — searchable GIF stickers (needs a free API key set
                in Settings); we send the tiny preview URL only.
     ============================================================ */
  var Stickers = (function () {
    var sheet, backdrop;            // picker sheet + scrim
    var tabsEl, grid;               // tab strip + thumbnail grid
    var searchRow, searchInput;     // Tenor search box
    var addBtn, fileInput;          // Mine: add-from-device
    var hintEl;                     // small caption under the tabs
    var tenorTab;                   // the Tenor tab button (hidden unless key set)

    var library = [];               // [{ id, src }] user uploads (session)
    var seq = 0;
    var curTab = "emoji";

    var MAX = 160;                  // upload downscale cap (px)
    var QUAL = 0.8;                 // JPEG quality for uploads
    var KEY_STORE = "wp-tenor-key"; // localStorage slot for the API key
    var tenorKey = "";              // current Tenor key ("") = disabled
    var tenorBusy = false;
    var tenorLastQ = "";

    // ---- built-in emoji pack (curated, no network) ----
    // A compact, broadly-supported set grouped by vibe. Rendered as text
    // so they cost zero bytes and look native everywhere.
    var EMOJI_PACK = [
      "😀","😂","🤣","😊","😍","🥰","😘","😎","🤩","🥳",
      "😜","🤪","🤔","🤨","😐","😴","😭","😡","🤯","😱",
      "👍","👎","👏","🙌","🙏","💪","🤝","✌️","🤞","👋",
      "❤️","🧡","💛","💚","💙","💜","🖤","💔","💖","🔥",
      "🎉","🎊","✨","⭐","🌟","💫","💯","✅","❌","⚠️",
      "👀","🤡","👻","💀","🤖","👽","🎃","💩","🐱","🐶",
      "🍕","🍔","🍟","🍿","🍰","🥤","🍺","🍷","☕","🍫",
      "⚽","🏀","🎮","🎵","🎬","📷","🎁","💎","🚀","🌈"
    ];

    function $(id) { return document.getElementById(id); }
    function newId() { seq = (seq + 1) >>> 0; return "st" + seq; }

    // ---- Tenor key persistence (mirrors LocalTurn conventions) ----
    function loadKey() {
      try { tenorKey = localStorage.getItem(KEY_STORE) || ""; } catch (e) { tenorKey = ""; }
      return tenorKey;
    }
    function saveKey(k) {
      tenorKey = (k || "").trim();
      try {
        if (tenorKey) localStorage.setItem(KEY_STORE, tenorKey);
        else localStorage.removeItem(KEY_STORE);
      } catch (e) {}
      applyTenorVisibility();
    }
    function hasTenor() { return !!tenorKey; }

    // show/hide the Tenor tab + its search row based on key presence
    function applyTenorVisibility() {
      if (tenorTab) tenorTab.classList.toggle("hidden", !hasTenor());
      // if we were on the Tenor tab and lost the key, fall back to Emoji
      if (curTab === "tenor" && !hasTenor()) setTab("emoji");
    }

    // ---- picker open/close (mirrors the Settings sheet convention) ----
    var _wasDrawing = false;
    function openPicker() {
      if (!sheet) return;
      // if draw mode is active, pause it so the sheet isn't blocked by
      // the canvas (which sits at z-index 9999)
      try {
        if (typeof Doodles !== "undefined" && Doodles.isOn()) {
          _wasDrawing = true;
          Doodles.setMode(false);
        }
      } catch (e) {}
      backdrop.classList.remove("hidden");
      sheet.classList.remove("hidden");
      renderTab();
    }
    function closePicker() {
      if (!sheet) return;
      backdrop.classList.add("hidden");
      sheet.classList.add("hidden");
      if (_wasDrawing) {
        _wasDrawing = false;
        try { Doodles.setMode(true); } catch (e) {}
      }
    }

    // ---- tab switching ----
    function setTab(name) {
      curTab = name;
      // sync the tab strip ARIA/state
      if (tabsEl) {
        var btns = tabsEl.querySelectorAll(".sticker-tab");
        for (var i = 0; i < btns.length; i++) {
          var on = btns[i].getAttribute("data-tab") === name;
          btns[i].classList.toggle("active", on);
          btns[i].setAttribute("aria-selected", on ? "true" : "false");
        }
      }
      // toggle the per-tab affordances
      if (searchRow) searchRow.classList.toggle("hidden", name !== "tenor");
      if (addBtn) addBtn.classList.toggle("hidden", name !== "mine");
      renderTab();
    }

    function renderTab() {
      if (!grid) return;
      if (curTab === "emoji") renderEmoji();
      else if (curTab === "mine") renderMine();
      else if (curTab === "tenor") renderTenor(null);
    }

    function setHint(text) {
      if (hintEl) hintEl.textContent = text;
    }

    // ---- Emoji tab ----
    function renderEmoji() {
      setHint("Tap an emoji to send it in chat.");
      grid.innerHTML = "";
      for (var i = 0; i < EMOJI_PACK.length; i++) {
        (function (ch) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "sticker-thumb sticker-thumb-emoji";
          b.textContent = ch;
          b.title = "Send " + ch;
          b.addEventListener("click", function () {
            send({ emoji: ch });
            closePicker();
          });
          grid.appendChild(b);
        })(EMOJI_PACK[i]);
      }
    }

    // ---- Mine tab (uploads) ----
    function renderMine() {
      setHint(library.length
        ? "Tap a sticker to send it. Added stickers sync to everyone in the room."
        : "Add stickers from your device — they sync to the whole room when you send one.");
      grid.innerHTML = "";
      if (!library.length) {
        var e = document.createElement("div");
        e.className = "sticker-empty";
        e.textContent = "No stickers yet — add some from your device.";
        grid.appendChild(e);
        return;
      }
      for (var i = 0; i < library.length; i++) {
        (function (s) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "sticker-thumb";
          b.title = "Send sticker";
          var im = document.createElement("img");
          im.src = s.src; im.alt = ""; im.loading = "lazy";
          b.appendChild(im);
          b.addEventListener("click", function () {
            send({ img: s.src });
            closePicker();
          });
          grid.appendChild(b);
        })(library[i]);
      }
    }

    // ---- Tenor tab ----
    // We query Tenor's v2 search endpoint with the user's key and render
    // tiny preview GIFs. Sending ships only the preview URL, so peers
    // fetch the same small asset (no P2P blob transfer needed).
    function renderTenor(list) {
      setHint(hasTenor()
        ? "Search Tenor for a sticker. Only the preview image is shared."
        : "Add a free Tenor API key in Settings to unlock search.");
      grid.innerHTML = "";
      if (!hasTenor()) {
        var n = document.createElement("div");
        n.className = "sticker-empty";
        n.textContent = "Add a Tenor API key in Settings to search stickers.";
        grid.appendChild(n);
        return;
      }
      if (!list) {
        var e = document.createElement("div");
        e.className = "sticker-empty";
        e.textContent = "Type a search above to find stickers.";
        grid.appendChild(e);
        return;
      }
      if (!list.length) {
        var z = document.createElement("div");
        z.className = "sticker-empty";
        z.textContent = "No stickers found — try another search.";
        grid.appendChild(z);
        return;
      }
      for (var i = 0; i < list.length; i++) {
        (function (item) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "sticker-thumb";
          b.title = "Send sticker";
          var im = document.createElement("img");
          im.src = item.url; im.alt = ""; im.loading = "lazy";
          b.appendChild(im);
          b.addEventListener("click", function () {
            send({ img: item.url, w: item.w, h: item.h });
            closePicker();
          });
          grid.appendChild(b);
        })(list[i]);
      }
    }

    function searchTenor(q) {
      q = (q || "").trim();
      if (!hasTenor()) return;
      if (!q) { renderTenor(null); return; }
      if (tenorBusy) return;
      tenorBusy = true;
      tenorLastQ = q;
      setHint("Searching Tenor…");
      // tenor autocomplete style: return a handful of small previews
      var url = "https://g.tenor.com/v2/search?q=" + encodeURIComponent(q) +
        "&key=" + encodeURIComponent(tenorKey) +
        "&limit=24&media_filter=tiny&contentfilter=medium";
      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var results = (j && j.results) || [];
          var out = [];
          for (var i = 0; i < results.length; i++) {
            var m = results[i].media_formats && results[i].media_formats.tiny;
            if (m && m.url) out.push({ url: m.url, w: m.dims && m.dims[0], h: m.dims && m.dims[1] });
          }
          if (tenorLastQ === q) renderTenor(out);
        })
        .catch(function () {
          if (tenorLastQ === q) {
            grid.innerHTML = "";
            var e = document.createElement("div");
            e.className = "sticker-empty";
            e.textContent = "Search failed — check your API key or network.";
            grid.appendChild(e);
          }
        })
        .then(function () { tenorBusy = false; }, function () { tenorBusy = false; });
    }

    // ---- file -> downscaled data URL (mirrors readPfp) ----
    function addFiles(fileList) {
      if (!fileList || !fileList.length) return;
      var pending = 0;
      var done = function () { pending--; if (pending === 0 && curTab === "mine") renderMine(); };
      for (var i = 0; i < fileList.length; i++) {
        var f = fileList[i];
        if (!f || !/^image\//.test(f.type)) continue;
        pending++;
        downscale(f, function (err, src) {
          if (!err && src) library.push({ id: newId(), src: src });
          done();
        });
      }
      if (pending === 0) toast("No usable images in that selection.", "err");
    }
    function downscale(file, cb) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          try {
            var scale = Math.min(1, MAX / Math.max(img.width, img.height));
            var w = Math.round(img.width * scale);
            var h = Math.round(img.height * scale);
            var c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            cb(null, c.toDataURL("image/jpeg", QUAL));
          } catch (e) { cb(e); }
        };
        img.onerror = function () { cb(new Error("bad image")); };
        img.src = reader.result;
      };
      reader.onerror = function () { cb(new Error("read failed")); };
      reader.readAsDataURL(file);
    }

    // ---- send a sticker as a chat message ----
    // Builds the same shape as sendChat() but tagged kind:"sticker", then
    // renders locally + broadcasts so peers see it via the chat handler.
    function send(sticker) {
      if (!sticker || (!sticker.emoji && !sticker.img)) return;
      var mid = newMid();
      var opts = {
        name: state.name,
        pfp: state.pfp,
        kind: "sticker",
        sticker: sticker,
        mid: mid,
        reply: REPLY_TO ? { name: REPLY_TO.name, text: (REPLY_TO.text || "").slice(0, 120) } : null
      };
      addChat(opts);
      var payload = { t: "chat", kind: "sticker", name: state.name, pfp: state.pfp, sticker: sticker, mid: mid };
      if (opts.reply) payload.reply = opts.reply;
      broadcast(payload);
      setReply(null);
      // mirror into the fullscreen overlay
      try { FsChat.onNewMessage({ name: state.name, text: sticker.emoji || "" }); } catch (e) {}
    }

    function init() {
      sheet = $("sticker-sheet");
      backdrop = $("sticker-backdrop");
      grid = $("sticker-grid");
      tabsEl = $("sticker-tabs");
      searchRow = $("sticker-search-row");
      searchInput = $("sticker-search");
      addBtn = $("sticker-add-btn");
      fileInput = $("sticker-input");
      hintEl = $("sticker-hint");
      tenorTab = document.querySelector('.sticker-tab[data-tab="tenor"]');
      if (!sheet || !fileInput) return;
      loadKey();
      applyTenorVisibility();
    }

    return {
      init: init,
      openPicker: openPicker,
      closePicker: closePicker,
      addFiles: addFiles,
      setTab: setTab,
      searchTenor: searchTenor,
      send: send,
      loadKey: loadKey,
      saveKey: saveKey,
      hasTenor: hasTenor,
      getKey: function () { return tenorKey; }
    };
  })();

  /* ============================================================
     Ping loop (RTT -> latency readout)
     ============================================================ */
  function startPing() {
    if (state.pingTimer) clearInterval(state.pingTimer);
    state.pingTimer = setInterval(function () {
      var keys = Object.keys(state.peers);
      for (var i = 0; i < keys.length; i++) {
        var c = state.peers[keys[i]].conn;
        if (c && c.open) { try { c.send({ t: "ping", ts: Date.now() }); } catch (e) {} }
      }
    }, DataSaver.pingMs());   // 3s normally, 10s under Data Saver
  }

  /* ============================================================
     Leave
     ============================================================ */
  function leaveRoom() {
    if (state.syncTimer) { clearInterval(state.syncTimer); state.syncTimer = null; }
    if (state.pingTimer) { clearInterval(state.pingTimer); state.pingTimer = null; }
    if (state.sharingScreen) stopScreenShare();
    detachRemoteStream();
    try { if (state.peer) state.peer.destroy(); } catch (e) {}
    state.peer = null;
    state.peers = {};
    state.hostConn = null;
    setReply(null);
    _reactions = {};
    // clear chat history when the room is destroyed
    state.chatHistory = [];
    state.fileName = null;
    state.srcType = null;
    state._intent = null;       // clear routing intent so next session starts clean
    if (player.src && player.src.indexOf("blob:") === 0) URL.revokeObjectURL(player.src);
    player.src = "";
    location.hash = "";
    // hide the mobile sheet when leaving
    try { ChatDrawer.close(); } catch (e) {}
    try { $("chat-act-badge").classList.add("hidden"); } catch (e) {}
    try { Doodles.setMode(false); Doodles.clear(); } catch (e) {}
    try { Stickers.closePicker(); } catch (e) {}
    DataMeter.reset();
    MediaMeter.reset();
    releaseWakeLock();
    setOnline("offline");
    showScreen("lobby");
  }

  /* ============================================================
     Doodle + sticker button wiring
     ------------------------------------------------------------
     The two IIFE modules own their internals; this just hooks the
     composer tool buttons, the draw-mode toolbar, and the sticker
     picker sheet to the right module calls.
     ============================================================ */
  function wireDoodle() {
    Doodles.init();
    // composer toggle buttons (normal + fullscreen chat) -> draw mode
    var main = $("doodle-btn"), fs = $("fs-doodle-btn");
    if (main) main.addEventListener("click", function () { Doodles.toggle(); });
    if (fs) fs.addEventListener("click", function () { Doodles.toggle(); });
    // draw-mode toolbar
    var clr = $("doodle-clear-btn"), ex = $("doodle-exit-btn");
    if (clr) clr.addEventListener("click", function () { Doodles.clear(); });
    if (ex) ex.addEventListener("click", function () { Doodles.setMode(false); });
  }

  function wireStickers() {
    Stickers.init();
    // composer buttons -> open picker
    var main = $("sticker-btn"), fs = $("fs-sticker-btn");
    if (main) main.addEventListener("click", function () { Stickers.openPicker(); });
    if (fs) fs.addEventListener("click", function () { Stickers.openPicker(); });
    // picker sheet controls
    var close = $("sticker-close"), back = $("sticker-backdrop");
    if (close) close.addEventListener("click", function () { Stickers.closePicker(); });
    if (back) back.addEventListener("click", function () { Stickers.closePicker(); });

    // tab strip -> switch grids
    var tabs = document.querySelectorAll(".sticker-tab");
    for (var i = 0; i < tabs.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () { Stickers.setTab(btn.getAttribute("data-tab")); });
      })(tabs[i]);
    }

    // Mine: add-from-device
    var add = $("sticker-add-btn"), input = $("sticker-input");
    if (add) add.addEventListener("click", function () { if (input) input.click(); });
    if (input) input.addEventListener("change", function (e) {
      Stickers.addFiles(e.target.files);
      e.target.value = "";
    });

    // Tenor: live search (debounced)
    var search = $("sticker-search");
    if (search) {
      var to = null;
      search.addEventListener("input", function (e) {
        if (to) clearTimeout(to);
        var v = e.target.value;
        to = setTimeout(function () { Stickers.searchTenor(v); }, 350);
      });
      search.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); if (to) clearTimeout(to); Stickers.searchTenor(e.target.value); }
      });
    }

    // Esc closes the picker
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && $("sticker-sheet") && !$("sticker-sheet").classList.contains("hidden")) {
        Stickers.closePicker();
      }
    });
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    console.log("%c[Watch Party] app.js running, init() reached", "color:#0a0;font-weight:bold");
    ChatOpacity.load();   // restore fullscreen chat opacity CSS vars early
    initLobby();
    console.log("[Watch Party] lobby wired");
    wirePlayerEvents();
    console.log("[Watch Party] player wired");
    wireChat();
    console.log("[Watch Party] chat wired");
    wireActions();
    console.log("[Watch Party] actions wired");
    try { FsChat.init(); console.log("[Watch Party] fullscreen chat wired"); } catch (e) { console.warn("FsChat init failed", e); }
    try { wireDoodle(); console.log("[Watch Party] doodle wired"); } catch (e) { console.warn("Doodle wiring failed", e); }
    try { wireStickers(); console.log("[Watch Party] stickers wired"); } catch (e) { console.warn("Sticker wiring failed", e); }
    wireSettings();
    console.log("[Watch Party] settings wired");
    updateTurnBadge();   // show initial TURN… state (updates again when fetch settles)
    window.addEventListener("hashchange", onHash);

    // route on first load
    var code = parseHash();
    if (code) onHash(); else showScreen("lobby");

    // ---- Background survival: keep connection alive when tab is hidden ----
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        // Tab went to background — do NOT destroy peer or leave room.
        // The Wake Lock (if active) helps prevent OS throttling.
        // Just stop sync timer to save battery; reconnect restores it.
        if (state.syncTimer) { clearInterval(state.syncTimer); state.syncTimer = null; }
      } else {
        // Tab came back to foreground — check if peer is still connected
        if (state.peer && state.room) {
          if (state.peer.disconnected) {
            try { state.peer.reconnect(); } catch (e) {}
          }
          // restart sync timer if host
          if (state.isHost) startHostSync();
          // re-request wake lock if it was released
          requestWakeLock();
        }
      }
    });

    // Warn before closing the tab while in a room
    window.addEventListener("beforeunload", function (e) {
      if (state.room) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  // boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
