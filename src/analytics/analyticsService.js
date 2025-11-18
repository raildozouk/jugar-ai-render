import db from '../database/config.js';
import cache from '../cache/redisClient.js';

class AnalyticsService {
  constructor() {
    this.eventQueue = [];
    this.flushInterval = 5000; // Flush a cada 5 segundos
    this.startAutoFlush();
  }

  /**
   * Registra evento de analytics
   */
  async trackEvent(eventType, eventData, metadata = {}) {
    const event = {
      event_type: eventType,
      event_data: eventData,
      user_id: metadata.userId || null,
      session_id: metadata.sessionId || null,
      ip_address: metadata.ipAddress || null,
      user_agent: metadata.userAgent || null,
      created_at: new Date()
    };

    // Adicionar à fila
    this.eventQueue.push(event);

    // Se a fila estiver grande, fazer flush imediato
    if (this.eventQueue.length >= 50) {
      await this.flush();
    }

    // Também incrementar contador no Redis para métricas em tempo real
    await cache.incr(`analytics:${eventType}:count`);
    await cache.expire(`analytics:${eventType}:count`, 86400); // 24h
  }

  /**
   * Flush da fila para o banco de dados
   */
  async flush() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Inserir em batch
      const values = events.map((e, i) => 
        `($${i*6+1}, $${i*6+2}, $${i*6+3}, $${i*6+4}, $${i*6+5}, $${i*6+6})`
      ).join(',');

      const params = events.flatMap(e => [
        e.event_type,
        JSON.stringify(e.event_data),
        e.user_id,
        e.session_id,
        e.ip_address,
        e.user_agent
      ]);

      await db.query(`
        INSERT INTO analytics 
        (event_type, event_data, user_id, session_id, ip_address, user_agent)
        VALUES ${values}
      `, params);

      console.log(`📊 Analytics: ${events.length} eventos salvos`);
    } catch (error) {
      console.error('Erro salvando analytics:', error.message);
      // Re-adicionar à fila em caso de erro
      this.eventQueue.push(...events);
    }
  }

  /**
   * Inicia flush automático
   */
  startAutoFlush() {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Registra mensagem processada
   */
  async trackMessage(data) {
    await this.trackEvent('message_processed', {
      conversationId: data.conversationId,
      messageLength: data.messageText?.length || 0,
      responseLength: data.aiResponse?.length || 0,
      processingTime: data.processingTime,
      tokensUsed: data.tokensUsed,
      fromCache: data.fromCache || false,
      gamblingProblemDetected: data.gamblingProblemDetected || false
    });
  }

  /**
   * Registra erro
   */
  async trackError(error, context = {}) {
    await this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      context: context
    });
  }

  /**
   * Obtém estatísticas em tempo real
   */
  async getRealtimeStats() {
    try {
      const keys = await cache.client?.keys('analytics:*:count') || [];
      const stats = {};

      for (const key of keys) {
        const count = await cache.get(key);
        const eventType = key.replace('analytics:', '').replace(':count', '');
        stats[eventType] = parseInt(count) || 0;
      }

      return stats;
    } catch (error) {
      console.error('Erro obtendo stats em tempo real:', error.message);
      return {};
    }
  }

  /**
   * Obtém relatório diário
   */
  async getDailyReport(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0];

      const result = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics
        WHERE DATE(created_at) = $1
        GROUP BY event_type
        ORDER BY count DESC
      `, [dateStr]);

      return result.rows;
    } catch (error) {
      console.error('Erro gerando relatório diário:', error.message);
      return [];
    }
  }

  /**
   * Obtém top eventos
   */
  async getTopEvents(limit = 10, days = 7) {
    try {
      const result = await db.query(`
        SELECT 
          event_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM analytics
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('Erro obtendo top eventos:', error.message);
      return [];
    }
  }

  /**
   * Obtém métricas de performance
   */
  async getPerformanceMetrics() {
    try {
      const result = await db.query(`
        SELECT 
          AVG((event_data->>'processingTime')::int) as avg_processing_time,
          MAX((event_data->>'processingTime')::int) as max_processing_time,
          MIN((event_data->>'processingTime')::int) as min_processing_time,
          AVG((event_data->>'tokensUsed')::int) as avg_tokens,
          SUM(CASE WHEN (event_data->>'fromCache')::boolean THEN 1 ELSE 0 END) as cache_hits,
          COUNT(*) as total_requests
        FROM analytics
        WHERE event_type = 'message_processed'
        AND created_at >= NOW() - INTERVAL '24 hours'
      `);

      return result.rows[0] || {};
    } catch (error) {
      console.error('Erro obtendo métricas de performance:', error.message);
      return {};
    }
  }
}

// Exportar instância singleton
const analytics = new AnalyticsService();
export default analytics;
