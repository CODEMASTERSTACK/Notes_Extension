document.addEventListener('DOMContentLoaded', () => {
    const noteListView = document.getElementById('note-list-view');
    const noteEditorView = document.getElementById('note-editor-view');
    const notesListContainer = document.getElementById('notes-list');
    const emptyState = document.getElementById('empty-state');
    const editor = document.getElementById('editor');
    const newNoteBtn = document.getElementById('new-note-btn');
    const backBtn = document.getElementById('back-btn');
    const deleteBtn = document.getElementById('delete-note-btn');
    const formatBtns = document.querySelectorAll('.format-btn[data-command]');
    const colorPicker = document.getElementById('foreColor-btn');
    const fontSelector = document.getElementById('fontName-btn');
    const fontSizeSelector = document.getElementById('fontSize-btn');
    const bgColorSelector = document.getElementById('bgColor-btn');
    const exportSelector = document.getElementById('export-btn');

    let currentNoteId = null;

    // Initial Load
    loadNotes();

    // Navigation handlers
    newNoteBtn.addEventListener('click', () => {
        currentNoteId = Date.now().toString();
        editor.innerHTML = '';
        showEditor();
    });

    backBtn.addEventListener('click', () => {
        saveCurrentNote(); // Ensure saved before going back
        showList();
        loadNotes(); // Refresh list to show updates
    });

    // Delete Note
    deleteBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this note?')) {
            deleteCurrentNote();
        }
    });

    // Color Picker
    colorPicker.addEventListener('input', (e) => {
        editor.focus();
        document.execCommand('foreColor', false, e.target.value);
    });

    // Font Selector
    fontSelector.addEventListener('change', (e) => {
        editor.focus();
        document.execCommand('fontName', false, e.target.value);
    });

    // Font Size Selector
    fontSizeSelector.addEventListener('change', (e) => {
        editor.focus();
        document.execCommand('fontSize', false, e.target.value);
    });

    // Background Color Selector
    bgColorSelector.addEventListener('change', (e) => {
        const color = e.target.value;
        const defaultColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');

        editor.style.backgroundColor = color || '';

        // Auto-contrast text for light backgrounds if we are in dark mode
        // For simplicity, if a specific color is chosen (not default), we force black text because our palette is pastel/light.
        // If default is chosen, we clear the inline style to let CSS handle it.
        if (color) {
            editor.style.color = '#1f2937'; // Dark gray text for pastel backgrounds
        } else {
            editor.style.color = ''; // Reset to theme default
        }

        saveCurrentNote();
    });

    // Export Selector
    exportSelector.addEventListener('change', (e) => {
        const format = e.target.value;
        if (format) {
            exportNote(format);
            exportSelector.value = ""; // Reset dropdown
        }
    });

    // Editor formatting
    formatBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent focus loss
            const command = btn.dataset.command;
            const value = btn.dataset.value || null;
            document.execCommand(command, false, value);
            editor.focus(); // Keep focus
        });
    });

    // Auto-save on input with debounce (simplified here just direct save for responsiveness)
    editor.addEventListener('input', () => {
        saveCurrentNote();
    });

    // Storage listener for background updates
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.notes) {
            // If we are in list view, refresh. If in editor, only refresh if it's not the current note (conflict resolution simplified)
            if (!noteEditorView.classList.contains('hidden')) {
                // If a new note was added via context menu while editing another note, just let it be.
                // Real-time sync for list view:
                return;
            }
            loadNotes();
        }
    });

    function showEditor() {
        noteListView.classList.add('hidden');
        noteEditorView.classList.remove('hidden');
        newNoteBtn.classList.add('hidden'); // Hide new note button in editor
        editor.focus();
    }

    function showList() {
        noteEditorView.classList.add('hidden');
        noteListView.classList.remove('hidden');
        newNoteBtn.classList.remove('hidden');
    }

    function loadNotes() {
        chrome.storage.local.get({ notes: [] }, (result) => {
            const notes = result.notes;
            renderNotesList(notes);
        });
    }

    function renderNotesList(notes) {
        notesListContainer.innerHTML = '';

        if (notes.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        notes.forEach(note => {
            const el = document.createElement('div');
            el.className = 'note-item';

            const titleInput = document.createElement('input');
            titleInput.className = 'note-title-input';
            titleInput.value = note.title || 'New Note';
            titleInput.placeholder = 'Title';

            // Save title on change
            titleInput.addEventListener('change', (e) => {
                const newTitle = e.target.value;
                updateNoteTitle(note.id, newTitle);
            });

            titleInput.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent opening the note when clicking input
            });

            // Auto-resize or style needs? Just CSS.

            const date = document.createElement('div');
            date.className = 'note-date';
            date.textContent = new Date(note.date).toLocaleDateString() + ' ' + new Date(note.date).toLocaleTimeString();

            el.appendChild(titleInput);
            el.appendChild(date);

            el.addEventListener('click', () => {
                openNote(note);
            });

            notesListContainer.appendChild(el);
        });
    }

    function updateNoteTitle(id, newTitle) {
        chrome.storage.local.get({ notes: [] }, (result) => {
            let notes = result.notes;
            const index = notes.findIndex(n => n.id === id);
            if (index > -1) {
                notes[index].title = newTitle;
                notes[index].manualTitle = true; // Flag to stop auto-updates
                chrome.storage.local.set({ notes: notes });
            }
        });
    }

    function openNote(note) {
        currentNoteId = note.id;
        editor.innerHTML = note.content;

        // Apply saved background color
        const savedBg = note.backgroundColor || '';
        bgColorSelector.value = savedBg;
        editor.style.backgroundColor = savedBg;

        if (savedBg) {
            editor.style.color = '#1f2937';
        } else {
            editor.style.color = '';
        }

        showEditor();
    }

    function saveCurrentNote() {
        if (!currentNoteId) return;

        const content = editor.innerHTML;
        chrome.storage.local.get({ notes: [] }, (result) => {
            let notes = result.notes;
            const index = notes.findIndex(n => n.id === currentNoteId);

            // Determine title: Use existing manual title if set, otherwise derive from content
            let title = 'New Note';
            let manualTitle = false;

            if (index > -1 && notes[index].manualTitle) {
                title = notes[index].title;
                manualTitle = true;
            } else {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                const plainText = tempDiv.textContent || '';
                title = plainText.substring(0, 30) + (plainText.length > 30 ? '...' : '');
                if (!title) title = 'New Note';
            }

            const updatedNote = {
                id: currentNoteId,
                title: title,
                content: content,
                date: new Date().toISOString(),
                backgroundColor: bgColorSelector.value,
                manualTitle: manualTitle, // Persist flag
                source: index > -1 ? notes[index].source : null
            };

            if (index > -1) {
                notes[index] = updatedNote;
            } else {
                notes.unshift(updatedNote);
            }

            // We turn off the listener temporarily or handle the loop logic?
            // Actually `chrome.storage.onChanged` will fire. We relied on the fact that if editor is open we ignore it in the listener.
            chrome.storage.local.set({ notes: notes });
        });
    }

    function deleteCurrentNote() {
        if (!currentNoteId) return;

        chrome.storage.local.get({ notes: [] }, (result) => {
            let notes = result.notes;
            notes = notes.filter(n => n.id !== currentNoteId);

            chrome.storage.local.set({ notes: notes }, () => {
                showList();
                loadNotes();
                currentNoteId = null; // Reset
            });
        });
    }

    function exportNote(format) {
        if (!currentNoteId) return;

        const title = document.querySelector('.note-title-input')?.value || 'Note'; // Get current title from list input if available
        // Need to fetch fresh state or use editor content directly
        const content = editor.innerHTML;
        const bgColor = editor.style.backgroundColor || '#ffffff';

        // Use a safe title for filename
        const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        if (format === 'text') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            const text = tempDiv.textContent || tempDiv.innerText || '';
            downloadFile(filename + '.txt', text, 'text/plain');
        }
        else if (format === 'word') {
            const html = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'></head>
                <body style="background-color: ${bgColor}; font-family: sans-serif;">
                    <h1>${title}</h1>
                    ${content}
                </body>
                </html>
            `;
            downloadFile(filename + '.doc', html, 'application/msword');
        }
        else if (format === 'pdf') {
            const element = document.createElement('div');
            element.innerHTML = `
                <div style="font-family: sans-serif; padding: 20px; background-color: ${bgColor}; color: ${editor.style.color || 'inherit'};">
                    <h1 style="border-bottom: 1px solid #ccc; padding-bottom: 10px;">${title}</h1>
                    ${content}
                </div>
            `;

            const opt = {
                margin: 0.5,
                filename: filename + '.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            // New Promise-based usage
            html2pdf().set(opt).from(element).save();
        }
    }

    function downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
});
