import tawkValidator from '../tawk/tawkValidator.js';
import tawkClient from '../tawk/tawkClient.js';
import openaiService from '../services/openaiService.js';

class WebhookController {
  /**
   * Maneja el webhook de Tawk.to
   */
  async handleTawkWebhook(req, res) {
    try {
      console.log('\n📨 Webhook recibido de Tawk.to');
      console.log('Timestamp:', new Date().toISOString());

      const payload = req.body;
      const signature = req.headers['x-tawk-signature'];

      // 1. Validar firma del webhook
      if (!tawkValidator.validateSignature(payload, signature)) {
        console.error('❌ Firma inválida del webhook');
        return res.status(401).json({ error: 'Firma inválida' });
      }

      // 2. Validar estructura del payload
      const payloadValidation = tawkValidator.validatePayload(payload);
      if (!payloadValidation.valid) {
        console.error('❌ Payload inválido:', payloadValidation.error);
        return res.status(400).json({ error: payloadValidation.error });
      }

      // 3. Verificar si debe procesarse
      const shouldProcess = tawkValidator.shouldProcessWebhook(payload);
      if (!shouldProcess.process) {
        console.log('ℹ️  Webhook ignorado:', shouldProcess.reason);
        return res.status(200).json({ 
          message: 'Webhook recibido pero no procesado',
          reason: shouldProcess.reason 
        });
      }

      // 4. Extraer información del mensaje
      const messageInfo = tawkValidator.extractMessageInfo(payload);
      console.log('👤 Visitante:', messageInfo.visitorName);
      console.log('💬 Mensaje:', messageInfo.messageText);

      // 5. Detectar problemas de ludopatía
      const hasGamblingProblem = openaiService.detectGamblingProblem(messageInfo.messageText);
      
      let aiResponse;
      
      if (hasGamblingProblem) {
        console.log('⚠️  Detectado posible problema de ludopatía');
        aiResponse = await openaiService.generateSupportResponse();
      } else {
        // 6. Generar respuesta con IA (RAG + OpenAI)
        console.log('🤖 Generando respuesta con IA...');
        const result = await openaiService.generateResponse(messageInfo.messageText);
        aiResponse = result.response;
        
        console.log('✅ Respuesta generada');
        console.log('📊 Chunks relevantes:', result.relevantChunks.length);
        console.log('💰 Tokens usados:', result.usage?.total_tokens || 'N/A');
      }

      // 7. Enviar respuesta a Tawk.to
      if (messageInfo.conversationId) {
        console.log('📤 Enviando respuesta a Tawk.to...');
        const sendResult = await tawkClient.sendMessage(
          messageInfo.conversationId,
          aiResponse
        );

        if (sendResult.success) {
          console.log('✅ Respuesta enviada exitosamente a Tawk.to');
        } else {
          console.error('❌ Error enviando respuesta a Tawk.to:', sendResult.error);
        }
      }

      // 8. Responder al webhook
      return res.status(200).json({
        success: true,
        message: 'Webhook procesado exitosamente',
        visitor: messageInfo.visitorName,
        responseSent: !!messageInfo.conversationId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error procesando webhook:', error);
      
      return res.status(500).json({
        error: 'Error interno procesando webhook',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Endpoint de prueba para verificar el sistema
   */
  async testEndpoint(req, res) {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Campo "message" requerido' });
      }

      console.log('🧪 Test endpoint - mensaje:', message);

      // Generar respuesta
      const result = await openaiService.generateResponse(message);

      return res.status(200).json({
        success: true,
        userMessage: message,
        aiResponse: result.response,
        relevantChunks: result.relevantChunks,
        usage: result.usage,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error en test endpoint:', error);
      
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
      
      const status = {
        timestamp: new Date().toISOString(),
        system: {
          status: 'operational',
          uptime: process.uptime(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development'
        },
        services: {
          openai: {
            configured: !!process.env.OPENAI_API_KEY,
            model: process.env.MODEL || 'gpt-4-turbo-preview'
          },
          tawk: tawkClient.getConfigStatus(),
          rag: {
            ready: ragService.isReady(),
            info: ragService.getInfo()
          }
        }
      };

      return res.status(200).json(status);

    } catch (error) {
      console.error('Error en status endpoint:', error);
      
      return res.status(500).json({
        error: 'Error obteniendo estado',
        message: error.message
      });
    }
  }
}

// Exportar instancia
const webhookController = new WebhookController();
export default webhookController;
