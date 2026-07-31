let allProjects = [];
const modal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');

async function loadProjects() {
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/projects`);
    const data = await response.json();
    if (!data.success) throw new Error('Request rejected');
    allProjects = data.data;
    renderProjects(allProjects);
  } catch (err) {
    console.error('Failed to load projects', err);
    document.getElementById('projectsTableBody').innerHTML = '<tr><td colspan="5">Error loading projects</td></tr>';
  }
}

function renderProjects(projects) {
  const tbody = document.getElementById('projectsTableBody');
  if (!projects?.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No projects found</td></tr>';
    return;
  }
  tbody.innerHTML = projects.map(project => `<tr>
    <td>${escapeHtml(project.title)}</td><td>${escapeHtml(project.category)}</td><td>${project.sortOrder}</td>
    <td><span class="status-badge ${project.published ? 'status-converted' : 'status-new'}">${project.published ? 'Published' : 'Draft'}</span></td>
    <td class="action-links"><a onclick="editProject('${project.id}')">Edit</a><a class="delete" onclick="deleteProject('${project.id}')">Delete</a></td>
  </tr>`).join('');
}

function openProjectModal(project = null) {
  document.getElementById('modalTitle').textContent = project ? 'Edit Project' : 'New Project';
  projectForm.reset();
  document.getElementById('projectId').value = project?.id ?? '';
  document.getElementById('projectTitle').value = project?.title ?? '';
  document.getElementById('projectSlug').value = project?.slug ?? '';
  document.getElementById('projectDescription').value = project?.description ?? '';
  document.getElementById('projectCategory').value = project?.category ?? '';
  document.getElementById('projectTags').value = project?.tags?.join(', ') ?? '';
  document.getElementById('projectImageUrl').value = project?.imageUrl ?? '';
  document.getElementById('projectSortOrder').value = project?.sortOrder ?? 0;
  document.getElementById('projectPublished').value = String(project?.published ?? false);
  modal.classList.add('active');
}
function closeProjectModal() { modal.classList.remove('active'); }
function editProject(id) { openProjectModal(allProjects.find(project => project.id === id)); }

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/projects/${id}`, { method: 'DELETE' });
    if (!(await response.json()).success) throw new Error('Delete rejected');
    loadProjects();
  } catch { alert('Failed to delete project'); }
}

projectForm.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('projectId').value;
  const imageUrl = document.getElementById('projectImageUrl').value.trim();
  const payload = {
    title: document.getElementById('projectTitle').value.trim(),
    slug: document.getElementById('projectSlug').value.trim(),
    description: document.getElementById('projectDescription').value.trim(),
    category: document.getElementById('projectCategory').value.trim(),
    tags: document.getElementById('projectTags').value.split(',').map(tag => tag.trim()).filter(Boolean),
    imageUrl: imageUrl || null,
    sortOrder: Number(document.getElementById('projectSortOrder').value),
    published: document.getElementById('projectPublished').value === 'true'
  };
  try {
    const response = await Auth.fetchWithAuth(`${window.APP_CONFIG.API_BASE_URL}/api/admin/projects${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || 'Save rejected');
    closeProjectModal(); loadProjects();
  } catch (err) { alert(`Failed to save project: ${err.message}`); }
});
