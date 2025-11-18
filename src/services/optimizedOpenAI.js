import OpenAI from 'openai';
import crypto from 'crypto';
import cache from '../cache/redisClient.js';
import ragService from '../rag/ragService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class OptimizedOpenAIService {
  constructor() {
    this.model = process.env.MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(process.env.MAX_TOKENS) || 500;
    this.temperature = parseFloat(process.env.TEMPERATURE) || 0.7;
    this.cacheTTL = 3600; // 1 hora
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
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
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }, // por 1K tokens
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 }
    };
    
    const price = prices[model] || prices['gpt-4-turbo-preview'];
    const cost = (tokens / 1000) * ((price.input + price.output) / 2);
    return cost;
  }

  /**
   * Verifica se a mensagem é similar a uma anterior (cache semântico)
   */
  async findSimilarCachedResponse(message) {
    try {
      // Buscar respostas recentes do cache
      const recentKeys = await cache.client?.keys('openai:*') || [];
      
      if (recentKeys.length === 0) return null;

      // Verificar se há uma mensagem muito similar (mesmo hash)
      const cacheKey = this.generateCacheKey(message);
      const cached = await cache.get(cacheKey);
      
      return cached;
    } catch (error) {
      console.error('Erro buscando cache semântico:', error.message);
      return null;
    }
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

      // 2. Buscar contexto relevante usando RAG
      let context = '';
      let relevantChunks = [];
      
      if (ragService.isReady()) {
        relevantChunks = await ragService.searchRelevantChunks(userMessage, 3);
        context = ragService.buildContext(relevantChunks);
      }

      // 3. Construir prompt otimizado
      const systemPrompt = this.buildOptimizedPrompt(context);

      // 4. Preparar mensagens
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-4), // Limitar histórico para economizar tokens
        { role: 'user', content: userMessage }
      ];

      // 5. Chamar OpenAI
      console.log('🤖 Chamando OpenAI API...');
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const assistantMessage = response.choices[0].message.content;
      const tokensUsed = response.usage.total_tokens;
      const cost = this.calculateCost(tokensUsed, this.model);

      // 6. Atualizar estatísticas
      this.stats.totalTokens += tokensUsed;
      this.stats.estimatedCost += cost;

      console.log(`💰 Tokens usados: ${tokensUsed} | Custo: $${cost.toFixed(4)}`);

      // 7. Salvar no cache
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
        usage: response.usage,
        cost: cost
      };

    } catch (error) {
      console.error('❌ Erro gerando resposta:', error.message);
      throw error;
    }
  }

  /**
   * Constrói prompt otimizado (mais curto = menos tokens)
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
${context.substring(0, 1500)}`; // Limitar contexto para economizar
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
   * Resposta rápida para ludopatía (sem usar API)
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
        : 0
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
