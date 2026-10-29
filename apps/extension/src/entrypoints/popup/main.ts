import type { Request, Response } from '../../lib/messages';

const tokenInput = document.getElementById('apiToken') as HTMLInputElement;
const saveButton = document.getElementById('saveToken') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;

function showStatus(message: string, type: 'success' | 'error') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';
}

async function testConnection() {
  const response: Response<{ org: string; user: string }> = await browser.runtime.sendMessage({ type: 'whoami' } satisfies Request);
  if (response.ok) showStatus(`Connected to ${response.data.org} as ${response.data.user}`, 'success');
  else showStatus(response.error, 'error');
}

browser.storage.local.get('apiToken').then(({ apiToken }) => {
  if (apiToken) {
    tokenInput.value = apiToken;
    testConnection();
  }
});

saveButton.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showStatus('Please enter an API token', 'error');
    return;
  }
  await browser.storage.local.set({ apiToken: token });
  await testConnection();
});
