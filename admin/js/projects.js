let allProjects = [];

async function loadProjects() {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/projects`);
    const data = await response.json();
    
    if (data.success) {
      allProjects = data.data; // adjust based on backend response shape
      renderProjects(allProjects);
    }
  } catch (err) {
    console.error('Failed to load projects', err);
    document.getElementById('projectsTableBody').innerHTML = '<tr><td colspan="5">Error loading projects</td></tr>';
  }
}

function renderProjects(projects) {
  const tbody = document.getElementById('projectsTableBody');
  
  if (!projects || projects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No projects found</td></tr>';
    return;
  }
  
  tbody.innerHTML = projects.map(proj => `
    <tr>
      <td>${escapeHtml(proj.title)}</td>
      <td>${escapeHtml(proj.client || '-')}</td>
      <td>${escapeHtml(proj.projectType || '-')}</td>
      <td>
        <span class="status-badge ${proj.published ? 'status-converted' : 'status-new'}">
          ${proj.published ? 'Published' : 'Draft'}
        </span>
      </td>
      <td class="action-links">
        <a onclick="editProject('${proj.id}')">Edit</a>
        <a class="delete" onclick="deleteProject('${proj.id}')">Delete</a>
      </td>
    </tr>
  `).join('');
}

// Modal logic
const modal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');

function openProjectModal(project = null) {
  document.getElementById('modalTitle').textContent = project ? 'Edit Project' : 'New Project';
  
  if (project) {
    document.getElementById('projectId').value = project.id;
    document.getElementById('projectTitle').value = project.title || '';
    document.getElementById('projectClient').value = project.client || '';
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectType').value = project.projectType || '';
    document.getElementById('projectLink').value = project.link || '';
    document.getElementById('projectImageUrl').value = project.imageUrl || '';
    document.getElementById('projectPublished').value = project.published ? 'true' : 'false';
  } else {
    projectForm.reset();
    document.getElementById('projectId').value = '';
  }
  
  modal.classList.add('active');
}

function closeProjectModal() {
  modal.classList.remove('active');
}

function editProject(id) {
  const project = allProjects.find(p => p.id === id);
  if (project) {
    openProjectModal(project);
  }
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/projects/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (data.success) {
      loadProjects();
    } else {
      alert('Failed to delete: ' + data.error?.message);
    }
  } catch (err) {
    alert('Failed to delete project');
  }
}

projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = document.getElementById('projectId').value;
  const payload = {
    title: document.getElementById('projectTitle').value,
    client: document.getElementById('projectClient').value,
    description: document.getElementById('projectDescription').value,
    projectType: document.getElementById('projectType').value,
    link: document.getElementById('projectLink').value,
    imageUrl: document.getElementById('projectImageUrl').value,
    published: document.getElementById('projectPublished').value === 'true'
  };
  
  try {
    const url = id 
      ? `${window.APP_CONFIG.API_BASE_URL}/api/admin/projects/${id}` 
      : `${window.APP_CONFIG.API_BASE_URL}/api/admin/projects`;
      
    const method = id ? 'PATCH' : 'POST';
    
    const response = await Auth.fetchWithAuth(url, {
      method,
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (data.success) {
      closeProjectModal();
      loadProjects();
    } else {
      alert('Failed to save project: ' + data.error?.message);
    }
  } catch (err) {
    alert('Failed to save project');
  }
});
