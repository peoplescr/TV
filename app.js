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

     Uses ExpressTURN free public TURN server — STATIC long-term credentials,
     no signup, no API call, no CORS. Works from any browser or the APK.
     Get/refresh free credentials at https://www.expressturn.com/ (they
     rotate the free password periodically — when the relay badge goes red,
     grab the new username/password from that page and update TURN_USERNAME /
     TURN_PASSWORD below).
     ============================================================ */

  // ExpressTURN free credentials (no account / no credit card).
  var TURN_HOST     = "free.expressturn.com";
  var TURN_PORT     = 3478;
  var TURN_USERNAME = "000000002097349597";
  var TURN_PASSWORD = "diN8vIfMKBph5bdlH0STB8Hsnd0=";

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
  // TURN entries are listed first so the relay is preferred for cross-network.
  function iceServers() {
    return [
      { urls: "turn:" + TURN_HOST + ":" + TURN_PORT,
        username: TURN_USERNAME, credential: TURN_PASSWORD },
      { urls: "turn:" + TURN_HOST + ":" + TURN_PORT + "?transport=tcp",
        username: TURN_USERNAME, credential: TURN_PASSWORD },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" }
    ];
  }

  // With static TURN credentials there's nothing to fetch, so TURN is always
  // "ready". We keep the gate so existing call sites don't need to change.
  var _turnReady = true;
  var TURN_CONFIGURED = true;
  function whenXirsysReady(cb) { cb(true); }
  function _resolveTurn() { updateTurnBadge(); }

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
    remoteStream: null
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
      conn.send({ t: "hello", name: state.name, hostName: state.name, pfp: state.pfp, srcType: state.srcType, fileName: state.fileName });

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
        // Rich chat. {mid, name, pfp, text, reply?:{name,text}}
        addChat({
          name: data.name || "Peer",
          pfp: data.pfp,
          text: data.text,
          mid: data.mid,
          reply: data.reply || null
        });
        // bump the FAB unread badge if the drawer is closed (mobile)
        try { ChatDrawer.onIncoming(); } catch (e) {}
        // HOST RELAY: a viewer sent a chat — rebroadcast to every OTHER peer
        // so 3+ person rooms all see each other's messages.
        if (state.isHost) relayToOthers(conn, data);
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
      var up = $("data-up"), down = $("data-down");
      if (up) up.textContent = human(sent);
      if (down) down.textContent = human(recv);
      var su = $("set-data-up"), sd = $("set-data-down");
      if (su) su.textContent = human(sent);
      if (sd) sd.textContent = human(recv);
      renderDetail();
    }

    function renderDetail() {
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
      reset: reset,
      totals: function () { return { sent: sent, recv: recv }; }
    };
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
      fab = $("chat-fab");
      badge = $("chat-fab-badge");
      input = $("chat-input");
      isMobile = window.matchMedia("(max-width: 1023px)").matches;

      // FAB toggle
      if (fab) fab.addEventListener("click", function () { open(); });

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
          hideFab();
        } else {
          // mobile: if not open, show FAB
          if (!isOpen) showFab();
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
    function showFab() { if (fab) fab.classList.remove("hidden"); }
    function hideFab() { if (fab) fab.classList.add("hidden"); }

    function open() {
      if (!mobile()) return;        // desktop: nothing to do
      isOpen = true;
      panel.classList.add("open");
      showBackdrop();
      hideFab();
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
      // re-show the FAB (idle style until new activity)
      showFab();
      fab.classList.add("idle");
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
      // a new message makes the FAB pulse again to draw the eye
      if (fab) fab.classList.remove("idle");
    }
    function clearUnread() {
      unread = 0;
      if (badge) badge.classList.add("hidden");
    }

    // edge-swipe: drag the panel by its leading knob to dismiss it
    function wireSwipe() {
      if (!panel) return;
      var knob = $("chat-swipe");
      var start = null, width = 0, dragging = false;

      function begin(clientX) {
        if (!isOpen) return;
        width = panel.getBoundingClientRect().width;
        start = clientX;
        dragging = true;
        panel.classList.add("dragging");
      }
      function move(clientX) {
        if (!dragging) return;
        var dx = Math.max(0, clientX - start);   // only allow dragging rightward
        panel.style.transform = "translateX(" + dx + "px)";
      }
      function end() {
        if (!dragging) return;
        dragging = false;
        panel.classList.remove("dragging");
        var cur = panel.getBoundingClientRect().left;
        var openLeft = (window.innerWidth - width);
        // if dragged more than ~35% of the way shut, close
        if (cur - openLeft > width * 0.35) {
          panel.style.transform = "";
          close();
        } else {
          panel.style.transform = "";
        }
      }

      if (knob) {
        knob.addEventListener("touchstart", function (e) {
          begin(e.touches[0].clientX);
        }, { passive: true });
        knob.addEventListener("touchmove", function (e) {
          move(e.touches[0].clientX);
        }, { passive: true });
        knob.addEventListener("touchend", end);
        // mouse support (desktop testing of mobile width)
        knob.addEventListener("mousedown", function (e) { begin(e.clientX); });
      }
      window.addEventListener("mousemove", function (e) { if (dragging) move(e.clientX); });
      window.addEventListener("mouseup", function () { if (dragging) end(); });
      window.addEventListener("touchmove", function (e) { if (dragging) move(e.touches[0].clientX); }, { passive: true });
      window.addEventListener("touchend", function () { if (dragging) end(); });
    }

    function showInitial() {
      // on mobile, reveal the FAB once we're in a room
      if (mobile()) showFab(); else hideFab();
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
    body.textContent = opts.text;     // textContent = safe (no HTML injection)
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
    $("settings-backdrop").classList.remove("hidden");
    $("settings-sheet").classList.remove("hidden");
    DataMeter.render();
    renderNetInfo();
  }
  function closeSettings() {
    $("settings-backdrop").classList.add("hidden");
    $("settings-sheet").classList.add("hidden");
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
    });
    call.on("close", function () {
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
  function cssFs(on) { $("video-wrap").classList.toggle("cfs", on); }

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
    state.fileName = null;
    state.srcType = null;
    state._intent = null;       // clear routing intent so next session starts clean
    if (player.src && player.src.indexOf("blob:") === 0) URL.revokeObjectURL(player.src);
    player.src = "";
    location.hash = "";
    // hide the mobile drawer + FAB when leaving
    try { ChatDrawer.close(); } catch (e) {}
    try { $("chat-fab").classList.add("hidden"); } catch (e) {}
    DataMeter.reset();
    setOnline("offline");
    showScreen("lobby");
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    console.log("%c[Watch Party] app.js running, init() reached", "color:#0a0;font-weight:bold");
    initLobby();
    console.log("[Watch Party] lobby wired");
    wirePlayerEvents();
    console.log("[Watch Party] player wired");
    wireChat();
    console.log("[Watch Party] chat wired");
    wireActions();
    console.log("[Watch Party] actions wired");
    updateTurnBadge();   // show initial TURN… state (updates again when fetch settles)
    window.addEventListener("hashchange", onHash);

    // route on first load
    var code = parseHash();
    if (code) onHash(); else showScreen("lobby");
  }

  // boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
