import OpenAI from 'openai';
import crypto from 'crypto';
import cache from '../cache/redisClient.js';
// Importar RAG service dinamicamente para evitar problemas de inicialização
let ragService = null;
try {
  const mockRagModule = await import('../rag/mockRagService.js');
  ragService = mockRagModule.default;
} catch (error) {
  console.warn('⚠️  RAG service não disponível');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key'
});

class OptimizedOpenAIService {
  constructor() {
    this.model = process.env.MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(process.env.MAX_TOKENS) || 500;
    this.temperature = parseFloat(process.env.TEMPERATURE) || 0.7;
    this.cacheTTL = 3600; // 1 hora
    this.mockMode = true; // Modo mock ativado - funciona sem custos de API
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
    
    if (this.mockMode) {
      console.log('⚠️  OpenAI en modo MOCK - usando respuestas simuladas');
    }
  }

  /**
   * Gera hash da mensagem para cache
   */
  generateCacheKey(message, context = '') {
    const content = message + context;
    return `openai:${crypto.createHash('md5').update(content).digest('hex')}`;
  }

  /**
   * Calcula custo estimado baseado em tokens
   */
  calculateCost(tokens, model) {
    const prices = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    };
    
    const price = prices[model] || prices['gpt-4-turbo-preview'];
    const cost = (tokens / 1000) * ((price.input + price.output) / 2);
    return cost;
  }

  /**
   * Genera respuesta mock (para demonstração)
   */
  generateMockResponse(userMessage, context) {
    // Detectar tipo de pergunta
    const lower = userMessage.toLowerCase();
    
    if (lower.includes('juego') && (lower.includes('popular') || lower.includes('mejor'))) {
      return `Los juegos más populares en JugarEnChile.com son Book of Dead, Starburst, Sweet Bonanza, Gates of Olympus y Wolf Gold. Todos ofrecen excelentes premios y entretenimiento garantizado para jugar en jugarenchile.com`;
    }
    
    if (lower.includes('deposit') || lower.includes('dinero') || lower.includes('pago')) {
      return `Puedes depositar mediante transferencia bancaria, tarjetas Visa/Mastercard, Mercado Pago, Khipu o WebPay. Los depósitos son instantáneos y seguros para jugar en jugarenchile.com`;
    }
    
    if (lower.includes('retir') || lower.includes('sacar')) {
      return `Los retiros se procesan en 24-48 horas hábiles después de la verificación. El monto mínimo es $10.000 CLP para jugar en jugarenchile.com`;
    }
    
    if (lower.includes('bono') || lower.includes('promoc')) {
      return `Ofrecemos bonos de bienvenida para nuevos jugadores, giros gratis y cashback. Consulta términos y condiciones para jugar en jugarenchile.com`;
    }
    
    if (lower.includes('segur') || lower.includes('confia')) {
      return `JugarEnChile.com utiliza encriptación SSL de 256 bits, la misma tecnología que los bancos. Somos una plataforma 100% segura y legal para jugar en jugarenchile.com`;
    }
    
    // Respuesta genérica
    return `Gracias por tu consulta. En JugarEnChile.com ofrecemos una experiencia de casino online segura y responsable. Contamos con los mejores juegos, bonos atractivos y soporte 24/7 para jugar en jugarenchile.com`;
  }

  /**
   * Gera resposta otimizada com cache
   */
  async generateResponse(userMessage, conversationHistory = [], useCache = true) {
    this.stats.totalRequests++;

    try {
      // 1. Tentar buscar do cache
      if (useCache) {
        const cacheKey = this.generateCacheKey(userMessage);
        const cachedResponse = await cache.get(cacheKey);
        
        if (cachedResponse) {
          this.stats.cacheHits++;
          console.log('💰 Resposta do CACHE - 0 tokens usados!');
          return {
            response: cachedResponse.response,
            fromCache: true,
            relevantChunks: cachedResponse.relevantChunks || [],
            usage: { total_tokens: 0 },
            cost: 0
          };
        }
        
        this.stats.cacheMisses++;
      }

      // 2. Buscar contexto relevante usando Mock RAG
      let context = '';
      let relevantChunks = [];
      
      if (ragService && ragService.isReady()) {
        relevantChunks = await ragService.searchRelevantChunks(userMessage, 3);
        context = ragService.buildContext(relevantChunks);
      }

      // 3. Gerar resposta (mock ou real)
      let assistantMessage;
      let tokensUsed = 0;
      let cost = 0;

      if (this.mockMode) {
        // Modo mock - sem chamada à API
        assistantMessage = this.generateMockResponse(userMessage, context);
        tokensUsed = 0;
        cost = 0;
        console.log('🤖 Resposta MOCK gerada (0 tokens)');
      } else {
        // Modo real - chamar OpenAI
        const systemPrompt = this.buildOptimizedPrompt(context);
        const messages = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory.slice(-4),
          { role: 'user', content: userMessage }
        ];

        console.log('🤖 Chamando OpenAI API...');
        const response = await openai.chat.completions.create({
          model: this.model,
          messages: messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        });

        assistantMessage = response.choices[0].message.content;
        tokensUsed = response.usage.total_tokens;
        cost = this.calculateCost(tokensUsed, this.model);
      }

      // 4. Atualizar estatísticas
      this.stats.totalTokens += tokensUsed;
      this.stats.estimatedCost += cost;

      if (tokensUsed > 0) {
        console.log(`💰 Tokens usados: ${tokensUsed} | Custo: $${cost.toFixed(4)}`);
      }

      // 5. Salvar no cache
      if (useCache) {
        const cacheKey = this.generateCacheKey(userMessage);
        await cache.set(cacheKey, {
          response: assistantMessage,
          relevantChunks: relevantChunks.map(c => ({
            text: c.text.substring(0, 200),
            similarity: c.similarity
          }))
        }, this.cacheTTL);
      }

      return {
        response: assistantMessage,
        fromCache: false,
        relevantChunks: relevantChunks.map(c => ({
          text: c.text.substring(0, 200),
          similarity: c.similarity
        })),
        usage: { total_tokens: tokensUsed },
        cost: cost
      };

    } catch (error) {
      console.error('❌ Erro gerando resposta:', error.message);
      
      // Fallback para resposta mock em caso de erro
      const mockResponse = this.generateMockResponse(userMessage, '');
      return {
        response: mockResponse,
        fromCache: false,
        relevantChunks: [],
        usage: { total_tokens: 0 },
        cost: 0,
        error: error.message
      };
    }
  }

  /**
   * Constrói prompt otimizado
   */
  buildOptimizedPrompt(context) {
    const basePrompt = `Eres asistente IA de JugarEnChile.com (casino online chileno).

REGLAS:
- Respuestas cortas (máx 3 párrafos)
- Tono profesional y empático
- Termina con: "para jugar en jugarenchile.com"
- Si detectas ludopatía, prioriza ayuda

DATOS CHILE:
- Salario mínimo: $460.000 CLP
- Edad mínima: 18 años`;

    if (context) {
      return `${basePrompt}

CONTEXTO:
${context.substring(0, 1500)}`;
    }

    return basePrompt;
  }

  /**
   * Detecta problemas de ludopatía
   */
  detectGamblingProblem(message) {
    const indicators = [
      'no puedo parar', 'he perdido mucho', 'necesito recuperar',
      'estoy en deuda', 'mi familia', 'adicto', 'ayuda', 'problema',
      'controlar', 'demasiado dinero'
    ];

    const lower = message.toLowerCase();
    return indicators.some(ind => lower.includes(ind));
  }

  /**
   * Resposta rápida para ludopatía
   */
  async generateSupportResponse() {
    return `Entiendo tu preocupación. Es valiente buscar ayuda.

Te recomiendo:
1. Línea de Ayuda: 600 360 7777 (SENDA Chile)
2. Jugadores Anónimos Chile
3. Autoexclusión en tu cuenta

Pedir ayuda es fortaleza. ¿Te ayudo a configurar límites en tu cuenta?`;
  }

  /**
   * Obtém estatísticas de uso
   */
  getStats() {
    const cacheHitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      cacheHitRate: `${cacheHitRate}%`,
      avgTokensPerRequest: this.stats.cacheMisses > 0
        ? Math.round(this.stats.totalTokens / this.stats.cacheMisses)
        : 0,
      mockMode: this.mockMode
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
  }
}

// Exportar instância singleton
const optimizedOpenAI = new OptimizedOpenAIService();
export default optimizedOpenAI;
