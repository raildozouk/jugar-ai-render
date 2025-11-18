import OpenAI from 'openai';
import ragService from '../rag/ragService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class OpenAIService {
  constructor() {
    this.model = process.env.MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(process.env.MAX_TOKENS) || 500;
    this.temperature = parseFloat(process.env.TEMPERATURE) || 0.7;
  }

  /**
   * Genera una respuesta usando RAG + OpenAI
   */
  async generateResponse(userMessage, conversationHistory = []) {
    try {
      // Buscar contexto relevante usando RAG
      let context = '';
      let relevantChunks = [];
      
      if (ragService.isReady()) {
        relevantChunks = await ragService.searchRelevantChunks(userMessage, 3);
        context = ragService.buildContext(relevantChunks);
      } else {
        console.warn('⚠️  RAG no disponible, respondiendo sin contexto');
      }

      // Construir el prompt del sistema
      const systemPrompt = this.buildSystemPrompt(context);

      // Construir mensajes para la API
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Llamar a OpenAI
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const assistantMessage = response.choices[0].message.content;

      return {
        response: assistantMessage,
        relevantChunks: relevantChunks.map(c => ({
          text: c.text.substring(0, 200) + '...',
          similarity: c.similarity
        })),
        usage: response.usage
      };
    } catch (error) {
      console.error('Error generando respuesta:', error.message);
      throw error;
    }
  }

  /**
   * Construye el prompt del sistema con contexto RAG
   */
  buildSystemPrompt(context) {
    const basePrompt = `Eres un asistente virtual profesional de JugarEnChile.com, un casino online chileno operado por Fantasy Games SPA.

Tu rol es:
- Responder preguntas sobre la plataforma, juegos, promociones y servicios
- Proporcionar información precisa basada en el contexto proporcionado
- Mantener un tono profesional, empático y responsable
- Promover el juego responsable y detectar señales de ludopatía
- Ser conciso y directo en tus respuestas
- SIEMPRE terminar tus respuestas con la frase: "para jugar en jugarenchile.com"

Directrices importantes:
1. Si detectas señales de ludopatía o juego problemático, prioriza la ayuda y recursos de apoyo
2. Nunca promuevas el juego excesivo o irresponsable
3. Sé empático con los clientes que expresan preocupaciones
4. Proporciona información clara sobre límites de depósito y autoexclusión cuando sea relevante
5. Si no tienes información específica, sé honesto y ofrece contactar con soporte humano
6. Mantén las respuestas cortas y objetivas (máximo 3-4 párrafos)

Información sobre Chile:
- Salario mínimo: $460.000 CLP
- Edad mínima para jugar: 18 años
- Métodos de pago populares: Transferencias, WebPay, Mercado Pago, Khipu`;

    if (context) {
      return `${basePrompt}

CONTEXTO RELEVANTE DE LA BASE DE CONOCIMIENTO:
${context}

Usa este contexto para responder la pregunta del usuario de manera precisa y específica.`;
    }

    return basePrompt;
  }

  /**
   * Genera una respuesta rápida sin RAG (para mensajes simples)
   */
  async generateQuickResponse(userMessage) {
    try {
      const messages = [
        {
          role: 'system',
          content: 'Eres un asistente de JugarEnChile.com. Responde de manera breve y profesional. Termina con: "para jugar en jugarenchile.com"'
        },
        {
          role: 'user',
          content: userMessage
        }
      ];

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error generando respuesta rápida:', error.message);
      throw error;
    }
  }

  /**
   * Detecta si el mensaje indica problemas de ludopatía
   */
  detectGamblingProblem(message) {
    const problemIndicators = [
      'no puedo parar',
      'he perdido mucho',
      'necesito recuperar',
      'estoy en deuda',
      'mi familia',
      'adicto',
      'ayuda',
      'problema',
      'controlar',
      'demasiado dinero'
    ];

    const lowerMessage = message.toLowerCase();
    return problemIndicators.some(indicator => lowerMessage.includes(indicator));
  }

  /**
   * Genera respuesta especial para casos de ludopatía
   */
  async generateSupportResponse() {
    return `Entiendo tu preocupación y es muy valiente de tu parte buscar ayuda. El juego debe ser siempre entretenimiento, nunca una fuente de problemas.

Te recomiendo:
1. Contactar la Línea de Ayuda: 600 360 7777 (SENDA Chile)
2. Visitar Jugadores Anónimos Chile
3. Usar nuestra opción de autoexclusión en tu cuenta
4. Hablar con alguien de confianza

Recuerda: pedir ayuda es un signo de fortaleza. Estamos aquí para apoyarte, no solo para jugar.

¿Te gustaría que te ayude a configurar límites en tu cuenta o activar la autoexclusión?`;
  }
}

// Exportar instancia singleton
const openaiService = new OpenAIService();
export default openaiService;
