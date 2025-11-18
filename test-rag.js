import dotenv from 'dotenv';
import ragService from './src/rag/ragService.js';

dotenv.config();

async function testRAG() {
  console.log('🧪 Testando sistema RAG...\n');

  try {
    // Verificar se embeddings estão carregados
    if (!ragService.isReady()) {
      console.error('❌ Embeddings não disponíveis');
      process.exit(1);
    }

    console.log('✅ Embeddings carregados');
    const info = ragService.getInfo();
    console.log(`📊 Total de chunks: ${info.totalChunks}`);
    console.log(`🤖 Modelo: ${info.model}`);
    console.log(`📏 Dimensão: ${info.embeddingDimension}\n`);

    // Teste 1: Buscar jogos populares
    console.log('🎮 Teste 1: Buscar informação sobre jogos populares');
    const result1 = await ragService.searchRelevantChunks('¿Cuáles son los juegos más populares?', 3);
    console.log(`✅ Encontrados ${result1.length} chunks relevantes`);
    result1.forEach((chunk, i) => {
      console.log(`   ${i + 1}. Similaridade: ${chunk.similarity.toFixed(4)}`);
      console.log(`      Texto: ${chunk.text.substring(0, 100)}...\n`);
    });

    // Teste 2: Buscar informação sobre ludopatía
    console.log('⚠️  Teste 2: Buscar informação sobre ludopatía');
    const result2 = await ragService.searchRelevantChunks('Tengo problemas con el juego', 2);
    console.log(`✅ Encontrados ${result2.length} chunks relevantes`);
    result2.forEach((chunk, i) => {
      console.log(`   ${i + 1}. Similaridade: ${chunk.similarity.toFixed(4)}`);
      console.log(`      Texto: ${chunk.text.substring(0, 100)}...\n`);
    });

    // Teste 3: Buscar informação sobre depósitos
    console.log('💰 Teste 3: Buscar informação sobre depósitos');
    const result3 = await ragService.searchRelevantChunks('¿Cómo puedo depositar dinero?', 2);
    console.log(`✅ Encontrados ${result3.length} chunks relevantes`);
    result3.forEach((chunk, i) => {
      console.log(`   ${i + 1}. Similaridade: ${chunk.similarity.toFixed(4)}`);
      console.log(`      Texto: ${chunk.text.substring(0, 100)}...\n`);
    });

    console.log('🎉 Todos os testes do RAG passaram!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    process.exit(1);
  }
}

testRAG();
