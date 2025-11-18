import tawkValidator from '../tawk/tawkValidator.js';
import tawkClient from '../tawk/tawkClient.js';
import optimizedOpenAI from '../services/optimizedOpenAI.js';
import analytics from '../analytics/analyticsService.js';
import logger from '../monitoring/logger.js';
import db from '../database/config.js';

class WebhookController {
  /**
   * Maneja el webhook de Tawk.to con funcionalidades avanzadas
   */
  async handleTawkWebhook(req, res) {
    const startTime = Date.now();
    
    try {
      logger.info('📨 Webhook recibido de Tawk.to');

      const payload = req.body;
      const signature = req.headers['x-tawk-signature'];

      // 1. Validar firma del webhook
      if (!tawkValidator.validateSignature(payload, signature)) {
        logger.error('❌ Firma inválida del webhook');
        await analytics.trackEvent('webhook_invalid_signature', { payload });
        return res.status(401).json({ error: 'Firma inválida' });
      }

      // 2. Validar estructura del payload
      const payloadValidation = tawkValidator.validatePayload(payload);
      if (!payloadValidation.valid) {
        logger.error('❌ Payload inválido:', payloadValidation.error);
        await analytics.trackEvent('webhook_invalid_payload', { error: payloadValidation.error });
        return res.status(400).json({ error: payloadValidation.error });
      }

      // 3. Verificar si debe procesarse
      const shouldProcess = tawkValidator.shouldProcessWebhook(payload);
      if (!shouldProcess.process) {
        logger.info('ℹ️  Webhook ignorado:', shouldProcess.reason);
        return res.status(200).json({ 
          message: 'Webhook recibido pero no procesado',
          reason: shouldProcess.reason 
        });
      }

      // 4. Extraer información del mensaje
      const messageInfo = tawkValidator.extractMessageInfo(payload);
      logger.logWebhook(messageInfo.conversationId, messageInfo.visitorName, messageInfo.messageText.length);

      // 5. Guardar conversación en DB (si disponível)
      let conversationId = null;
      try {
        if (db.isConnected) {
          const conv = await this.saveConversation(messageInfo);
          conversationId = conv.id;
        }
      } catch (dbError) {
        logger.warn('⚠️  DB não disponível, continuando sem persistência');
      }

      // 6. Detectar problemas de ludopatía
      const hasGamblingProblem = optimizedOpenAI.detectGamblingProblem(messageInfo.messageText);
      
      let aiResponse;
      let tokensUsed = 0;
      let cost = 0;
      let fromCache = false;
      
      if (hasGamblingProblem) {
        logger.logGamblingAlert(messageInfo.conversationId, messageInfo.visitorName, messageInfo.messageText);
        aiResponse = await optimizedOpenAI.generateSupportResponse();
        
        // Track alerta
        await analytics.trackEvent('gambling_problem_detected', {
          chatId: messageInfo.conversationId,
          visitorName: messageInfo.visitorName
        });
      } else {
        // 7. Generar respuesta con IA (optimizada con cache)
        logger.info('🤖 Generando respuesta con IA...');
        const result = await optimizedOpenAI.generateResponse(messageInfo.messageText);
        
        aiResponse = result.response;
        tokensUsed = result.usage?.total_tokens || 0;
        cost = result.cost || 0;
        fromCache = result.fromCache || false;
        
        logger.logOpenAI(tokensUsed, cost, fromCache);
      }

      // 8. Guardar mensaje en DB
      const processingTime = Date.now() - startTime;
      
      try {
        if (db.isConnected && conversationId) {
          await this.saveMessage({
            conversationId,
            messageInfo,
            aiResponse,
            processingTime,
            tokensUsed,
            hasGamblingProblem
          });
        }
      } catch (dbError) {
        logger.warn('⚠️  Erro salvando mensagem no DB');
      }

      // 9. Enviar respuesta a Tawk.to
      if (messageInfo.conversationId) {
        logger.info('📤 Enviando respuesta a Tawk.to...');
        const sendResult = await tawkClient.sendMessage(
          messageInfo.conversationId,
          aiResponse
        );

        if (sendResult.success) {
          logger.info('✅ Respuesta enviada exitosamente');
        } else {
          logger.error('❌ Error enviando respuesta:', sendResult.error);
        }
      }

      // 10. Track analytics
      await analytics.trackMessage({
        conversationId: messageInfo.conversationId,
        messageText: messageInfo.messageText,
        aiResponse,
        processingTime,
        tokensUsed,
        fromCache,
        gamblingProblemDetected: hasGamblingProblem
      });

      // 11. Responder al webhook
      logger.info(`✅ Webhook procesado en ${processingTime}ms`);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook procesado exitosamente',
        visitor: messageInfo.visitorName,
        processingTime: `${processingTime}ms`,
        tokensUsed,
        cost: `$${cost.toFixed(4)}`,
        fromCache,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('❌ Error procesando webhook:', error);
      
      await analytics.trackError(error, {
        endpoint: '/api/webhook',
        processingTime
      });
      
      return res.status(500).json({
        error: 'Error interno procesando webhook',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Guarda conversación en DB
   */
  async saveConversation(messageInfo) {
    const result = await db.query(`
      INSERT INTO conversations (chat_id, visitor_id, visitor_name, visitor_email, message_count)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (chat_id) 
      DO UPDATE SET 
        last_message_at = CURRENT_TIMESTAMP,
        message_count = conversations.message_count + 1
      RETURNING id
    `, [
      messageInfo.conversationId,
      messageInfo.visitorId,
      messageInfo.visitorName,
      messageInfo.visitorEmail
    ]);

    return result.rows[0];
  }

  /**
   * Guarda mensaje en DB
   */
  async saveMessage(data) {
    await db.query(`
      INSERT INTO messages 
      (conversation_id, message_id, sender_type, message_text, ai_response, 
       processing_time_ms, tokens_used, gambling_problem_detected)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      data.conversationId,
      data.messageInfo.messageId,
      'visitor',
      data.messageInfo.messageText,
      data.aiResponse,
      data.processingTime,
      data.tokensUsed,
      data.hasGamblingProblem
    ]);
  }

  /**
   * Endpoint de prueba
   */
  async testEndpoint(req, res) {
    const startTime = Date.now();
    
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Campo "message" requerido' });
      }

      logger.info('🧪 Test endpoint - mensaje:', message);

      const result = await optimizedOpenAI.generateResponse(message);
      const processingTime = Date.now() - startTime;

      return res.status(200).json({
        success: true,
        userMessage: message,
        aiResponse: result.response,
        fromCache: result.fromCache,
        relevantChunks: result.relevantChunks,
        usage: result.usage,
        cost: `$${result.cost?.toFixed(4) || 0}`,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error en test endpoint:', error);
      
      return res.status(500).json({
        error: 'Error generando respuesta',
        message: error.message
      });
    }
  }

  /**
   * Endpoint de estado del sistema
   */
  async statusEndpoint(req, res) {
    try {
      const ragService = (await import('../rag/ragService.js')).default;
      const cache = (await import('../cache/redisClient.js')).default;
      
      const status = {
        timestamp: new Date().toISOString(),
        system: {
          status: 'operational',
          uptime: process.uptime(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
          }
        },
        services: {
          openai: {
            configured: !!process.env.OPENAI_API_KEY,
            model: process.env.MODEL || 'gpt-4-turbo-preview',
            stats: optimizedOpenAI.getStats()
          },
          tawk: tawkClient.getConfigStatus(),
          rag: {
            ready: ragService.isReady(),
            info: ragService.getInfo()
          },
          cache: {
            connected: cache.isConnected,
            stats: await cache.getStats()
          },
          database: db.getStatus()
        },
        analytics: await analytics.getRealtimeStats()
      };

      return res.status(200).json(status);

    } catch (error) {
      logger.error('Error en status endpoint:', error);
      
      return res.status(500).json({
        error: 'Error obteniendo estado',
        message: error.message
      });
    }
  }

  /**
   * Endpoint de analytics
   */
  async analyticsEndpoint(req, res) {
    try {
      const { period = 'daily', days = 7 } = req.query;

      const data = {
        realtime: await analytics.getRealtimeStats(),
        topEvents: await analytics.getTopEvents(10, parseInt(days)),
        performance: await analytics.getPerformanceMetrics(),
        openaiStats: optimizedOpenAI.getStats()
      };

      if (period === 'daily') {
        data.dailyReport = await analytics.getDailyReport();
      }

      return res.status(200).json(data);

    } catch (error) {
      logger.error('Error en analytics endpoint:', error);
      
      return res.status(500).json({
        error: 'Error obteniendo analytics',
        message: error.message
      });
    }
  }
}

// Exportar instância
const webhookController = new WebhookController();
export default webhookController;
