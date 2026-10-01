const Kanban = (() => {
  const COLUMNS = ['todo', 'progress', 'done'];
  const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };

  let tasks = [];
  let draggedId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function taskById(id) {
    return tasks.find(t => String(t.id) === String(id));
  }

  function render() {
    COLUMNS.forEach(status => {
      const col = $(status);
      const items = tasks.filter(t => t.status === status);
      const countEl = $('count-' + status);
      if (countEl) countEl.textContent = String(items.length);

      if (!items.length) {
        col.innerHTML = '<div class="empty-msg">Sin tareas</div>';
        return;
      }

      col.innerHTML = items.map(task => {
        const title = Utils.escapeHtml(task.title);
        const desc = Utils.escapeHtml(task.description || '');
        const assignee = (task.assignee || '').trim();
        const initials = Utils.escapeHtml(Utils.getInitials(assignee));
        const assigneeName = Utils.escapeHtml(assignee || 'Sin asignar');
        const priority = task.priority || 'media';
        const badge = PRIORITY_LABELS[priority] || priority;

        return `
          <div class="task" draggable="true" data-id="${task.id}" data-priority="${priority}"
               ondragstart="Kanban.dragStart(event)" ondragend="Kanban.dragEnd(event)">
            <div class="task-title">${title}</div>
            ${desc ? `<div class="task-desc">${desc}</div>` : ''}
            <div class="task-footer">
              <div class="assignee">
                <span class="avatar">${initials}</span>
                <span>${assigneeName}</span>
              </div>
              <span class="priority-badge ${priority}">${badge}</span>
              <div class="task-actions">
                <button type="button" class="btn-icon edit" title="Editar" onclick="Kanban.edit(${task.id})">✎</button>
                <button type="button" class="btn-icon delete" title="Eliminar" onclick="Kanban.remove(${task.id})">✕</button>
              </div>
            </div>
          </div>`;
      }).join('');
    });
  }

  async function loadTasks() {
    const data = await API.getTasks();
    tasks = data.tasks || [];
    render();
  }

  function openModal(task) {
    $('modal-title').textContent = task ? 'Editar Tarea' : 'Nueva Tarea';
    $('task-id').value = task ? task.id : '';
    $('title').value = task ? task.title : '';
    $('description').value = task ? (task.description || '') : '';
    $('assignee').value = task ? (task.assignee || '') : '';
    $('priority').value = task ? (task.priority || 'media') : 'media';
    $('status').value = task ? (task.status || 'todo') : 'todo';
    $('modal').classList.add('active');
    $('title').focus();
  }

  function closeModal() {
    $('modal').classList.remove('active');
    $('task-form').reset();
    $('task-id').value = '';
  }

  function edit(id) {
    const task = taskById(id);
    if (task) openModal(task);
  }

  async function remove(id) {
    if (!confirm('Eliminar esta tarea?')) return;
    await API.deleteTask(id);
    await loadTasks();
  }

  function dragStart(event) {
    const card = event.target.closest('.task');
    if (!card) return;
    draggedId = card.dataset.id;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedId);
  }

  function dragEnd(event) {
    const card = event.target.closest('.task');
    if (card) card.classList.remove('dragging');
    draggedId = null;
    document.querySelectorAll('.tasks.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  function dragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  }

  function dragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  async function drop(event, status) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const id = event.dataTransfer.getData('text/plain') || draggedId;
    const task = taskById(id);
    if (!task || task.status === status) return;
    await API.updateTask(id, { ...task, status });
    await loadTasks();
  }

  async function init() {
    const me = await API.me();
    $('user-name').textContent = me.user.fullname || me.user.username;

    $('btn-new-task').onclick = () => openModal(null);
    $('btn-cancel').onclick = closeModal;
    $('modal').addEventListener('click', e => {
      if (e.target.id === 'modal') closeModal();
    });

    $('btn-logout').onclick = async () => {
      await API.logout();
      window.location.href = '/login.html';
    };

    $('btn-clear-all').onclick = async () => {
      if (!tasks.length) return;
      if (!confirm('Eliminar todas las tareas?')) return;
      await Promise.all(tasks.map(t => API.deleteTask(t.id)));
      await loadTasks();
    };

    $('task-form').onsubmit = async e => {
      e.preventDefault();
      const payload = {
        title: $('title').value.trim(),
        description: $('description').value.trim(),
        assignee: $('assignee').value.trim(),
        priority: $('priority').value,
        status: $('status').value
      };
      const id = $('task-id').value;
      if (id) await API.updateTask(id, payload);
      else await API.createTask(payload);
      closeModal();
      await loadTasks();
    };

    await loadTasks();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch(err => {
      if (err.message !== 'No autenticado') console.error(err);
    });
  });

  return { dragStart, dragEnd, dragOver, dragLeave, drop, edit, remove };
})();
