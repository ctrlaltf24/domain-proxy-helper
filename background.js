const browserSettingsKey = 'com.github.ctrlaltf24.browser-proxy-switcher.domains';


// Format of settings is:
// [
//     {
//         // UUID v4
//         "id": "00000000-0000-0000-0000-000000000000",
//         // Domain name
//         "hostname": "firefox-default",
//         // Proxy settings
//         "proxy": {
//             "type": "socks4",
//             "username": "user",
//             "password": "password",
//             "host": "",
//             "port": "1080",
//             "proxyDNS": true
//         },
//         // Proxy string (used for easy display)
//         "proxyString": "socks4://localhost:1080"
//     }
// ]
let settings = [];

function handleProxifiedRequest(requestInfo) {
    let requestHostname = new URL(requestInfo.url).hostname;
    // Go through the list of domains and see if the request matches any of them
    let matchedSetting = null;
    for (let index in settings) {
        let setting = settings[index];
        if (requestHostname === setting.hostname || requestHostname.endsWith('.' + setting.hostname)) {
            matchedSetting = setting;
            break;
        }
    }
    if (!matchedSetting) {
        // If no match was found then don't change the proxy
        return;
    }

    // XXX: Not sure if this will respect the proxy DNS setting.
    // May need to implement a custom DNS resolver

    // Only return the one proxy setting that matches the domain
    return {
        ...matchedSetting.proxy,
        connectionIsolationKey: browserSettingsKey + "." + matchedSetting.id
    };
}

// Listen for a request to open a webpage
browser.proxy.onRequest.addListener(handleProxifiedRequest, { urls: ["<all_urls>"] });

// Log any errors from the proxy script
browser.proxy.onError.addListener(error => {
    console.error(`Proxy error: ${error.message}`);
});

// Listen for changes in extension storage
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        let changedItems = Object.keys(changes);
        for (let item of changedItems) {
            if (item === browserSettingsKey) {
                settings = changes[item].newValue;
            }
        }
    }
});
