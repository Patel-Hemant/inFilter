// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const masterToggle = document.getElementById('masterToggle');
    const fadeToggle = document.getElementById('fadeToggle');
    const fadeThreshold = document.getElementById('fadeThreshold');
    const fadeUnknown = document.getElementById('fadeUnknown');
    const showYoeBadge = document.getElementById('showYoeBadge');
    const fadeYoeEnabled = document.getElementById('fadeYoeEnabled');
    const maxYoeThreshold = document.getElementById('maxYoeThreshold');
    const showSalaryIcon = document.getElementById('showSalaryIcon');

    // Load state
    chrome.storage.local.get({
        isEnabled: true,
        fadeEnabled: true,
        fadeThreshold: 2000,
        fadeUnknown: false,
        showYoeBadge: true,
        fadeYoeEnabled: false,
        maxYoeThreshold: 3,
        showSalaryIcon: true
    }, (items) => {
        masterToggle.checked = items.isEnabled !== false;
        fadeToggle.checked = items.fadeEnabled !== false;
        fadeThreshold.value = items.fadeThreshold;
        fadeUnknown.checked = items.fadeUnknown === true;
        showYoeBadge.checked = items.showYoeBadge !== false;
        fadeYoeEnabled.checked = items.fadeYoeEnabled === true;
        maxYoeThreshold.value = items.maxYoeThreshold ?? 3;
        showSalaryIcon.checked = items.showSalaryIcon !== false;
    });

    // Save and apply state instantly on any change
    function saveState() {
        const isEnabled = masterToggle.checked;
        
        chrome.storage.local.set({
            isEnabled: isEnabled,
            fadeEnabled: fadeToggle.checked,
            fadeThreshold: parseInt(fadeThreshold.value, 10) || 0,
            fadeUnknown: fadeUnknown.checked,
            showYoeBadge: showYoeBadge.checked,
            fadeYoeEnabled: fadeYoeEnabled.checked,
            maxYoeThreshold: parseInt(maxYoeThreshold.value, 10) ?? 3,
            showSalaryIcon: showSalaryIcon.checked
        });

        // Update Badge Text/Color
        chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
        chrome.action.setBadgeBackgroundColor({ color: isEnabled ? '#4688F1' : '#FF0000' });

        // Notify active tab to toggle immediately
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            tabs.forEach(t => {
                chrome.tabs.sendMessage(t.id, { action: "toggleState", isEnabled: isEnabled }).catch(() => {});
            });
        });
    }

    masterToggle.addEventListener('change', saveState);
    fadeToggle.addEventListener('change', saveState);
    fadeThreshold.addEventListener('input', saveState);
    fadeUnknown.addEventListener('change', saveState);
    showYoeBadge.addEventListener('change', saveState);
    fadeYoeEnabled.addEventListener('change', saveState);
    maxYoeThreshold.addEventListener('input', saveState);
    showSalaryIcon.addEventListener('change', saveState);
});
