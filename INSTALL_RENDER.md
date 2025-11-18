# Guía de Instalación y Operación en Render.com

Este documento explica paso a paso cómo desplegar y operar el backend de IA en la plataforma de **Render.com**. Está dirigido a operadores que no necesariamente tienen un profundo conocimiento técnico.

## 🎯 Objetivo

El objetivo es publicar el servidor en internet para que pueda recibir y responder mensajes del chat de Tawk.to de forma automática.

## 🛠️ Requisitos Previos

Antes de empezar, asegúrate de tener:

1.  **Una cuenta en Render.com**.
2.  **Una cuenta en GitHub** con acceso al repositorio `raildozouk/jugar-ai-render`.
3.  **Las claves de API necesarias**: `OPENAI_API_KEY`, `TAWK_WEBHOOK_SECRET`, `TAWK_API_KEY` y `TAWK_PROPERTY_ID`.

## 🚀 Pasos para el Despliegue

El despliegue se realiza una sola vez. Una vez configurado, Render.com actualizará el servidor automáticamente cada vez que se hagan cambios en el código en GitHub.

### Paso 1: Crear el Servicio en Render

1.  Inicia sesión en tu cuenta de Render.com.
2.  En el Dashboard, haz clic en **"New +"** y selecciona **"Blueprint"**.
3.  Conecta tu cuenta de GitHub si aún no lo has hecho.
4.  Selecciona el repositorio `raildozouk/jugar-ai-render` de la lista.
5.  Render detectará automáticamente el archivo `render.yaml` y pre-configurará el servicio. Dale un nombre al grupo de servicios (ej: `jugar-ai-backend`).
6.  Haz clic en **"Apply"** para crear el servicio.

### Paso 2: Configurar las Variables de Entorno (Los Secretos)

Esta es la parte más importante para que el sistema funcione. Aquí es donde pondrás las claves secretas sin que queden expuestas en el código.

1.  Una vez creado el servicio, ve a la pestaña **"Environment"** dentro de tu nuevo servicio web (`jugar-ai-render`).
2.  En la sección **"Secret Files & Env Groups"**, busca la sección **"Environment Variables"**.
3.  Verás una lista de variables que ya están definidas en `render.yaml` (como `NODE_ENV`, `PORT`, etc.).
4.  Ahora, debes agregar las variables secretas. Haz clic en **"Add Environment Variable"** y añade las siguientes claves, una por una:

    | Key                   | Value                                         |
    | --------------------- | --------------------------------------------- |
    | `OPENAI_API_KEY`      | Pega aquí tu clave de OpenAI (empieza con `sk-`) |
    | `TAWK_WEBHOOK_SECRET` | Pega aquí el secreto que creaste en Tawk.to   |
    | `TAWK_API_KEY`        | Pega aquí tu clave de API de Tawk.to          |
    | `TAWK_PROPERTY_ID`    | Pega aquí el ID de tu propiedad de Tawk.to    |

    **¡MUY IMPORTANTE!** Asegúrate de que no haya espacios antes o después de las claves que pegas.

5.  Haz clic en **"Save Changes"**. El servicio se reiniciará automáticamente para aplicar las nuevas variables.

### Paso 3: Generar y Subir los Embeddings

Este es un paso manual que debe realizar un desarrollador antes del primer despliegue.

1.  En un entorno local (no en Render), ejecutar el comando `npm run generate-embeddings`. Esto creará el archivo `knowledge/embeddings.json`.
2.  **IMPORTANTE**: Por seguridad y para evitar costos, el `render.yaml` **no** genera los embeddings automáticamente. Este proceso debe hacerse de forma controlada.
3.  El archivo `embeddings.json` generado debe ser subido a una ubicación accesible por el servidor. Una opción es usar el **disco persistente de Render** o un servicio de almacenamiento como AWS S3.

    *Para la versión inicial, el archivo se incluirá en el repositorio para simplificar el despliegue, aunque no es la mejor práctica.* El `.gitignore` será modificado para permitirlo temporalmente.

### Paso 4: Obtener la URL del Servidor

Una vez que el servicio se haya desplegado correctamente (verás un mensaje de "Live" o "Deploy successful"), Render te proporcionará una URL pública para tu servidor. La encontrarás en la parte superior de la página del servicio, algo como:

`https://jugar-ai-render.onrender.com`

Copia esta URL. La necesitarás para el siguiente paso.

### Paso 5: Configurar el Webhook en Tawk.to

Ahora tienes que decirle a Tawk.to a dónde debe enviar los mensajes.

1.  Inicia sesión en tu panel de Tawk.to.
2.  Ve a **"Administración"** (el ícono de engranaje).
3.  En la sección de **"Configuración"**, selecciona **"Webhooks"**.
4.  Haz clic en **"Crear Webhook"**.
5.  **Endpoint URL**: Pega la URL de tu servidor de Render y añádele `/api/webhook` al final. Por ejemplo:
    `https://jugar-ai-render.onrender.com/api/webhook`
6.  **Secreto del Webhook**: Aquí debes poner **exactamente el mismo texto** que usaste para la variable `TAWK_WEBHOOK_SECRET` en Render.
7.  Selecciona los eventos que quieres que activen el webhook. Como mínimo, necesitas **"Nuevo mensaje de chat"** (`chat:new_message`).
8.  Guarda el webhook.

## ✅ ¡Listo! Verificación Final

Si todo ha ido bien, el sistema ya está operativo.

-   Abre el chat en JugarEnChile.com y envía un mensaje de prueba.
-   Deberías recibir una respuesta automática de la IA en pocos segundos.
-   En Render, puedes ir a la pestaña **"Logs"** para ver en tiempo real lo que está haciendo el servidor (mensajes recibidos, respuestas generadas, etc.). Esto es muy útil para diagnosticar problemas.

## 🔄 Mantenimiento y Actualizaciones

### Actualizar la Base de Conocimiento

Como se mencionó en el `README.md`, para que la IA aprenda nueva información, se deben seguir estos pasos:

1.  Un desarrollador debe editar el archivo `knowledge/consolidated_knowledge.txt`.
2.  Luego, debe ejecutar localmente `npm run generate-embeddings`.
3.  Finalmente, debe subir el nuevo archivo `knowledge/embeddings.json` al repositorio de GitHub.

Como el auto-deploy está activado en Render, en cuanto los cambios se suban a GitHub, el servidor se actualizará solo.

### Monitoreo

Revisa los logs en Render de vez en cuando para asegurarte de que todo funciona correctamente. Si ves errores (líneas en rojo), contacta al equipo de desarrollo.
