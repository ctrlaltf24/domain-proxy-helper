// Format of settings is:
// {
//     "domains": [
//         {
//             // UUID v4
//             "id": "00000000-0000-0000-0000-000000000000",
//             // Domain name
//             "hostname": "firefox-default",
//             // Proxy settings
//             "proxy": {
//                 "type": "socks4",
//                 "username": "user",
//                 "password": "password",
//                 "host": "",
//                 "port": "1080",
//                 "proxyDNS": true
//             },
//             // Proxy string (used for easy display)
//             "proxyString": "socks4://localhost:1080"
//         }
//     ]
// }
let settings = {
    "domains": [],
};
let cachedDNS = [];

async function refreshDNSCache() {
    for (let domain of settings.domains) {
        await cacheDNS(domain);
    }
}

// Cache the dns resolution for a domain using the proxy
async function cacheDNS(domain) {
    if (cachedDNS.includes(domain.hostname)) {
        return;
    }
    if (!browser.extension.isAllowedIncognitoAccess()) {
        console.warn("Cannot set the system wide proxy for a brief moment to cache DNS resolution without permissions to access incognito mode.");
        return;
    }
    if (!domain.proxy) {
        console.error(`No proxy settings for ${domain.hostname}`);
        return;
    }
    let originalProxy = await browser.proxy.settings.get({});
    // Format the proxy setting as a string
    let socksString = domain.proxy.hostname;
    if (domain.proxy.port) {
        socksString += ':' + domain.proxy.port;
    }
    if (domain.proxy.username && domain.proxy.password) {
        socksString = domain.proxy.username + ':' + domain.proxy.password + '@' + socksString;
    } else if (domain.proxy.username) {
        socksString = domain.proxy.username + '@' + socksString;
    }
    await browser.proxy.settings.set({
        value: {
            proxyDNS: true,
            proxyType: "manual",
            socks: socksString,
        }
    });
    // Unfortunately, we can't use the DNS API to resolve the DNS for a domain
    // because the proxy settings are not applied to the DNS API.
    // "DNS will fail with NS_ERROR_UNKNOWN_PROXY_HOST if proxying DNS over socks is enabled." - https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/dns
    await fetch(`http://${domain.hostname}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
    }).then((response) => {
        cachedDNS.push(domain.hostname);
    }).catch((error) => {
        console.error(`Failed to resolve DNS for ${domain.hostname}: ${error.message}`);
    });
    await browser.proxy.settings.set({
        value: originalProxy
    });
}

function handleProxifiedRequest(requestInfo) {
    let requestHostname = new URL(requestInfo.url).hostname;
    // Go through the list of domains and see if the request matches any of them
    let matchedSetting = null;
    for (let index in settings["domains"]) {
        let setting = settings["domains"][index];
        if (requestHostname === setting.hostname || requestHostname.endsWith('.' + setting.hostname)) {
            matchedSetting = setting;
            break;
        }
    }
    if (!matchedSetting) {
        // If no match was found then don't change the proxy
        return;
    }

    // Only return the one proxy setting that matches the domain
    return {
        ...matchedSetting.proxy,
        connectionIsolationKey: "per-domain-proxy-" + matchedSetting.id
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
            settings[item] = changes[item].newValue;
        }
        settings.domains = settings["domains"] || [];
        refreshDNSCache();
    }
});

// Load the settings from storage
browser.storage.local.get().then((storedSettings) => {
    settings = storedSettings;
    settings.domains = settings["domains"] || [];
    refreshDNSCache();
});
