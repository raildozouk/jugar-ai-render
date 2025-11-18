import pg from 'pg';
const { Pool } = pg;

class DatabaseConfig {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  /**
   * Inicializa a conexão com o banco de dados
   */
  async connect() {
    if (this.isConnected) {
      console.log('✅ Database já está conectado');
      return this.pool;
    }

    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
          rejectUnauthorized: false
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Testar conexão
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ Conectado ao PostgreSQL');
      
      return this.pool;
    } catch (error) {
      console.error('❌ Erro conectando ao PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Executa uma query
   */
  async query(text, params) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      console.log(`Query executada em ${duration}ms:`, text.substring(0, 50));
      return result;
    } catch (error) {
      console.error('Erro na query:', error.message);
      throw error;
    }
  }

  /**
   * Fecha a conexão
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔌 Desconectado do PostgreSQL');
    }
  }

  /**
   * Verifica se está conectado
   */
  getStatus() {
    return {
      connected: this.isConnected,
      poolSize: this.pool?.totalCount || 0,
      idleConnections: this.pool?.idleCount || 0,
      waitingClients: this.pool?.waitingCount || 0
    };
  }
}

// Exportar instância singleton
const db = new DatabaseConfig();
export default db;
