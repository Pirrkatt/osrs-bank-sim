const StorageManager = {
    currentActiveLayoutId: null,
    isAutosaveEnabled: false,

    CONFIG: {
        maxSavedLayouts: 9,
        storageKey: 'bank_layouts_data',
        startTop: 47,
        startLeft: 58
    },

    init(slots) {
        let layouts = this.getSavedLayouts();
        if (layouts.length === 0) {
            // Guarantee at least 1 tab
            layouts.push({ id: 'default', data: new Array(slots.length).fill(null) });
            localStorage.setItem(this.CONFIG.storageKey, JSON.stringify(layouts));
        }

        const savedAutosave = localStorage.getItem('bank_autosave_enabled');
        this.isAutosaveEnabled = savedAutosave === 'true';

        const autosaveBtn = document.getElementById('autosave-toggle');
        if (autosaveBtn) {
            this.updateAutosaveButton(autosaveBtn);
        }

        this.currentActiveLayoutId = layouts[0].id;
        this.loadLayout(layouts[0].data, slots);
        this.renderTabs(slots);
    },

    autoSave(slots) {
        if (!this.isAutosaveEnabled || !this.currentActiveLayoutId) return;

        let layouts = this.getSavedLayouts();
        const index = layouts.findIndex(l => l.id === this.currentActiveLayoutId);
        
        if (index !== -1) {
            layouts[index].data = this.captureLayout(slots);
            localStorage.setItem(this.CONFIG.storageKey, JSON.stringify(layouts));
            console.log("Autosaved!");
        }
    },

    toggleAutosave(button) {
        this.isAutosaveEnabled = !this.isAutosaveEnabled;
        this.updateAutosaveButton(button);

        localStorage.setItem('bank_autosave_enabled', this.isAutosaveEnabled);
    },

    updateAutosaveButton(button) {
        button.innerText = `Auto-Save: ${this.isAutosaveEnabled ? 'ON' : 'OFF'}`;

        if (this.isAutosaveEnabled) {
            button.classList.add('enabled');
        } else {
            button.classList.remove('enabled');
        }
    },

    createNewLayout(slots) {
        let savedLayouts = this.getSavedLayouts();
        if (savedLayouts.length >= this.CONFIG.maxSavedLayouts) {
            alert(`Max ${this.CONFIG.maxSavedLayouts} tabs allowed.`);
            return;
        }

        const newEmptyData = new Array(slots.length).fill(null);
        const newId = `layout-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        savedLayouts.push({ id: newId, data: newEmptyData });
        localStorage.setItem(this.CONFIG.storageKey, JSON.stringify(savedLayouts));
        
        this.currentActiveLayoutId = newId;
        this.loadLayout(newEmptyData, slots);
        this.renderTabs(slots);
    },

    captureLayout(slots) {
        return slots.map(slot => {
            const item = slot.firstElementChild;
            if (!item) return null;
            const img = item.querySelector('img');
            return { src: img.getAttribute('src'), name: img.title };
        });
    },

    overwriteLayout(layoutId, slots) {
        let layouts = this.getSavedLayouts();
        const index = layouts.findIndex(l => l.id === layoutId);
        if (index !== -1) {
            layouts[index].data = this.captureLayout(slots);
            localStorage.setItem(this.CONFIG.storageKey, JSON.stringify(layouts));
        }
    },

    getSavedLayouts() {
        return JSON.parse(localStorage.getItem(this.CONFIG.storageKey) || "[]");
    },

    deleteLayout(layoutId, slots) {
        let layouts = this.getSavedLayouts();

        if (layouts.length <= 1) return;

        layouts = layouts.filter(l => l.id !== layoutId);
        localStorage.setItem(this.CONFIG.storageKey, JSON.stringify(layouts));

        if (this.currentActiveLayoutId === layoutId) {
            this.currentActiveLayoutId = layouts[0].id;
            this.loadLayout(layouts[0].data, slots);
        }
        this.renderTabs(slots);
    },

    renderTabs(slots) {
        let container = document.getElementById('layout-tabs-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'layout-tabs-container';
            container.style.top = `${this.CONFIG.startTop}px`;
            container.style.left = `${this.CONFIG.startLeft}px`;
            document.querySelector('.bank').appendChild(container);
        }

        const layouts = this.getSavedLayouts();
        container.innerHTML = "";

        layouts.forEach((layout, index) => {
            const btn = document.createElement('button');
            btn.className = 'layout-tab';
            
            if (this.currentActiveLayoutId === layout.id) {
                btn.classList.add('active');
            }

            btn.innerHTML = `<span>${index + 1}</span>`;
            
            btn.onclick = () => {
                this.currentActiveLayoutId = layout.id;
                
                const freshLayouts = this.getSavedLayouts();
                const clickedLayout = freshLayouts.find(l => l.id === layout.id);
                
                if (clickedLayout) {
                    this.loadLayout(clickedLayout.data, slots);
                }

                this.renderTabs(slots);
            };

            btn.oncontextmenu = (e) => {
                e.preventDefault();
                this.showContextMenu(e.pageX, e.pageY, layout.id, slots, layouts.length > 1);
            };
            container.appendChild(btn);
        });
    },

    showContextMenu(x, y, layoutId, slots, canDelete) {
        let menu = document.getElementById('tab-context-menu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'tab-context-menu';
            document.body.appendChild(menu);
        }
        
        let html = `<div class="menu-item" id="menu-overwrite">Save to Tab</div>`;
        if (canDelete) {
            html += `<div class="menu-item" id="menu-delete" style="color: #ff4d4d;">Delete Tab</div>`;
        }

        menu.innerHTML = html;
        menu.style.display = 'block';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        document.getElementById('menu-overwrite').onclick = () => {
            this.overwriteLayout(layoutId, slots);
            menu.style.display = 'none';
        };

        if (canDelete) {
            document.getElementById('menu-delete').onclick = () => {
                this.deleteLayout(layoutId, slots);
                menu.style.display = 'none';
            };
        }

        const close = () => { menu.style.display = 'none'; document.removeEventListener('click', close); };
        setTimeout(() => document.addEventListener('click', close), 10);
    },

    loadLayout(data, slots) {
        slots.forEach((slot, i) => {
            while (slot.firstChild) slot.removeChild(slot.firstChild);
            if (data && data[i]) {
                const div = document.createElement("div");
                div.className = "item";
                div.id = `loaded-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
                div.draggable = true;
                div.innerHTML = `<img src="${data[i].src}" title="${data[i].name}">`;
                slot.appendChild(div);
                DragDrop.makeDraggable(div);
            }
        });

        if (typeof updateBankCounter === 'function') {
            updateBankCounter();
        }
    }
};