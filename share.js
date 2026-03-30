document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('export-tab').addEventListener('click', () => {
        const layouts = StorageManager.getSavedLayouts();
        const activeLayout = layouts.find(l => l.id === StorageManager.currentActiveLayoutId);
        
        if (!activeLayout) return;

        const compressed = {};
        activeLayout.data.forEach((item, index) => {
            if (item) {
                const fileName = item.src.split('/').pop(); 
                compressed[index] = [fileName, item.name];
            }
        });

        const jsonString = JSON.stringify(compressed);
        const bytes = new TextEncoder().encode(jsonString);
        const encodedData = btoa(String.fromCodePoint(...bytes));

        navigator.clipboard.writeText(encodedData).then(() => {
            alert("Tab layout copied! This code contains only the current tab.");
        }).catch(err => {
            prompt("Copy this tab code:", encodedData);
        });
    });

    document.getElementById('import-tab').addEventListener('click', () => {
        const code = prompt("Paste the tab code here to import it as a new tab:");
        if (!code) return;

        try {
            const decodedData = decodeURIComponent(escape(atob(code)));
            const importedItems = JSON.parse(decodedData);

            if (Array.isArray(importedItems)) {
                let savedLayouts = StorageManager.getSavedLayouts();
                
                const newId = Date.now();
                
                savedLayouts.push({ 
                    id: newId, 
                    data: importedItems 
                });
                
                localStorage.setItem(StorageManager.CONFIG.storageKey, JSON.stringify(savedLayouts));
                
                StorageManager.currentActiveLayoutId = newId;
                
                const slots = Array.from(document.querySelectorAll('.slot'));
                StorageManager.loadLayout(importedItems, slots);
                StorageManager.renderTabs(slots);
                
                if (typeof updateBankCounter === 'function') {
                    updateBankCounter();
                }
                alert("Tab imported successfully!");
            } else {
                alert("Invalid tab code.");
            }
        } catch (err) {
            alert("Failed to import tab. Make sure the code is correct.");
            console.error(err);
        }
    });
});