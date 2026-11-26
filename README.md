# Among Fest — PWA multijugador (primera versión)

## Qué incluye
- Web adaptable a móvil y con manifiesto PWA.
- Crear una sala y generar código aleatorio de 4 caracteres.
- Entrar en una sala con código y nombre, sin registro.
- Límite de 25 jugadores y mínimo de 4.
- Sala de espera sincronizada en tiempo real.
- Botón «Estoy listo» / «Todavía no».
- Cuenta atrás automática de 10 segundos cuando todos están listos.
- Reparto privado de roles realizado en el servidor.
- Temporizador de 60 minutos y catálogo de 25 pruebas.
- Actualización en tiempo real con Socket.IO.

## Ejecutar en un ordenador
Necesitas Node.js 20 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

Para probar desde varios móviles en la misma Wi-Fi, abre en todos la dirección IP local del ordenador, por ejemplo `http://192.168.1.20:3000`. El cortafuegos debe permitir el puerto 3000.

## Publicar en Internet
Esta carpeta contiene el código de la aplicación, pero no está publicada ni tiene una URL pública todavía. Para que entren jugadores desde cualquier red hace falta desplegar el servidor en un hosting compatible con Node.js y HTTPS. Configura el comando de inicio `npm start` y el puerto mediante `PORT` si el proveedor lo requiere.

## Limitaciones de esta primera versión
- Las salas viven en memoria: si el servidor se reinicia, se pierden.
- No hay reconexión con recuperación de sesión, persistencia ni moderación de trampas.
- El avance de pruebas es común y básico; aún falta validación por estación/QR o confirmación entre jugadores.
- El código es una base funcional inicial, no una versión de producción auditada.
- Los sabotajes y códigos de eliminación todavía no están implementados en el servidor.
- El reparto de roles sí se realiza en el servidor y cada cliente recibe únicamente su propio rol.

## Reglas iniciales
- 4 a 25 jugadores.
- Impostores: aproximadamente uno por cada seis jugadores, al menos uno.
- La partida comienza 10 segundos después de que todos los jugadores conectados estén listos.
- Si alguien se desconecta antes del inicio, sale de la sala y se recalcula la cuenta atrás.


## Importar y publicar en Replit
1. En Replit, crea un proyecto nuevo e importa/sube el contenido de esta carpeta (no abras `index.html` directamente).
2. Comprueba que `package.json`, `server.js` y la carpeta `public/` quedan en la raíz del proyecto.
3. Replit debe instalar las dependencias de `package.json`. Si no lo hace automáticamente, ejecuta `npm install` en la consola.
4. Pulsa **Run**. El archivo `.replit` ya indica `npm start`.
5. Para publicarlo, usa **Deploy** y elige un despliegue compatible con una aplicación Node.js que mantenga el servidor y las conexiones WebSocket.
6. Cuando Replit muestre una URL HTTPS pública, ábrela en dos móviles distintos y prueba crear una sala y entrar con el código antes de compartirla con todos.

Importante: no compartas la URL como versión definitiva hasta completar esa prueba. Este paquete es la primera versión y todavía no incluye sabotajes reales ni el sistema definitivo de códigos secretos de eliminación.
