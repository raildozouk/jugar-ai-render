import Redis from 'ioredis';

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Conecta ao Redis
   */
  async connect() {
    if (this.isConnected) {
      return this.client;
    }

    try {
      // Se não houver REDIS_URL, usar modo mock (sem cache)
      if (!process.env.REDIS_URL) {
        console.log('⚠️  Redis não configurado - cache desabilitado');
        this.client = new MockRedis();
        this.isConnected = true;
        return this.client;
      }

      this.client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true
      });

      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Conectado ao Redis');
      
      return this.client;
    } catch (error) {
      console.error('❌ Erro conectando ao Redis:', error.message);
      // Fallback para mock
      this.client = new MockRedis();
      this.isConnected = true;
      return this.client;
    }
  }

  /**
   * Busca valor do cache
   */
  async get(key) {
    if (!this.isConnected) await this.connect();
    
    try {
      const value = await this.client.get(key);
      if (value) {
        console.log(`✅ Cache HIT: ${key}`);
        return JSON.parse(value);
      }
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    } catch (error) {
      console.error('Erro ao buscar do cache:', error.message);
      return null;
    }
  }

  /**
   * Salva valor no cache
   */
  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error('Erro ao salvar no cache:', error.message);
      return false;
    }
  }

  /**
   * Remove valor do cache
   */
  async del(key) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.client.del(key);
      console.log(`🗑️  Cache DEL: ${key}`);
      return true;
    } catch (error) {
      console.error('Erro ao deletar do cache:', error.message);
      return false;
    }
  }

  /**
   * Limpa todo o cache
   */
  async flush() {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.client.flushall();
      console.log('🧹 Cache limpo completamente');
      return true;
    } catch (error) {
      console.error('Erro ao limpar cache:', error.message);
      return false;
    }
  }

  /**
   * Incrementa contador
   */
  async incr(key) {
    if (!this.isConnected) await this.connect();
    
    try {
      const value = await this.client.incr(key);
      return value;
    } catch (error) {
      console.error('Erro ao incrementar:', error.message);
      return null;
    }
  }

  /**
   * Define expiração
   */
  async expire(key, seconds) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Erro ao definir expiração:', error.message);
      return false;
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  async getStats() {
    if (!this.isConnected) await this.connect();
    
    try {
      const info = await this.client.info('stats');
      return {
        connected: this.isConnected,
        info: info
      };
    } catch (error) {
      return {
        connected: this.isConnected,
        error: error.message
      };
    }
  }
}

/**
 * Mock Redis para desenvolvimento sem Redis
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    console.log('📦 Usando MockRedis (cache em memória)');
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async setex(key, ttl, value) {
    this.store.set(key, {
      value: value,
      expiry: Date.now() + (ttl * 1000)
    });
    return 'OK';
  }

  async del(key) {
    this.store.delete(key);
    return 1;
  }

  async flushall() {
    this.store.clear();
    return 'OK';
  }

  async incr(key) {
    const current = parseInt(this.store.get(key)?.value || '0');
    const newValue = current + 1;
    this.store.set(key, { value: newValue.toString() });
    return newValue;
  }

  async expire(key, seconds) {
    const item = this.store.get(key);
    if (item) {
      item.expiry = Date.now() + (seconds * 1000);
    }
    return 1;
  }

  async info() {
    return `# Mock Redis Stats
keys:${this.store.size}`;
  }

  async connect() {
    return true;
  }
}

// Exportar instância singleton
const cache = new RedisCache();
export default cache;
