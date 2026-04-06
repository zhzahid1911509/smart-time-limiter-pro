# ⏱️ Smart Time Limiter — Chrome Extension

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Chrome](https://img.shields.io/badge/Chrome-88%2B-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge)
![Manifest](https://img.shields.io/badge/Manifest-V3-red?style=for-the-badge)

**Intelligent website time management with real-time tracking, gradual blocking, daily reports, AI-powered productivity coaching, and full data export.**

---

> _"The key is not to prioritize what's on your schedule, but to schedule your priorities."_
> — Stephen Covey

---

</div>

## 📖 Table of Contents

- [Why This Extension?](#-why-this-extension)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Installation](#-installation)
- [Quick Start Guide](#-quick-start-guide)
- [Feature Deep Dive](#-feature-deep-dive)
- [Dashboard Overview](#-dashboard-overview)
- [AI Coach Setup](#-ai-coach-setup)
- [Settings Reference](#-settings-reference)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Technical Details](#-technical-details)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Privacy Policy](#-privacy-policy)
- [License](#-license)

---

## 🤔 Why This Extension?

Most website blockers are **binary** — they either block a site or they don't. That's like a light switch: on or off.

**Smart Time Limiter** is different. It works like a **thermostat** for your browsing:

| Traditional Blocker | Smart Time Limiter |
|---|---|
| Site blocked or allowed | Tracks time, warns, then blocks |
| No usage visibility | Real-time widget on every page |
| No data insights | Full dashboard with charts & reports |
| Manual decisions | AI-powered personalized coaching |
| Binary: on/off | Smart: awareness → warning → block |

You're not a machine. You don't need a wall. You need **visibility, warnings, and a firm boundary**.

---

## ✨ Features

### 🕐 Real-Time Tracking
- Tracks time on every website you visit
- Live timer updates every second
- Shows spent time, remaining time, and percentage used
- Draggable mini-dashboard widget on every page

### 🚫 Smart Blocking
- Set custom daily time limits per site (1 min to 24 hours)
- Warning notification at 80% (configurable)
- **Hard block**: Site becomes completely inaccessible
- Full-screen block page with motivational quotes
- "Emergency: Add 5 Minutes" option (toggle-able)
- Blocks keyboard shortcuts to prevent bypass

### 📊 Full Dashboard
- Real-time synced stats cards
- Bar chart of today's top sites
- 7-day usage trend chart
- Live tracking of all open tabs
- Score-based productivity rating (0–100%)

### 📈 Detailed Reports
- Score hero with visual breakdown
- Time analysis (average, longest, shortest per site)
- Category breakdown (Social, Video, News, Other)
- Weekly comparison chart
- Site-by-site table with rank, usage, status
- Behavioral insights with pattern analysis
- Date picker for historical reports

### 🤖 AI Productivity Coach
- Gemini 2.0 Flash integration
- Context-aware tips based on your actual data
- Caching system (1 hour, invalidates on usage change)
- Time-of-day awareness (morning vs evening tips)
- Score-aware tone (encouraging / optimizing / congratulatory)
- Smart fallback when API is unavailable

### 📸 Export Reports as Images
- Beautiful dark-themed PNG export
- Canvas-rendered bar charts, stats, and breakdowns
- One-click download

### ⚙️ Comprehensive Settings
- **Blocking**: Style, warning threshold, extend toggle, keyboard blocking
- **Notifications**: Warning, block, and daily summary toggles
- **Widget**: Show/hide, position, start minimized, limits-only mode
- **Tracking**: Track all sites, pause when idle, reset time, whitelist
- **Data**: Export/Import JSON, clear today, reset everything
- **History**: Keep 7, 14, 30, 90, or 365 days

### 📖 Built-in User Guide
- Complete documentation accessible from the dashboard
- Step-by-step instructions for every feature
- Table of contents with smooth scrolling
- Troubleshooting section

---

## 📸 Screenshots

<table>
<tr>
<td width="50%">
<h3>📊 Popup Overview</h3>
<img src="screenshots/popup-overview.png" alt="Popup Overview">
</td>
<td width="50%">
<h3>⏰ Setting a Limit</h3>
<img src="screenshots/popup-limits.png" alt="Setting Limits">
</td>
</tr>
<tr>
<td width="50%">
<h3>📈 Daily Report</h3>
<img src="screenshots/popup-report.png" alt="Daily Report">
</td>
<td width="50%">
<h3>🤖 AI Coach</h3>
<img src="screenshots/popup-ai.png" alt="AI Coach">
</td>
</tr>
<tr>
<td width="50%">
<h3>🌐 On-Page Widget</h3>
<img src="screenshots/content-widget.png" alt="Widget">
</td>
<td width="50%">
<h3>🚫 Block Screen</h3>
<img src="screenshots/content-block.png" alt="Block Screen">
</td>
</tr>
<tr>
<td width="50%">
<h3>📊 Dashboard Overview</h3>
<img src="screenshots/dashboard-overview.png" alt="Dashboard">
</td>
<td width="50%">
<h3>📈 Detailed Reports</h3>
<img src="screenshots/dashboard-reports.png" alt="Reports">
</td>
</tr>
<tr>
<td width="50%">
<h3>⚙️ Settings</h3>
<img src="screenshots/dashboard-settings.png" alt="Settings">
</td>
<td width="50%">
<h3>📖 User Guide</h3>
<img src="screenshots/dashboard-guide.png" alt="User Guide">
</td>
</tr>
</table>

---

## 📥 Installation

### From Website

1. Visit the [Smart Time Limiter Pro](https://smart-time-limiter.great-site.net/)
2. Download the extension and follow the installation guide
3. Pin the extension to your toolbar

### Manual Installation (Developer Mode)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/smart-time-limiter.git
cd smart-time-limiter

# 2. Open Chrome
# Navigate to: chrome://extensions/

# 3. Enable Developer Mode
# Toggle the switch in the top-right corner

# 4. Load Unpacked
# Click "Load unpacked" → Select the smart-time-limiter folder

# 5. Pin the Extension
# Click the puzzle icon in toolbar → Pin Smart Time Limiter
