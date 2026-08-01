// Runs on a full page load and again after every PJAX swap; the dataset flag
// lives on the grid itself, so each swapped-in <main> is hydrated exactly once.
async function initProjectsPage() {
  const grid = document.querySelector('#projects-grid');
  if (!grid || grid.dataset.hydrated === 'true') return;
  grid.dataset.hydrated = 'true';

  try {
    const response = await fetch(`${window.APP_CONFIG?.API_BASE_URL || ''}/api/projects`);
    const payload = await response.json();
    if (!response.ok || !payload.success || !Array.isArray(payload.data) || payload.data.length === 0) return;

    const visualClasses = ['visual--nova', 'visual--motion', 'visual--flow'];
    grid.replaceChildren(...payload.data.map((project, index) => createProjectCard(project, index, visualClasses)));
  } catch {
    // Keep the inline concept cards visible if the API is offline.
  }
}

// When this file is injected by a PJAX swap, DOMContentLoaded has already
// fired and never will again — initialise immediately in that case.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectsPage);
} else {
  initProjectsPage();
}
document.addEventListener('waliliens:pjax', initProjectsPage);

function createProjectCard(project, index, visualClasses) {
  const card = document.createElement('article');
  card.className = `project${index === 0 ? ' project--large' : ''}`;

  const visual = document.createElement('div');
  visual.className = `project__visual ${visualClasses[index % visualClasses.length]}`;
  if (project.imageUrl) {
    visual.style.backgroundImage = `linear-gradient(rgba(10, 15, 44, .2), rgba(10, 15, 44, .55)), url("${CSS.escape(project.imageUrl)}")`;
    visual.style.backgroundSize = 'cover';
    visual.style.backgroundPosition = 'center';
  }
  const label = document.createElement('span');
  label.textContent = project.title;
  visual.append(label);

  const meta = document.createElement('div');
  meta.className = 'project__meta';
  const title = document.createElement('h3');
  title.textContent = project.title;
  const category = document.createElement('p');
  category.textContent = project.category;
  meta.append(title, category);
  card.append(visual, meta);
  return card;
}
