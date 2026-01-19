# WhatsappAutoSender

Una aplicación de escritorio minimalista para enviar mensajes masivos por WhatsApp Web de forma automatizada y segura.

## 🚀 Características

- **Input Excel**: Carga sencilla de archivos .xlsx.
- **Automatización Real**: Usa un navegador real (Chrome/Chromium) para enviar mensajes, simulando interacción humana.
- **Soporte Internacional**: Manejo inteligente de códigos de país.
- **Personalización**: Soporta variables en el mensaje (ej: `{{nombre}}`).
- **Control Total**: Pausa, Cancelación inmediata y resumen en vivo.
- **Seguridad**: Intervalos configurables para evitar bloqueos.

## ⚠️ Advertencia Importante

**Riesgo de Bloqueo**: El uso de herramientas de automatización no oficiales va en contra de los términos de servicio de WhatsApp.
- **Usa una cuenta secundaria** si es posible.
- Mantén intervalos altos (60 segundos o más).
- No envíes spam indiscriminado.

## 🛠️ Requisitos Previos (Desarrollo)

Para compilar el proyecto necesitas:

1. **Node.js**: [Descargar aquí](https://nodejs.org/)
2. **Rust**: Necesario para compilar Tauri.
   - En Windows, descarga e instala `rustup-init.exe` desde [rustup.rs](https://rustup.rs/).
   - Asegúrate de instalar también las "C++ Build Tools" de Visual Studio si se solicita.
3. **Python 3.10+**: Necesario solo para desarrollar el backend.

## 📦 Instalación y Configuración

1. **Clonar el repositorio**:
   ```powershell
   git clone <repo-url>
   cd WhatsappAutoSender
   ```

2. **Instalar Dependencias de Frontend**:
   ```powershell
   npm install
   ```

3. **Configurar Entorno Python (Opcional si solo compilas)**:
   ```powershell
   python -m venv python/venv
   .\python\venv\Scripts\pip install -r python/requirements.txt
   .\python\venv\Scripts\python -m playwright install chromium
   ```

## 🏗️ Compilación y Empaquetado

Esta aplicación utiliza un **backend en Python empaquetado** como un ejecutable independiente ("sidecar"). Esto permite que el usuario final no necesite instalar Python.

### Paso 1: Generar el Ejecutable del Backend

Debes convertir el script de Python en un `.exe` usando PyInstaller.

```powershell
# Instalar PyInstaller si no lo tienes
pip install pyinstaller

# Generar el ejecutable (desde la raíz del proyecto)
# Esto creará la carpeta 'dist' con 'backend.exe'
pyinstaller --onefile --name backend python/main.py

# Mover el ejecutable a la carpeta de binarios de Tauri
# NOTA: El nombre debe incluír la arquitectura target (ej: x86_64-pc-windows-msvc)
mkdir src-tauri\binaries 2>NUL
move dist\backend.exe src-tauri\binaries\backend-x86_64-pc-windows-msvc.exe
```

### Paso 2: Compilar la Aplicación (Installer)

Una vez que el binario `backend-*.exe` está en su lugar, puedes generar el instalador `.msi` o `.exe`.

```powershell
npm run tauri build
```
El instalador se generará en `src-tauri/target/release/bundle/nsis/`.

## ▶️ Desarrollo (Hot Reload)

Para trabajar en el código:

1. Asegúrate de tener el backend compilado en `src-tauri/binaries` (Tauri necesita el binario presente incluso en dev si está configurado como sidecar) O configurar temporalmente `tauri.conf.json` para usar el script.
   * *Recomendación*: Genera el binario una vez y trabaja en el frontend. Si cambias el Python, regenera el binario.

2. Inicia Tauri:
   ```powershell
   npm run tauri dev
   ```

## 📝 Guía de Uso

1. **Preparar Excel**:
   - Crea un archivo `.xlsx`.
   - Asegúrate de tener una columna con los teléfonos (ej: `Telefono`).
   - Opcional: Una columna con el código de país (ej: `Pais` con valores como `56`, `57`, etc.).
   
2. **Configurar App**:
   - **Columna Celular**: Escribe el nombre exacto del encabezado en tu Excel (ej: `Telefono`).
   - **Columna Cod. País**: (Opcional) Nombre de la columna de país. Si se omite, el programa asume que el teléfono ya incluye el código.
   - **Mensaje**: Escribe tu mensaje. Usa `{{columna}}` para reemplazar datos dinámicamente.

3. **Ejecutar**:
   - Carga el Excel.
   - Clic en **Vincular WhatsApp** y escanea el QR si es necesario.
   - Clic en **Iniciar Proceso**.

## 🔧 Solución de Problemas Comunes

- **Error: `backend not found`**: Asegúrate de haber seguido el "Paso 1" de compilación y que el archivo `.exe` esté en `src-tauri/binaries` con el nombre correcto (`backend-x86_64-pc-windows-msvc.exe`).
- **Navegador no abre**: El ejecutable empaquetado necesita descargar los binarios de navegador de Playwright la primera vez, o tener Chrome instalado. En la mayoría de entornos con Chrome funciona.
- **Antivirus**: Algunos antivirus pueden marcar el `.exe` generado por PyInstaller como sospechoso (falso positivo común). Añade una excepción si es necesario.
