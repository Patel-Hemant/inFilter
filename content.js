// content.js

let extensionEnabled = true;
let fadeEnabled = true;
let fadeThreshold = 2000;
let fadeUnknown = false;
let showSalaryIcon = true;

chrome.storage.local.get(['isEnabled', 'fadeEnabled', 'fadeThreshold', 'fadeUnknown', 'showSalaryIcon'], (result) => {
    extensionEnabled = result.isEnabled !== false;
    fadeEnabled = result.fadeEnabled !== false;
    if (result.fadeThreshold !== undefined) fadeThreshold = result.fadeThreshold;
    fadeUnknown = result.fadeUnknown === true;
    showSalaryIcon = result.showSalaryIcon !== false;
    updateBadgeVisibility();
    updateSalaryIcons();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.fadeEnabled) fadeEnabled = changes.fadeEnabled.newValue;
        if (changes.fadeThreshold) fadeThreshold = changes.fadeThreshold.newValue;
        if (changes.fadeUnknown) fadeUnknown = changes.fadeUnknown.newValue;
        if (changes.showSalaryIcon) {
            showSalaryIcon = changes.showSalaryIcon.newValue;
            updateSalaryIcons();
        }
        updateFades();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleState") {
        extensionEnabled = request.isEnabled;
        updateBadgeVisibility();
        updateFades();
    }
});

function updateBadgeVisibility() {
    const badges = document.querySelectorAll('.employee-count-badge');
    badges.forEach(badge => {
        badge.style.display = extensionEnabled ? 'inline' : 'none';
    });
}

function updateFades() {
    const badges = document.querySelectorAll('.employee-count-badge');
    badges.forEach(badge => {
        const jobCard = badge.closest('.job-card-container, .jobs-search-results__list-item, [componentkey^="job-card-component"]');
        if (!jobCard) return;

        if (extensionEnabled) {
            let shouldFade = false;
            
            if (badge.innerText.includes('?')) {
                shouldFade = fadeUnknown;
            } else if (fadeEnabled && fadeThreshold > 0) {
                const match = badge.innerText.match(/\d[0-9,]*/);
                if (match) {
                    const count = parseInt(match[0].replace(/,/g, ''), 10);
                    if (count < fadeThreshold) shouldFade = true;
                }
            }
            
            if (shouldFade) {
                jobCard.style.opacity = '0.3';
                jobCard.style.transition = 'opacity 0.3s ease';
            } else {
                jobCard.style.opacity = '1';
            }
        } else {
            jobCard.style.opacity = '1';
        }
    });
}

function updateSalaryIcons() {
    const badges = document.querySelectorAll('.employee-count-badge');
    badges.forEach(badge => {
        const existingIcon = badge.querySelector('.salary-icon');
        if (showSalaryIcon) {
            if (!existingIcon) {
                const companyName = badge.dataset.companyName || "";
                const positionName = badge.dataset.positionName || "";
                
                const moneySpan = document.createElement('span');
                moneySpan.className = 'salary-icon';
                moneySpan.innerText = ' 💰';
                moneySpan.style.cursor = 'pointer';
                moneySpan.title = "Search Salary";
                moneySpan.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const query = `${companyName} ${positionName} salary leetcode`;
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
                };
                badge.appendChild(moneySpan);
            }
        } else {
            if (existingIcon) {
                existingIcon.remove();
            }
        }
    });
}

const companyCountCache = {};

function getCsrfToken() {
    try {
        const match = document.cookie.split('; ').find(row => row.startsWith('JSESSIONID='));
        return match ? match.split('=')[1].replace(/"/g, '') : '';
    } catch (e) {
        return '';
    }
}

async function fetchCompanyCount(companyUrl, companyName) {
    try {
        const csrfToken = getCsrfToken();
        const formattedName = companyUrl.split('/company/')[1]?.replace(/\//g, '');
        
        // STRATEGY 1: Fetch via LinkedIn Voyager API (Extremely accurate and fast, no HTML parsing)
        if (formattedName && csrfToken) {
            try {
                const apiUrl = `https://www.linkedin.com/voyager/api/organization/companies?q=universalName&universalName=${formattedName}`;
                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'accept': 'application/vnd.linkedin.normalized+json+2.1',
                        'csrf-token': csrfToken
                    }
                });
                
                if (apiResponse.ok) {
                    const apiData = await apiResponse.json();
                    const strData = JSON.stringify(apiData);
                    const staffCountMatch = strData.match(/"staffCount":(\d+)/);
                    
                    if (staffCountMatch && staffCountMatch[1]) {
                        const count = parseInt(staffCountMatch[1]);
                        if (!(count > 25000 && count < 27000 && !companyName.toLowerCase().includes("linkedin"))) {
                            console.log(`[LinkedIn Employee Count] Voyager API success for ${companyName}`);
                            return `${count.toLocaleString()} employees`;
                        }
                    }
                }
            } catch (apiErr) {
                // Ignore and fallback to HTML
            }
        }

        // STRATEGY 2: Fallback to fetching the HTML page directly
        const response = await fetch(companyUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'csrf-token': csrfToken
            }
        });
        
        if (!response.ok) {
            return "N/A";
        }

        const htmlText = await response.text();
        
        if (htmlText.includes("authwall") || htmlText.includes("Security Verification") || htmlText.includes("window.location.href")) {
            return "N/A";
        }
        
        const textMatch = htmlText.match(/([0-9][0-9,Kk\+\-]*\s+employees)/i);
        if (textMatch && textMatch[0]) {
            if (!(textMatch[0].includes("26,000") && !companyName.toLowerCase().includes("linkedin"))) {
                return textMatch[0];
            }
        }

        const staffCountMatch = htmlText.match(/"staffCount"\s*:\s*(\d+)/);
        if (staffCountMatch && staffCountMatch[1]) {
            const count = parseInt(staffCountMatch[1]);
            if (!(count > 25000 && count < 27000 && !companyName.toLowerCase().includes("linkedin"))) {
                return `${count.toLocaleString()} employees`;
            }
        }

        const rangeMatch = htmlText.match(/"companySize"\s*:\s*\{[^\}]*"start"\s*:\s*(\d+)(?:[^\}]*"end"\s*:\s*(\d+))?/);
        if (rangeMatch && rangeMatch[1]) {
            const start = parseInt(rangeMatch[1]);
            if (start > 0) {
                const end = rangeMatch[2] ? `-${parseInt(rangeMatch[2]).toLocaleString()}` : "+";
                return `${start.toLocaleString()}${end} employees`;
            }
        }

        // If it failed all strategies, log a snippet of the HTML so we know what we received!
        return "N/A";
        return "N/A";

    } catch (e) {
        return "N/A";
    }
}

let isFetching = false;
const fetchQueue = [];

function processQueue() {
    if (isFetching || fetchQueue.length === 0) return;
    
    isFetching = true;
    const { companyUrl, companyName, resolve } = fetchQueue.shift();
    
    fetchCompanyCount(companyUrl, companyName)
        .then(count => {
            resolve(count);
        })
        .finally(() => {
            setTimeout(() => {
                isFetching = false;
                processQueue();
            }, 1000); 
        });
}

function queueFetch(companyUrl, companyName) {
    return new Promise((resolve) => {
        fetchQueue.push({ companyUrl, companyName, resolve });
        processQueue();
    });
}

async function processJobCard(jobCardElement) {
    if (!jobCardElement || jobCardElement.dataset.employeeCountProcessedV6 === "true") return;
    
    try {
        let companyDiv = null;
        let companyName = "";
        let companyUrl = "";
        
        const titleContainer = jobCardElement.querySelector('[data-display-contents="true"]');
        if (titleContainer && titleContainer.nextElementSibling) {
            companyDiv = titleContainer.nextElementSibling;
            
            const oldBadges = companyDiv.querySelectorAll('.employee-count-badge');
            oldBadges.forEach(b => b.remove());
            
            companyName = (companyDiv.textContent || "").trim();
        } else {
            companyDiv = jobCardElement.querySelector('.job-card-container__company-name, .job-card-list__company-name, .artdeco-entity-lockup__subtitle');
            if (companyDiv) {
                const oldBadges = companyDiv.querySelectorAll('.employee-count-badge');
                oldBadges.forEach(b => b.remove());
                
                companyName = (companyDiv.textContent || "").trim();
            }
        }
        
        if (!companyName || !companyDiv) return;
        
        jobCardElement.dataset.employeeCountProcessedV6 = "true";

        const companyLink = jobCardElement.querySelector('a[href*="/company/"]');
        if (companyLink) {
            const matchUrl = companyLink.href.match(/.*\/company\/[^\/]+\//);
            if (matchUrl) {
                companyUrl = matchUrl[0];
            }
        }
        
        if (!companyUrl) {
            const formattedName = companyName
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
            companyUrl = `https://www.linkedin.com/company/${formattedName}/`;
        }

        const badge = document.createElement('span');
        badge.className = 'employee-count-badge';
        badge.innerText = ` • Loading...`;
        badge.style.color = '#999999';
        
        const pTag = companyDiv.querySelector('p');
        if (pTag) {
            pTag.appendChild(badge);
        } else {
            companyDiv.appendChild(badge);
        }

        const cacheKey = companyUrl;
        if (!companyCountCache[cacheKey]) {
            companyCountCache[cacheKey] = queueFetch(companyUrl, companyName);
        }

        const employeeCount = await companyCountCache[cacheKey];
        
        if (document.body.contains(badge)) {
            if (employeeCount === "N/A") {
                badge.innerText = ` • ?`;
                badge.style.color = "#999999"; 
            } else {
                badge.innerText = ` • 👥 ${employeeCount}`;
                badge.style.color = "#057642"; 
            }
            
            // Extract position name for the salary search
            let positionName = "";
            const titleContainer = jobCardElement.querySelector('[data-display-contents="true"]');
            if (titleContainer) {
                const titleSpan = titleContainer.querySelector('span[aria-hidden="true"]') || titleContainer.querySelector('span');
                if (titleSpan) {
                    // Remove nested SVGs/hidden text and trim
                    positionName = titleSpan.innerText || titleSpan.textContent;
                } else {
                    positionName = titleContainer.innerText || titleContainer.textContent;
                }
            }
            if (!positionName) {
                const fallbackTitle = jobCardElement.querySelector('.job-card-list__title, .artdeco-entity-lockup__title, .job-card-container__title, .job-card-list__title--emphasized');
                if (fallbackTitle) {
                    positionName = fallbackTitle.innerText || fallbackTitle.textContent;
                }
            }
            
            if (positionName) {
                positionName = positionName.replace(/\(.*\)/g, '').replace(/\n/g, '').trim();
            }
            
            badge.dataset.companyName = companyName;
            badge.dataset.positionName = positionName;
            
            updateFades();
            updateSalaryIcons();
        }
    } catch (error) {
        // Silently fail
    }
}

function processJobCards() {
    if (!extensionEnabled) return;
    const jobCards = document.querySelectorAll('[componentkey^="job-card-component"], .job-card-container, .jobs-search-results__list-item');
    jobCards.forEach(card => {
        processJobCard(card);
    });
}

setInterval(processJobCards, 2000);
