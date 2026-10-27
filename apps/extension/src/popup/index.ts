document.addEventListener('DOMContentLoaded', () => {
  const apiTokenInput = document.getElementById('apiToken') as HTMLInputElement;
  const saveButton = document.getElementById('saveToken') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;

  // Load saved token
  chrome.storage.local.get(['apiToken'], (result) => {
    if (result.apiToken) {
      apiTokenInput.value = result.apiToken;
    }
  });

  // Save token
  saveButton.addEventListener('click', () => {
    const token = apiTokenInput.value.trim();
    
    if (!token) {
      showStatus('Please enter an API token', 'error');
      return;
    }

    chrome.storage.local.set({ apiToken: token }, () => {
      showStatus('Token saved successfully!', 'success');
    });
  });

  function showStatus(message: string, type: 'success' | 'error') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
