const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcryptjs = require("bcryptjs");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5000",
    credentials: true,
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your-secret-key-change-in-production",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true },
  })
);

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, "..")));

// Database initialization
const db = new sqlite3.Database(path.join(__dirname, "focushub.db"), (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellido TEXT NOT NULL,
        fecha_nacimiento TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        contraseña TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tasks table
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        timeAllocated INTEGER NOT NULL,
        timeSpent REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Notes table
    db.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        contenido TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    console.log("Database tables initialized");
  });
}

// ===== AUTHENTICATION ENDPOINTS =====

// Register endpoint
app.post("/api/auth/register", async (req, res) => {
  const { nombre, apellido, fecha_nacimiento, email, contraseña } = req.body;

  // Validation
  if (!nombre || !apellido || !fecha_nacimiento || !email || !contraseña) {
    return res.status(400).json({
      success: false,
      message: "Todos los campos son requeridos",
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Email inválido",
    });
  }

  // Password validation (at least 6 characters)
  if (contraseña.length < 6) {
    return res.status(400).json({
      success: false,
      message: "La contraseña debe tener al menos 6 caracteres",
    });
  }

  try {
    // Hash password
    const hashedPassword = await bcryptjs.hash(contraseña, 10);

    // Insert user
    db.run(
      `INSERT INTO users (nombre, apellido, fecha_nacimiento, email, contraseña) 
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, apellido, fecha_nacimiento, email, hashedPassword],
      function (err) {
        if (err) {
          if (err.message.includes("UNIQUE constraint failed")) {
            return res.status(400).json({
              success: false,
              message: "El email ya está registrado",
            });
          }
          console.error("Database error:", err);
          return res.status(500).json({
            success: false,
            message: "Error al registrar usuario",
          });
        }

        // Session
        req.session.userId = this.lastID;
        req.session.email = email;

        res.status(201).json({
          success: true,
          message: "Usuario registrado exitosamente",
          userId: this.lastID,
          email: email,
        });
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
    });
  }
});

// Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { email, contraseña } = req.body;

  if (!email || !contraseña) {
    return res.status(400).json({
      success: false,
      message: "Email y contraseña son requeridos",
    });
  }

  db.get(
    "SELECT id, email, contraseña FROM users WHERE email = ?",
    [email],
    async (err, user) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Error en el servidor",
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Email o contraseña incorrectos",
        });
      }

      try {
        const passwordMatch = await bcryptjs.compare(
          contraseña,
          user.contraseña
        );

        if (!passwordMatch) {
          return res.status(401).json({
            success: false,
            message: "Email o contraseña incorrectos",
          });
        }

        // Session
        req.session.userId = user.id;
        req.session.email = user.email;

        res.json({
          success: true,
          message: "Login exitoso",
          userId: user.id,
          email: user.email,
        });
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
          success: false,
          message: "Error en el servidor",
        });
      }
    }
  );
});

// Check session endpoint
app.get("/api/auth/check", (req, res) => {
  if (req.session.userId) {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      email: req.session.email,
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: "Error al cerrar sesión",
      });
    }
    res.json({
      success: true,
      message: "Sesión cerrada",
    });
  });
});

// ===== TASKS ENDPOINTS =====

// Get all tasks for user
app.get("/api/tasks", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
    });
  }

  db.all(
    "SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId],
    (err, tasks) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al obtener tareas",
        });
      }
      res.json({
        success: true,
        tasks: tasks || [],
      });
    }
  );
});

// Create task
app.post("/api/tasks", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
    });
  }

  const { nombre, timeAllocated } = req.body;

  if (!nombre || !timeAllocated) {
    return res.status(400).json({
      success: false,
      message: "Nombre y tiempo son requeridos",
    });
  }

  db.run(
    `INSERT INTO tasks (user_id, nombre, timeAllocated, status)
     VALUES (?, ?, ?, 'pending')`,
    [req.session.userId, nombre, timeAllocated],
    function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al crear tarea",
        });
      }

      res.status(201).json({
        success: true,
        message: "Tarea creada exitosamente",
        taskId: this.lastID,
      });
    }
  );
});

// Update task
app.put("/api/tasks/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
    });
  }

  const { nombre, timeAllocated, timeSpent, status } = req.body;
  const taskId = req.params.id;

  db.run(
    `UPDATE tasks 
     SET nombre = ?, timeAllocated = ?, timeSpent = ?, status = ?
     WHERE id = ? AND user_id = ?`,
    [nombre, timeAllocated, timeSpent, status, taskId, req.session.userId],
    function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al actualizar tarea",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: "Tarea no encontrada",
        });
      }

      res.json({
        success: true,
        message: "Tarea actualizada exitosamente",
      });
    }
  );
});

// Delete task
app.delete("/api/tasks/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado",
    });
  }

  const taskId = req.params.id;

  db.run(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
    [taskId, req.session.userId],
    function (err) {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al eliminar tarea",
        });
      }

      if (this.changes === 0) {
        return res.status(404).json({
          success: false,
          message: "Tarea no encontrada",
        });
      }

      res.json({
        success: true,
        message: "Tarea eliminada exitosamente",
      });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`FocusHub server running on http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop the server");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed");
    }
    process.exit(0);
  });
});
