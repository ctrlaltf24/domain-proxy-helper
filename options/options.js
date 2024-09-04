const template = document.querySelector('#proxyInput');
const containersList = document.querySelector('#containers');
const commonList = document.querySelector('#common');

const browserSettingsKey = 'com.github.ctrlaltf24.browser-proxy-switcher.domains';

let settings = {};

function getProxyFromInput(text) {
    text = text.trim();
    if (text === '') {
        return {};
    }
    const proxyRegexp = /(?<type>(socks4?)):\/\/(\b(?<username>\w+):(?<password>\w+)@)?(?<host>((?:\d{1,3}\.){3}\d{1,3}\b)|(\b([\w.-]+)+))(:(?<port>\d+))?/;
    const matches = proxyRegexp.exec(text);
    if (!matches) {
        return {};
    }
    return { ...matches.groups, proxyDNS: true };
}

function storeSettings(e) {
    const row = e.target.closest('[data-identity-id]');
    const id = row.getAttribute('data-identity-id');
    if (id) {
        const proxyInput = row.querySelector('input.userContext-proxy');
        const domainInput = row.querySelector('input.userContent-domain');
        if (!proxyInput || !domainInput || proxyInput.value === '' || domainInput.value === '') {
            return;
        }
        let result = {
            "id": id,
            "hostname": domainInput.value,
            "proxy": getProxyFromInput(proxyInput.value),
            "proxyString": proxyInput.value
        };

        let newSettingIndex = -1;
        const originalSettings = settings[browserSettingsKey] || [];
        for (let i = 0; i < originalSettings.length; i++) {
            if (originalSettings[i].id === id) {
                newSettingIndex = i;
                break;
            }
        }
        let settingsToStore = originalSettings;
        if (newSettingIndex === -1) {
            settingsToStore = [...originalSettings, result];
        } else {
            settingsToStore[newSettingIndex] = result;
        }
        
        browser.storage.local.set({
            [browserSettingsKey]: settingsToStore
        });

    }
}


function printContainerRow(domain, list) {
    const row = template.content.cloneNode(true);
    const div = row.querySelector('div');
    div.setAttribute('data-identity-id', domain.id);

    const domainInput = row.querySelector('input.userContent-domain')
    domainInput.value = domain.hostname;

    const proxyInput = row.querySelector('input.userContext-proxy');
    proxyInput.value = domain.proxyString;

    // showInfo(div);
    div.removeAttribute('hidden');
    proxyInput.addEventListener('change', storeSettings);
    domainInput.addEventListener('change', storeSettings);

    list.appendChild(row);
}

async function setupContainerFields() {
    settings = await browser.storage.local.get();

    // See background.js for the structure of the domains object
    let domains = settings[browserSettingsKey] || [];

    for (const domain of domains) {
        printContainerRow(domain, containersList);
    }

    // Print one extra row
    printContainerRow({
        "id": domains.length + 1,
        "hostname": "",
        "proxy": {},
        "proxyString": ""
    }, containersList);
}

setupContainerFields().catch(e => { console.log(e) });
