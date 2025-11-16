# FocusHub API Testing Guide

## Cómo probar los endpoints

Usa una herramienta como **Postman**, **Insomnia**, o **curl** para hacer requests.

## Ejemplos con curl

### 1. Registro de usuario

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellido": "Pérez",
    "fecha_nacimiento": "1990-01-15",
    "email": "juan@example.com",
    "contraseña": "password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "contraseña": "password123"
  }'
```

### 3. Verificar autenticación

```bash
curl http://localhost:5000/api/auth/check
```

### 4. Crear tarea

```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Estudiar JavaScript",
    "timeAllocated": 60
  }'
```

### 5. Obtener todas las tareas

```bash
curl http://localhost:5000/api/tasks
```

### 6. Actualizar tarea

```bash
curl -X PUT http://localhost:5000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Estudiar TypeScript",
    "timeAllocated": 90,
    "timeSpent": 30,
    "status": "in_progress"
  }'
```

### 7. Eliminar tarea

```bash
curl -X DELETE http://localhost:5000/api/tasks/1
```

### 8. Logout

```bash
curl -X POST http://localhost:5000/api/auth/logout
```

## Respuestas esperadas

### Registro exitoso (201)

```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "userId": 1,
  "email": "juan@example.com"
}
```

### Login exitoso (200)

```json
{
  "success": true,
  "message": "Login exitoso",
  "userId": 1,
  "email": "juan@example.com"
}
```

### Obtener tareas (200)

```json
{
  "success": true,
  "tasks": [
    {
      "id": 1,
      "user_id": 1,
      "nombre": "Estudiar JavaScript",
      "timeAllocated": 60,
      "timeSpent": 0,
      "status": "pending",
      "created_at": "2024-11-16T10:30:00.000Z"
    }
  ]
}
```

### Error - Email duplicado (400)

```json
{
  "success": false,
  "message": "El email ya está registrado"
}
```

### Error - No autorizado (401)

```json
{
  "success": false,
  "message": "No autorizado"
}
```

## Notas importantes

- La autenticación se maneja mediante **sesiones HTTP**
- Las cookies de sesión se envían automáticamente en cada request
- Los errores devuelven códigos HTTP apropiados (400, 401, 404, 500)
- Todas las respuestas son en formato JSON

## Validaciones del servidor

### Registro

- Todos los campos son requeridos
- Email debe ser válido (formato correcto)
- Contraseña mínimo 6 caracteres
- Email debe ser único (no puede existir otro usuario con ese email)

### Tareas

- Nombre es requerido
- timeAllocated debe ser un número > 0
- Solo el propietario de la tarea puede verla/editarla/eliminarla

## Estados de la tarea

- `pending` - Tarea no iniciada
- `in_progress` - Tarea en progreso
- `completed` - Tarea completada
