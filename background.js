chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    const url = details.url;
    const parseURL = new URL(url);
    
    if (parseURL.pathname.endsWith('.pdf')) {
        const newURL = chrome.runtime.getURL('viewer.html') + '?pdf=' + encodeURIComponent(url);

        chrome.tabs.update(details.tabId, { url: newURL });
    }
});