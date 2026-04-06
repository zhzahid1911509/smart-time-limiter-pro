// ============================================
// AI PRODUCTIVITY TIPS ENGINE
// ============================================

// This module provides context-aware productivity tips
// Can be enhanced with actual AI API integration (OpenAI, etc.)

const AI_TIPS_DATABASE = {
  // Category-based tips
  socialMedia: {
    sites: ["facebook.com", "twitter.com", "x.com", "instagram.com", "tiktok.com", "reddit.com", "linkedin.com", "snapchat.com"],
    tips: [
      "📱 Social media apps are designed to be addictive. Use the '5-5-5 method': Ask yourself - Will this matter in 5 minutes? 5 hours? 5 days?",
      "🔔 Turn off ALL social media notifications. Check social media on YOUR schedule, not theirs.",
      "📊 You spend more time on social media than you think. Try logging out after each session - the friction helps.",
      "🧠 Every scroll triggers a dopamine hit. Replace 5 minutes of scrolling with 5 deep breaths.",
      "📵 Try a 'Social Media Sabbath' - one full day per week with no social media.",
      "✍️ Before opening social media, write down WHY you're opening it. If there's no clear reason, don't.",
      "🎯 Set specific goals for social media use: 'I'll check Twitter for 10 minutes to read industry news.'"
    ]
  },

  videoStreaming: {
    sites: ["youtube.com", "netflix.com", "twitch.tv", "hulu.com", "disneyplus.com", "primevideo.com", "hbomax.com"],
    tips: [
      "🎬 Create a 'Watch List' - only watch what you planned to watch. No browsing.",
      "⏸️ Use the episode rule: After one episode, do something productive before the next.",
      "🚫 Disable autoplay on all streaming platforms. It's designed to keep you watching.",
      "📺 Watch educational content instead - documentaries, tutorials, skill-building videos.",
      "⏰ Set a timer before you start watching. When it rings, stop.",
      "🎧 Try switching to podcasts while doing chores - productive + entertainment."
    ]
  },

  news: {
    sites: ["cnn.com", "bbc.com", "news.google.com", "reuters.com", "apnews.com", "nytimes.com"],
    tips: [
      "📰 Schedule 2 specific times daily for news (morning + evening). Avoid constant checking.",
      "🔍 'Doom scrolling' news increases anxiety without increasing knowledge. Set strict limits.",
      "📋 Subscribe to a daily newsletter instead of checking news sites throughout the day.",
      "🧘 After reading news, take 2 minutes to process. Ask: 'What can I actually do about this?'"
    ]
  },

  shopping: {
    sites: ["amazon.com", "ebay.com", "etsy.com", "walmart.com", "target.com"],
    tips: [
      "🛒 Use the 72-hour rule: Wait 72 hours before any non-essential purchase.",
      "💰 Window shopping online is still shopping. Each minute browsing increases purchase likelihood by 10%.",
      "📋 Make a shopping list BEFORE visiting any store. Only buy what's on the list."
    ]
  },

  // Time-based tips
  morning: [
    "🌅 Don't check your phone for the first 30 minutes after waking up.",
    "☀️ Start with your most important task. Your brain is freshest in the morning.",
    "🥤 Drink water before coffee. Hydration improves focus by up to 14%."
  ],

  afternoon: [
    "🍽️ Post-lunch slump? Take a 10-minute walk instead of browsing. It restores energy.",
    "☕ The afternoon dip is natural. Use it for lighter tasks, not infinite scrolling.",
    "🎯 Re-evaluate your to-do list. What's the ONE thing left that matters most?"
  ],

  evening: [
    "🌙 Screens before bed reduce melatonin by 50%. Set a digital curfew 1 hour before sleep.",
    "📚 Replace 30 minutes of browsing with reading. You'll sleep better AND learn more.",
    "🧘 End your digital day with gratitude. Write 3 things you accomplished today."
  ],

  // Score-based tips
  lowScore: [
    "🔴 Your productivity score suggests you're spending too much time on distracting sites.",
    "💪 Small improvements compound. Try reducing each site by just 5 minutes tomorrow.",
    "🎯 Identify your #1 time-wasting site and set an aggressive limit for it.",
    "⏰ Try the 'Nuclear Option': Block your top 3 distracting sites for 4 hours and see how it feels."
  ],

  mediumScore: [
    "📈 You're making progress! Focus on one more site to limit and you'll see big improvements.",
    "⚡ You're close to a great score. The difference between good and great is consistency.",
    "🔄 Review your limits weekly. As habits form, gradually reduce them."
  ],

  highScore: [
    "🌟 Excellent discipline! You're using the internet intentionally, not reactively.",
    "🏆 You're in the top tier of self-regulated internet users. Keep it up!",
    "🎯 Consider setting even more ambitious goals - what could you accomplish with an extra hour daily?"
  ],

  // General wisdom
  general: [
    "🧠 Your brain can only truly focus for 90 minutes at a time. Work in 90-minute blocks.",
    "📵 Put your phone in another room while working. Out of sight, out of mind.",
    "✅ The 2-minute rule: If something takes less than 2 minutes, do it NOW.",
    "🎵 Listen to music without lyrics while working. It improves focus without distraction.",
    "🏃 Physical exercise improves digital discipline. A 20-min workout reduces cravings for screens.",
    "💡 Decision fatigue leads to mindless browsing. Reduce decisions by batching tasks.",
    "📊 What gets measured gets managed. You're already ahead by tracking your time!",
    "🔋 Your willpower is like a battery - it depletes throughout the day. Do hard things first.",
    "🎪 Multitasking is a myth. Each switch costs 15-25 minutes of focused attention.",
    "🌳 Take 'green breaks' - look at nature for 40 seconds. It restores attention by 25%."
  ]
};

// Export for use in background.js
if (typeof module !== 'undefined') {
  module.exports = AI_TIPS_DATABASE;
}