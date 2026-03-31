document.addEventListener('DOMContentLoaded', () => {
    let copyTimeout;
    let itemsMap = null;

    // Lazy-load and map items.json for faster lookups during import
    const getItemsMap = async () => {
        if (itemsMap) return itemsMap;
        try {
            const r = await fetch("./cdn/json/items.json");
            const items = await r.json();

            // Store as Map for O(1) lookup
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

        if (!isReadonly) {
            mText.focus();
        }
    };

    mCloseBtn.onclick = closeModal;
    modal.onclick = (e) => { if(e.target === modal) closeModal(); };

    // Version 3: Ultra-compact sparse Base36 export
    document.getElementById('export-tab').addEventListener('click', () => {
        const layouts = StorageManager.getSavedLayouts();
        const activeLayout = layouts.find(l => String(l.id) === String(StorageManager.currentActiveLayoutId));
        
        if (!activeLayout) return;

        // Create a string: "v3|index36:id36|index36:id36..."
        // Only include slots that actually have an item
        const packedData = activeLayout.data.reduce((acc, item, index) => {
            if (item && item.id !== undefined && item.id !== null) {
                const b36Index = index.toString(36);
                const b36Id = parseInt(item.id).toString(36);
                acc.push(`${b36Index}:${b36Id}`);
            }
            return acc;
        }, ["v3"]).join('|');

        const compressed = LZString.compressToEncodedURIComponent(packedData);
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

    // Version 3: Ultra-compact import
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

                const rawData = LZString.decompressFromEncodedURIComponent(code);
                if (!rawData) throw new Error("The code is invalid or corrupted.");

                const parts = rawData.split('|');
                const version = parts.shift(); // Remove and get the version (e.g., "v3")

                if (version !== 'v3') {
                    throw new Error("Unsupported format version. This importer requires v3.");
                }

                const slots = Array.from(document.querySelectorAll('.slot'));
                const tabData = new Array(slots.length).fill(null);
                const map = await getItemsMap();

                parts.forEach(entry => {
                    const [b36Index, b36Id] = entry.split(':');
                    const realIndex = parseInt(b36Index, 36);
                    const realId = parseInt(b36Id, 36);
                    
                    const item = map.get(String(realId));
                    if (item && realIndex < tabData.length) {
                        tabData[realIndex] = { 
                            id: item.id, 
                            src: `cdn/items/${item.image}`, 
                            name: item.name 
                        };
                    }
                });

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