// ============================================
// SMART TIME LIMITER - Popup (Gemini AI + Export)
// ============================================

var currentData = null;
var reportData = null;

// ══════════════════════════════════════
// ── INIT (runs when popup opens) ──
// ══════════════════════════════════════

document.addEventListener("DOMContentLoaded", async function() {
    document.getElementById("currentDate").textContent =
        new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

    document.getElementById("reportDate").value = getToday();

    setupTabs();
    setupEventListeners();
    await refreshData();

    // Initialize AI key state
    await loadApiKey();

    chrome.runtime.onMessage.addListener(function(msg) {
        if (msg.type === "USAGE_TICK") refreshData();
    });

    setInterval(refreshData, 2000);
});

// ══════════════════════════════════════
// ── TABS ──
// ══════════════════════════════════════

function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
            document.querySelectorAll(".tab-content").forEach(function(c) { c.classList.remove("active"); });
            btn.classList.add("active");
            document.getElementById("tab-" + btn.dataset.tab).classList.add("active");

            if (btn.dataset.tab === "report") loadReport();
            if (btn.dataset.tab === "ai") loadAIInsights();
        });
    });
}

// ══════════════════════════════════════
// ── EVENT LISTENERS ──
// ══════════════════════════════════════

function setupEventListeners() {
    // Quick limit toggle
    document.getElementById("quickLimitBtn").addEventListener("click", function() {
        var modal = document.getElementById("quickLimitModal");
        modal.style.display = modal.style.display === "none" ? "block" : "none";
    });

    // Quick limit preset buttons
    document.querySelectorAll(".ql-btn").forEach(function(btn) {
        btn.addEventListener("click", async function() {
            var minutes = parseInt(btn.dataset.minutes);
            if (currentData && currentData.activeHostname) {
                await setLimit(currentData.activeHostname, minutes);
                document.getElementById("quickLimitModal").style.display = "none";
                await refreshData();
            }
        });
    });

    // Custom limit
    document.getElementById("setCustomLimit").addEventListener("click", async function() {
        var minutes = parseInt(document.getElementById("customMinutes").value);
        if (minutes > 0 && currentData && currentData.activeHostname) {
            await setLimit(currentData.activeHostname, minutes);
            document.getElementById("quickLimitModal").style.display = "none";
            document.getElementById("customMinutes").value = "";
            await refreshData();
        }
    });

    // Add limit form
    document.getElementById("addLimitBtn").addEventListener("click", function() {
        var form = document.getElementById("addLimitForm");
        form.style.display = form.style.display === "none" ? "block" : "none";
        if (currentData && currentData.activeHostname) {
            document.getElementById("limitHostname").value = currentData.activeHostname;
        }
    });

    document.getElementById("cancelLimitBtn").addEventListener("click", function() {
        document.getElementById("addLimitForm").style.display = "none";
    });

    document.getElementById("saveLimitBtn").addEventListener("click", async function() {
        var hostname = document.getElementById("limitHostname").value.trim().replace("www.", "");
        var daily = parseInt(document.getElementById("limitDaily").value);
        var warning = parseInt(document.getElementById("limitWarning").value) || Math.floor(daily * 0.8);
        if (hostname && daily > 0) {
            await setLimit(hostname, daily, warning);
            document.getElementById("addLimitForm").style.display = "none";
            document.getElementById("limitHostname").value = "";
            document.getElementById("limitDaily").value = "";
            document.getElementById("limitWarning").value = "";
            await refreshData();
        }
    });

    // Dashboard buttons
    document.getElementById("openDashboard").addEventListener("click", function() {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    });

    document.getElementById("dashboardBtn").addEventListener("click", function() {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    });

    // Limits list — event delegation for Remove buttons
    document.getElementById("limitsList").addEventListener("click", function(e) {
        var btn = e.target.closest("[data-remove-host]");
        if (btn) removeLimit(btn.getAttribute("data-remove-host"));
    });

    // Report
    document.getElementById("reportDate").addEventListener("change", loadReport);
    document.getElementById("exportImageBtn").addEventListener("click", exportReportAsImage);

    // AI Tip button
    document.getElementById("getAiTip").addEventListener("click", getAITip);

    // AI Key buttons
    document.getElementById("saveApiKey").addEventListener("click", async function() {
        var key = document.getElementById("geminiApiKey").value.trim();
        if (key.length < 20) {
            showAiStatus("Invalid API key format", "error");
            return;
        }
        await chrome.storage.local.set({ geminiApiKey: key });
        document.getElementById("geminiApiKey").value = "";
        showAiStatus("✅ API key saved!", "success");
        setTimeout(function() { loadApiKey(); }, 800);
    });

    document.getElementById("changeApiKey").addEventListener("click", async function() {
        await chrome.storage.local.remove("geminiApiKey");
        await chrome.storage.local.remove("aiTipCache");
        loadApiKey();
        showAiStatus("🗑️ Key cleared. Enter a new one.", "success");
    });
}

// ══════════════════════════════════════
// ── DATA OPERATIONS ──
// ══════════════════════════════════════

async function refreshData() {
    try {
        currentData = await chrome.runtime.sendMessage({ type: "GET_ALL_DATA" });
        updateOverview();
        updateLimitsList();
    } catch (e) {}
}

async function setLimit(hostname, daily, warning) {
    await chrome.runtime.sendMessage({
        type: "SET_LIMIT",
        data: { hostname: hostname, daily: daily, warning: warning || Math.floor(daily * 0.8) }
    });
}

async function removeLimit(hostname) {
    await chrome.runtime.sendMessage({
        type: "REMOVE_LIMIT",
        data: { hostname: hostname }
    });
    await refreshData();
}

// ══════════════════════════════════════
// ── OVERVIEW TAB ──
// ══════════════════════════════════════

function updateOverview() {
    if (!currentData) return;
    var usage = currentData.usage;
    var limits = currentData.limits;
    var blockedSites = currentData.blockedSites || {};
    var activeHostname = currentData.activeHostname;

    var siteName = document.getElementById("currentSiteName");
    var statusBadge = document.getElementById("currentStatus");

    if (activeHostname) {
        siteName.textContent = activeHostname;
        var seconds = usage[activeHostname] || 0;
        var limit = limits[activeHostname];

        updateProgressRing(seconds, limit);
        document.getElementById("currentSpent").textContent = formatTime(seconds);
        document.getElementById("currentLimit").textContent = limit ? limit.daily + "m" : "None";
        document.getElementById("currentRemaining").textContent = limit
            ? formatTime(Math.max(limit.daily * 60 - seconds, 0)) : "∞";

        if (limit) {
            var pct = (seconds / (limit.daily * 60)) * 100;
            if (blockedSites[activeHostname]) {
                statusBadge.textContent = "🚫 Blocked"; statusBadge.className = "status-badge critical";
            } else if (pct >= 95) {
                statusBadge.textContent = "🔴 Critical"; statusBadge.className = "status-badge critical";
            } else if (pct >= 80) {
                statusBadge.textContent = "⚠️ Warning"; statusBadge.className = "status-badge warning";
            } else {
                statusBadge.textContent = "✅ Active"; statusBadge.className = "status-badge";
            }
        } else {
            statusBadge.textContent = "📍 Tracking"; statusBadge.className = "status-badge";
        }
    } else {
        siteName.textContent = "No active site";
        statusBadge.textContent = "Idle"; statusBadge.className = "status-badge";
    }

    var totalSeconds = Object.values(usage).reduce(function(a, b) { return a + b; }, 0);
    document.getElementById("totalTime").textContent = formatTime(totalSeconds);
    document.getElementById("sitesVisited").textContent = Object.keys(usage).length;
    var exceeded = Object.entries(usage).filter(function(e) {
        return limits[e[0]] && e[1] > limits[e[0]].daily * 60;
    }).length;
    document.getElementById("limitsExceeded").textContent = exceeded;
    document.getElementById("productivityScore").textContent = calculateScore(usage, limits) + "%";
    updateTopSites(usage, limits, blockedSites);
}

function updateProgressRing(seconds, limit) {
    var ring = document.getElementById("progressRing");
    var ringValue = document.getElementById("ringValue");
    var circ = 2 * Math.PI * 52;
    ringValue.textContent = Math.floor(seconds / 60);
    if (limit) {
        var pct = Math.min((seconds / (limit.daily * 60)) * 100, 100);
        ring.style.strokeDashoffset = circ - (pct / 100) * circ;
        ring.style.stroke = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#6366f1";
    } else {
        ring.style.strokeDashoffset = circ * 0.7;
        ring.style.stroke = "#6366f1";
    }
}

function updateTopSites(usage, limits, blockedSites) {
    var container = document.getElementById("topSitesList");
    var sorted = Object.entries(usage).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
    if (sorted.length === 0) {
        container.innerHTML = '<div class="empty-state">No activity yet</div>';
        return;
    }
    var maxSec = sorted[0][1];
    container.innerHTML = sorted.map(function(e, i) {
        var hostname = e[0], seconds = e[1];
        var limit = limits[hostname];
        var blocked = blockedSites[hostname];
        var pct = limit ? Math.min((seconds / (limit.daily * 60)) * 100, 100) : (seconds / maxSec) * 60;
        var color = blocked ? "#dc2626" : (limit ? (pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#6366f1") : "#6366f1");
        var rankClass = i < 3 ? "top-" + (i + 1) : "";
        var blockedTag = blocked ? ' <span style="color:#ef4444;font-size:10px;">🚫</span>' : '';
        return '<div class="site-item"><div class="site-rank ' + rankClass + '">' + (i + 1) + '</div>' +
            '<div class="site-info"><div class="site-hostname">' + hostname + blockedTag + '</div>' +
            '<div class="site-progress-bar"><div class="site-progress-fill" style="width:' + pct + '%;background:' + color + ';"></div></div></div>' +
            '<div class="site-time">' + formatTime(seconds) + '</div></div>';
    }).join("");
}

// ══════════════════════════════════════
// ── LIMITS TAB ──
// ══════════════════════════════════════

function updateLimitsList() {
    if (!currentData) return;
    var limits = currentData.limits;
    var usage = currentData.usage;
    var blockedSites = currentData.blockedSites || {};
    var container = document.getElementById("limitsList");
    var entries = Object.entries(limits);
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state">No limits set yet</div>';
        return;
    }
    container.innerHTML = entries.map(function(e) {
        var hostname = e[0], config = e[1];
        var seconds = usage[hostname] || 0;
        var pct = Math.round((seconds / (config.daily * 60)) * 100);
        var blocked = blockedSites[hostname];
        var icon = blocked ? "🚫 " : (pct >= 80 ? "⚠️ " : "✅ ");
        return '<div class="limit-item"><div class="limit-site-info"><h4>' + icon + hostname + '</h4>' +
            '<div class="limit-details">Limit: ' + config.daily + 'm | Warn: ' + config.warning +
            'm | Used: ' + formatTime(seconds) + ' (' + Math.min(pct, 100) + '%)</div></div>' +
            '<div><button class="btn-danger-sm" data-remove-host="' + hostname + '">Remove & Unblock</button></div></div>';
    }).join("");
}

// ══════════════════════════════════════
// ── REPORT TAB ──
// ══════════════════════════════════════

async function loadReport() {
    var date = document.getElementById("reportDate").value || getToday();
    try {
        reportData = await chrome.runtime.sendMessage({
            type: "GET_DAILY_REPORT",
            data: { date: date }
        });
        renderReport(reportData);
    } catch (e) {}
}

function renderReport(report) {
    if (!report) return;
    var s = report.summary;

    document.getElementById("reportSummary").innerHTML =
        '<div class="report-summary-grid">' +
        '<div class="report-summary-item"><span class="report-summary-value">' + s.totalHours + 'h</span><span class="report-summary-label">Total</span></div>' +
        '<div class="report-summary-item"><span class="report-summary-value">' + s.siteCount + '</span><span class="report-summary-label">Sites</span></div>' +
        '<div class="report-summary-item"><span class="report-summary-value">' + s.productivityScore + '%</span><span class="report-summary-label">Score</span></div>' +
        '</div>';

    var bars = document.getElementById("reportBars");
    var topSites = report.sites.slice(0, 6);
    if (topSites.length === 0) {
        bars.innerHTML = '<div class="empty-state">No data</div>';
        return;
    }
    var maxMin = Math.max.apply(null, topSites.map(function(s) { return s.minutes; }));
    if (maxMin === 0) maxMin = 1;

    bars.innerHTML = topSites.map(function(site) {
        var pct = (site.minutes / maxMin) * 100;
        var color = site.overLimit ? "#ef4444" : "#6366f1";
        var name = site.hostname.replace(/\.com|\.org|\.net|\.io/g, "").substring(0, 12);
        return '<div class="report-bar-item">' +
            '<span class="report-bar-name">' + name + '</span>' +
            '<div class="report-bar-track"><div class="report-bar-fill" style="width:' + pct + '%;background:' + color + ';">' + site.minutes + 'm</div></div>' +
            '<span class="report-bar-time">' + (site.percentage !== null ? Math.round(site.percentage) + '%' : '—') + '</span></div>';
    }).join("");

    var detail = document.getElementById("reportSitesDetail");
    detail.innerHTML = report.sites.map(function(site) {
        var overClass = site.overLimit ? ' report-over' : '';
        return '<div class="report-site-row">' +
            '<span class="report-site-name' + overClass + '">' + (site.overLimit ? '🚫 ' : '') + site.hostname + '</span>' +
            '<span class="report-site-stats">' + site.minutes + 'm' +
            (site.limit ? ' / ' + site.limit + 'm' : '') + '</span></div>';
    }).join("");
}

// ══════════════════════════════════════
// ── EXPORT REPORT AS IMAGE ──
// ══════════════════════════════════════

async function exportReportAsImage() {
    var btn = document.getElementById("exportImageBtn");
    btn.textContent = "⏳ Generating...";
    btn.classList.add("exporting");

    if (!reportData) await loadReport();

    if (!reportData || !reportData.sites || reportData.sites.length === 0) {
        btn.textContent = "❌ No Data";
        setTimeout(function() {
            btn.textContent = "📸 Export as Image";
            btn.classList.remove("exporting");
        }, 2000);
        return;
    }

    try {
        var canvas = generateReportCanvas(reportData);
        var dataUrl = canvas.toDataURL("image/png");
        var link = document.createElement("a");
        link.download = "time-report-" + reportData.date + ".png";
        link.href = dataUrl;
        link.click();

        btn.textContent = "✅ Downloaded!";
        setTimeout(function() {
            btn.textContent = "📸 Export as Image";
            btn.classList.remove("exporting");
        }, 2000);
    } catch (e) {
        btn.textContent = "❌ Error";
        setTimeout(function() {
            btn.textContent = "📸 Export as Image";
            btn.classList.remove("exporting");
        }, 2000);
    }
}

function generateReportCanvas(report) {
    var sites = report.sites.slice(0, 8);
    var s = report.summary;
    var W = 800;
    var headerH = 140;
    var statsH = 100;
    var chartH = 40 * sites.length + 60;
    var detailH = 30 * sites.length + 60;
    var footerH = 60;
    var H = headerH + statsH + chartH + detailH + footerH + 40;

    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    var bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#0f0f1a");
    bgGrad.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.02)";
    ctx.lineWidth = 1;
    for (var gi = 0; gi < W; gi += 40) { ctx.beginPath(); ctx.moveTo(gi, 0); ctx.lineTo(gi, H); ctx.stroke(); }
    for (var gj = 0; gj < H; gj += 40) { ctx.beginPath(); ctx.moveTo(0, gj); ctx.lineTo(W, gj); ctx.stroke(); }

    var y = 0;

    var headerGrad = ctx.createLinearGradient(0, 0, W, headerH);
    headerGrad.addColorStop(0, "rgba(99,102,241,0.1)");
    headerGrad.addColorStop(1, "rgba(139,92,246,0.05)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, headerH);

    var lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0, "#6366f1");
    lineGrad.addColorStop(1, "#a78bfa");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, headerH - 2, W, 2);

    ctx.font = "40px serif";
    ctx.fillText("⏱️", 30, 60);
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillStyle = "#f1f5f9";
    ctx.fillText("Smart Time Limiter", 85, 55);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    var dateFormatted = new Date(report.date).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    ctx.fillText("Daily Report — " + dateFormatted, 85, 82);

    var scoreColor = s.productivityScore >= 70 ? "#10b981" : s.productivityScore >= 40 ? "#f59e0b" : "#ef4444";
    roundRect(ctx, W - 160, 30, 130, 50, 12, scoreColor + "20");
    ctx.fillStyle = scoreColor;
    ctx.font = "bold 24px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(s.productivityScore + "%", W - 95, 58);
    ctx.font = "10px system-ui";
    ctx.fillText("SCORE", W - 95, 72);
    ctx.textAlign = "left";

    y = headerH + 20;

    var statsData = [
        { label: "TOTAL TIME", value: s.totalHours + "h", icon: "⏱", color: "#818cf8" },
        { label: "SITES VISITED", value: s.siteCount + "", icon: "🌐", color: "#3b82f6" },
        { label: "LIMITS EXCEEDED", value: s.overLimitCount + "", icon: "🚨", color: "#ef4444" },
        { label: "TOP SITE", value: s.topSite.substring(0, 15), icon: "🏆", color: "#f59e0b" }
    ];

    var cardW = (W - 80) / 4;
    statsData.forEach(function(stat, i) {
        var x = 30 + i * (cardW + 10);
        roundRect(ctx, x, y, cardW, 75, 10, "rgba(255,255,255,0.03)");
        ctx.fillStyle = stat.color;
        ctx.fillRect(x, y + 10, 3, 55);
        ctx.font = "20px serif";
        ctx.fillText(stat.icon, x + 14, y + 30);
        ctx.font = "bold 18px system-ui";
        ctx.fillStyle = "#f1f5f9";
        ctx.fillText(stat.value, x + 14, y + 52);
        ctx.font = "9px system-ui";
        ctx.fillStyle = "#64748b";
        ctx.fillText(stat.label, x + 14, y + 67);
    });

    y += statsH;

    roundRect(ctx, 25, y, W - 50, chartH, 12, "rgba(255,255,255,0.02)");
    ctx.font = "bold 14px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("📊 Time by Site", 45, y + 28);

    var barY = y + 45;
    var maxMin = Math.max.apply(null, sites.map(function(s) { return s.minutes; }));
    if (maxMin === 0) maxMin = 1;
    var barMaxW = W - 250;

    sites.forEach(function(site) {
        var barW = Math.max((site.minutes / maxMin) * barMaxW, 10);
        var barColor = site.overLimit ? "#ef4444" : "#6366f1";
        ctx.font = "12px system-ui";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "right";
        ctx.fillText(site.hostname.substring(0, 18), 155, barY + 14);
        ctx.textAlign = "left";
        roundRect(ctx, 165, barY + 2, barMaxW, 20, 4, "rgba(255,255,255,0.04)");
        var barGrad = ctx.createLinearGradient(165, 0, 165 + barW, 0);
        barGrad.addColorStop(0, barColor);
        barGrad.addColorStop(1, barColor + "bb");
        roundRect(ctx, 165, barY + 2, barW, 20, 4, barGrad);
        ctx.font = "bold 12px system-ui";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(site.minutes + "m", 165 + barMaxW + 10, barY + 16);
        if (site.percentage !== null) {
            ctx.font = "10px system-ui";
            ctx.fillStyle = site.overLimit ? "#ef4444" : "#64748b";
            ctx.fillText(Math.round(site.percentage) + "%", 165 + barMaxW + 50, barY + 16);
        }
        barY += 40;
    });

    y += chartH + 10;

    roundRect(ctx, 25, y, W - 50, detailH, 12, "rgba(255,255,255,0.02)");
    ctx.font = "bold 14px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("📋 Detailed Breakdown", 45, y + 28);

    var tY = y + 48;
    ctx.font = "bold 10px system-ui";
    ctx.fillStyle = "#4a5568";
    ctx.fillText("SITE", 50, tY);
    ctx.fillText("TIME", 400, tY);
    ctx.fillText("LIMIT", 500, tY);
    ctx.fillText("STATUS", 600, tY);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.moveTo(45, tY + 8); ctx.lineTo(W - 45, tY + 8); ctx.stroke();
    tY += 25;

    sites.forEach(function(site) {
        var status = site.overLimit ? "🚫 Over" : (site.percentage >= 80 ? "⚠️ Warning" : "✅ OK");
        ctx.font = "13px system-ui";
        ctx.fillStyle = site.overLimit ? "#ef4444" : "#e2e8f0";
        ctx.fillText(site.hostname.substring(0, 30), 50, tY);
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(site.minutes + " min", 400, tY);
        ctx.fillText(site.limit ? site.limit + " min" : "—", 500, tY);
        ctx.font = "12px system-ui";
        ctx.fillStyle = site.overLimit ? "#ef4444" : (site.percentage >= 80 ? "#f59e0b" : "#10b981");
        ctx.fillText(status, 600, tY);
        tY += 30;
    });

    y += detailH + 10;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, y, W, footerH);
    ctx.strokeStyle = "rgba(99,102,241,0.2)";
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#4a5568";
    ctx.fillText("Generated by Smart Time Limiter • " + new Date().toLocaleString(), 30, y + 25);
    ctx.textAlign = "right";
    ctx.fillStyle = "#64748b";
    ctx.font = "italic 11px system-ui";
    ctx.fillText("\"Your time is limited. Use it wisely.\"", W - 30, y + 25);
    ctx.textAlign = "left";

    return canvas;
}

function roundRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
}

// ══════════════════════════════════════
// ── GEMINI AI ──
// ══════════════════════════════════════

async function loadApiKey() {
    var storage = await chrome.storage.local.get("geminiApiKey");
    var hasKey = storage.geminiApiKey && storage.geminiApiKey.trim().length >= 20;

    document.getElementById("aiSetup").style.display = hasKey ? "none" : "block";
    document.getElementById("changeApiKey").style.display = hasKey ? "inline-block" : "none";
    document.getElementById("getAiTip").disabled = !hasKey;

    if (!hasKey) {
        document.getElementById("aiTip").innerHTML =
            "<p>🔑 Add your Gemini API key above to unlock AI-powered coaching.</p>";
    }
}

async function getAITip() {
    var btn = document.getElementById("getAiTip");
    var statusEl = document.getElementById("aiStatus");

    btn.textContent = "🔄 Asking Gemini...";
    btn.disabled = true;
    statusEl.textContent = "";
    statusEl.className = "ai-status";

    try {
        var topSites = Object.entries(currentData?.usage || {})
            .map(function(e) {
                return { hostname: e[0], seconds: e[1], minutes: Math.round(e[1] / 60) };
            })
            .sort(function(a, b) { return b.seconds - a.seconds; })
            .slice(0, 5);

        var context = {
            usage: currentData?.usage || {},
            limits: currentData?.limits || {},
            topSites: topSites,
            productivityScore: calculateScore(currentData?.usage || {}, currentData?.limits || {})
        };

        var response = await chrome.runtime.sendMessage({
            type: "GET_AI_TIP",
            data: context
        });

        // Needs API key
        if (response.needsKey) {
            document.getElementById("aiTip").innerHTML = "<p>" + response.tip + "</p>";
            loadApiKey();
            btn.textContent = "✨ Get AI Tip";
            btn.disabled = false;
            return;
        }

        // Show the tip
        document.getElementById("aiTip").innerHTML = "<p>" + response.tip + "</p>";

        // Status feedback
        if (response.cached) {
            showAiStatus("💡 From cache (refreshes hourly or on usage change)", "cached");
        } else if (response.fallback) {
            showAiStatus("⚠️ Gemini unavailable, using smart fallback", "error");
        } else if (response.fromAI) {
            showAiStatus("✅ Powered by Gemini 2.0 Flash", "success");
        }

    } catch (e) {
        document.getElementById("aiTip").innerHTML =
            "<p>❌ Failed to get tip. Check your connection and try again.</p>";
        showAiStatus("Network error: " + e.message, "error");
    }

    btn.textContent = "✨ Get Another Tip";
    btn.disabled = false;
}

function showAiStatus(msg, type) {
    var el = document.getElementById("aiStatus");
    el.textContent = msg;
    el.className = "ai-status " + type;
}

function loadAIInsights() {
    if (!currentData) return;
    var usage = currentData.usage;
    var limits = currentData.limits;
    var container = document.getElementById("insightsList");
    var insights = [];

    var totalMin = Math.round(
        Object.values(usage).reduce(function(a, b) { return a + b; }, 0) / 60
    );

    if (totalMin > 120) {
        insights.push({ icon: "📈", text: totalMin + "m browsing today. That's " + (totalMin / 60).toFixed(1) + "h!" });
    }

    var over = Object.entries(usage).filter(function(e) {
        return limits[e[0]] && e[1] > limits[e[0]].daily * 60;
    });
    if (over.length) {
        insights.push({ icon: "🚨", text: "Over limit on: " + over.map(function(e) { return e[0]; }).join(", ") });
    }

    var top = Object.entries(usage).sort(function(a, b) { return b[1] - a[1]; })[0];
    if (top) {
        insights.push({ icon: "🏆", text: "Top site: " + top[0] + " (" + formatTime(top[1]) + ")" });
    }

    var score = calculateScore(usage, limits);
    if (score >= 80) {
        insights.push({ icon: "🌟", text: "Excellent discipline! Score: " + score + "%" });
    } else if (score < 50) {
        insights.push({ icon: "💪", text: "Score: " + score + "%. Try closing 2 distracting tabs." });
    }

    container.innerHTML = insights.length
        ? insights.map(function(i) {
            return '<div class="insight-item"><span class="insight-icon">' + i.icon +
                '</span><span class="insight-text">' + i.text + '</span></div>';
        }).join("")
        : '<div class="empty-state">Start browsing to see insights</div>';
}

// ══════════════════════════════════════
// ── UTILITIES ──
// ══════════════════════════════════════

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return "0m";
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
}

function calculateScore(usage, limits) {
    var entries = Object.entries(usage);
    if (entries.length === 0) return 100;
    var penalty = 0;
    entries.forEach(function(e) {
        if (limits[e[0]] && e[1] > limits[e[0]].daily * 60) penalty += 15;
    });
    return Math.max(0, Math.min(100, 100 - penalty));
}

function getToday() {
    return new Date().toISOString().split("T")[0];
}