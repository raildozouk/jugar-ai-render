import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Formato customizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para console (mais legível)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transports
const transports = [
  // Console
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
];

// Adicionar file transports apenas em produção
if (process.env.NODE_ENV === 'production') {
  // Logs de erro
  transports.push(
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: customFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  );

  // Logs combinados
  transports.push(
    new DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      format: customFormat,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: transports,
  exitOnError: false
});

// Adicionar métodos customizados
logger.logRequest = (req, res, duration) => {
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
};

logger.logOpenAI = (tokensUsed, cost, fromCache) => {
  logger.info('OpenAI API Call', {
    tokensUsed,
    cost: `$${cost.toFixed(4)}`,
    fromCache,
    saved: fromCache ? 'YES' : 'NO'
  });
};

logger.logWebhook = (chatId, visitorName, messageLength) => {
  logger.info('Webhook Received', {
    chatId,
    visitorName,
    messageLength
  });
};

logger.logGamblingAlert = (chatId, visitorName, message) => {
  logger.warn('Gambling Problem Detected', {
    chatId,
    visitorName,
    messagePreview: message.substring(0, 100)
  });
};

logger.logCache = (operation, key, hit = null) => {
  const meta = { operation, key };
  if (hit !== null) {
    meta.hit = hit;
  }
  logger.debug('Cache Operation', meta);
};

logger.logDatabase = (query, duration) => {
  logger.debug('Database Query', {
    query: query.substring(0, 100),
    duration: `${duration}ms`
  });
};

// Capturar exceções não tratadas
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    })
  );
}

export default logger;
