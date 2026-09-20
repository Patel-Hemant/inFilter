// content.js - inFilter Chrome Extension

let extensionEnabled = true;
let fadeEnabled = true;
let fadeThreshold = 2000;
let fadeUnknown = false;
let showYoeBadge = true;
let fadeYoeEnabled = false;
let maxYoeThreshold = 3;
let showSalaryIcon = true;

chrome.storage.local.get([
    'isEnabled',
    'fadeEnabled',
    'fadeThreshold',
    'fadeUnknown',
    'showYoeBadge',
    'fadeYoeEnabled',
    'maxYoeThreshold',
    'showSalaryIcon'
], (result) => {
    extensionEnabled = result.isEnabled !== false;
    fadeEnabled = result.fadeEnabled !== false;
    if (result.fadeThreshold !== undefined) fadeThreshold = result.fadeThreshold;
    fadeUnknown = result.fadeUnknown === true;
    showYoeBadge = result.showYoeBadge !== false;
    fadeYoeEnabled = result.fadeYoeEnabled === true;
    if (result.maxYoeThreshold !== undefined) maxYoeThreshold = result.maxYoeThreshold;
    showSalaryIcon = result.showSalaryIcon !== false;
    updateBadgeVisibility();
    updateYoeBadgesVisibility();
    updateFades();
    updateSalaryIcons();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.fadeEnabled) fadeEnabled = changes.fadeEnabled.newValue;
        if (changes.fadeThreshold) fadeThreshold = changes.fadeThreshold.newValue;
        if (changes.fadeUnknown) fadeUnknown = changes.fadeUnknown.newValue;
        if (changes.showYoeBadge) {
            showYoeBadge = changes.showYoeBadge.newValue;
            updateYoeBadgesVisibility();
        }
        if (changes.fadeYoeEnabled) fadeYoeEnabled = changes.fadeYoeEnabled.newValue;
        if (changes.maxYoeThreshold) maxYoeThreshold = changes.maxYoeThreshold.newValue;
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
        updateYoeBadgesVisibility();
        updateFades();
        updateSalaryIcons();
    }
});

function updateBadgeVisibility() {
    const badges = document.querySelectorAll('.employee-count-badge');
    badges.forEach(badge => {
        badge.style.display = extensionEnabled ? 'inline-block' : 'none';
    });
}

function updateYoeBadgesVisibility() {
    const yoeSpans = document.querySelectorAll('.yoe-badge');
    yoeSpans.forEach(span => {
        span.style.display = (extensionEnabled && showYoeBadge) ? 'inline' : 'none';
    });
}

function updateFades() {
    const badges = document.querySelectorAll('.employee-count-badge');
    badges.forEach(badge => {
        const jobCard = badge.closest('.job-card-container, .jobs-search-results__list-item, [componentkey^="job-card-component"]');
        if (!jobCard) return;

        if (extensionEnabled) {
            let shouldFade = false;
            
            // 1. Check Unknown Employee Count
            if (badge.dataset.employeeCount === "N/A" || (badge.dataset.employeeCount && badge.dataset.employeeCount.includes('?'))) {
                if (fadeUnknown) shouldFade = true;
            } else if (fadeEnabled && fadeThreshold > 0) {
                // 2. Check Small Company Employee Threshold
                const count = parseInt(badge.dataset.employeeCountRaw || '0', 10);
                if (count > 0 && count < fadeThreshold) {
                    shouldFade = true;
                }
            }
            
            // 3. Check Years of Experience (YOE) Threshold
            if (fadeYoeEnabled && maxYoeThreshold !== undefined && maxYoeThreshold !== null) {
                const requiredMinYoe = parseInt(badge.dataset.yoeMin || '-1', 10);
                if (requiredMinYoe > -1 && requiredMinYoe > maxYoeThreshold) {
                    shouldFade = true;
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
        if (showSalaryIcon && extensionEnabled) {
            if (!existingIcon) {
                const companyName = badge.dataset.companyName || "";
                const positionName = badge.dataset.positionName || "";
                
                const moneySpan = document.createElement('span');
                moneySpan.className = 'salary-icon';
                moneySpan.innerText = ' 💰';
                moneySpan.title = `Search ${companyName} ${positionName} Salary on LeetCode`;
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

// ----------------------------------------------------
// CACHES & RATE-LIMITED QUEUE FOR COMPANY COUNTS
// ----------------------------------------------------
const companyCountCache = {};
const jobYoeCache = {};

let isFetching = false;
const fetchQueue = [];

function processQueue() {
    if (isFetching || fetchQueue.length === 0) return;
    
    isFetching = true;
    const task = fetchQueue.shift();
    
    task()
        .finally(() => {
            setTimeout(() => {
                isFetching = false;
                processQueue();
            }, 300); // 300ms smooth delay
        });
}

function queueFetch(companyUrl, companyName) {
    return new Promise((resolve) => {
        fetchQueue.push(() => fetchCompanyCount(companyUrl, companyName).then(resolve).catch(() => resolve("N/A")));
        processQueue();
    });
}

function getCsrfToken() {
    try {
        const match = document.cookie.split('; ').find(row => row.startsWith('JSESSIONID='));
        return match ? match.split('=')[1].replace(/"/g, '') : '';
    } catch (e) {
        return '';
    }
}

// ----------------------------------------------------
// YEARS OF EXPERIENCE (YOE) EXTRACTION
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

function fetchJobYOE(jobId) {
    if (!jobId) return Promise.resolve(null);
    if (jobYoeCache[jobId]) return Promise.resolve(jobYoeCache[jobId]);

    // 1. Check if the active right pane currently shows this job's description
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const currentJobId = urlParams.get('currentJobId') || window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
        if (currentJobId === jobId) {
            const descEl = document.querySelector('[data-testid="expandable-text-box"], .jobs-description__content, #job-details, .jobs-box__html-content');
            if (descEl && descEl.innerText) {
                const yoe = extractYOE(descEl.innerText);
                if (yoe) {
                    jobYoeCache[jobId] = yoe;
                    return Promise.resolve(yoe);
                }
            }
        }
    } catch (e) {}

    // 2. Delegate to background script (Bypasses page CORS completely)
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ action: "fetchJobYOE", jobId: jobId }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success || !response.yoe) {
                    jobYoeCache[jobId] = { display: null, min: null, max: null };
                    resolve(jobYoeCache[jobId]);
                } else {
                    jobYoeCache[jobId] = response.yoe;
                    resolve(response.yoe);
                }
            });
        } catch (e) {
            jobYoeCache[jobId] = { display: null, min: null, max: null };
            resolve(jobYoeCache[jobId]);
        }
    });
}

// ----------------------------------------------------
// COMPANY EMPLOYEE COUNT EXTRACTION
// ----------------------------------------------------
async function fetchCompanyCount(companyUrl, companyName) {
    try {
        const csrfToken = getCsrfToken();
        const formattedName = companyUrl.split('/company/')[1]?.replace(/\//g, '');
        
        // STRATEGY 1: Fetch via LinkedIn Voyager API (Direct & Fast)
        if (formattedName && csrfToken) {
            try {
                const apiUrl = `https://www.linkedin.com/voyager/api/organization/companies?q=universalName&universalName=${formattedName}`;
                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'accept': 'application/vnd.linkedin.normalized+json+2.1',
                        'csrf-token': csrfToken
                    }
                });
                
                if (apiResponse && apiResponse.ok) {
                    const apiData = await apiResponse.json();
                    const strData = JSON.stringify(apiData);
                    const staffCountMatch = strData.match(/"staffCount":(\d+)/);
                    
                    if (staffCountMatch && staffCountMatch[1]) {
                        const count = parseInt(staffCountMatch[1], 10);
                        if (!(count > 25000 && count < 27000 && !companyName.toLowerCase().includes("linkedin"))) {
                            return `${count.toLocaleString()} employees`;
                        }
                    }
                }
            } catch (apiErr) {}
        }

        // STRATEGY 2: Fallback to HTML
        const response = await fetch(companyUrl, {
            credentials: 'include',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'csrf-token': csrfToken
            }
        });
        
        if (!response || !response.ok) return "N/A";

        const htmlText = await response.text();
        
        if (htmlText.includes("authwall") || htmlText.includes("Security Verification") || htmlText.includes("window.location.href")) {
            return "N/A";
        }
        
        const textMatch = htmlText.match(/([0-9][0-9,Kk\+\-]*\s+employees)/i);
        if (textMatch && textMatch[0]) {
            if (!(textMatch[0].includes("26,000") && !companyName.toLowerCase().includes("linkedin"))) return textMatch[0];
        }

        const staffCountMatch = htmlText.match(/"staffCount"\s*:\s*(\d+)/);
        if (staffCountMatch && staffCountMatch[1]) {
            const count = parseInt(staffCountMatch[1], 10);
            if (!(count > 25000 && count < 27000 && !companyName.toLowerCase().includes("linkedin"))) return `${count.toLocaleString()} employees`;
        }

        const rangeMatch = htmlText.match(/"companySize"\s*:\s*\{[^\}]*"start"\s*:\s*(\d+)(?:[^\}]*"end"\s*:\s*(\d+))?/);
        if (rangeMatch && rangeMatch[1]) {
            const start = parseInt(rangeMatch[1], 10);
            if (start > 0) {
                const end = rangeMatch[2] ? `-${parseInt(rangeMatch[2], 10).toLocaleString()}` : "+";
                return `${start.toLocaleString()}${end} employees`;
            }
        }
        return "N/A";
    } catch (e) { return "N/A"; }
}

// ----------------------------------------------------
// JOB CARD ID EXTRACTION
// ----------------------------------------------------
function extractJobId(jobCardElement) {
    if (!jobCardElement) return null;
    
    // 1. data-job-id attribute
    let id = jobCardElement.getAttribute('data-job-id');
    if (id && /^\d+$/.test(id)) return id;
    
    // 2. data-occludable-job-id attribute
    id = jobCardElement.getAttribute('data-occludable-job-id');
    if (id && /^\d+$/.test(id)) return id;
    
    // 3. componentkey attribute like "job-card-component-ref-4452421935"
    const compKey = jobCardElement.getAttribute('componentkey') || 
                    jobCardElement.querySelector('[componentkey*="job-card-component-ref-"]')?.getAttribute('componentkey');
    if (compKey) {
        const m = compKey.match(/(\d{7,12})/);
        if (m) return m[1];
    }
    
    // 4. Job link inside card (e.g. href="/jobs/view/4452421935/...")
    const jobLink = jobCardElement.querySelector('a[href*="/jobs/view/"]');
    if (jobLink && jobLink.href) {
        const m = jobLink.href.match(/\/jobs\/view\/(\d+)/);
        if (m) return m[1];
    }
    
    // 5. Link with currentJobId (e.g. href="...?currentJobId=4452421935...")
    const currentJobLink = jobCardElement.querySelector('a[href*="currentJobId="]');
    if (currentJobLink && currentJobLink.href) {
        const m = currentJobLink.href.match(/currentJobId=(\d+)/);
        if (m) return m[1];
    }

    return null;
}

// ----------------------------------------------------
// PROGRESSIVE BADGE RENDERING
// ----------------------------------------------------
function renderBadge(badge) {
    if (!document.body.contains(badge)) return;

    const employeeCount = badge.dataset.employeeCount;
    const yoeDisplay = badge.dataset.yoeDisplay;

    // If company count is still loading
    if (!employeeCount) {
        badge.innerText = ` • Loading...`;
        badge.style.color = '#999999';
        return;
    }

    let countText = "";
    if (employeeCount === "N/A") {
        countText = " • ?";
        badge.style.color = "#999999";
    } else {
        countText = ` • 👥 ${employeeCount}`;
        badge.style.color = "#057642";
    }

    let yoeHtml = "";
    if (yoeDisplay) {
        const displayStyle = (extensionEnabled && showYoeBadge) ? 'inline' : 'none';
        yoeHtml = `<span class="yoe-badge" style="display: ${displayStyle};"> • 🎓 ${yoeDisplay}</span>`;
    }

    badge.innerHTML = `${countText}${yoeHtml}`;

    updateFades();
    updateSalaryIcons();
}

// ----------------------------------------------------
// JOB CARD PROCESSING
// ----------------------------------------------------
async function processJobCard(jobCardElement) {
    if (!jobCardElement || jobCardElement.dataset.infilterProcessed === "true") return;
    
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
        
        jobCardElement.dataset.infilterProcessed = "true";

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

        // Extract Position Name for salary search
        let positionName = "";
        if (titleContainer) {
            const titleSpan = titleContainer.querySelector('span[aria-hidden="true"]') || titleContainer.querySelector('span');
            if (titleSpan) {
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

        // Extract Job ID for YOE extraction
        const jobId = extractJobId(jobCardElement);

        // Initial Loading Badge
        const badge = document.createElement('span');
        badge.className = 'employee-count-badge';
        badge.innerText = ` • Loading...`;
        badge.style.color = '#999999';
        badge.dataset.companyName = companyName;
        badge.dataset.positionName = positionName;
        if (jobId) badge.dataset.jobId = jobId;
        
        const pTag = companyDiv.querySelector('p');
        if (pTag) {
            pTag.appendChild(badge);
        } else {
            companyDiv.appendChild(badge);
        }

        // Step 1: Start Company Count Fetch (Instant UI update when ready)
        const countTask = companyCountCache[companyUrl] || (companyCountCache[companyUrl] = queueFetch(companyUrl, companyName));
        countTask.then(employeeCount => {
            badge.dataset.employeeCount = employeeCount || "N/A";
            let rawCount = 0;
            if (employeeCount && employeeCount !== "N/A") {
                const m = employeeCount.match(/\d[0-9,]*/);
                if (m) rawCount = parseInt(m[0].replace(/,/g, ''), 10);
            }
            badge.dataset.employeeCountRaw = rawCount.toString();
            renderBadge(badge);
        });

        // Step 2: Start Job YOE Fetch via background script / DOM
        if (jobId) {
            fetchJobYOE(jobId).then(yoeData => {
                if (yoeData && yoeData.display) {
                    badge.dataset.yoeDisplay = yoeData.display;
                    badge.dataset.yoeMin = (yoeData.min !== null && yoeData.min !== undefined) ? yoeData.min.toString() : "-1";
                }
                renderBadge(badge);
            });
        }
    } catch (error) {
        // Silently fail
    }
}

// ----------------------------------------------------
// ACTIVE DETAILS PANE OBSERVER (Instant live YOE sync on click)
// ----------------------------------------------------
function inspectActiveJobDetails() {
    try {
        const descEl = document.querySelector('[data-testid="expandable-text-box"], .jobs-description__content, #job-details, .jobs-box__html-content');
        if (!descEl || !descEl.innerText) return;

        const urlParams = new URLSearchParams(window.location.search);
        const currentJobId = urlParams.get('currentJobId') || window.location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1];
        if (!currentJobId) return;

        const yoe = extractYOE(descEl.innerText);
        if (yoe) {
            jobYoeCache[currentJobId] = yoe;
            
            // Find corresponding badge in the left list and update it instantly!
            const targetBadge = document.querySelector(`.employee-count-badge[data-job-id="${currentJobId}"]`);
            if (targetBadge && targetBadge.dataset.yoeDisplay !== yoe.display) {
                targetBadge.dataset.yoeDisplay = yoe.display;
                targetBadge.dataset.yoeMin = (yoe.min !== null && yoe.min !== undefined) ? yoe.min.toString() : "-1";
                renderBadge(targetBadge);
            }
        }
    } catch (e) {}
}

function processJobCards() {
    if (!extensionEnabled) return;
    const jobCards = document.querySelectorAll('[componentkey^="job-card-component"], .job-card-container, .jobs-search-results__list-item');
    jobCards.forEach(card => {
        processJobCard(card);
    });
    inspectActiveJobDetails();
}

setInterval(processJobCards, 1500);

// Listen for clicks on job cards to immediately check right pane details
document.addEventListener('click', (e) => {
    if (e.target.closest('.job-card-container, .jobs-search-results__list-item, [componentkey^="job-card-component"]')) {
        setTimeout(inspectActiveJobDetails, 400);
        setTimeout(inspectActiveJobDetails, 1000);
    }
});
