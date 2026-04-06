// ============================================
// SMART TIME LIMITER - Content Script (Settings Aware)
// ============================================

(function() {
    var miniDashboard = null;
    var isBlocked = false;
    var isDashboardMinimized = false;
    var currentHostname = window.location.hostname.replace("www.", "");
    var syncInterval = null;
    var SYNC_RATE = 1000;
    var cachedSettings = {};

    // ── SELF-SYNCING ──
    function startSyncing() {
        if (syncInterval) clearInterval(syncInterval);
        syncNow();
        syncInterval = setInterval(syncNow, SYNC_RATE);
    }

    function syncNow() {
        if (isBlocked) return;
        try {
            chrome.runtime.sendMessage(
                { type: "GET_SITE_STATUS", data: { hostname: currentHostname } },
                function(response) {
                    if (chrome.runtime.lastError) return;
                    if (!response) return;

                    // Cache settings from response
                    if (response.settings) cachedSettings = response.settings;

                    // Whitelisted — hide widget
                    if (response.whitelisted) {
                        hideWidget();
                        return;
                    }

                    // Blocked
                    if (response.blocked) {
                        showFullBlock(currentHostname);
                        return;
                    }

                    // Check if widget should show
                    var showWidget = cachedSettings.showWidget !== false;
                    var onlyWithLimits = cachedSettings.onlyWithLimits === true;

                    if (!showWidget) {
                        hideWidget();
                        return;
                    }

                    if (onlyWithLimits && !response.hasLimit) {
                        hideWidget();
                        return;
                    }

                    // Show and update dashboard
                    showWidgetIfNeeded();
                    updateDashboard({
                        hostname: currentHostname,
                        currentSeconds: response.currentSeconds,
                        limitSeconds: response.limitSeconds || 0,
                        percentage: response.percentage || 0,
                        remainingSeconds: response.remainingSeconds || 0,
                        status: response.status || "safe"
                    });
                }
            );
        } catch (e) {}
    }

    // Visibility change
    document.addEventListener("visibilitychange", function() {
        if (isBlocked) return;
        if (document.hidden) {
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(syncNow, 5000);
        } else {
            if (syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(syncNow, SYNC_RATE);
            syncNow();
        }
    });

    // SPA navigation
    var lastUrl = window.location.href;
    function checkUrlChange() {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            currentHostname = window.location.hostname.replace("www.", "");
            if (!isBlocked) syncNow();
        }
    }

    if (document.body || document.documentElement) {
        new MutationObserver(checkUrlChange).observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function() { origPush.apply(this, arguments); setTimeout(checkUrlChange, 300); };
    history.replaceState = function() { origReplace.apply(this, arguments); setTimeout(checkUrlChange, 300); };
    window.addEventListener("popstate", function() { setTimeout(checkUrlChange, 300); });

    // ── WIDGET VISIBILITY ──
    function hideWidget() {
        if (miniDashboard) miniDashboard.style.display = "none";
    }

    function showWidgetIfNeeded() {
        if (!miniDashboard) createMiniDashboard();
        if (miniDashboard) miniDashboard.style.display = "";
    }

    // ── CREATE MINI DASHBOARD ──
    function createMiniDashboard() {
        if (miniDashboard) return;
        miniDashboard = document.createElement("div");
        miniDashboard.id = "stl-mini-dashboard";
        miniDashboard.innerHTML = '\
            <div class="stl-dash-header">\
                <span class="stl-dash-icon">⏱️</span>\
                <span class="stl-dash-title">Time Limiter</span>\
                <div class="stl-dash-controls">\
                    <button class="stl-dash-btn stl-minimize" title="Minimize">−</button>\
                    <button class="stl-dash-btn stl-close" title="Hide">×</button>\
                </div>\
            </div>\
            <div class="stl-dash-body">\
                <div class="stl-site-name"></div>\
                <div class="stl-progress-container">\
                    <div class="stl-progress-bar"><div class="stl-progress-fill"></div></div>\
                    <div class="stl-progress-text">0%</div>\
                </div>\
                <div class="stl-time-info">\
                    <div class="stl-time-spent"><span class="stl-label">Spent:</span><span class="stl-value stl-spent-value">0m</span></div>\
                    <div class="stl-time-remaining"><span class="stl-label">Left:</span><span class="stl-value stl-remaining-value">∞</span></div>\
                </div>\
                <div class="stl-status-badge"><span class="stl-status-dot"></span><span class="stl-status-text">Tracking</span></div>\
            </div>\
            <div class="stl-dash-minimized"><span class="stl-mini-time">0m</span><div class="stl-mini-progress"><div class="stl-mini-progress-fill"></div></div></div>';

        document.body.appendChild(miniDashboard);

        // Apply position from settings
        applyWidgetPosition();

        // Apply startMinimized
        if (cachedSettings.startMinimized) {
            isDashboardMinimized = true;
            miniDashboard.classList.add("stl-minimized");
        }

        miniDashboard.querySelector(".stl-minimize").addEventListener("click", toggleMinimize);
        miniDashboard.querySelector(".stl-close").addEventListener("click", function() {
            hideWidget();
            setTimeout(function() { if (miniDashboard) miniDashboard.style.display = ""; }, 300000);
        });
        miniDashboard.querySelector(".stl-dash-minimized").addEventListener("click", toggleMinimize);
        makeDraggable(miniDashboard);
    }

    function applyWidgetPosition() {
        if (!miniDashboard) return;
        var pos = cachedSettings.widgetPosition || "bottom-right";
        miniDashboard.style.top = "auto";
        miniDashboard.style.bottom = "auto";
        miniDashboard.style.left = "auto";
        miniDashboard.style.right = "auto";

        if (pos === "bottom-right") { miniDashboard.style.bottom = "20px"; miniDashboard.style.right = "20px"; }
        else if (pos === "bottom-left") { miniDashboard.style.bottom = "20px"; miniDashboard.style.left = "20px"; }
        else if (pos === "top-right") { miniDashboard.style.top = "20px"; miniDashboard.style.right = "20px"; }
        else if (pos === "top-left") { miniDashboard.style.top = "20px"; miniDashboard.style.left = "20px"; }
    }

    function toggleMinimize() {
        isDashboardMinimized = !isDashboardMinimized;
        if (miniDashboard) miniDashboard.classList.toggle("stl-minimized", isDashboardMinimized);
    }

    function makeDraggable(el) {
        var dragging = false, sx, sy, ix, iy;
        var header = el.querySelector(".stl-dash-header");
        header.addEventListener("mousedown", function(e) {
            if (e.target.closest(".stl-dash-btn")) return;
            dragging = true; sx = e.clientX; sy = e.clientY;
            var r = el.getBoundingClientRect(); ix = r.left; iy = r.top;
            el.style.transition = "none";
        });
        document.addEventListener("mousemove", function(e) {
            if (!dragging) return;
            el.style.left = (ix + e.clientX - sx) + "px";
            el.style.top = (iy + e.clientY - sy) + "px";
            el.style.right = "auto"; el.style.bottom = "auto";
        });
        document.addEventListener("mouseup", function() { dragging = false; if (el) el.style.transition = ""; });
    }

    // ── UPDATE DASHBOARD ──
    function updateDashboard(data) {
        if (isBlocked || !miniDashboard) return;

        miniDashboard.querySelector(".stl-site-name").textContent = data.hostname;

        var fill = miniDashboard.querySelector(".stl-progress-fill");
        var miniFill = miniDashboard.querySelector(".stl-mini-progress-fill");
        var fillWidth = data.limitSeconds ? Math.min(data.percentage, 100) : 0;
        fill.style.width = fillWidth + "%";
        miniFill.style.width = fillWidth + "%";

        var colorMap = { safe: "#10b981", moderate: "#f59e0b", warning: "#f97316", critical: "#ef4444", blocked: "#dc2626" };
        var color = colorMap[data.status] || "#10b981";
        fill.style.background = color;
        miniFill.style.background = color;

        miniDashboard.querySelector(".stl-progress-text").textContent = data.limitSeconds ? Math.round(data.percentage) + "%" : "No limit";
        miniDashboard.querySelector(".stl-spent-value").textContent = formatTimeLive(data.currentSeconds);
        miniDashboard.querySelector(".stl-remaining-value").textContent = data.limitSeconds ? formatTimeLive(data.remainingSeconds) : "∞";
        miniDashboard.querySelector(".stl-mini-time").textContent = formatTimeLive(data.currentSeconds);

        var statusLabels = { safe: "✅ Safe", moderate: "⚡ Moderate", warning: "⚠️ Warning", critical: "🔴 Critical", blocked: "🚫 Blocked" };
        miniDashboard.querySelector(".stl-status-dot").style.background = color;
        miniDashboard.querySelector(".stl-status-text").textContent = statusLabels[data.status] || "Tracking";
        miniDashboard.classList.toggle("stl-pulse", data.status === "warning" || data.status === "critical");
    }

    // ── FULL BLOCK ──
    function showFullBlock(hostname) {
        if (isBlocked) return;
        isBlocked = true;
        if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }

        try {
            var media = document.querySelectorAll("video, audio");
            for (var i = 0; i < media.length; i++) { media[i].pause(); media[i].src = ""; }
        } catch (e) {}

        // Get settings then render
        try {
            chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, function(settings) {
                if (chrome.runtime.lastError) settings = {};
                renderBlockScreen(hostname, settings || {});
            });
        } catch (e) {
            renderBlockScreen(hostname, {});
        }
    }

    function renderBlockScreen(hostname, settings) {
        var allowExtend = settings.allowExtend !== false;
        var blockKeyboard = settings.blockKeyboard !== false;

        var extendHtml = allowExtend
            ? '<button class="block-btn btn-extend" id="stl-extend-btn">⚡ Emergency: Add 5 Minutes</button>'
            : '<div class="block-strict">🔒 Strict mode — time extensions disabled</div>';

        document.documentElement.innerHTML = '\
        <head><title>🚫 Blocked - ' + hostname + '</title>\
        <style>\
            *{margin:0;padding:0;box-sizing:border-box}\
            html,body{width:100%;height:100%;overflow:hidden;background:#0a0a1a;font-family:system-ui,-apple-system,sans-serif}\
            .block-container{width:100%;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center,#111127 0%,#0a0a1a 70%)}\
            .block-card{text-align:center;max-width:500px;padding:48px 40px}\
            .block-icon{font-size:80px;margin-bottom:20px;display:block}\
            .block-title{font-size:40px;font-weight:900;margin-bottom:16px;background:linear-gradient(135deg,#ef4444,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}\
            .block-msg{font-size:17px;color:#94a3b8;line-height:1.7;margin-bottom:8px}\
            .block-host{color:#ef4444;font-weight:700}\
            .block-sub{font-size:14px;color:#4a5568;margin-bottom:32px}\
            .block-actions{display:flex;flex-direction:column;gap:12px;margin-bottom:32px}\
            .block-btn{display:block;width:100%;padding:16px;border:none;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s}\
            .block-btn:hover{transform:translateY(-2px)}\
            .btn-extend{background:linear-gradient(135deg,#ef4444,#dc2626);color:white;box-shadow:0 4px 15px rgba(239,68,68,0.3)}\
            .btn-close{background:transparent;color:#4a5568;border:1px solid rgba(255,255,255,0.08)!important}\
            .block-quote{padding-top:24px;border-top:1px solid rgba(255,255,255,0.05);font-size:14px;font-style:italic;color:#374151;line-height:1.6}\
            .block-timer{display:inline-block;padding:6px 16px;border-radius:20px;background:rgba(239,68,68,0.1);color:#ef4444;font-size:13px;font-weight:600;margin-bottom:24px}\
            .block-strict{padding:12px 20px;border-radius:10px;background:rgba(239,68,68,0.08);color:#ef4444;font-size:13px;margin-bottom:12px;text-align:center}\
        </style></head>\
        <body><div class="block-container"><div class="block-card">\
            <span class="block-icon">🚫</span>\
            <h1 class="block-title">Time\'s Up!</h1>\
            <p class="block-msg">You\'ve reached your daily limit for<br><span class="block-host">' + hostname + '</span></p>\
            <div class="block-timer">⏰ Resets at midnight</div>\
            <p class="block-sub">Close this tab and do something productive!</p>\
            <div class="block-actions">\
                ' + extendHtml + '\
                <button class="block-btn btn-close" id="stl-close-btn">← Go Back</button>\
            </div>\
            <div class="block-quote" id="stl-quote-text"></div>\
        </div></div></body>';

        document.title = "🚫 Blocked - " + hostname;

        var quotes = [
            "The key is not to prioritize what\'s on your schedule, but to schedule your priorities. — Stephen Covey",
            "Focus is a matter of deciding what things you\'re NOT going to do. — John Carmack",
            "Your time is limited, don\'t waste it living someone else\'s life. — Steve Jobs",
            "It\'s not that we have little time, but that we waste a good deal of it. — Seneca",
            "The secret of getting ahead is getting started. — Mark Twain"
        ];
        var quoteEl = document.getElementById("stl-quote-text");
        if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];

        // Extend button
        var extendBtn = document.getElementById("stl-extend-btn");
        if (extendBtn) {
            extendBtn.addEventListener("click", function() {
                try {
                    chrome.runtime.sendMessage({ type: "OVERRIDE_BLOCK", data: { hostname: hostname } }, function(resp) {
                        if (resp && resp.success === false) {
                            extendBtn.textContent = "🔒 Disabled";
                            extendBtn.disabled = true;
                        } else {
                            window.location.reload();
                        }
                    });
                } catch (e) { window.location.reload(); }
            });
        }

        // Back button
        var closeBtn = document.getElementById("stl-close-btn");
        if (closeBtn) {
            closeBtn.addEventListener("click", function() {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "https://www.google.com";
            });
        }

        // Block navigation
        history.pushState(null, "", window.location.href);
        window.addEventListener("popstate", function() { history.pushState(null, "", window.location.href); });

        // Block keyboard (setting-aware)
        if (blockKeyboard) {
            document.addEventListener("keydown", function(e) {
                if (e.ctrlKey && (e.key === "w" || e.key === "t" || e.key === "W" || e.key === "T")) return;
                e.preventDefault(); e.stopPropagation(); return false;
            }, true);
            document.addEventListener("contextmenu", function(e) { e.preventDefault(); });
        }
    }

    // ── UNBLOCK ──
    function unblockSite() {
        if (!isBlocked) return;
        isBlocked = false;
        window.location.reload();
    }

    // ── LISTEN FOR PUSH MESSAGES ──
    chrome.runtime.onMessage.addListener(function(message) {
        if (!message || !message.type) return;
        switch (message.type) {
            case "TIME_UPDATE": if (!isBlocked) updateDashboard(message.data); break;
            case "BLOCK_LEVEL": if (message.data && message.data.level === "full") showFullBlock(message.data.hostname); break;
            case "UNBLOCK": unblockSite(); break;
        }
    });

    // ── FORMAT TIME ──
    function formatTimeLive(seconds) {
        if (!seconds || seconds <= 0) return "0s";
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + "m " + s + "s";
        return s + "s";
    }

    // ── INIT ──
    // Fetch settings first, then start
    try {
        chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, function(settings) {
            if (chrome.runtime.lastError) settings = {};
            cachedSettings = settings || {};

            if (cachedSettings.showWidget !== false) {
                createMiniDashboard();
            }
            startSyncing();
        });
    } catch (e) {
        createMiniDashboard();
        startSyncing();
    }
})();