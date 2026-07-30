let currentPage = 1;
let currentLeads = [];

async function loadLeads(page = 1) {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/leads?page=${page}&limit=10`);
    const data = await response.json();
    if (data.success) {
      currentPage = page;
      currentLeads = data.leads;
      renderLeads(data.leads);
    }
  } catch (err) {
    console.error('Failed to load leads', err);
    document.getElementById('leadsTableBody').innerHTML = '<tr><td colspan="6">Error loading leads</td></tr>';
  }
}

function renderLeads(leads) {
  const tbody = document.getElementById('leadsTableBody');
  if (!leads?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No leads found</td></tr>';
    return;
  }

  tbody.innerHTML = leads.map(lead => `
    <tr>
      <td>${new Date(lead.createdAt).toLocaleDateString()}</td>
      <td>${escapeHtml(lead.name)}</td>
      <td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td>
      <td>${escapeHtml(lead.projectType)}</td>
      <td><select onchange="updateLeadStatus('${lead.id}', this.value)" class="status-badge status-${lead.status}">
        ${['new', 'contacted', 'qualified', 'closed'].map(status => `<option value="${status}" ${lead.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select></td>
      <td><button class="button button--small button--outline" onclick="viewLeadMessage('${lead.id}')">View Message</button></td>
    </tr>`).join('');
}

async function updateLeadStatus(id, status) {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/leads/${id}`, {
      method: 'PATCH', body: JSON.stringify({ status })
    });
    if (!(await response.json()).success) throw new Error('Update rejected');
  } catch (err) {
    alert('Failed to update status');
  }
  loadLeads(currentPage);
}

function viewLeadMessage(id) {
  const lead = currentLeads.find(item => item.id === id);
  alert(lead?.message || 'No message');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
