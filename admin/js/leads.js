let currentPage = 1;

async function loadLeads(page = 1) {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/leads?page=${page}&limit=10`);
    const data = await response.json();
    
    if (data.success) {
      currentPage = page;
      renderLeads(data.data.items);
      // Optional: render pagination controls if data.data.meta is used
    }
  } catch (err) {
    console.error('Failed to load leads', err);
    document.getElementById('leadsTableBody').innerHTML = '<tr><td colspan="6">Error loading leads</td></tr>';
  }
}

function renderLeads(leads) {
  const tbody = document.getElementById('leadsTableBody');
  
  if (!leads || leads.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No leads found</td></tr>';
    return;
  }
  
  tbody.innerHTML = leads.map(lead => `
    <tr>
      <td>${new Date(lead.createdAt).toLocaleDateString()}</td>
      <td>${escapeHtml(lead.name)}</td>
      <td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td>
      <td>${escapeHtml(lead.projectType || '-')}</td>
      <td>
        <select onchange="updateLeadStatus('${lead.id}', this.value)" class="status-badge status-${lead.status.toLowerCase()}">
          <option value="new" ${lead.status === 'new' || lead.status === 'NEW' ? 'selected' : ''}>New</option>
          <option value="contacted" ${lead.status === 'contacted' || lead.status === 'CONTACTED' ? 'selected' : ''}>Contacted</option>
          <option value="converted" ${lead.status === 'converted' || lead.status === 'CONVERTED' ? 'selected' : ''}>Converted</option>
        </select>
      </td>
      <td>
        <button class="button button--small button--outline" onclick="viewLeadMessage('${escapeHtml(lead.message || 'No message')}')">View Message</button>
      </td>
    </tr>
  `).join('');
}

async function updateLeadStatus(id, newStatus) {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus.toUpperCase() }) // Or lowercase based on backend schema
    });
    const data = await response.json();
    if (data.success) {
      loadLeads(currentPage); // refresh
    } else {
      alert('Failed to update status: ' + data.error?.message);
      loadLeads(currentPage); // revert
    }
  } catch (err) {
    alert('Failed to update status');
    loadLeads(currentPage);
  }
}

function viewLeadMessage(message) {
  alert(message); // Simple implementation. For a real app, use a modal.
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}
