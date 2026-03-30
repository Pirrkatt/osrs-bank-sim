document.addEventListener('dragover', (e) => {
    if (document.body.classList.contains('dragging-item')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
});

const DragDrop = {
    makeDraggable(item) {
        item.addEventListener('dragstart', (e) => {
            const img = item.querySelector('img');
            
            if (img) {
                e.dataTransfer.setDragImage(img, 16, 16);
            }

            e.dataTransfer.setData('text/plain', item.id);
            e.dataTransfer.effectAllowed = 'move';

            setTimeout(() => {
                item.classList.add('dragging');
                document.body.classList.add('dragging-item');
            }, 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            document.body.classList.remove('dragging-item');
        });

        item.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    handleSwap(targetSlot, itemToPlace, isFromPanel) {
        if (targetSlot.firstElementChild) {
            if (isFromPanel) {
                targetSlot.removeChild(targetSlot.firstElementChild);
            } else {
                const existingItem = targetSlot.firstElementChild;
                const sourceSlot = itemToPlace.parentElement;
                if (sourceSlot && sourceSlot.classList.contains('slot')) {
                    sourceSlot.appendChild(existingItem);
                }
            }
        }
        targetSlot.appendChild(itemToPlace);
    },

    handleInsert(targetIndex, itemToPlace, isFromPanel, slots) {
        const currentItems = slots.map(s => s.firstElementChild);
        if (!isFromPanel) {
            const oldIndex = currentItems.indexOf(itemToPlace);
            if (oldIndex !== -1) currentItems.splice(oldIndex, 1);
        }
        currentItems.splice(targetIndex, 0, itemToPlace);
        const finalItems = currentItems.slice(0, slots.length);
        
        slots.forEach((slot, i) => {
            while (slot.firstChild) slot.removeChild(slot.firstChild);
            if (finalItems[i]) slot.appendChild(finalItems[i]);
        });
    }
};