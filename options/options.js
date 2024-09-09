const template = document.querySelector('#proxyInput');
const containersList = document.querySelector('#containers');
const commonList = document.querySelector('#common');
const importButton = document.querySelector('#importButton');
const importInput = document.querySelector('#importInput');
const exportButton = document.querySelector('#export');
const saveButton = document.querySelector('#saveButton');

let settings = [];

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
            // Remove the row if either the domain or proxy is empty
            settings = settings.filter((setting) => setting.id !== id);
        } else {
            let result = {
                "id": id,
                "hostname": domainInput.value,
                "proxy": getProxyFromInput(proxyInput.value),
                "proxyString": proxyInput.value
            };

            let newSettingIndex = -1;
            for (let i = 0; i < settings.length; i++) {
                if (settings[i].id === id) {
                    settings[i] = result;
                    break;
                }
            }
            if (newSettingIndex === -1) {
                settings = [...settings, result];
            }
        }

        browser.storage.local.set({ "domains": settings });
    }
}

function generateId() {
    // Generates a random identifier that is not already in use
    let id = '';
    do {
        id = Math.floor(Math.random() * 1_000_000_000).toString();
    } while (settings.find((setting) => setting.id === id));
    return id;
}

function printContainerRow(domain, list) {
    const row = template.content.cloneNode(true);
    const div = row.querySelector('div');
    div.setAttribute('data-identity-id', domain.id);

    const domainInput = row.querySelector('input.userContent-domain')
    domainInput.value = domain.hostname;

    const proxyInput = row.querySelector('input.userContext-proxy');
    proxyInput.value = domain.proxyString;

    div.removeAttribute('hidden');
    proxyInput.addEventListener('change', storeSettings);
    domainInput.addEventListener('change', storeSettings);
    proxyInput.addEventListener('change', ensureOneEmptyContainer);
    domainInput.addEventListener('change', ensureOneEmptyContainer);

    list.appendChild(row);
}

function ensureOneEmptyContainer() {
    // Check to make sure there is at least one empty domain input and one empty proxy input
    let found = false;
    for (let row of containersList.children) {
        let domainInput = row.querySelector('input.userContent-domain');
        let proxyInput = row.querySelector('input.userContext-proxy');
        // Skip the header row
        if (domainInput == null && proxyInput == null) {
            continue;
        }
        if (domainInput.value === '' && proxyInput.value === '') {
            if (found) {
                row.remove();
            } else {
                found = true;
            }
        }
    }
    if (!found) {
        printContainerRow({
            "id": generateId(),
            "hostname": "",
            "proxy": {},
            "proxyString": ""
        }, containersList);
    }
}

async function setupContainerFields() {
    // See background.js for the structure of the domains object
    let storedSettings = await browser.storage.local.get();
    settings = storedSettings['domains'] || [];

    for (const domain of settings) {
        printContainerRow(domain, containersList);
    }

    ensureOneEmptyContainer();
}

setupContainerFields().catch(e => { console.log(e) });

function exportSettings() {
    const data = new Blob([JSON.stringify(settings)], { type: 'application/json' });
    const url = URL.createObjectURL(data);

    // Create a temporary a element to download the file
    const a = document.createElement('a');
    a.href = url;
    a.download = 'per-domain-proxy-settings.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function importSettings() {
    const file = importInput.files[0];
    if (!file) {
        return;
    }
    let contents = await file.text();
    let newDomainSettings = JSON.parse(contents);
    // Generate new IDs for the imported settings
    for (let domain of newDomainSettings) {
        domain["id"] = generateId();
    }
    settings = [...newDomainSettings];
    containersList.innerHTML = '';
    await browser.storage.local.set({ "domains": settings });
    await setupContainerFields();
}

function save() {
    // For each element in container that has the attribute data-identity-id run storeSettings
    containersList.querySelectorAll('[data-identity-id]').forEach(row => {
        storeSettings({ target: row });
        // Remove any row that have an empty domain or proxy
        if (row.querySelector('input.userContent-domain').value === '' || row.querySelector('input.userContext-proxy').value === '') {
            row.remove();
        }
    });

    ensureOneEmptyContainer();

    // turn the save button green for a second then back to normal
    saveButton.style.backgroundColor = 'green';
    setTimeout(() => {
        saveButton.style.backgroundColor = '';
    }, 1000);
}

importButton.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', importSettings);
exportButton.addEventListener('click', exportSettings);
saveButton.addEventListener('click', save);
