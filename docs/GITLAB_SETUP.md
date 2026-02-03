# Vincular CocoStock con GitLab

Este documento explica cómo conectar el proyecto CocoStock con GitLab.

## Estado actual

- ✅ Repositorio Git inicializado
- ✅ Commit inicial creado (161 archivos)
- ⏳ Pendiente: Crear proyecto en GitLab y hacer push

---

## Pasos para vincular con GitLab

### 1. Crear el proyecto en GitLab

1. Entra en [GitLab](https://gitlab.com) (o tu instancia de GitLab)
2. Haz clic en **"New project"** o **"Crear proyecto"**
3. Selecciona **"Create blank project"**
4. Configura el proyecto:
   - **Project name:** CocoStock (o el nombre que prefieras)
   - **Project URL:** Tu grupo o usuario de GitLab
   - **Visibility:** Private o Public, según prefieras
5. **Importante:** NO marques "Initialize repository with a README" (ya tenemos código)
6. Haz clic en **"Create project"**

### 2. Obtener la URL del repositorio

En la página del proyecto recién creado, verás la URL. Puede ser:

- **HTTPS:** `https://gitlab.com/tu-usuario/cocostock.git`
- **SSH:** `git@gitlab.com:tu-usuario/cocostock.git`

### 3. Añadir el remoto y hacer push

Abre una terminal en la carpeta del proyecto y ejecuta:

```powershell
# Añadir el remoto (reemplaza con tu URL de GitLab)
git remote add origin https://gitlab.com/tu-usuario/cocostock.git

# Renombrar la rama a main (opcional, GitLab suele usar main)
git branch -M main

# Subir el código a GitLab
git push -u origin main
```

**Si usas SSH:**

```powershell
git remote add origin git@gitlab.com:tu-usuario/cocostock.git
git branch -M main
git push -u origin main
```

### 4. Autenticación

- **HTTPS:** GitLab te pedirá usuario y contraseña. Para mayor seguridad, usa un [Personal Access Token](https://gitlab.com/-/user_settings/personal_access_tokens) en lugar de la contraseña.
- **SSH:** Necesitas tener una clave SSH configurada en GitLab. Puedes crearla con `ssh-keygen` si no tienes una.

---

## Comandos útiles después del push

```powershell
# Ver el estado
git status

# Hacer commit de cambios
git add .
git commit -m "Descripción del cambio"

# Subir cambios a GitLab
git push

# Descargar cambios del servidor
git pull
```

---

## Solución de problemas

### Error: "remote origin already exists"
Si ya tienes un remoto configurado:
```powershell
git remote remove origin
git remote add origin TU_URL_DE_GITLAB
```

### Error de autenticación con HTTPS
Crea un Personal Access Token en GitLab:
1. GitLab → Settings → Access Tokens
2. Crea un token con permisos `read_repository` y `write_repository`
3. Úsalo como contraseña cuando Git te lo pida

### La rama se llama "master" en lugar de "main"
No hay problema. Puedes hacer push a master:
```powershell
git push -u origin master
```
