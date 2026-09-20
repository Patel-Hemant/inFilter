# inFilter 💼

A powerful, privacy-first Chrome Extension that supercharges your LinkedIn job search by injecting critical company scale, required experience, and salary data directly into the job feed. Stop wasting time manually opening job descriptions, and instantly filter out the noise.

## ✨ Features

- **📊 Instant Scale Metrics**: Automatically injects the exact employee count of the company right next to the job title (`• 👥 4,627 employees`).
- **🎓 Experience Level Intel (YOE)**: Automatically parses the job description in the background and displays the minimum required years of experience (`• 🎓 3+ yrs`, `• 🎓 5+ yrs`).
- **👻 Smart Fading (Ghosting)**:
  - **Company Size**: Grey out companies smaller than your employee threshold (e.g. < 2,000).
  - **Experience Level**: Grey out jobs that require more experience than you currently have (e.g. fades 5+ / 7+ yrs jobs if you have 3 yrs).
  - **Unknown Data**: Optionally grey out unverified/unknown (`?`) listings.
- **💰 1-Click Salary Intel**: Injects a 💰 icon that, when clicked, instantly opens a Google Search for `[Company] [Role] salary leetcode` so you can immediately see expected compensation.
- **⚡ Live Control Panel**: A sleek popup menu lets you toggle the extension, adjust fade thresholds, configure your YOE, and turn features on/off instantly without ever reloading the page.
- **🛡️ Privacy-First & Rate-Limit Safe**: Runs entirely locally in your browser. Uses intelligent queueing to mimic human scrolling and protect your LinkedIn account from bot-detection.

## 🚀 Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Toggle on **"Developer mode"** in the top right corner.
4. Click **"Load unpacked"** and select the `inFilter` folder.
5. Go to LinkedIn Jobs and start hunting!
