document.addEventListener('DOMContentLoaded', () => {
    let copyTimeout;
    let itemsMap = null;

    // Lazy-load and map items.json for faster lookups during import
    const getItemsMap = async () => {
        if (itemsMap) return itemsMap;
        try {
            const r = await fetch("./cdn/json/items.json");
            const items = await r.json();
            itemsMap = new Map(items.map(i => [String(i.id), i]));
            return itemsMap;
        } catch (e) {
            console.error("Failed to load item database:", e);
            return new Map();
        }
    };

    document.body.insertAdjacentHTML('beforeend', `
        <div id="share-modal" class="modal-overlay">
            <div class="modal-content">
                <h2 id="modal-title"></h2>
                <p id="modal-desc"></p>
                <textarea id="modal-text" spellcheck="false"></textarea>
                <p id="modal-error" class="modal-error"></p>
                <div class="modal-buttons">
                    <button id="modal-action-btn" class="side-btn primary"></button>
                    <button id="modal-close-btn" class="side-btn">Close</button>
                </div>
            </div>
        </div>
    `);

    const modal = document.getElementById('share-modal');
    const mTitle = document.getElementById('modal-title');
    const mDesc = document.getElementById('modal-desc');
    const mText = document.getElementById('modal-text');
    const mError = document.getElementById('modal-error');
    const mActionBtn = document.getElementById('modal-action-btn');
    const mCloseBtn = document.getElementById('modal-close-btn');

    const resetModal = () => {
        if (copyTimeout) {
            clearTimeout(copyTimeout);
            copyTimeout = null;
        }
        mError.style.display = 'none';
        mError.innerText = '';
        mText.value = '';
    };

    const closeModal = () => {
        resetModal();
        modal.style.display = 'none';
    };

    const openModal = (title, desc, btnText, isReadonly) => {
        resetModal();
        mTitle.innerText = title;
        mDesc.innerText = desc;
        mActionBtn.innerText = btnText;
        mText.readOnly = isReadonly;
        modal.style.display = 'flex';
    };

    mCloseBtn.onclick = closeModal;
    modal.onclick = (e) => { if(e.target === modal) closeModal(); };

    document.getElementById('export-tab').addEventListener('click', () => {
        const layouts = StorageManager.getSavedLayouts();
        const activeLayout = layouts.find(l => String(l.id) === String(StorageManager.currentActiveLayoutId));
        
        if (!activeLayout) return;

        // Version 2: Simple array of IDs
        const data = {
            v: 2,
            s: activeLayout.data.map(item => (item && (item.id !== undefined && item.id !== null && item.id !== '')) ? parseInt(item.id) : -1)
        };

        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(data));
        openModal("Export Tab", "Copy the code below to share this tab:", "Copy Code", true);
        mText.value = compressed;
        
        mActionBtn.onclick = () => {
            navigator.clipboard.writeText(compressed).then(() => {
                if (modal.style.display === 'none') return;
                if (copyTimeout) clearTimeout(copyTimeout);
                mActionBtn.innerText = "Code Copied!";
                copyTimeout = setTimeout(() => mActionBtn.innerText = "Copy Code", 2000);
            });
        };
    });

    document.getElementById('import-tab').addEventListener('click', () => {
        openModal("Import Tab", "Paste the code below to import it as a new tab:", "Import Tab", false);

        mActionBtn.onclick = async () => {
            const code = mText.value.trim();
            if (!code) return;

            try {
                const savedLayouts = StorageManager.getSavedLayouts();
                if (savedLayouts.length >= 10) {
                    throw new Error("You already have the maximum amount of tabs (10).");
                }

                const json = LZString.decompressFromEncodedURIComponent(code);
                if (!json) throw new Error("The code is invalid or corrupted.");

                const data = JSON.parse(json);
                let tabData = [];

                if (data.v === 2 && Array.isArray(data.s)) {
                    const map = await getItemsMap();
                    tabData = data.s.map(id => {
                        if (id === -1) return null;
                        const item = map.get(String(id));
                        return item ? { 
                            id: item.id, 
                            src: `cdn/items/${item.image}`, 
                            name: item.name 
                        } : null;
                    });
                } else {
                    throw new Error("Unsupported or invalid format version.");
                }

                const slots = Array.from(document.querySelectorAll('.slot'));
                while (tabData.length < slots.length) tabData.push(null);

                const newId = `layout-${Date.now()}`;
                savedLayouts.push({ id: newId, data: tabData });
                localStorage.setItem(StorageManager.CONFIG.storageKey, JSON.stringify(savedLayouts));

                StorageManager.currentActiveLayoutId = newId;
                StorageManager.loadLayout(tabData, slots);
                StorageManager.renderTabs(slots);
                StorageManager.updateAddTabButtonState();
                closeModal();
            } catch (err) {
                mError.innerText = "Import Failed:\n" + err.message;
                mError.style.display = 'block';
            }
        };
    });
});