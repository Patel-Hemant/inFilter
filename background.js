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
});
