# Backend de IA Avançado para JugarEnChile.com v2.0

Sistema completo de inteligencia artificial para chat de soporte con **funcionalidades empresariales avanzadas**: base de datos PostgreSQL, cache Redis, analytics en tiempo real, logging profesional y optimización automática de costos de API.

## 🚀 Características Principales

### ✅ Core Features
- **Webhook Tawk.to** con validación HMAC de seguridad
- **RAG (Retrieval-Augmented Generation)** con embeddings de OpenAI
- **Respuestas contextualizadas** usando GPT-4
- **Detección de ludopatía** con respuestas especializadas

### 🔥 Funcionalidades Avanzadas v2.0
- **PostgreSQL** para persistencia de conversaciones y mensajes
- **Redis Cache** para optimización de costos (respuestas cacheadas)
- **Analytics en tiempo real** con métricas detalladas
- **Logging profesional** con Winston (rotación diaria de logs)
- **Optimización automática de costos** (cache semántico)
- **Monitoreo de performance** con estadísticas detalladas
- **Sistema de métricas** para análisis de uso

## 💰 Optimización de Costos

El sistema implementa múltiples estrategias para **minimizar costos de API**:

### 1. Cache Inteligente
- Respuestas idénticas se sirven desde cache (0 tokens)
- TTL configurable (default: 1 hora)
- Cache hit rate tracking en tiempo real

### 2. Prompt Optimizado
- Prompts más cortos = menos tokens
- Contexto RAG limitado a 1500 caracteres
- Histórico de conversación limitado a últimos 4 mensajes

### 3. Detección de Patrones
- Preguntas sobre ludopatía usan respuestas pre-definidas (0 tokens)
- Sin llamadas a API para mensajes del sistema

### 4. Métricas de Costo
- Tracking de tokens usados por request
- Cálculo de costo estimado en tiempo real
- Estadísticas de ahorro por cache

**Ejemplo de ahorro**: Con 50% cache hit rate, el costo se reduce a la mitad.

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario en Tawk.to                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Webhook Validation                          │
│              (HMAC Signature Check)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Redis Cache Check                          │
│              (¿Respuesta ya existe?)                         │
└────────────┬───────────────────────┬────────────────────────┘
             │ Cache HIT             │ Cache MISS
             │ (0 tokens)            │
             ▼                       ▼
    ┌────────────────┐      ┌──────────────────┐
    │  Return Cache  │      │   RAG Service    │
    │   Response     │      │  (Embeddings)    │
    └────────────────┘      └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  OpenAI API      │
                            │  (GPT-4)         │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Save to Cache   │
                            └────────┬─────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (Save Conversation)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Analytics Tracking                            │
│         (Tokens, Cost, Performance)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Send Response to Tawk.to                        │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Estructura del Proyecto

```
/jugar-ai-render
├── /knowledge              → Base de conocimiento
│   ├── consolidated_knowledge.txt
│   └── embeddings.json
├── /scripts                → Scripts utilitarios
│   ├── generate-embeddings.js
│   └── migrate-database.js
├── /src
│   ├── /analytics          → Sistema de analytics
│   ├── /cache              → Redis cache client
│   ├── /controllers        → Controladores de rutas
│   ├── /database           → Configuración PostgreSQL
│   ├── /monitoring         → Logging con Winston
│   ├── /rag                → Sistema RAG
│   ├── /routes             → Definición de rutas
│   ├── /services           → Servicios (OpenAI optimizado)
│   ├── /tawk               → Integración Tawk.to
│   └── server.js           → Servidor principal
├── .env.example            → Variables de entorno
├── Dockerfile              → Docker configuration
├── package.json            → Dependencias
├── render.yaml             → Configuración Render.com
└── README.md               → Este archivo
```

## 🚀 Scripts Disponibles

```bash
# Instalar dependencias
npm install

# Iniciar servidor (producción)
npm start

# Iniciar servidor (desarrollo con hot-reload)
npm run dev

# Generar embeddings (OBLIGATORIO antes del primer deploy)
npm run generate-embeddings

# Migrar base de datos (crear tablas)
npm run db:migrate

# Ejecutar tests
npm test
```

## ⚙️ Variables de Entorno

### Obligatorias
```env
OPENAI_API_KEY=sk-...           # API key de OpenAI
TAWK_WEBHOOK_SECRET=...         # Secreto del webhook Tawk.to
TAWK_API_KEY=...                # API key de Tawk.to
TAWK_PROPERTY_ID=...            # Property ID de Tawk.to
```

### Opcionales (pero recomendadas)
```env
DATABASE_URL=postgresql://...   # PostgreSQL (si no está, funciona sin DB)
REDIS_URL=redis://...           # Redis (si no está, usa cache en memoria)
```

### Configurables
```env
PORT=10000                      # Puerto del servidor
NODE_ENV=production             # Entorno
LOG_LEVEL=info                  # Nivel de logging
MODEL=gpt-4-turbo-preview       # Modelo de OpenAI
MAX_TOKENS=500                  # Tokens máximos por respuesta
CACHE_TTL=3600                  # TTL del cache en segundos
```

## 📡 Endpoints Disponibles

### Producción

#### `POST /api/webhook`
Recibe webhooks de Tawk.to

#### `GET /api/status`
Estado del sistema con métricas en tiempo real
```json
{
  "system": { "status": "operational", "uptime": 12345 },
  "services": {
    "openai": { "stats": { "cacheHitRate": "45.2%" } },
    "cache": { "connected": true },
    "database": { "connected": true }
  }
}
```

#### `GET /api/analytics`
Analytics y métricas detalladas
```json
{
  "realtime": { "message_processed": 150 },
  "performance": { "avg_processing_time": 850 },
  "openaiStats": { "totalTokens": 45000, "estimatedCost": 1.35 }
}
```

### Testing

#### `POST /api/test`
Prueba el sistema sin Tawk.to
```bash
curl -X POST http://localhost:10000/api/test \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuáles son los juegos más populares?"}'
```

## 📈 Monitoreo y Métricas

### Estadísticas en Tiempo Real
- Total de requests
- Cache hit rate (% de respuestas desde cache)
- Tokens totales usados
- Costo estimado acumulado
- Tiempo promedio de respuesta

### Logs Estructurados
- Rotación diaria automática
- Logs de error separados
- Tracking de cada request HTTP
- Métricas de performance por query

### Analytics Persistentes
- Conversaciones guardadas en PostgreSQL
- Mensajes con metadata completa
- Detección de problemas de ludopatía
- Métricas de uso por día/semana/mes

## 💾 Base de Datos

### Tablas Principales
- **conversations**: Historial de conversaciones
- **messages**: Todos los mensajes con metadata
- **analytics**: Eventos de analytics
- **metrics**: Métricas de sistema
- **logs**: Logs persistentes
- **feedback**: Feedback de usuarios

### Migración
```bash
npm run db:migrate
```

Esto crea todas las tablas, índices y views necesarias.

## 🔒 Seguridad

- ✅ Validación HMAC de webhooks
- ✅ Helmet.js para headers de seguridad
- ✅ Variables de entorno para secretos
- ✅ Rate limiting (configurable)
- ✅ Sanitización de inputs
- ✅ Logs de auditoría

## 📦 Despliegue en Render.com

El archivo `render.yaml` está configurado para despliegue automático con:
- Servicio web Node.js
- Base de datos PostgreSQL
- Cache Redis (opcional)
- Auto-deploy desde GitHub
- Health checks automáticos

Ver **INSTALL_RENDER.md** para instrucciones detalladas.

## 🎯 Optimización de Costos - Ejemplo Real

### Sin Cache (Baseline)
- 1000 requests/día
- 500 tokens promedio por request
- Costo: ~$0.25/día = **$7.50/mes**

### Con Cache (50% hit rate)
- 1000 requests/día
- 500 requests desde cache (0 tokens)
- 500 requests a API (500 tokens cada una)
- Costo: ~$0.125/día = **$3.75/mes**

**Ahorro: 50% ($3.75/mes)**

### Con Cache + Optimizaciones (70% hit rate)
- 1000 requests/día
- 700 requests desde cache (0 tokens)
- 300 requests a API (400 tokens promedio con prompt optimizado)
- Costo: ~$0.06/día = **$1.80/mes**

**Ahorro: 76% ($5.70/mes)**

## 🤝 Para Javier Camello y Javier Cordero

Este sistema v2.0 es una actualización mayor que agrega:

1. **Ahorro de costos**: Las respuestas repetidas no gastan tokens
2. **Más rápido**: Cache responde en milisegundos
3. **Historial completo**: Todas las conversaciones se guardan
4. **Métricas detalladas**: Pueden ver estadísticas de uso
5. **Más confiable**: Logs profesionales para debugging

El chat sigue funcionando igual para ustedes, pero ahora es más eficiente y profesional.

## 📞 Soporte Técnico

- **Logs en vivo**: Render.com → Logs tab
- **Métricas**: `GET /api/analytics`
- **Estado**: `GET /api/status`

---

**Versión**: 2.0.0  
**Desarrollado para**: JugarEnChile.com  
**Tecnologías**: Node.js, Express, OpenAI, PostgreSQL, Redis, Winston
