// ============================================
// SMART TIME LIMITER - Background (Settings Integrated)
// ============================================

var activeTabId = null;
var activeHostname = null;
var trackingInterval = null;
var TICK_INTERVAL = 1000;

// ── SAFE SENDERS ──
function safeSendToTab(tabId, message) {
    try { chrome.tabs.sendMessage(tabId, message).catch(function() {}); }
    catch (e) {}
}
function safeSendToPopup(message) {
    try { chrome.runtime.sendMessage(message).catch(function() {}); }
    catch (e) {}
}

// ── INIT ──
chrome.runtime.onInstalled.addListener(async function() {
    var defaults = {
        siteLimits: {},
        siteUsage: {},
        settings: {
            blockStyle: "hard",
            warningAt: 80,
            allowExtend: true,
            blockKeyboard: true,
            notifyWarning: true,
            notifyBlock: true,
            notifyDaily: true,
            showWidget: true,
            widgetPosition: "bottom-right",
            startMinimized: false,
            onlyWithLimits: false,
            trackAll: true,
            pauseIdle: false,
            dailyResetTime: "00:00",
            whitelistedSites: [],
            historyDays: 30
        },
        weeklyData: {},
        blockedSites: {}
    };
    var existing = await chrome.storage.local.get(null);
    // Merge defaults with existing, preserving user data
    if (!existing.settings) existing.settings = {};
    var mergedSettings = Object.assign({}, defaults.settings, existing.settings);
    var merged = Object.assign({}, defaults, existing, { settings: mergedSettings });
    await chrome.storage.local.set(merged);

    chrome.alarms.create("dailyReset", { when: getNextResetTime(), periodInMinutes: 1440 });
    console.log("Smart Time Limiter installed.");
});

chrome.alarms.onAlarm.addListener(async function(alarm) {
    if (alarm.name === "dailyReset") await performDailyReset();
});

function getNextResetTime() {
    var d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
}

async function performDailyReset() {
    var data = await chrome.storage.local.get(["siteUsage", "weeklyData", "settings"]);
    var settings = data.settings || {};
    var yesterday = getYesterday();
    var weeklyData = data.weeklyData || {};

    if (data.siteUsage && data.siteUsage[yesterday]) {
        weeklyData[yesterday] = data.siteUsage[yesterday];
    }

    // Trim old history based on historyDays setting
    var historyDays = settings.historyDays || 30;
    var cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    Object.keys(weeklyData).forEach(function(dateKey) {
        if (new Date(dateKey) < cutoff) delete weeklyData[dateKey];
    });

    await chrome.storage.local.set({ weeklyData: weeklyData, blockedSites: {} });

    // Daily summary notification (check setting)
    if (settings.notifyDaily !== false) {
        var yesterdayUsage = (data.siteUsage && data.siteUsage[yesterday]) || {};
        var totalMin = Math.round(Object.values(yesterdayUsage).reduce(function(a, b) { return a + b; }, 0) / 60);
        if (totalMin > 0) {
            chrome.notifications.create("dailyReset", {
                type: "basic",
                iconUrl: "icons/icon128.png",
                title: "📊 Daily Report",
                message: "You spent " + totalMin + " min on tracked sites yesterday. Limits reset!",
                priority: 1
            });
        }
    }
}

// ── TAB TRACKING ──
chrome.tabs.onActivated.addListener(async function(info) {
    try { var tab = await chrome.tabs.get(info.tabId); handleTabChange(tab); }
    catch (e) { stopTracking(); }
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url || changeInfo.status === "complete") handleTabChange(tab);
});

chrome.tabs.onRemoved.addListener(function(tabId) {
    if (tabId === activeTabId) stopTracking();
});

chrome.windows.onFocusChanged.addListener(async function(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) { stopTracking(); }
    else {
        try { var tabs = await chrome.tabs.query({ active: true, currentWindow: true }); if (tabs[0]) handleTabChange(tabs[0]); }
        catch (e) { stopTracking(); }
    }
});

function handleTabChange(tab) {
    if (!tab || !tab.url) { stopTracking(); return; }
    try {
        var url = new URL(tab.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") { stopTracking(); return; }
        var hostname = url.hostname.replace("www.", "");
        activeTabId = tab.id;
        if (hostname !== activeHostname) {
            activeHostname = hostname;
            startTracking(hostname);
        }
        checkAndBlockTab(tab.id, hostname);
    } catch (e) { stopTracking(); }
}

async function checkAndBlockTab(tabId, hostname) {
    var data = await chrome.storage.local.get(["blockedSites", "siteLimits", "siteUsage"]);
    var blockedSites = data.blockedSites || {};
    var limits = data.siteLimits || {};
    var usage = data.siteUsage || {};
    var today = getToday();

    if (blockedSites[hostname]) {
        safeSendToTab(tabId, { type: "BLOCK_LEVEL", data: { level: "full", hostname: hostname } });
        return;
    }

    var siteLimit = limits[hostname];
    if (siteLimit && usage[today] && usage[today][hostname]) {
        if (usage[today][hostname] >= siteLimit.daily * 60) {
            blockedSites[hostname] = true;
            await chrome.storage.local.set({ blockedSites: blockedSites });
            safeSendToTab(tabId, { type: "BLOCK_LEVEL", data: { level: "full", hostname: hostname } });
        }
    }
}

async function blockAllTabsForHostname(hostname) {
    try {
        var allTabs = await chrome.tabs.query({});
        for (var i = 0; i < allTabs.length; i++) {
            if (!allTabs[i].url) continue;
            try {
                var tabHost = new URL(allTabs[i].url).hostname.replace("www.", "");
                if (tabHost === hostname) {
                    safeSendToTab(allTabs[i].id, { type: "BLOCK_LEVEL", data: { level: "full", hostname: hostname } });
                }
            } catch (e) {}
        }
    } catch (e) {}
}

function startTracking(hostname) {
    stopTracking();
    activeHostname = hostname;
    trackingInterval = setInterval(function() { tickUsage(hostname); }, TICK_INTERVAL);
}

function stopTracking() {
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
    activeHostname = null;
    activeTabId = null;
}

// ── TICK (every second) ──
async function tickUsage(hostname) {
    var today = getToday();
    var data = await chrome.storage.local.get(["siteUsage", "siteLimits", "blockedSites", "settings"]);
    var usage = data.siteUsage || {};
    var limits = data.siteLimits || {};
    var blockedSites = data.blockedSites || {};
    var settings = data.settings || {};

    // ── CHECK WHITELIST ──
    var whitelist = settings.whitelistedSites || [];
    if (whitelist.indexOf(hostname) !== -1) {
        return; // Don't track whitelisted sites
    }

    // ── CHECK trackAll SETTING ──
    // If trackAll is off, only track sites that have limits
    if (settings.trackAll === false && !limits[hostname]) {
        return;
    }

    if (!usage[today]) usage[today] = {};
    if (!usage[today][hostname]) usage[today][hostname] = 0;
    usage[today][hostname] += 1;
    await chrome.storage.local.set({ siteUsage: usage });

    var currentSeconds = usage[today][hostname];
    var siteLimit = limits[hostname];

    if (siteLimit) {
        var limitSeconds = siteLimit.daily * 60;
        var percentage = (currentSeconds / limitSeconds) * 100;
        var warningPct = settings.warningAt || 80;

        // Send time update
        if (activeTabId && !blockedSites[hostname]) {
            safeSendToTab(activeTabId, {
                type: "TIME_UPDATE",
                data: {
                    hostname: hostname,
                    currentSeconds: currentSeconds,
                    limitSeconds: limitSeconds,
                    percentage: Math.min(percentage, 100),
                    remainingSeconds: Math.max(limitSeconds - currentSeconds, 0),
                    status: getStatus(percentage)
                }
            });
        }

        // ── WARNING NOTIFICATION (check setting) ──
        var roundPct = Math.round(percentage);
        if (roundPct === Math.round(warningPct) && !blockedSites[hostname + "_warned"]) {
            if (settings.notifyWarning !== false) {
                var remMin = Math.ceil((limitSeconds - currentSeconds) / 60);
                chrome.notifications.create("warn-" + hostname, {
                    type: "basic",
                    iconUrl: "icons/icon128.png",
                    title: "⚠️ Time Warning",
                    message: "You have " + remMin + " min left on " + hostname + "!",
                    priority: 2
                });
            }
            blockedSites[hostname + "_warned"] = true;
            await chrome.storage.local.set({ blockedSites: blockedSites });
        }

        // ── BLOCK when limit reached ──
        if (currentSeconds >= limitSeconds && !blockedSites[hostname]) {
            blockedSites[hostname] = true;
            await chrome.storage.local.set({ blockedSites: blockedSites });

            // Block notification (check setting)
            if (settings.notifyBlock !== false) {
                chrome.notifications.create("blocked-" + hostname, {
                    type: "basic",
                    iconUrl: "icons/icon128.png",
                    title: "🚫 Site Blocked",
                    message: hostname + " is now blocked! Daily limit reached.",
                    priority: 2
                });
            }

            blockAllTabsForHostname(hostname);
        }

        // Keep blocking if already blocked
        if (blockedSites[hostname] && activeTabId) {
            safeSendToTab(activeTabId, { type: "BLOCK_LEVEL", data: { level: "full", hostname: hostname } });
        }
    }

    safeSendToPopup({ type: "USAGE_TICK", data: { hostname: hostname, seconds: currentSeconds, today: today } });
}

function getStatus(percentage) {
    if (percentage >= 100) return "blocked";
    if (percentage >= 95) return "critical";
    if (percentage >= 80) return "warning";
    if (percentage >= 50) return "moderate";
    return "safe";
}

// ── MESSAGE HANDLER ──
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    handleMessage(message, sender).then(sendResponse);
    return true;
});

async function handleMessage(message, sender) {
    switch (message.type) {

        case "GET_SETTINGS": {
            var data = await chrome.storage.local.get("settings");
            return data.settings || {};
        }

        case "GET_SITE_STATUS": {
            var hostname = message.data.hostname;
            var today = getToday();
            var data = await chrome.storage.local.get(["siteUsage", "siteLimits", "blockedSites", "settings"]);
            var usage = data.siteUsage || {};
            var limits = data.siteLimits || {};
            var blockedSites = data.blockedSites || {};
            var settings = data.settings || {};

            // Check whitelist
            var whitelist = settings.whitelistedSites || [];
            if (whitelist.indexOf(hostname) !== -1) {
                return { blocked: false, hasLimit: false, whitelisted: true, currentSeconds: 0, limitSeconds: 0, percentage: 0, remainingSeconds: 0, status: "safe" };
            }

            var currentSeconds = (usage[today] && usage[today][hostname]) || 0;
            var siteLimit = limits[hostname];
            var isBlockedSite = !!blockedSites[hostname];

            if (siteLimit && currentSeconds >= siteLimit.daily * 60 && !isBlockedSite) {
                blockedSites[hostname] = true;
                await chrome.storage.local.set({ blockedSites: blockedSites });
                isBlockedSite = true;
            }

            if (!siteLimit) {
                return { blocked: isBlockedSite, hasLimit: false, currentSeconds: currentSeconds, limitSeconds: 0, percentage: 0, remainingSeconds: 0, status: "safe", settings: settings };
            }

            var limitSeconds = siteLimit.daily * 60;
            var percentage = (currentSeconds / limitSeconds) * 100;
            var remaining = Math.max(limitSeconds - currentSeconds, 0);
            var status = percentage >= 100 ? "blocked" : percentage >= 95 ? "critical" : percentage >= 80 ? "warning" : percentage >= 50 ? "moderate" : "safe";

            return { blocked: isBlockedSite, hasLimit: true, currentSeconds: currentSeconds, limitSeconds: limitSeconds, percentage: Math.min(percentage, 100), remainingSeconds: remaining, status: status, settings: settings };
        }

        case "CHECK_BLOCKED": {
            var hostname = message.data.hostname;
            var data = await chrome.storage.local.get(["blockedSites", "siteLimits", "siteUsage", "settings"]);
            var blockedSites = data.blockedSites || {};
            var limits = data.siteLimits || {};
            var usage = data.siteUsage || {};
            var settings = data.settings || {};
            var today = getToday();

            // Whitelist check
            var whitelist = settings.whitelistedSites || [];
            if (whitelist.indexOf(hostname) !== -1) {
                return { blocked: false };
            }

            if (blockedSites[hostname]) return { blocked: true };

            var siteLimit = limits[hostname];
            if (siteLimit && usage[today] && usage[today][hostname]) {
                if (usage[today][hostname] >= siteLimit.daily * 60) {
                    blockedSites[hostname] = true;
                    await chrome.storage.local.set({ blockedSites: blockedSites });
                    return { blocked: true };
                }
            }
            return { blocked: false };
        }

        case "GET_ALL_DATA": {
            var data = await chrome.storage.local.get(null);
            var today = getToday();
            return {
                usage: (data.siteUsage && data.siteUsage[today]) || {},
                limits: data.siteLimits || {},
                settings: data.settings || {},
                weeklyData: data.weeklyData || {},
                allUsage: data.siteUsage || {},
                blockedSites: data.blockedSites || {},
                activeHostname: activeHostname
            };
        }

        case "SET_LIMIT": {
            var info = message.data;
            var data = await chrome.storage.local.get("siteLimits");
            var limits = data.siteLimits || {};
            limits[info.hostname] = { daily: info.daily, warning: info.warning || Math.floor(info.daily * 0.8) };
            await chrome.storage.local.set({ siteLimits: limits });

            // Check if already over new limit
            var usageData = await chrome.storage.local.get(["siteUsage", "blockedSites"]);
            var today = getToday();
            var currentSecs = (usageData.siteUsage && usageData.siteUsage[today] && usageData.siteUsage[today][info.hostname]) || 0;
            if (currentSecs >= info.daily * 60) {
                var bs = usageData.blockedSites || {};
                bs[info.hostname] = true;
                await chrome.storage.local.set({ blockedSites: bs });
                blockAllTabsForHostname(info.hostname);
            }
            return { success: true };
        }

        case "REMOVE_LIMIT": {
            var hostname = message.data.hostname;
            var data = await chrome.storage.local.get(["siteLimits", "blockedSites", "siteUsage"]);
            var limits = data.siteLimits || {};
            var blockedSites = data.blockedSites || {};
            var usage = data.siteUsage || {};
            var today = getToday();

            delete limits[hostname];
            delete blockedSites[hostname];
            delete blockedSites[hostname + "_warned"];
            if (usage[today]) delete usage[today][hostname];

            await chrome.storage.local.set({ siteLimits: limits, blockedSites: blockedSites, siteUsage: usage });

            // Unblock all tabs
            try {
                var allTabs = await chrome.tabs.query({});
                for (var i = 0; i < allTabs.length; i++) {
                    if (!allTabs[i].url) continue;
                    try {
                        var tabHost = new URL(allTabs[i].url).hostname.replace("www.", "");
                        if (tabHost === hostname) safeSendToTab(allTabs[i].id, { type: "UNBLOCK" });
                    } catch (e) {}
                }
            } catch (e) {}
            return { success: true };
        }

        case "UPDATE_SETTINGS": {
            var data = await chrome.storage.local.get("settings");
            var current = data.settings || {};
            var updated = Object.assign({}, current, message.data);
            await chrome.storage.local.set({ settings: updated });
            return { success: true };
        }

        case "GET_DAILY_REPORT": {
            return await generateDailyReport(message.data && message.data.date);
        }

        case "GET_WEEKLY_REPORT": {
            return await generateWeeklyReport();
        }

        case "OVERRIDE_BLOCK": {
            // Check if extend is allowed
            var settingsData = await chrome.storage.local.get("settings");
            var settings = settingsData.settings || {};
            if (settings.allowExtend === false) {
                return { success: false, reason: "disabled" };
            }

            var hn = message.data.hostname;
            var data = await chrome.storage.local.get(["siteUsage", "blockedSites"]);
            var today = getToday();
            var usage = data.siteUsage || {};
            var blockedSites = data.blockedSites || {};

            if (usage[today] && usage[today][hn]) {
                usage[today][hn] = Math.max(usage[today][hn] - 300, 0);
            }
            delete blockedSites[hn];

            await chrome.storage.local.set({ siteUsage: usage, blockedSites: blockedSites });
            return { success: true, addedMinutes: 5 };
        }

        case "GET_AI_TIP": {
            var context = message.data || {};
            var storage = await chrome.storage.local.get(["geminiApiKey", "aiTipCache"]);
            var apiKey = storage.geminiApiKey;

            if (!apiKey || apiKey.trim().length < 20) {
                return { tip: "⚠️ Add your Gemini API key in the AI tab for personalized tips.", error: "no_key", needsKey: true };
            }

            var cache = storage.aiTipCache || {};
            var now = Date.now();
            var usageHash = JSON.stringify((context.topSites || []).slice(0, 3));

            if (cache.tip && cache.timestamp && (now - cache.timestamp < 3600000) && cache.usageHash === usageHash) {
                return { tip: cache.tip, cached: true };
            }

            var prompt = buildGeminiPrompt(context);

            try {
                var response = await fetch(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + apiKey,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.6, maxOutputTokens: 120, topP: 0.9 }
                        })
                    }
                );

                if (!response.ok) {
                    var errData = await response.json().catch(function() { return {}; });
                    throw new Error((errData.error && errData.error.message) || "HTTP " + response.status);
                }

                var respData = await response.json();
                var tip = "";
                if (respData.candidates && respData.candidates[0] && respData.candidates[0].content && respData.candidates[0].content.parts && respData.candidates[0].content.parts[0]) {
                    tip = respData.candidates[0].content.parts[0].text || "";
                }
                tip = tip.replace(/^[\*\-\•]\s*/gm, "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\n+/g, " ").trim();

                if (!tip) throw new Error("Empty response");

                await chrome.storage.local.set({ aiTipCache: { tip: tip, timestamp: now, usageHash: usageHash } });
                return { tip: tip, success: true, fromAI: true };

            } catch (e) {
                var fallback = generateFallbackTip(context);
                return { tip: fallback, error: e.message, fallback: true };
            }
        }

        case "EXPORT_DATA": {
            return await chrome.storage.local.get(null);
        }

        default:
            return { error: "Unknown" };
    }
}

// ── REPORTS ──
async function generateDailyReport(date) {
    var targetDate = date || getToday();
    var data = await chrome.storage.local.get(["siteUsage", "siteLimits"]);
    var dayUsage = (data.siteUsage && data.siteUsage[targetDate]) || {};
    var limits = data.siteLimits || {};

    var sites = Object.entries(dayUsage).map(function(e) {
        var hostname = e[0], seconds = e[1];
        var limit = limits[hostname];
        return {
            hostname: hostname, seconds: seconds, minutes: Math.round(seconds / 60),
            limit: limit ? limit.daily : null,
            percentage: limit ? Math.min((seconds / (limit.daily * 60)) * 100, 100) : null,
            overLimit: limit ? seconds > limit.daily * 60 : false
        };
    }).sort(function(a, b) { return b.seconds - a.seconds; });

    var totalSec = Object.values(dayUsage).reduce(function(a, b) { return a + b; }, 0);
    var overCount = sites.filter(function(s) { return s.overLimit; }).length;

    return {
        date: targetDate, sites: sites,
        summary: {
            totalMinutes: Math.round(totalSec / 60), totalHours: (totalSec / 3600).toFixed(1),
            siteCount: sites.length, topSite: sites[0] ? sites[0].hostname : "None",
            overLimitCount: overCount, productivityScore: Math.max(0, 100 - overCount * 15)
        }
    };
}

async function generateWeeklyReport() {
    var data = await chrome.storage.local.get(["siteUsage", "weeklyData"]);
    var allUsage = Object.assign({}, data.weeklyData || {}, data.siteUsage || {});
    var days = [];

    for (var i = 6; i >= 0; i--) {
        var d = new Date(); d.setDate(d.getDate() - i);
        var ds = d.toISOString().split("T")[0];
        var du = allUsage[ds] || {};
        var total = Object.values(du).reduce(function(a, b) { return a + b; }, 0);
        days.push({ date: ds, dayName: d.toLocaleDateString("en-US", { weekday: "short" }), totalMinutes: Math.round(total / 60), sites: du });
    }

    var weekTotals = {};
    days.forEach(function(day) { Object.entries(day.sites).forEach(function(e) { weekTotals[e[0]] = (weekTotals[e[0]] || 0) + e[1]; }); });

    var topSites = Object.entries(weekTotals).map(function(e) {
        return { hostname: e[0], seconds: e[1], minutes: Math.round(e[1] / 60) };
    }).sort(function(a, b) { return b.seconds - a.seconds; }).slice(0, 10);

    var tw = days.reduce(function(a, d) { return a + d.totalMinutes; }, 0);

    return {
        days: days, topSites: topSites,
        summary: { totalMinutes: tw, totalHours: (tw / 60).toFixed(1), averageDailyMinutes: Math.round(tw / 7),
            mostActiveDay: days.reduce(function(a, b) { return a.totalMinutes > b.totalMinutes ? a : b; }).dayName, trend: "stable" }
    };
}

// ── AI ──
function buildGeminiPrompt(context) {
    var usage = context.usage || {};
    var limits = context.limits || {};
    var topSites = context.topSites || [];
    var score = context.productivityScore || 100;
    var totalMin = Math.round(Object.values(usage).reduce(function(a, b) { return a + b; }, 0) / 60);
    var hour = new Date().getHours();
    var timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

    var overLimit = topSites.filter(function(s) { return limits[s.hostname] && s.minutes > limits[s.hostname].daily; })
        .map(function(s) { return s.hostname; }).slice(0, 2).join(", ") || "none";
    var topList = topSites.slice(0, 4).map(function(s) { return s.hostname.replace(/\.com|\.org|\.net|\.io/g, "") + " (" + s.minutes + "m)"; }).join(", ") || "none";

    return "You are an expert productivity coach for a browser time-tracking extension.\n" +
        "Analyze this user's data and give ONE concise actionable tip (1-2 sentences max).\n" +
        "No markdown, bullets, greetings. Just the tip.\n\n" +
        "Context:\n" +
        "• Time: " + timeOfDay + "\n" +
        "• Total browsing: " + totalMin + " min\n" +
        "• Score: " + score + "/100\n" +
        "• Top sites: " + topList + "\n" +
        "• Over limit: " + overLimit + "\n" +
        "• Limits set: " + Object.keys(limits).length + "\n\n" +
        "Rules: Focus on biggest time-waster. Be specific. Under 25 words.";
}

function generateFallbackTip(context) {
    var tips = [
        "Close unused tabs. Each open tab drains focus.",
        "Try 25/5 Pomodoro: 25 min work, 5 min break.",
        "Batch social media to 2 scheduled check-ins daily.",
        "Disable autoplay on video sites.",
        "Write top 3 tasks before opening any browser tab.",
        "Replace 10 min scrolling with a quick walk.",
        "Turn off non-essential notifications for 2 hours.",
        "Stand up and stretch for 2 minutes right now.",
        "Your time is limited. Don't waste it. — Steve Jobs",
        "Discipline is choosing what you want most over what you want now."
    ];
    var topSites = context.topSites || [];
    if (topSites[0] && topSites[0].minutes > 45) {
        tips.unshift(topSites[0].hostname + " = " + topSites[0].minutes + "m. Set a hard limit.");
    }
    return tips[Math.floor(Math.random() * tips.length)];
}

function getToday() { return new Date().toISOString().split("T")[0]; }
function getYesterday() { var d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; }