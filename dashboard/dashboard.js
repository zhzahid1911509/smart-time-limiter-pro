// ============================================
// SMART TIME LIMITER — Dashboard (Complete)
// ============================================

var dashData = null;
var reportData = null;
var weeklyData = null;

// ══════════════════════════
// ── INIT ──
// ══════════════════════════

document.addEventListener("DOMContentLoaded", async function() {
    document.getElementById("dashDate").textContent =
        new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    document.getElementById("dashReportDate").value = getToday();

    setupNavigation();
    setupSitesTab();
    setupAITab();
    setupExport();
    setupSettings();
    startLiveClock();

    await loadDashboard();
    await loadSettings();

    setInterval(loadDashboard, 2000);
});

function startLiveClock() {
    function tick() {
        var now = new Date();
        document.getElementById("liveClock").textContent =
            now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    tick();
    setInterval(tick, 1000);
}

function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(function(item) {
        item.addEventListener("click", function(e) {
            e.preventDefault();
            document.querySelectorAll(".nav-item").forEach(function(i) { i.classList.remove("active"); });
            document.querySelectorAll(".section").forEach(function(s) { s.classList.remove("active"); });
            item.classList.add("active");
            document.getElementById("section-" + item.dataset.section).classList.add("active");

            if (item.dataset.section === "reports") loadDetailedReport();
            if (item.dataset.section === "ai") loadAIDashboard();
            if (item.dataset.section === "settings") loadSettings();
        });
    });
}

// ══════════════════════════
// ── LOAD ALL DATA ──
// ══════════════════════════

async function loadDashboard() {
    try {
        dashData = await chrome.runtime.sendMessage({ type: "GET_ALL_DATA" });
        var report = await chrome.runtime.sendMessage({ type: "GET_DAILY_REPORT" });
        weeklyData = await chrome.runtime.sendMessage({ type: "GET_WEEKLY_REPORT" });

        updateStats(report);
        updateBarChart(report.sites);
        updateTrendChart(weeklyData);
        updateLiveSites(dashData);
        updateSitesTable(dashData);
    } catch (e) {
        console.error("Dashboard sync error:", e);
    }
}

// ══════════════════════════
// ── OVERVIEW ──
// ══════════════════════════

function updateStats(report) {
    var s = report.summary;
    var h = Math.floor(s.totalMinutes / 60);
    var m = s.totalMinutes % 60;
    document.getElementById("dashTotalTime").textContent = h + "h " + m + "m";
    document.getElementById("dashSiteCount").textContent = s.siteCount;
    document.getElementById("dashOverLimit").textContent = s.overLimitCount;
    document.getElementById("dashScore").textContent = s.productivityScore + "%";

    document.getElementById("dashTotalSub").textContent = s.totalMinutes > 180 ? "⚠️ High usage today" : "📊 Within healthy range";
    document.getElementById("dashSiteSub").textContent = "Top: " + s.topSite;
    document.getElementById("dashOverSub").textContent = s.overLimitCount > 0 ? "Action needed!" : "All within limits";
    document.getElementById("dashScoreSub").textContent = s.productivityScore >= 70 ? "Great job!" : "Room to improve";
}

function updateBarChart(sites) {
    var container = document.getElementById("dashBarChart");
    var top = sites.slice(0, 8);
    if (top.length === 0) { container.innerHTML = '<div class="empty-state">No data today</div>'; return; }
    var maxMin = Math.max.apply(null, top.map(function(s) { return s.minutes; })) || 1;
    container.innerHTML = top.map(function(site) {
        var pct = (site.minutes / maxMin) * 100;
        var color = site.overLimit ? "#ef4444" : "#6366f1";
        return '<div class="horiz-bar-item"><span class="horiz-bar-name">' + site.hostname + '</span>' +
            '<div class="horiz-bar-track"><div class="horiz-bar-fill" style="width:' + pct + '%;background:' + color + ';">' + site.minutes + 'm</div></div>' +
            '<span class="horiz-bar-value">' + (site.percentage !== null ? Math.round(site.percentage) + '%' : '—') + '</span></div>';
    }).join("");
}

function updateTrendChart(weekly) {
    var container = document.getElementById("dashTrendChart");
    var maxMin = Math.max.apply(null, weekly.days.map(function(d) { return d.totalMinutes; })) || 1;
    var today = getToday();
    container.innerHTML = weekly.days.map(function(day) {
        var height = Math.max((day.totalMinutes / maxMin) * 100, 4);
        var isToday = day.date === today;
        return '<div class="trend-bar"><span class="trend-bar-value">' + day.totalMinutes + 'm</span>' +
            '<div class="trend-bar-fill ' + (isToday ? 'today-bar' : '') + '" style="height:' + height + '%;"></div>' +
            '<span class="trend-bar-label">' + day.dayName + '</span></div>';
    }).join("");
}

function updateLiveSites(data) {
    var container = document.getElementById("dashLiveSites");
    var badge = document.getElementById("activeHostBadge");
    badge.textContent = data.activeHostname ? "🔴 " + data.activeHostname : "No active site";

    var sorted = Object.entries(data.usage).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    if (sorted.length === 0) { container.innerHTML = '<div class="empty-state">No activity yet</div>'; return; }

    container.innerHTML = sorted.map(function(e) {
        var hostname = e[0], seconds = e[1];
        var limit = data.limits[hostname];
        var blocked = data.blockedSites && data.blockedSites[hostname];
        var isActive = hostname === data.activeHostname;
        var pct = limit ? Math.min((seconds / (limit.daily * 60)) * 100, 100) : 0;
        var color = blocked ? "#ef4444" : (pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#6366f1");
        var cardClass = "live-site-card" + (isActive ? " is-active" : "") + (blocked ? " is-blocked" : "");

        return '<div class="' + cardClass + '">' +
            '<div class="live-site-name">' + (isActive ? '🔴 ' : '') + (blocked ? '🚫 ' : '') + hostname + '</div>' +
            '<div class="live-site-time' + (blocked ? ' is-blocked' : '') + '">' + formatTimeLive(seconds) + '</div>' +
            (limit
                ? '<div class="live-site-bar"><div class="live-site-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
                  '<div class="live-site-status">' + Math.round(pct) + '% of ' + limit.daily + 'm limit</div>'
                : '<div class="live-site-status">No limit set</div>') +
            '</div>';
    }).join("");
}

// ══════════════════════════
// ── SITES & LIMITS ──
// ══════════════════════════

function setupSitesTab() {
    document.getElementById("dashAddLimitBtn").addEventListener("click", function() {
        var modal = document.getElementById("dashAddLimitModal");
        modal.style.display = modal.style.display === "none" ? "block" : "none";
    });

    document.getElementById("dashCancelLimitBtn").addEventListener("click", function() {
        document.getElementById("dashAddLimitModal").style.display = "none";
    });

    document.querySelectorAll(".preset-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
            document.getElementById("dashLimitDaily").value = btn.dataset.min;
            document.getElementById("dashLimitWarn").value = Math.floor(parseInt(btn.dataset.min) * 0.8);
        });
    });

    document.getElementById("dashSaveLimitBtn").addEventListener("click", async function() {
        var hostname = document.getElementById("dashLimitHost").value.trim().replace("www.", "");
        var daily = parseInt(document.getElementById("dashLimitDaily").value);
        var warn = parseInt(document.getElementById("dashLimitWarn").value) || Math.floor(daily * 0.8);
        if (!hostname || !daily || daily < 1) return;

        await chrome.runtime.sendMessage({ type: "SET_LIMIT", data: { hostname: hostname, daily: daily, warning: warn } });
        document.getElementById("dashLimitHost").value = "";
        document.getElementById("dashLimitDaily").value = "";
        document.getElementById("dashLimitWarn").value = "";
        document.getElementById("dashAddLimitModal").style.display = "none";
        await loadDashboard();
    });

    document.getElementById("dashSitesTable").addEventListener("click", async function(e) {
        var removeBtn = e.target.closest("[data-remove-host]");
        if (removeBtn) {
            await chrome.runtime.sendMessage({ type: "REMOVE_LIMIT", data: { hostname: removeBtn.getAttribute("data-remove-host") } });
            await loadDashboard();
            return;
        }
        var addBtn = e.target.closest("[data-add-host]");
        if (addBtn) {
            document.getElementById("dashLimitHost").value = addBtn.getAttribute("data-add-host");
            document.getElementById("dashAddLimitModal").style.display = "block";
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
}

function updateSitesTable(data) {
    var container = document.getElementById("dashSitesTable");
    var allSites = {};
    Object.keys(data.usage).forEach(function(h) { allSites[h] = true; });
    Object.keys(data.limits).forEach(function(h) { allSites[h] = true; });

    var sorted = Object.keys(allSites).sort(function(a, b) { return (data.usage[b] || 0) - (data.usage[a] || 0); });

    if (sorted.length === 0) { container.innerHTML = '<div class="empty-state">No sites tracked yet</div>'; return; }

    var html = '<div class="table-header"><div>Site</div><div>Time</div><div>Limit</div><div>Usage</div><div>Status</div><div>Actions</div></div>';

    sorted.forEach(function(hostname) {
        var seconds = data.usage[hostname] || 0;
        var limit = data.limits[hostname];
        var blocked = data.blockedSites && data.blockedSites[hostname];
        var pct = limit ? Math.min((seconds / (limit.daily * 60)) * 100, 100) : 0;
        var color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#6366f1";

        var status = "—";
        if (blocked) status = '<span style="color:#ef4444">🚫 Blocked</span>';
        else if (limit && pct >= 100) status = '<span style="color:#ef4444">🚫 Over</span>';
        else if (limit && pct >= 80) status = '<span style="color:#f59e0b">⚠️ Warning</span>';
        else if (limit) status = '<span style="color:#10b981">✅ OK</span>';

        var actions = limit
            ? '<button class="btn-remove-sm" data-remove-host="' + hostname + '">Remove & Unblock</button>'
            : '<button class="btn-add-sm" data-add-host="' + hostname + '">+ Add Limit</button>';

        html += '<div class="table-row">' +
            '<div class="table-cell site">' + hostname + '</div>' +
            '<div class="table-cell time">' + formatTimeLive(seconds) + '</div>' +
            '<div class="table-cell">' + (limit ? limit.daily + 'm' : '—') + '</div>' +
            '<div class="table-cell">' + (limit ? '<span class="progress-mini"><span class="progress-mini-fill" style="width:' + pct + '%;background:' + color + '"></span></span>' + Math.round(pct) + '%' : '—') + '</div>' +
            '<div class="table-cell">' + status + '</div>' +
            '<div class="table-cell table-actions">' + actions + '</div></div>';
    });

    container.innerHTML = html;
}

// ══════════════════════════
// ── REPORTS ──
// ══════════════════════════

document.getElementById("dashReportDate").addEventListener("change", loadDetailedReport);

async function loadDetailedReport() {
    var date = document.getElementById("dashReportDate").value || getToday();
    try {
        reportData = await chrome.runtime.sendMessage({ type: "GET_DAILY_REPORT", data: { date: date } });
        weeklyData = await chrome.runtime.sendMessage({ type: "GET_WEEKLY_REPORT" });
        renderDetailedReport(reportData, weeklyData);
    } catch (e) {}
}

function renderDetailedReport(report, weekly) {
    if (!report) return;
    var s = report.summary;
    var sites = report.sites;
    var totalSec = s.totalMinutes * 60;

    // Hero
    var scoreColor = s.productivityScore >= 70 ? "#10b981" : s.productivityScore >= 40 ? "#f59e0b" : "#ef4444";
    document.getElementById("reportHero").innerHTML =
        '<div class="hero-stat"><div class="hero-stat-value">' + s.totalHours + 'h</div><div class="hero-stat-label">Total Time</div>' +
        '<div class="hero-stat-sub">' + s.totalMinutes + ' min across ' + s.siteCount + ' sites</div></div>' +
        '<div class="hero-score" style="border-color:' + scoreColor + '">' +
        '<div class="hero-score-value" style="color:' + scoreColor + '">' + s.productivityScore + '</div>' +
        '<div class="hero-score-label" style="color:' + scoreColor + '">Score</div></div>' +
        '<div class="hero-stat"><div class="hero-stat-value">' + s.overLimitCount + '</div><div class="hero-stat-label">Over Limit</div>' +
        '<div class="hero-stat-sub">' + (s.overLimitCount > 0 ? 'Needs improvement' : 'All within limits!') + '</div></div>' +
        '<div class="hero-stat"><div class="hero-stat-value">' + s.topSite.replace(/\.com|\.org/g, '') + '</div><div class="hero-stat-label">Top Site</div>' +
        '<div class="hero-stat-sub">' + (sites[0] ? sites[0].minutes + ' minutes' : '') + '</div></div>';

    // Time Breakdown
    var avgPerSite = s.siteCount > 0 ? Math.round(s.totalMinutes / s.siteCount) : 0;
    var longestSession = sites[0] ? sites[0].minutes : 0;
    var shortestSession = sites.length > 0 ? sites[sites.length - 1].minutes : 0;
    var withLimits = sites.filter(function(si) { return si.limit !== null; }).length;

    document.getElementById("reportTimeBreakdown").innerHTML =
        '<h4>⏱️ Time Analysis</h4>' +
        '<div class="analytics-row"><span class="analytics-label">Total browsing</span><span class="analytics-value">' + s.totalMinutes + ' min (' + s.totalHours + 'h)</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">Avg per site</span><span class="analytics-value">' + avgPerSite + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">Longest session</span><span class="analytics-value">' + longestSession + ' min (' + s.topSite + ')</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">Shortest tracked</span><span class="analytics-value">' + shortestSession + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">Sites with limits</span><span class="analytics-value">' + withLimits + ' / ' + s.siteCount + '</span></div>';

    // Category Analysis
    var social = ["facebook.com", "twitter.com", "x.com", "instagram.com", "tiktok.com", "reddit.com", "linkedin.com"];
    var video = ["youtube.com", "netflix.com", "twitch.tv", "hulu.com", "disneyplus.com"];
    var news = ["cnn.com", "bbc.com", "news.google.com", "nytimes.com", "reuters.com"];
    var socialMin = 0, videoMin = 0, newsMin = 0, otherMin = 0;
    sites.forEach(function(si) {
        if (social.indexOf(si.hostname) !== -1) socialMin += si.minutes;
        else if (video.indexOf(si.hostname) !== -1) videoMin += si.minutes;
        else if (news.indexOf(si.hostname) !== -1) newsMin += si.minutes;
        else otherMin += si.minutes;
    });

    document.getElementById("reportCategoryAnalysis").innerHTML =
        '<h4>📂 Category Breakdown</h4>' +
        '<div class="analytics-row"><span class="analytics-label">📱 Social Media</span><span class="analytics-value">' + socialMin + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">🎬 Video/Streaming</span><span class="analytics-value">' + videoMin + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">📰 News</span><span class="analytics-value">' + newsMin + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">💼 Other</span><span class="analytics-value">' + otherMin + ' min</span></div>' +
        '<div class="analytics-row"><span class="analytics-label">Biggest category</span><span class="analytics-value" style="color:#818cf8">' + getBiggestCategory(socialMin, videoMin, newsMin, otherMin) + '</span></div>';

    // Report Bar Chart
    var reportBars = document.getElementById("reportBarChart");
    var topSites = sites.slice(0, 10);
    if (topSites.length === 0) { reportBars.innerHTML = '<div class="empty-state">No data</div>'; }
    else {
        var maxM = Math.max.apply(null, topSites.map(function(si) { return si.minutes; })) || 1;
        reportBars.innerHTML = topSites.map(function(si) {
            var pct = (si.minutes / maxM) * 100;
            var pctOfTotal = totalSec > 0 ? Math.round((si.seconds / totalSec) * 100) : 0;
            var color = si.overLimit ? "#ef4444" : "#6366f1";
            return '<div class="horiz-bar-item"><span class="horiz-bar-name">' + si.hostname + '</span>' +
                '<div class="horiz-bar-track"><div class="horiz-bar-fill" style="width:' + pct + '%;background:' + color + ';">' + si.minutes + 'm (' + pctOfTotal + '%)</div></div>' +
                '<span class="horiz-bar-value">' + (si.percentage !== null ? Math.round(si.percentage) + '%' : '—') + '</span></div>';
        }).join("");
    }

    // Weekly Chart
    if (weekly) {
        var wContainer = document.getElementById("reportWeeklyChart");
        var maxW = Math.max.apply(null, weekly.days.map(function(d) { return d.totalMinutes; })) || 1;
        var todayStr = getToday();
        wContainer.innerHTML = weekly.days.map(function(day) {
            var height = Math.max((day.totalMinutes / maxW) * 100, 4);
            return '<div class="trend-bar"><span class="trend-bar-value">' + day.totalMinutes + 'm</span>' +
                '<div class="trend-bar-fill ' + (day.date === todayStr ? 'today-bar' : '') + '" style="height:' + height + '%;"></div>' +
                '<span class="trend-bar-label">' + day.dayName + '</span></div>';
        }).join("");
    }

    // Detail Table
    var detailContainer = document.getElementById("reportDetailTable");
    if (sites.length === 0) {
        detailContainer.innerHTML = '<h4>📋 Site Details</h4><div class="empty-state">No data for this date</div>';
    } else {
        var tableHtml = '<h4>📋 Site-by-Site Breakdown</h4>' +
            '<div class="detail-row" style="font-weight:700;color:#4a5568;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">' +
            '<div>#</div><div>Site</div><div>Time</div><div>Limit</div><div>Usage</div><div>Status</div></div>';

        tableHtml += sites.map(function(si, i) {
            var pctOfTotal = totalSec > 0 ? Math.round((si.seconds / totalSec) * 100) : 0;
            var statusText = si.overLimit ? '<span style="color:#ef4444">🚫 Over Limit</span>'
                : (si.percentage !== null && si.percentage >= 80 ? '<span style="color:#f59e0b">⚠️ Warning</span>'
                : (si.limit ? '<span style="color:#10b981">✅ OK</span>' : '<span style="color:#64748b">No limit</span>'));
            var pctColor = si.overLimit ? "#ef4444" : (si.percentage >= 80 ? "#f59e0b" : "#e2e8f0");

            return '<div class="detail-row">' +
                '<div class="detail-rank">' + (i + 1) + '</div>' +
                '<div class="detail-host">' + si.hostname + ' <span style="color:#4a5568;font-size:11px;">(' + pctOfTotal + '%)</span></div>' +
                '<div class="detail-time">' + si.minutes + ' min</div>' +
                '<div class="detail-limit">' + (si.limit ? si.limit + ' min' : '—') + '</div>' +
                '<div class="detail-pct" style="color:' + pctColor + '">' + (si.percentage !== null ? Math.round(si.percentage) + '%' : '—') + '</div>' +
                '<div class="detail-status">' + statusText + '</div></div>';
        }).join("");

        detailContainer.innerHTML = tableHtml;
    }

    renderInsights(report, weekly);
}

function getBiggestCategory(social, video, news, other) {
    var max = Math.max(social, video, news, other);
    if (max === 0) return "None";
    if (max === social) return "📱 Social (" + social + "m)";
    if (max === video) return "🎬 Video (" + video + "m)";
    if (max === news) return "📰 News (" + news + "m)";
    return "💼 Other (" + other + "m)";
}

function renderInsights(report, weekly) {
    var container = document.getElementById("reportInsights");
    var s = report.summary;
    var sites = report.sites;
    var insights = [];

    if (s.totalMinutes > 240) {
        insights.push({ icon: "🔴", text: "Over 4 hours browsing today (" + s.totalHours + "h). Consider setting stricter limits." });
    } else if (s.totalMinutes > 120) {
        insights.push({ icon: "🟡", text: "2+ hours of browsing today. Moderate — you can optimize further." });
    } else if (s.totalMinutes > 0) {
        insights.push({ icon: "🟢", text: "Under 2 hours of browsing. Excellent discipline!" });
    }

    if (s.overLimitCount > 0) {
        var overSites = sites.filter(function(si) { return si.overLimit; }).map(function(si) { return si.hostname; });
        insights.push({ icon: "🚨", text: "Exceeded limits on: " + overSites.join(", ") + ". Reduce by 10 min tomorrow." });
    }

    if (sites[0] && s.totalMinutes > 0) {
        var topPct = Math.round((sites[0].seconds / (s.totalMinutes * 60)) * 100);
        if (topPct > 60) {
            insights.push({ icon: "📊", text: sites[0].hostname + " = " + topPct + "% of all time. It dominates your browsing." });
        }
    }

    if (weekly && weekly.summary) {
        var avgD = weekly.summary.averageDailyMinutes;
        if (s.totalMinutes > avgD * 1.3) {
            insights.push({ icon: "📈", text: "Today is " + Math.round((s.totalMinutes / avgD - 1) * 100) + "% above your 7-day average (" + avgD + "m/day)." });
        } else if (s.totalMinutes < avgD * 0.7 && s.totalMinutes > 0) {
            insights.push({ icon: "📉", text: "Today is " + Math.round((1 - s.totalMinutes / avgD) * 100) + "% below average. Great improvement!" });
        }
    }

    var untracked = sites.filter(function(si) { return si.limit === null; });
    if (untracked.length > 3) {
        insights.push({ icon: "🎯", text: untracked.length + " sites untracked. Consider: " + untracked.slice(0, 3).map(function(si) { return si.hostname; }).join(", ") });
    }

    if (s.productivityScore >= 90) {
        insights.push({ icon: "🏆", text: "Outstanding! Score " + s.productivityScore + "%. Top-tier self-regulation." });
    } else if (s.productivityScore < 50) {
        insights.push({ icon: "💪", text: "Score " + s.productivityScore + "%. Focus on your #1 time-waster and cut 15 min." });
    }

    if (insights.length === 0) {
        insights.push({ icon: "📊", text: "Browse some sites to see behavioral insights." });
    }

    container.innerHTML = '<h4>🧠 Behavioral Insights</h4>' +
        insights.map(function(i) {
            return '<div class="insight-row"><span class="insight-row-icon">' + i.icon + '</span><span>' + i.text + '</span></div>';
        }).join("");
}

// ══════════════════════════
// ── AI TAB ──
// ══════════════════════════

function setupAITab() {
    document.getElementById("dashGetTip").addEventListener("click", getDashAITip);

    document.getElementById("dashSaveKey").addEventListener("click", async function() {
        var key = document.getElementById("dashGeminiKey").value.trim();
        if (key.length < 20) return;
        await chrome.storage.local.set({ geminiApiKey: key });
        document.getElementById("dashGeminiKey").value = "";
        loadAIDashboard();
    });

    document.getElementById("dashChangeKey").addEventListener("click", async function() {
        await chrome.storage.local.remove("geminiApiKey");
        await chrome.storage.local.remove("aiTipCache");
        loadAIDashboard();
    });
}

async function loadAIDashboard() {
    var storage = await chrome.storage.local.get("geminiApiKey");
    var hasKey = storage.geminiApiKey && storage.geminiApiKey.trim().length >= 20;

    document.getElementById("dashAiSetup").style.display = hasKey ? "none" : "block";
    document.getElementById("dashChangeKey").style.display = hasKey ? "inline-block" : "none";
    document.getElementById("dashGetTip").disabled = !hasKey;

    if (!hasKey) {
        document.getElementById("dashAiTip").innerHTML = "<p>🔑 Add your Gemini API key to unlock AI coaching.</p>";
    }

    if (dashData) {
        var usage = dashData.usage;
        var limits = dashData.limits;
        var topSite = Object.entries(usage).sort(function(a, b) { return b[1] - a[1]; })[0];
        var score = calculateScore(usage, limits);

        document.getElementById("dashAiInsights").innerHTML =
            '<div class="ai-insight-card"><h5>⏱️ Session Summary</h5><p>' + Math.round(Object.values(usage).reduce(function(a, b) { return a + b; }, 0) / 60) + 'm across ' + Object.keys(usage).length + ' sites</p></div>' +
            '<div class="ai-insight-card"><h5>🏆 Top Consumer</h5><p>' + (topSite ? topSite[0] + ' (' + Math.round(topSite[1] / 60) + 'm)' : 'None yet') + '</p></div>' +
            '<div class="ai-insight-card"><h5>⭐ Score</h5><p>' + score + '% — ' + (score >= 70 ? 'Great!' : 'Room to improve') + '</p></div>' +
            '<div class="ai-insight-card"><h5>🎯 Limits</h5><p>' + Object.keys(limits).length + ' sites with limits</p></div>';
    }
}

async function getDashAITip() {
    var btn = document.getElementById("dashGetTip");
    var statusEl = document.getElementById("dashAiStatus");
    btn.textContent = "🔄 Asking Gemini...";
    btn.disabled = true;
    statusEl.textContent = "";

    try {
        var topSites = Object.entries(dashData?.usage || {})
            .map(function(e) { return { hostname: e[0], seconds: e[1], minutes: Math.round(e[1] / 60) }; })
            .sort(function(a, b) { return b.seconds - a.seconds; }).slice(0, 5);

        var response = await chrome.runtime.sendMessage({
            type: "GET_AI_TIP",
            data: { usage: dashData?.usage || {}, limits: dashData?.limits || {}, topSites: topSites, productivityScore: calculateScore(dashData?.usage || {}, dashData?.limits || {}) }
        });

        if (response.needsKey) { loadAIDashboard(); return; }
        document.getElementById("dashAiTip").innerHTML = "<p>" + response.tip + "</p>";
        statusEl.textContent = response.fromAI ? "✅ Gemini 2.0 Flash" : (response.cached ? "💡 Cached" : "");
        statusEl.className = "ai-dash-status " + (response.fromAI ? "success" : "");
    } catch (e) {
        document.getElementById("dashAiTip").innerHTML = "<p>❌ Failed. Check connection.</p>";
        statusEl.textContent = "Error";
        statusEl.className = "ai-dash-status error";
    }

    btn.textContent = "✨ Get Another Tip";
    btn.disabled = false;
}

// ══════════════════════════
// ── SETTINGS ──
// ══════════════════════════

function setupSettings() {
    document.getElementById("settWarningAt").addEventListener("input", function() {
        document.getElementById("settWarningAtValue").textContent = this.value + "%";
    });

    document.getElementById("settSaveAll").addEventListener("click", saveAllSettings);

    document.getElementById("settExportData").addEventListener("click", async function() {
        var data = await chrome.runtime.sendMessage({ type: "EXPORT_DATA" });
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "smart-time-limiter-backup-" + getToday() + ".json";
        a.click();
        URL.revokeObjectURL(url);
        showSavedBadge();
    });

    document.getElementById("settImportData").addEventListener("click", function() {
        document.getElementById("settImportFile").click();
    });

    document.getElementById("settImportFile").addEventListener("change", async function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                var data = JSON.parse(ev.target.result);
                await chrome.storage.local.set(data);
                showSavedBadge();
                await loadDashboard();
                loadSettings();
            } catch (err) { alert("Invalid file format."); }
        };
        reader.readAsText(file);
        e.target.value = "";
    });

    document.getElementById("settClearToday").addEventListener("click", function() {
        showConfirm("🗑️", "Clear Today's Data?", "This will reset all usage tracked today. Limits remain. Cannot be undone.", async function() {
            var today = getToday();
            var data = await chrome.storage.local.get(["siteUsage", "blockedSites"]);
            var usage = data.siteUsage || {};
            delete usage[today];
            await chrome.storage.local.set({ siteUsage: usage, blockedSites: {} });
            await loadDashboard();
            showSavedBadge();
        });
    });

    document.getElementById("settResetAll").addEventListener("click", function() {
        showConfirm("⚠️", "Reset Everything?", "This permanently deletes ALL data: history, limits, settings, AI cache. Cannot be undone!", async function() {
            await chrome.storage.local.clear();
            window.location.reload();
        });
    });
}

async function loadSettings() {
    var data = await chrome.storage.local.get("settings");
    var s = data.settings || {};

    document.getElementById("settBlockStyle").value = s.blockStyle || "hard";
    document.getElementById("settWarningAt").value = s.warningAt || 80;
    document.getElementById("settWarningAtValue").textContent = (s.warningAt || 80) + "%";
    document.getElementById("settAllowExtend").checked = s.allowExtend !== false;
    document.getElementById("settBlockKeyboard").checked = s.blockKeyboard !== false;
    document.getElementById("settNotifyWarning").checked = s.notifyWarning !== false;
    document.getElementById("settNotifyBlock").checked = s.notifyBlock !== false;
    document.getElementById("settNotifyDaily").checked = s.notifyDaily !== false;
    document.getElementById("settShowWidget").checked = s.showWidget !== false;
    document.getElementById("settWidgetPosition").value = s.widgetPosition || "bottom-right";
    document.getElementById("settStartMinimized").checked = s.startMinimized === true;
    document.getElementById("settOnlyWithLimits").checked = s.onlyWithLimits === true;
    document.getElementById("settTrackAll").checked = s.trackAll !== false;
    document.getElementById("settPauseIdle").checked = s.pauseIdle === true;
    document.getElementById("settResetTime").value = s.dailyResetTime || "00:00";
    document.getElementById("settWhitelist").value = (s.whitelistedSites || []).join(", ");
    document.getElementById("settHistoryDays").value = s.historyDays || 30;

    loadAboutStats();
}

async function saveAllSettings() {
    var settings = {
        blockStyle: document.getElementById("settBlockStyle").value,
        warningAt: parseInt(document.getElementById("settWarningAt").value),
        allowExtend: document.getElementById("settAllowExtend").checked,
        blockKeyboard: document.getElementById("settBlockKeyboard").checked,
        notifyWarning: document.getElementById("settNotifyWarning").checked,
        notifyBlock: document.getElementById("settNotifyBlock").checked,
        notifyDaily: document.getElementById("settNotifyDaily").checked,
        showWidget: document.getElementById("settShowWidget").checked,
        widgetPosition: document.getElementById("settWidgetPosition").value,
        startMinimized: document.getElementById("settStartMinimized").checked,
        onlyWithLimits: document.getElementById("settOnlyWithLimits").checked,
        trackAll: document.getElementById("settTrackAll").checked,
        pauseIdle: document.getElementById("settPauseIdle").checked,
        dailyResetTime: document.getElementById("settResetTime").value,
        whitelistedSites: document.getElementById("settWhitelist").value
            .split(",").map(function(s) { return s.trim().replace("www.", ""); }).filter(function(s) { return s.length > 0; }),
        historyDays: parseInt(document.getElementById("settHistoryDays").value)
    };

    await chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", data: settings });
    showSavedBadge();
}

async function loadAboutStats() {
    var data = await chrome.storage.local.get(["siteUsage", "siteLimits", "weeklyData"]);
    var usage = data.siteUsage || {};
    var limits = data.siteLimits || {};
    var weekly = data.weeklyData || {};

    var totalDays = Object.keys(usage).length + Object.keys(weekly).length;
    var totalLimits = Object.keys(limits).length;
    var allSeconds = 0;
    Object.values(usage).forEach(function(d) { Object.values(d).forEach(function(s) { allSeconds += s; }); });
    Object.values(weekly).forEach(function(d) { Object.values(d).forEach(function(s) { allSeconds += s; }); });

    document.getElementById("aboutStats").innerHTML =
        '<div class="about-stat"><div class="about-stat-value">' + totalDays + '</div><div class="about-stat-label">Days Tracked</div></div>' +
        '<div class="about-stat"><div class="about-stat-value">' + Math.round(allSeconds / 3600) + 'h</div><div class="about-stat-label">Total Tracked</div></div>' +
        '<div class="about-stat"><div class="about-stat-value">' + totalLimits + '</div><div class="about-stat-label">Active Limits</div></div>';
}

function showSavedBadge() {
    var badge = document.getElementById("settingsSavedBadge");
    badge.style.display = "inline-block";
    setTimeout(function() { badge.style.display = "none"; }, 2500);
}

function showConfirm(icon, title, message, onConfirm) {
    var overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML =
        '<div class="confirm-card"><div class="confirm-icon">' + icon + '</div><h3>' + title + '</h3><p>' + message + '</p>' +
        '<div class="confirm-actions"><button class="btn-confirm-danger" id="confirmYes">Yes, Do It</button>' +
        '<button class="btn-confirm-cancel" id="confirmNo">Cancel</button></div></div>';
    document.body.appendChild(overlay);

    document.getElementById("confirmYes").addEventListener("click", function() { overlay.remove(); onConfirm(); });
    document.getElementById("confirmNo").addEventListener("click", function() { overlay.remove(); });
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
}

// ══════════════════════════
// ── EXPORT ──
// ══════════════════════════

function setupExport() {
    document.getElementById("exportBtn").addEventListener("click", async function() {
        var data = await chrome.runtime.sendMessage({ type: "EXPORT_DATA" });
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "smart-time-limiter-" + getToday() + ".json";
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById("dashExportImage").addEventListener("click", async function() {
        if (!reportData) await loadDetailedReport();
        if (!reportData || reportData.sites.length === 0) return;
        var btn = document.getElementById("dashExportImage");
        btn.textContent = "⏳ Generating...";
        try {
            var canvas = generateDashReportCanvas(reportData);
            var link = document.createElement("a");
            link.download = "report-" + reportData.date + ".png";
            link.href = canvas.toDataURL("image/png");
            link.click();
            btn.textContent = "✅ Done!";
        } catch (e) { btn.textContent = "❌ Error"; }
        setTimeout(function() { btn.textContent = "📸 Export Image"; }, 2000);
    });
}

function generateDashReportCanvas(report) {
    var sites = report.sites.slice(0, 8);
    var s = report.summary;
    var W = 800, headerH = 100, statsH = 80, chartH = 40 * sites.length + 50;
    var H = headerH + statsH + chartH + 60;

    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0f0f1a"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(99,102,241,0.08)"; ctx.fillRect(0, 0, W, headerH);
    ctx.fillStyle = "#6366f1"; ctx.fillRect(0, headerH - 2, W, 2);

    ctx.font = "bold 24px system-ui"; ctx.fillStyle = "#f1f5f9";
    ctx.fillText("⏱️ Smart Time Limiter — " + report.date, 30, 50);
    ctx.font = "14px system-ui"; ctx.fillStyle = "#94a3b8";
    ctx.fillText("Total: " + s.totalHours + "h | Sites: " + s.siteCount + " | Score: " + s.productivityScore + "% | Over: " + s.overLimitCount, 30, 76);

    var y = headerH + 20;
    var maxM = Math.max.apply(null, sites.map(function(si) { return si.minutes; })) || 1;

    sites.forEach(function(site) {
        var barW = Math.max((site.minutes / maxM) * (W - 250), 10);
        var color = site.overLimit ? "#ef4444" : "#6366f1";
        ctx.font = "12px system-ui"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "right";
        ctx.fillText(site.hostname.substring(0, 20), 150, y + 14); ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(160, y + 2, W - 250, 20);
        ctx.fillStyle = color; ctx.fillRect(160, y + 2, barW, 20);
        ctx.font = "bold 12px system-ui"; ctx.fillStyle = "#e2e8f0";
        ctx.fillText(site.minutes + "m", W - 70, y + 16);
        y += 40;
    });

    ctx.font = "11px system-ui"; ctx.fillStyle = "#4a5568";
    ctx.fillText("Generated by Smart Time Limiter • " + new Date().toLocaleString(), 30, H - 20);

    return canvas;
}

// ══════════════════════════
// ── UTILS ──
// ══════════════════════════

function formatTimeLive(seconds) {
    if (!seconds || seconds <= 0) return "0s";
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + "h " + m + "m " + s + "s";
    if (m > 0) return m + "m " + s + "s";
    return s + "s";
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

function getToday() { return new Date().toISOString().split("T")[0]; }