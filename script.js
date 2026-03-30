document.addEventListener('DOMContentLoaded', () => {
    const itemList = document.querySelector('.item-list');
    const slots = Array.from(document.querySelectorAll('.slot'));
    const swapBtn = document.getElementById('swap-btn');
    const insertBtn = document.getElementById('insert-btn');
    const saveLayoutBtn = document.getElementById('save-layout');
    const searchInput = document.getElementById('item-search');
    const clearBtn = document.getElementById('clear-search');
    const bankContainer = document.querySelector('.bank');
    const autosaveBtn = document.getElementById('autosave-toggle');

    let dragMode = 'swap';

    // Init storage tabs
    StorageManager.init(slots);
    updateBankCounter();

    // Fetch items
    fetch("equipment.json")
        .then(r => r.json())
        .then(items => {
            itemList.innerHTML = "";
            items.forEach((item, index) => {
                if (!item.image) return;
                const div = document.createElement("div");
                div.className = "item";
                div.id = `item-source-${index}`; 
                div.draggable = true;
                div.innerHTML = `<img loading="lazy" src="cdn/items/${item.image}" title="${item.name}" onerror="this.parentElement.remove();">`;
                itemList.appendChild(div);
                DragDrop.makeDraggable(div);
            });
        });

    // Button Listeners
    swapBtn.addEventListener('click', () => { dragMode = 'swap'; swapBtn.classList.add('active'); insertBtn.classList.remove('active'); });
    insertBtn.addEventListener('click', () => { dragMode = 'insert'; insertBtn.classList.add('active'); swapBtn.classList.remove('active'); });
    saveLayoutBtn.addEventListener('click', () => StorageManager.createNewLayout(slots));
    autosaveBtn.addEventListener('click', () => {
        StorageManager.toggleAutosave(autosaveBtn);

        // Save immediately if toggled on just to make sure
        if (StorageManager.isAutosaveEnabled) {
            StorageManager.autoSave(slots);
        }
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        const query = searchInput.value.toLowerCase().trim();

        clearBtn.style.display = query.length > 0 ? 'flex' : 'none';

        const items = document.querySelectorAll('.item-list .item');
        items.forEach(item => {
            const img = item.querySelector('img');
            const itemName = img ? (img.title || "").toLowerCase() : "";
            item.classList.toggle('hidden', !itemName.includes(query));
        });
    });

    // Button: Clear Search
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchInput.focus();

        // Show all items again
        const items = document.querySelectorAll('.item-list .item');
        items.forEach(item => item.classList.remove('hidden'));
    });

    // Slot Listeners
    slots.forEach((slot, index) => {
        slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('over'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('over'));
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('over');
            const id = e.dataTransfer.getData('text/plain');
            const dragged = document.getElementById(id);
            if (!dragged) return;

            let itemToPlace = dragged;
            if (dragged.parentElement === itemList) {
                itemToPlace = dragged.cloneNode(true);
                itemToPlace.id = `bank-item-${Date.now()}`;
                itemToPlace.classList.remove('dragging');
                DragDrop.makeDraggable(itemToPlace);
            }

            if (dragMode === 'swap') DragDrop.handleSwap(slot, itemToPlace, dragged.parentElement === itemList);
            else DragDrop.handleInsert(index, itemToPlace, dragged.parentElement === itemList, slots);

            StorageManager.autoSave(slots);
            updateBankCounter();
        });
        slot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (slot.firstElementChild) {
              slot.removeChild(slot.firstElementChild);
              StorageManager.autoSave(slots);
              updateBankCounter();
            }
        });
    });

    bankContainer.addEventListener('contextmenu', (e) => {
      const isItem = e.target.closest('.item');
      const isButton = e.target.closest('button');
      const isSlot = e.target.closest('.slot');

      if (isSlot || isItem) {
          e.preventDefault();
          return;
      }

      if (!isButton) {
          e.preventDefault();
      }
  });
});

function updateBankCounter() {
    const slots = document.querySelectorAll('.bank-grid .slot');
    let filledCount = 0;
    slots.forEach(slot => {
        if (slot.firstElementChild) filledCount++;
    });
    const counter = document.getElementById('current-count');
    if (counter) counter.textContent = filledCount;
}