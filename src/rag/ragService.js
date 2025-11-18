import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class RAGService {
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
        console.warn('⚠️  Archivo de embeddings no encontrado. Ejecuta: npm run generate-embeddings');
        this.embeddings = null;
        return;
      }

      const data = fs.readFileSync(this.embeddingsPath, 'utf-8');
      this.embeddings = JSON.parse(data);
      console.log(`✅ Embeddings cargados: ${this.embeddings.embeddings.length} chunks`);
    } catch (error) {
      console.error('❌ Error cargando embeddings:', error.message);
      this.embeddings = null;
    }
  }

  /**
   * Recarga los embeddings (útil si se regeneran)
   */
  reloadEmbeddings() {
    this.loadEmbeddings();
  }

  /**
   * Calcula similitud coseno entre dos vectores
   */
  cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Genera embedding para una consulta
   */
  async generateQueryEmbedding(query) {
    try {
      const response = await openai.embeddings.create({
        model: this.embeddings?.metadata?.model || 'text-embedding-3-large',
        input: query,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generando embedding de consulta:', error.message);
      throw error;
    }
  }

  /**
   * Busca los chunks más relevantes para una consulta
   */
  async searchRelevantChunks(query, topK = 3) {
    if (!this.embeddings) {
      throw new Error('Embeddings no disponibles. Ejecuta: npm run generate-embeddings');
    }

    // Generar embedding de la consulta
    const queryEmbedding = await this.generateQueryEmbedding(query);

    // Calcular similitud con todos los chunks
    const similarities = this.embeddings.embeddings.map(item => ({
      id: item.id,
      text: item.text,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
      metadata: item.metadata
    }));

    // Ordenar por similitud descendente y tomar los top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities.slice(0, topK);
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
      model: this.embeddings.metadata.model,
      embeddingDimension: this.embeddings.metadata.embeddingDimension,
      generatedAt: this.embeddings.metadata.generatedAt
    };
  }
}

// Exportar instancia singleton
const ragService = new RAGService();
export default ragService;
