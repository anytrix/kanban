const API = (() => {
  async function request(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options
    });
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('No autenticado');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error en la peticion');
    return data;
  }

  return {
    me: () => request('/api/auth/me'),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    getTasks: () => request('/api/tasks'),
    createTask: (task) => request('/api/tasks', { method: 'POST', body: JSON.stringify(task) }),
    updateTask: (id, task) => request('/api/tasks/' + id, { method: 'PUT', body: JSON.stringify(task) }),
    deleteTask: (id) => request('/api/tasks/' + id, { method: 'DELETE' })
  };
})();
