document.addEventListener('DOMContentLoaded', () => {
    let copyTimeout;

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

        const data = {
            v: 1,
            s: activeLayout.data.map(item => {
                if (!item || !item.src) return 0;
                const filename = decodeURIComponent(item.src.split('/').pop());
                return [filename, item.name];
            })
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

        mActionBtn.onclick = () => {
            const code = mText.value.trim();
            if (!code) return;

            try {
                const savedLayouts = StorageManager.getSavedLayouts();
                if (savedLayouts.length >= 10) {
                    mError.innerText = "Import Failed:\nYou already have the maximum amount of tabs.\nRemove one and try again.";
                    mError.style.display = 'block';
                    return;
                }

                const json = LZString.decompressFromEncodedURIComponent(code);
                if (!json) throw new Error();

                const data = JSON.parse(json);
                if (data.v !== 1 || !Array.isArray(data.s)) throw new Error();

                const slots = Array.from(document.querySelectorAll('.slot'));
                const tabData = data.s.map(item => {
                    if (!item || item === 0) return null;
                    return {
                        src: `cdn/items/${item[0]}`,
                        name: item[1]
                    };
                });

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
                mError.innerText = "Import Failed:\nThe code is invalid or corrupted.";
                mError.style.display = 'block';
            }
        };
    });
});