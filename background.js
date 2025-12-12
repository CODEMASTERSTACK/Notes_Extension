chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-notes",
    title: "Save to Notes",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-notes" && info.selectionText) {
    const newNote = {
      id: Date.now().toString(),
      title: info.selectionText.substring(0, 30) + "...",
      content: info.selectionText, // Initial content as plain text, will be HTML editable later
      date: new Date().toISOString(),
      source: info.pageUrl
    };

    chrome.storage.local.get({ notes: [] }, (result) => {
      const notes = result.notes;
      notes.unshift(newNote); // Add to top
      chrome.storage.local.set({ notes: notes });
    });
  }
});
