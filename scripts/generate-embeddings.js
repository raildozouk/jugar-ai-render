import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Configuración de rutas para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

// Inicializar cliente OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuración
const KNOWLEDGE_FILE = path.join(__dirname, '../knowledge/consolidated_knowledge.txt');
const OUTPUT_FILE = path.join(__dirname, '../knowledge/embeddings.json');
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';
const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = parseInt(process.env.CHUNK_OVERLAP) || 200;

/**
 * Divide el texto en chunks con overlap
 */
function splitTextIntoChunks(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    start += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Genera embeddings para un chunk de texto
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generando embedding:', error.message);
    throw error;
  }
}

/**
 * Calcula similitud coseno entre dos vectores
 */
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando generación de embeddings...\n');
  
  // Verificar que existe el archivo de conocimiento
  if (!fs.existsSync(KNOWLEDGE_FILE)) {
    console.error(`❌ Error: No se encontró el archivo ${KNOWLEDGE_FILE}`);
    process.exit(1);
  }
  
  // Verificar API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY no está configurada');
    console.error('Por favor, configura la variable de entorno OPENAI_API_KEY');
    process.exit(1);
  }
  
  console.log(`📖 Leyendo archivo: ${KNOWLEDGE_FILE}`);
  const knowledgeText = fs.readFileSync(KNOWLEDGE_FILE, 'utf-8');
  
  console.log(`📏 Tamaño del texto: ${knowledgeText.length} caracteres`);
  console.log(`🔪 Dividiendo en chunks de ${CHUNK_SIZE} caracteres con overlap de ${CHUNK_OVERLAP}...\n`);
  
  const chunks = splitTextIntoChunks(knowledgeText, CHUNK_SIZE, CHUNK_OVERLAP);
  console.log(`✂️  Total de chunks creados: ${chunks.length}\n`);
  
  const embeddings = [];
  
  // Generar embeddings para cada chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`⚙️  Procesando chunk ${i + 1}/${chunks.length}...`);
    
    try {
      const embedding = await generateEmbedding(chunk);
      
      embeddings.push({
        id: i,
        text: chunk,
        embedding: embedding,
        metadata: {
          length: chunk.length,
          index: i
        }
      });
      
      console.log(`✅ Chunk ${i + 1} procesado exitosamente`);
      
      // Pequeña pausa para evitar rate limits
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error procesando chunk ${i + 1}:`, error.message);
      throw error;
    }
  }
  
  // Guardar embeddings
  console.log(`\n💾 Guardando embeddings en: ${OUTPUT_FILE}`);
  
  const output = {
    metadata: {
      model: EMBEDDING_MODEL,
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      totalChunks: embeddings.length,
      generatedAt: new Date().toISOString(),
      embeddingDimension: embeddings[0].embedding.length
    },
    embeddings: embeddings
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  console.log('✅ Embeddings generados exitosamente!\n');
  console.log('📊 Estadísticas:');
  console.log(`   - Total de chunks: ${embeddings.length}`);
  console.log(`   - Dimensión de embeddings: ${embeddings[0].embedding.length}`);
  console.log(`   - Modelo usado: ${EMBEDDING_MODEL}`);
  console.log(`   - Archivo de salida: ${OUTPUT_FILE}\n`);
  
  console.log('🎉 Proceso completado!');
}

// Ejecutar script
main().catch(error => {
  console.error('\n❌ Error fatal:', error);
  process.exit(1);
});
