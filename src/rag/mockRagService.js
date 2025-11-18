import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mock RAG Service - Funciona sem chamadas à API OpenAI
 * Usa busca por palavras-chave em vez de embeddings semânticos
 */
class MockRAGService {
  constructor() {
    this.embeddings = null;
    this.embeddingsPath = path.join(__dirname, '../../knowledge/embeddings.json');
    this.loadEmbeddings();
  }

  /**
   * Carga los embeddings desde el archivo JSON
   */
  loadEmbeddings() {
    try {
      if (!fs.existsSync(this.embeddingsPath)) {
        console.warn('⚠️  Archivo de embeddings no encontrado');
        this.embeddings = null;
        return;
      }

      const data = fs.readFileSync(this.embeddingsPath, 'utf-8');
      this.embeddings = JSON.parse(data);
      console.log(`✅ Mock RAG: ${this.embeddings.embeddings.length} chunks cargados`);
    } catch (error) {
      console.error('❌ Error cargando embeddings:', error.message);
      this.embeddings = null;
    }
  }

  /**
   * Recarga los embeddings
   */
  reloadEmbeddings() {
    this.loadEmbeddings();
  }

  /**
   * Calcula similaridad basada en palabras clave (mock)
   */
  calculateKeywordSimilarity(query, text) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const textLower = text.toLowerCase();
    
    let matches = 0;
    queryWords.forEach(word => {
      if (textLower.includes(word)) {
        matches++;
      }
    });
    
    // Normalizar entre 0 y 1
    return matches / Math.max(queryWords.length, 1);
  }

  /**
   * Busca los chunks más relevantes usando palabras clave
   */
  async searchRelevantChunks(query, topK = 3) {
    if (!this.embeddings) {
      throw new Error('Embeddings no disponibles');
    }

    // Calcular similaridad con todos los chunks
    const similarities = this.embeddings.embeddings.map(item => ({
      id: item.id,
      text: item.text,
      similarity: this.calculateKeywordSimilarity(query, item.text),
      metadata: item.metadata
    }));

    // Ordenar por similitud descendente y tomar los top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    const results = similarities.slice(0, topK);
    
    console.log(`🔍 Mock RAG: Query="${query}" → ${results.length} chunks encontrados`);
    
    return results;
  }

  /**
   * Construye el contexto a partir de los chunks relevantes
   */
  buildContext(relevantChunks) {
    return relevantChunks
      .map((chunk, index) => `[Contexto ${index + 1}]\n${chunk.text}`)
      .join('\n\n');
  }

  /**
   * Verifica si los embeddings están disponibles
   */
  isReady() {
    return this.embeddings !== null;
  }

  /**
   * Obtiene información sobre los embeddings cargados
   */
  getInfo() {
    if (!this.embeddings) {
      return null;
    }

    return {
      totalChunks: this.embeddings.embeddings.length,
      model: this.embeddings.metadata.model + ' (Mock Mode)',
      embeddingDimension: this.embeddings.metadata.embeddingDimension,
      generatedAt: this.embeddings.metadata.generatedAt
    };
  }
}

// Exportar instancia singleton
const mockRagService = new MockRAGService();
export default mockRagService;
