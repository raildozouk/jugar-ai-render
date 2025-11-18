# Backend de IA para JugarEnChile.com

Este proyecto contiene el código fuente del backend de inteligencia artificial para el chat de soporte de JugarEnChile.com. El sistema está diseñado para integrarse con Tawk.to, procesar mensajes de usuarios, y responder automáticamente utilizando un modelo de lenguaje de OpenAI enriquecido con una base de conocimiento propia (RAG).

## 🧠 ¿Cómo Funciona?

El flujo de operación es el siguiente:

1.  **Recepción de Mensajes**: Tawk.to envía un `webhook` a nuestro servidor cada vez que un visitante escribe un mensaje en el chat.
2.  **Validación**: El servidor valida que el `webhook` sea auténtico y provenga de Tawk.to, utilizando un secreto compartido para firmar la petición.
3.  **Procesamiento RAG**: El mensaje del usuario se convierte en un vector numérico (embedding) y se compara con una base de conocimiento pre-procesada (`knowledge/embeddings.json`). Los fragmentos más relevantes de la base de conocimiento se seleccionan para dar contexto a la IA.
4.  **Generación de Respuesta**: Se envía el mensaje del usuario junto con el contexto relevante a la API de OpenAI (modelo GPT-4). La IA genera una respuesta coherente y precisa.
5.  **Envío de Respuesta**: La respuesta generada por la IA se envía de vuelta al chat de Tawk.to, apareciendo como un mensaje del agente de soporte.

## 🏗️ Estructura del Proyecto

El proyecto está organizado de la siguiente manera para mantener el código limpio y escalable:

```
/jugar-ai-render
├── /knowledge
│   ├── consolidated_knowledge.txt  # Base de conocimiento en texto plano
│   └── embeddings.json             # Embeddings generados (NO se sube a GitHub)
├── /scripts
│   └── generate-embeddings.js      # Script para crear los embeddings
├── /src
│   ├── /controllers                # Lógica de las rutas (qué hacer)
│   ├── /rag                        # Lógica del sistema RAG
│   ├── /routes                     # Definición de las rutas del API
│   ├── /services                   # Lógica de negocio (OpenAI, etc.)
│   ├── /tawk                       # Lógica para Tawk.to (validación, cliente)
│   └── server.js                   # Archivo principal del servidor
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Archivos a ignorar por Git
├── Dockerfile                      # Configuración para crear la imagen Docker
├── INSTALL_RENDER.md               # Guía de instalación para Render.com
├── package.json                    # Dependencias y scripts del proyecto
├── README.md                       # Este archivo
└── render.yaml                     # Configuración de despliegue para Render.com
```

## 🚀 Scripts Disponibles

Puedes ejecutar los siguientes comandos desde la raíz del proyecto:

-   `npm install`: Instala todas las dependencias necesarias.
-   `npm start`: Inicia el servidor en modo producción.
-   `npm run dev`: Inicia el servidor en modo desarrollo, reiniciando automáticamente con cada cambio.
-   `npm run generate-embeddings`: Lee el archivo `consolidated_knowledge.txt`, lo procesa y genera el archivo `knowledge/embeddings.json`. **Este script es fundamental y debe ejecutarse cada vez que se actualice la base de conocimiento.**

## ⚙️ Variables de Entorno

Para que el sistema funcione, es OBLIGATORIO configurar las siguientes variables de entorno. Crea un archivo `.env` en la raíz del proyecto (basado en `.env.example`) y complétalo con tus claves.

| Variable              | Descripción                                               |
| --------------------- | --------------------------------------------------------- |
| `PORT`                | Puerto en el que correrá el servidor (ej: `10000`).       |
| `OPENAI_API_KEY`      | Tu clave secreta de la API de OpenAI.                     |
| `TAWK_WEBHOOK_SECRET` | El secreto que configuras en Tawk.to para firmar webhooks.|
| `TAWK_API_KEY`        | Tu clave de API de Tawk.to para poder enviar mensajes.    |
| `TAWK_PROPERTY_ID`    | El ID de la propiedad de Tawk.to a la que responderá.   |

**IMPORTANTE**: El archivo `.env` NUNCA debe ser subido a GitHub. Está incluido en `.gitignore` para prevenir exposiciones accidentales de secretos.

## ☁️ Despliegue

El proyecto está pre-configurado para un despliegue sencillo en **Render.com** utilizando el archivo `render.yaml`.

Para instrucciones detalladas sobre cómo poner en producción el servidor, consulta el archivo **`INSTALL_RENDER.md`**.

## ✍️ Para Javier Camello y Javier Cordero

Este sistema es el "cerebro" que responde automáticamente en el chat. No necesitan tocar el código, pero es útil que entiendan dos cosas:

1.  **La Base de Conocimiento es Clave**: El archivo `knowledge/consolidated_knowledge.txt` es el documento que la IA "lee" para saber qué responder. Si quieren que la IA sepa algo nuevo, o si una información cambia (ej: un nuevo juego, un cambio en los bonos), solo tienen que editar ese archivo de texto. Después de editarlo, hay que pedirle al desarrollador que ejecute el comando `npm run generate-embeddings` para que la IA "aprenda" los cambios.

2.  **El Chat Sigue Funcionando Como Siempre**: Para ustedes, el chat de Tawk.to no cambia. Verán las conversaciones como siempre. La única diferencia es que ahora un "agente IA" responderá automáticamente a las preguntas más comunes. Siempre pueden intervenir en una conversación si lo consideran necesario.

El objetivo es que este sistema les ahorre tiempo respondiendo preguntas repetitivas, para que ustedes puedan enfocarse en los clientes que realmente necesitan ayuda humana.
