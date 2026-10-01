const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db/init");

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "cambia-esta-clave-en-produccion",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

app.get("/", (req, res) => {
  if (!req.session.userId) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "No autenticado" });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  next();
}

// ---------- AUTH ----------
app.post("/api/auth/register", (req, res) => {
  const { username, fullname, password } = req.body;
  if (!username || !fullname || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: "Usuario minimo 3, contrasena minimo 4" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (exists) return res.status(409).json({ error: "Ese usuario ya existe" });

  const hash = bcrypt.hashSync(password, 10);
  let result;
  try {
    result = db.prepare(
      "INSERT INTO users (username, fullname, password_hash, role, created_at) VALUES (?, ?, ?, 'student', ?)"
    ).run(username, fullname, hash, Date.now());
  } catch (err) {
    return res.status(409).json({ error: "Ese usuario ya existe" });
  }

  const userId = Number(result.lastInsertRowid);
  req.session.userId = userId;
  req.session.username = username;
  req.session.fullname = fullname;
  req.session.role = "student";

  res.json({ ok: true, user: { id: userId, username, fullname, role: "student" } });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Faltan datos" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Usuario o contrasena incorrectos" });

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.fullname = user.fullname;
  req.session.role = user.role;

  res.json({ ok: true, user: { id: user.id, username: user.username, fullname: user.fullname, role: user.role } });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "No autenticado" });
  res.json({ user: { id: req.session.userId, username: req.session.username, fullname: req.session.fullname, role: req.session.role } });
});

// ---------- TAREAS ----------
app.get("/api/tasks", requireAuth, (req, res) => {
  const tasks = db.prepare(
    "SELECT id, title, description, assignee, priority, status, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC"
  ).all(req.session.userId);
  res.json({ tasks });
});

app.post("/api/tasks", requireAuth, (req, res) => {
  const { title, description, assignee, priority, status } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "El titulo es obligatorio" });

  const now = Date.now();
  const result = db.prepare(
    "INSERT INTO tasks (user_id, title, description, assignee, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(req.session.userId, title.trim(), (description || "").trim(), (assignee || "").trim(), priority || "media", status || "todo", now, now);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(Number(result.lastInsertRowid));
  res.status(201).json({ task });
});

app.put("/api/tasks/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").get(id, req.session.userId);
  if (!existing) return res.status(404).json({ error: "Tarea no encontrada" });

  const { title, description, assignee, priority, status } = req.body;
  db.prepare(
    "UPDATE tasks SET title = ?, description = ?, assignee = ?, priority = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(title || existing.title, description ?? existing.description, assignee ?? existing.assignee, priority || existing.priority, status || existing.status, Date.now(), id, req.session.userId);

  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  res.json({ task: updated });
});

app.delete("/api/tasks/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?").run(id, req.session.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Tarea no encontrada" });
  res.json({ ok: true });
});

// ---------- ADMIN ----------
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare(
    "SELECT u.id, u.username, u.fullname, u.role, u.created_at, COUNT(t.id) AS task_count FROM users u LEFT JOIN tasks t ON t.user_id = u.id GROUP BY u.id ORDER BY u.username"
  ).all();
  res.json({ users });
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en http://localhost:" + PORT);
});
