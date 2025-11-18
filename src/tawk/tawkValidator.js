import crypto from 'crypto';

class TawkValidator {
  constructor() {
    this.webhookSecret = process.env.TAWK_WEBHOOK_SECRET;
  }

  /**
   * Valida la firma del webhook de Tawk.to
   * Tawk.to envía un header 'X-Tawk-Signature' con HMAC SHA256
   */
  validateSignature(payload, signature) {
    if (!this.webhookSecret) {
      console.warn('⚠️  TAWK_WEBHOOK_SECRET no configurado - validación deshabilitada');
      return true; // En desarrollo, permitir sin validación
    }

    if (!signature) {
      console.error('❌ No se recibió firma en el webhook');
      return false;
    }

    try {
      // Calcular HMAC SHA256 del payload
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const calculatedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

      // Comparar firmas de manera segura
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedSignature)
      );
    } catch (error) {
      console.error('Error validando firma:', error.message);
      return false;
    }
  }

  /**
   * Valida que el payload tenga la estructura esperada
   */
  validatePayload(payload) {
    if (!payload) {
      return { valid: false, error: 'Payload vacío' };
    }

    // Validar campos requeridos según documentación de Tawk.to
    if (!payload.message) {
      return { valid: false, error: 'Campo "message" faltante' };
    }

    if (!payload.message.text) {
      return { valid: false, error: 'Campo "message.text" faltante' };
    }

    if (!payload.visitor) {
      return { valid: false, error: 'Campo "visitor" faltante' };
    }

    return { valid: true };
  }

  /**
   * Extrae información relevante del payload de Tawk.to
   */
  extractMessageInfo(payload) {
    return {
      messageText: payload.message.text,
      messageId: payload.message.id || null,
      visitorId: payload.visitor.id || null,
      visitorName: payload.visitor.name || 'Visitante',
      visitorEmail: payload.visitor.email || null,
      conversationId: payload.chatId || null,
      timestamp: payload.time || new Date().toISOString(),
      propertyId: payload.property?.id || null
    };
  }

  /**
   * Verifica si el mensaje es del visitante (no del agente)
   */
  isVisitorMessage(payload) {
    // Tawk.to indica el tipo de mensaje
    return payload.message?.type === 'visitor' || 
           payload.message?.sender === 'visitor' ||
           !payload.message?.sender; // Por defecto asumimos visitante
  }

  /**
   * Verifica si el webhook debe ser procesado
   */
  shouldProcessWebhook(payload) {
    // Solo procesar mensajes de visitantes
    if (!this.isVisitorMessage(payload)) {
      return { process: false, reason: 'Mensaje no es del visitante' };
    }

    // Ignorar mensajes vacíos
    if (!payload.message?.text?.trim()) {
      return { process: false, reason: 'Mensaje vacío' };
    }

    // Ignorar mensajes automáticos del sistema
    if (payload.message?.text?.startsWith('[Sistema]')) {
      return { process: false, reason: 'Mensaje del sistema' };
    }

    return { process: true };
  }
}

// Exportar instancia singleton
const tawkValidator = new TawkValidator();
export default tawkValidator;
