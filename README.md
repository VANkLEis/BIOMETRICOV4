# SecureCall - Aplicación de Videollamadas

Una aplicación segura de videollamadas construida con React, Vite y PeerJS.

## Estructura del Proyecto

```
/
├── client/          # Aplicación frontend en React
└── server/          # Servidor de señalización PeerJS
```

## Desarrollo Local

### Configuración del Frontend

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar el servidor de desarrollo:
```bash
npm run dev
```

El frontend estará disponible en `http://localhost:5173`

### Configuración del Backend

1. Navegar al directorio del servidor:
```bash
cd server
```

2. Instalar dependencias:
```bash
npm install
```

3. Iniciar el servidor PeerJS:
```bash
npm run dev
```

El servidor PeerJS estará ejecutándose en `http://localhost:3000`

## Despliegue

### Despliegue del Frontend

El frontend puede ser desplegado en cualquier servicio de alojamiento estático (Netlify, Vercel, etc.).

1. Construir el frontend:
```bash
npm run build
```

2. Desplegar el directorio `dist`

### Despliegue del Backend (Render.com)

1. Crear un nuevo Servicio Web en Render
2. Conectar tu repositorio de GitHub
3. Configurar el servicio:
   - Directorio Raíz: `server`
   - Comando de Construcción: `npm install`
   - Comando de Inicio: `npm start`
   - Variables de Entorno:
     - `PORT`: 3000

### Variables de Entorno

Crear un archivo `.env` en el directorio raíz con las siguientes variables:

```env
VITE_PEER_HOST=localhost
VITE_PEER_PORT=3000
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=false
```

Para producción, actualizar los valores en `.env.production`:

```env
VITE_PEER_HOST=tu-app.onrender.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/peerjs
VITE_PEER_SECURE=true
```

## Pruebas

1. Para pruebas locales entre dispositivos en la misma red:
   - Usar la dirección IP local de tu computadora
   - Ambos dispositivos deben estar en la misma red
   - Acceder vía `http://ip-local:5173`

2. Para pruebas con dispositivos externos:
   - Desplegar el backend en Render.com
   - Actualizar las variables de entorno del frontend
   - Desplegar el frontend
   - Acceder vía HTTPS

## Notas Importantes

- WebRTC requiere HTTPS en producción
- El desarrollo local puede usar HTTP
- Los dispositivos móviles requieren HTTPS a menos que se use localhost
- El servidor PeerJS debe estar ejecutándose para que las videollamadas funcionen

## Solución de Problemas Comunes

1. Error de Cámara o Micrófono:
   - Verificar que el navegador tiene permisos de acceso
   - Asegurarse de que ninguna otra aplicación esté usando la cámara
   - En móviles, verificar los permisos del sistema

2. Problemas de Conexión:
   - Verificar que ambos usuarios tienen buena conexión a internet
   - Asegurarse de que el servidor PeerJS está activo
   - Comprobar que las variables de entorno son correctas

3. Errores de HTTPS:
   - En producción, asegurarse de usar HTTPS
   - Para desarrollo local, aceptar los certificados autofirmados
   - En móviles, usar siempre HTTPS excepto para localhost