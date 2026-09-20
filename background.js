// background.js

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ isEnabled: true });
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
});

chrome.storage.local.get(['isEnabled'], (result) => {
    const isEnabled = result.isEnabled !== false;
    chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: isEnabled ? '#4688F1' : '#FF0000' });
});

// ----------------------------------------------------
// YEARS OF EXPERIENCE (YOE) EXTRACTION IN BACKGROUND
// ----------------------------------------------------
const wordToNum = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "fifteen": 15
};

const numPattern = "\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen";

function parseNumberWord(val) {
    if (!val) return null;
    val = val.toLowerCase().trim();
    if (wordToNum[val] !== undefined) return wordToNum[val];
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

function extractYOE(desc) {
    if (!desc) return null;
    const cleanText = desc.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

    const patterns = [
        // "3-5 years of software development experience", "5+ years of experience", "five or more years of experience"
        new RegExp(`(?:minimum(?:\\s+of)?|at\\s+least)?\\s*(${numPattern})\\s*(?:(?:-|to)\\s*(${numPattern}))?\\s*(?:or\\s+more|\\+)?\\s*(?:years?|yrs?)(?:\\s+of)?(?:\\s+[a-zA-Z/-]+){0,4}\\s*(?:experience|exp)\\b`, "gi"),
        // "experience: 5+ years" or "experience of 3-5 years"
        new RegExp(`(?:experience|exp)\\s*(?:of|:)?\\s*(${numPattern})\\s*(?:(?:-|to)\\s*(${numPattern})|\\+)?\\s*(?:years?|yrs?)\\b`, "gi"),
        // "5+ years in/with/as a software engineer"
        new RegExp(`(${numPattern})\\s*\\+\\s*(?:years?|yrs?)\\s*(?:in|with|working|building|developing|leading|as\\s+a)\\b`, "gi")
    ];

    const found = [];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(cleanText)) !== null) {
            const minYears = parseNumberWord(match[1]);
            if (minYears !== null && minYears >= 0 && minYears <= 25) {
                const maxYears = match[2] ? parseNumberWord(match[2]) : null;
                const display = maxYears ? `${minYears}-${maxYears} yrs` : `${minYears}+ yrs`;
                found.push({
                    text: match[0].trim(),
                    min: minYears,
                    max: maxYears,
                    display: display
                });
            }
        }
    }
    
    if (found.length === 0) return null;

    // Prioritize largest general experience requirement
    found.sort((a, b) => b.min - a.min);
    return found[0];
}

async function fetchJobYOEFromBackground(jobId) {
    if (!jobId) return null;
    
    // 1. Try Guest API (No auth required, clean HTML)
    try {
        const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
        const res = await fetch(guestUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        if (res.ok) {
            const html = await res.text();
            const yoe = extractYOE(html);
            if (yoe) return yoe;
        }
    } catch (e) {}

    // 2. Try Standard Public Job View
    try {
        const viewUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
        const res = await fetch(viewUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        if (res.ok) {
            const html = await res.text();
            const yoe = extractYOE(html);
            if (yoe) return yoe;
        }
    } catch (e) {}

    return null;
}

// ----------------------------------------------------
// MESSAGE ROUTER
// ----------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "searchCompanyUrl") {
        const query = encodeURIComponent(`"${request.companyName}" site:linkedin.com/company`);
        const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;
        
        fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        })
        .then(response => response.text())
        .then(html => {
            const match = html.match(/linkedin\.com\/company\/([a-z0-9\-]+)/i);
            if (match && match[1]) {
                sendResponse({ success: true, url: match[1] });
            } else {
                sendResponse({ success: false });
            }
        })
        .catch(error => {
            sendResponse({ success: false });
        });
        
        return true; 
    }

    if (request.action === "fetchJobYOE") {
        fetchJobYOEFromBackground(request.jobId)
            .then(yoe => {
                sendResponse({ success: true, yoe: yoe });
            })
            .catch(() => {
                sendResponse({ success: false, yoe: null });
            });
        return true; // Keep channel open for async response
    }
});
