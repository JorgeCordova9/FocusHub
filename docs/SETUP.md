````markdown
# FocusHub - Sistema de Autenticación y Gestión de Tareas

## 📋 Descripción

FocusHub es una aplicación web de productividad con sistema completo de autenticación, gestión de tareas persistentes en base de datos, y características de enfoque (Pomodoro, notas, pizarra, música).

## ✨ Características Implementadas

### Autenticación

- ✅ Registro de usuarios con validación
- ✅ Login seguro con contraseñas hasheadas (bcryptjs)
- ✅ Sesiones con express-session
- ✅ Protección de rutas (requiere autenticación)
- ✅ Logout

### Gestión de Tareas

- ✅ Crear tareas con nombre y tiempo asignado
- ✅ Visualizar tareas (pending, in progress, completed)
- ✅ Editar tareas
- ✅ Eliminar tareas
- ✅ Persistencia en base de datos
- ✅ Sincronización automática entre dispositivos

### Base de Datos

- ✅ SQLite con tablas relacionadas (users, tasks, notes)
- ✅ Integridad referencial
- ✅ Validación de datos

### Interfaz de Usuario

- ✅ Página de login/registro elegante
- ✅ Validaciones en formularios
- ✅ Mensajes de éxito/error
- ✅ Responsive design
- ✅ Panel de usuario con logout

## 🚀 Instalación y Configuración

### Requisitos Previos

- Node.js (v14 o superior)
- npm (viene con Node.js)

### Pasos de Instalación

1. **Navega a la carpeta del servidor:**

```bash
cd server
```

2. **Instala las dependencias:**

```bash
npm install
```

3. **Inicia el servidor:**

```bash
npm start
```

El servidor se ejecutará en `http://localhost:5000`

### Variables de Entorno (Opcional)

Crea un archivo `.env` en la carpeta `server/`:

```
PORT=5000
```

## 📁 Estructura del Proyecto

```
FocusHub/
├── server/
│   ├── package.json          # Dependencias del servidor
│   ├── server.js             # Servidor Express principal
│   └── focushub.db           # Base de datos SQLite (se crea automáticamente)
├── auth.html                 # Página de login/registro
├── index.html                # Aplicación principal
├── app.js                    # Lógica de la aplicación
├── style.css                 # Estilos
├── README.md                 # Este archivo
└── SETUP.md                  # Este archivo
```

## 🔐 Seguridad Implementada

### Contraseñas

- Hash con bcryptjs (10 rondas)
- Validación de mínimo 6 caracteres
- No se almacenan contraseñas en texto plano

### Sesiones

- Express-session con cookies seguras
- Validación de autenticación en cada endpoint
- Logout completo

### Base de Datos

- Validación de email único
- Validación de datos requeridos
- Protección contra inyección SQL (prepared statements)

## 📊 API REST Endpoints

### Autenticación

```
POST /api/auth/register
- Body: { nombre, apellido, fecha_nacimiento, email, contraseña }
- Response: { success, message, userId, email }

POST /api/auth/login
- Body: { email, contraseña }
- Response: { success, message, userId, email }

GET /api/auth/check
- Response: { authenticated, userId, email }

POST /api/auth/logout
- Response: { success, message }
```

### Tareas

```
GET /api/tasks
- Response: { success, tasks[] }

POST /api/tasks
- Body: { nombre, timeAllocated }
- Response: { success, message, taskId }

PUT /api/tasks/:id
- Body: { nombre, timeAllocated, timeSpent, status }
- Response: { success, message }

DELETE /api/tasks/:id
- Response: { success, message }
```

## 🗄️ Esquema de Base de Datos

### Tabla: users

```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
nombre            TEXT NOT NULL
apellido          TEXT NOT NULL
fecha_nacimiento  TEXT NOT NULL
email             TEXT NOT NULL UNIQUE
contraseña        TEXT NOT NULL (hash)
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Tabla: tasks

```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
user_id           INTEGER NOT NULL (FOREIGN KEY)
nombre            TEXT NOT NULL
timeAllocated     INTEGER NOT NULL
timeSpent         REAL DEFAULT 0
status            TEXT DEFAULT 'pending'
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

### Tabla: notes (para futuras características)

```sql
id                INTEGER PRIMARY KEY AUTOINCREMENT
task_id           INTEGER NOT NULL (FOREIGN KEY)
titulo            TEXT NOT NULL
contenido         TEXT NOT NULL
created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
```

## 🎯 Flujo de la Aplicación

1. **Usuario accede a la app** → Se redirige a `/auth.html`
2. **Usuario se registra** → Datos guardados en DB, sesión iniciada
3. **Usuario inicia sesión** → Se verifica email y contraseña, sesión iniciada
4. **Usuario accede a `/index.html`** → Se verifica autenticación
5. **Usuario crea tarea** → Se guarda en DB asociada a su ID
6. **Usuario edita/elimina tarea** → Cambios sincronizados a DB
7. **Usuario cierra sesión** → Sesión destruida, se redirige a `/auth.html`

## 🌐 Uso de la Aplicación

### Registro

1. Haz clic en "Regístrate aquí" en la página de login
2. Completa los campos requeridos
3. Haz clic en "Crear Cuenta"
4. Se te redirigirá automáticamente a la app

### Crear Tarea

1. Haz clic en "+ New Task"
2. Ingresa el nombre de la tarea
3. Selecciona el tiempo asignado (o escribe uno custom)
4. Haz clic en "Create Task"

### Iniciar Tarea

1. Haz clic en "Start →" en la tarea
2. Se inicia automáticamente el timer
3. Trabaja en la tarea
4. El tiempo se sincroniza automáticamente

### Sincronización

- Las tareas se sincronizan automáticamente con el servidor
- Puedes acceder desde cualquier dispositivo y ver las mismas tareas
- Los cambios se guardan en tiempo real

## 🐛 Solución de Problemas

### Error: "Cannot find module 'express'"

```bash
cd server
npm install
```

### Error: "Port already in use"

Cambia el puerto en `.env` o detén el proceso que usa el puerto 5000

### Error: "CORS error"

Verifica que el servidor esté corriendo en `http://localhost:5000`

### Las tareas no persisten

- Verifica que la base de datos se creó: `server/focushub.db`
- Reinicia el servidor: `npm start`

## 📝 Notas Técnicas

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js + Express
- **Base de Datos**: SQLite3
- **Seguridad**: bcryptjs para hash de contraseñas
- **Sesiones**: express-session con cookies

## 🔄 Próximas Mejoras Posibles

- [ ] Recuperación de contraseña por email
- [ ] Avatar de usuario
- [ ] Compartir tareas
- [ ] Notificaciones en tiempo real
- [ ] Estadísticas detalladas
- [ ] Exportar datos (CSV, PDF)
- [ ] Sincronización en tiempo real con WebSocket
- [ ] Autenticación OAuth (Google, GitHub)

## 📞 Soporte

Para reportar errores o sugerencias, contacta al desarrollador.

---

**Versión**: 1.0.0
**Última actualización**: Noviembre 2024
````
