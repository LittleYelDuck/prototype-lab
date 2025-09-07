class MemoryCardsApp {
    constructor() {
        this.memories = [];
        this.editingIndex = -1;
        this.deleteIndex = -1;
        this.init();
    }

    init() {
        this.loadMemories();
        this.bindEvents();
        this.renderMemories();
        this.setDefaultDate();
    }

    bindEvents() {
        document.getElementById('addBtn').addEventListener('click', () => this.openModal());
        document.getElementById('heroAddBtn').addEventListener('click', () => this.openModal());
        document.getElementById('closeBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('memoryForm').addEventListener('submit', (e) => this.saveMemory(e));
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.closeModal();
            }
        });
        
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());
        document.getElementById('deleteModalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('deleteModalOverlay')) {
                this.closeDeleteModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('memoryDate').value = today;
    }

    openModal(index = -1) {
        this.editingIndex = index;
        const modal = document.getElementById('modalOverlay');
        const form = document.getElementById('memoryForm');
        const title = document.getElementById('modalTitle');
        const saveBtn = document.getElementById('saveBtn');

        if (index >= 0) {
            title.textContent = 'Edit Memory';
            saveBtn.textContent = 'Update Memory';
            this.populateForm(this.memories[index]);
        } else {
            title.textContent = 'Add New Memory';
            saveBtn.textContent = 'Save Memory';
            form.reset();
            this.setDefaultDate();
        }

        modal.classList.add('active');
        document.getElementById('childName').focus();
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('modalOverlay');
        modal.classList.remove('active');
        document.getElementById('memoryForm').reset();
        this.editingIndex = -1;
        document.body.style.overflow = 'auto';
    }

    populateForm(memory) {
        document.getElementById('childName').value = memory.childName || '';
        document.getElementById('childAge').value = memory.childAge || '';
        document.getElementById('memoryText').value = memory.text || '';
        document.getElementById('memoryDate').value = memory.date || '';
    }

    saveMemory(e) {
        e.preventDefault();
        
        const formData = {
            childName: document.getElementById('childName').value.trim(),
            childAge: document.getElementById('childAge').value.trim(),
            text: document.getElementById('memoryText').value.trim(),
            date: document.getElementById('memoryDate').value,
            timestamp: Date.now()
        };

        if (!formData.text) {
            this.showNotification('Please enter what your child said!', 'error');
            return;
        }

        if (!formData.date) {
            this.showNotification('Please select a date!', 'error');
            return;
        }

        if (this.editingIndex >= 0) {
            formData.timestamp = this.memories[this.editingIndex].timestamp;
            this.memories[this.editingIndex] = formData;
            this.showNotification('Memory updated successfully! 💕', 'success');
        } else {
            this.memories.push(formData);
            this.showNotification('Memory saved successfully! 🌟', 'success');
        }

        this.saveMemories();
        this.renderMemories();
        this.closeModal();
    }

    openDeleteModal(index) {
        this.deleteIndex = index;
        const modal = document.getElementById('deleteModalOverlay');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeDeleteModal() {
        const modal = document.getElementById('deleteModalOverlay');
        modal.classList.remove('active');
        this.deleteIndex = -1;
        document.body.style.overflow = 'auto';
    }

    confirmDelete() {
        if (this.deleteIndex >= 0) {
            this.memories.splice(this.deleteIndex, 1);
            this.saveMemories();
            this.renderMemories();
            this.showNotification('Memory deleted', 'info');
        }
        this.closeDeleteModal();
    }

    renderMemories() {
        const container = document.getElementById('memoriesContainer');
        const emptyState = document.getElementById('emptyState');

        if (this.memories.length === 0) {
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        const sortedMemories = [...this.memories].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        container.innerHTML = '';
        
        sortedMemories.forEach((memory, index) => {
            const originalIndex = this.memories.findIndex(m => 
                m.timestamp === memory.timestamp
            );
            const card = this.createMemoryCard(memory, originalIndex);
            container.appendChild(card);
        });
    }

    createMemoryCard(memory, index) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        
        const formattedDate = new Date(memory.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Assign character based on index (rotate through 8 characters)
        const characterNumber = (index % 8) + 1;
        const characterPath = `images/character${characterNumber}.jpg`;

        card.innerHTML = `
            <div class="card-sparkles">
                <span class="card-sparkle">✨</span>
                <span class="card-sparkle">💫</span>
                <span class="card-sparkle">⭐</span>
                <span class="card-sparkle">🌟</span>
            </div>
            <div class="card-character-section">
                <img src="${characterPath}" alt="Cute character ${characterNumber}" class="memory-card-character">
                <div class="character-decorations">
                    <span class="heart-float heart-1">💕</span>
                    <span class="heart-float heart-2">💖</span>
                    <span class="heart-float heart-3">🌸</span>
                </div>
            </div>
            <div class="card-content">
                <div class="card-header">
                    ${memory.childName ? `<h3 class="child-name">${this.escapeHtml(memory.childName)}</h3>` : '<h3 class="child-name">Sweet Memory</h3>'}
                    ${memory.childAge ? `<div class="child-age">${this.escapeHtml(memory.childAge)}</div>` : ''}
                </div>
                <div class="memory-text">${this.escapeHtml(memory.text)}</div>
                <div class="memory-date">${formattedDate}</div>
            </div>
            <div class="card-actions">
                <button class="card-action-btn edit-btn" onclick="app.openModal(${index})" title="Edit memory">
                    <span class="btn-icon">✏️</span>
                    <span class="btn-text">Edit</span>
                </button>
                <button class="card-action-btn delete-btn" onclick="app.openDeleteModal(${index})" title="Delete memory">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Delete</span>
                </button>
            </div>
        `;

        return card;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                ${message}
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#00b894' : type === 'error' ? '#e17055' : '#74b9ff'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            font-weight: 500;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);

        if (!document.querySelector('style[data-notifications]')) {
            const style = document.createElement('style');
            style.setAttribute('data-notifications', 'true');
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    loadMemories() {
        try {
            const stored = localStorage.getItem('kidsMemories');
            this.memories = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading memories:', error);
            this.memories = [];
        }
    }

    saveMemories() {
        try {
            localStorage.setItem('kidsMemories', JSON.stringify(this.memories));
        } catch (error) {
            console.error('Error saving memories:', error);
            this.showNotification('Error saving memory. Please try again.', 'error');
        }
    }

    exportMemories() {
        if (this.memories.length === 0) {
            this.showNotification('No memories to export!', 'info');
            return;
        }

        const dataStr = JSON.stringify(this.memories, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `kids-memories-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showNotification('Memories exported successfully! 📁', 'success');
    }

    importMemories(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedMemories = JSON.parse(e.target.result);
                if (Array.isArray(importedMemories)) {
                    this.memories = [...this.memories, ...importedMemories];
                    this.saveMemories();
                    this.renderMemories();
                    this.showNotification('Memories imported successfully! 🎉', 'success');
                } else {
                    throw new Error('Invalid format');
                }
            } catch (error) {
                this.showNotification('Error importing file. Please check the format.', 'error');
            }
        };
        reader.readAsText(file);
    }
}

const app = new MemoryCardsApp();

function handleImport(input) {
    const file = input.files[0];
    if (file) {
        app.importMemories(file);
        input.value = '';
    }
}