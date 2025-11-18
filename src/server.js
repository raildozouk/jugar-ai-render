import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import webhookRoutes from './routes/webhook.js';
import logger from './monitoring/logger.js';
import db from './database/config.js';
import cache from './cache/redisClient.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares de seguridad
// Configurar Helmet com CSP relaxado para dashboard
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());
app.use(compression());

// Middleware para parsear JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static('public'));

// Middleware de logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'JugarEnChile.com AI Backend v2.0 - Sistema operativo',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'Webhook Tawk.to',
      'RAG con OpenAI',
      'Cache Redis',
      'PostgreSQL',
      'Analytics avanzado',
      'Logging con Winston',
      'Optimización de costos'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    }
  });
});

// Rutas del webhook
app.use('/api', webhookRoutes);

// Manejo de errores 404
app.use((req, res) => {
  logger.warn('404 Not Found:', req.path);
  res.status(404).json({
    error: 'Endpoint no encontrado',
    path: req.path
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

// Función de inicialización
async function initialize() {
  try {
    logger.info('🚀 Iniciando JugarEnChile.com AI Backend v2.0...');
    
    // Conectar a servicios opcionales
    try {
      if (process.env.DATABASE_URL) {
        await db.connect();
        logger.info('✅ PostgreSQL conectado');
      } else {
        logger.warn('⚠️  DATABASE_URL no configurada - funcionando sin DB');
      }
    } catch (dbError) {
      logger.warn('⚠️  PostgreSQL no disponible - continuando sin DB');
    }

    try {
      await cache.connect();
      logger.info('✅ Cache conectado');
    } catch (cacheError) {
      logger.warn('⚠️  Cache usando modo mock (memoria)');
    }

    // Iniciar servidor
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
      logger.info(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`⏰ Timestamp: ${new Date().toISOString()}`);
      logger.info('✅ Sistema listo para recibir webhooks');
    });

  } catch (error) {
    logger.error('❌ Error fatal durante inicialización:', error);
    process.exit(1);
  }
}

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido, cerrando servidor...');
  
  try {
    await db.disconnect();
    logger.info('✅ Base de datos desconectada');
  } catch (error) {
    logger.error('Error desconectando DB:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recibido, cerrando servidor...');
  
  try {
    await db.disconnect();
    logger.info('✅ Base de datos desconectada');
  } catch (error) {
    logger.error('Error desconectando DB:', error);
  }
  
  process.exit(0);
});

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  logger.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Promise rechazada no manejada:', reason);
});

// Inicializar aplicación
initialize();
