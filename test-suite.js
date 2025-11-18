import dotenv from 'dotenv';
import mockRagService from './src/rag/mockRagService.js';
import optimizedOpenAI from './src/services/optimizedOpenAI.js';
import cache from './src/cache/redisClient.js';

dotenv.config();

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    testsFailed++;
  }
}

async function testRAGService() {
  console.log('\n🧪 === Testando RAG Service ===\n');
  
  // Teste 1: Embeddings carregados
  assert(mockRagService.isReady(), 'Embeddings devem estar carregados');
  
  // Teste 2: Info dos embeddings
  const info = mockRagService.getInfo();
  assert(info !== null, 'Info dos embeddings deve existir');
  assert(info.totalChunks === 10, 'Deve ter 10 chunks');
  
  // Teste 3: Busca de chunks relevantes
  const results = await mockRagService.searchRelevantChunks('juegos populares', 3);
  assert(results.length === 3, 'Deve retornar 3 chunks');
  assert(results[0].similarity >= 0, 'Similaridade deve ser >= 0');
  
  // Teste 4: Build context
  const context = mockRagService.buildContext(results);
  assert(context.length > 0, 'Contexto deve ter conteúdo');
  assert(context.includes('[Contexto'), 'Contexto deve ter formatação correta');
}

async function testCacheService() {
  console.log('\n🧪 === Testando Cache Service ===\n');
  
  // Teste 1: Conexão
  await cache.connect();
  assert(cache.isConnected, 'Cache deve estar conectado');
  
  // Teste 2: Set e Get
  await cache.set('test:key', { value: 'test' }, 60);
  const value = await cache.get('test:key');
  assert(value !== null, 'Deve recuperar valor do cache');
  assert(value.value === 'test', 'Valor deve ser correto');
  
  // Teste 3: Delete
  await cache.del('test:key');
  const deletedValue = await cache.get('test:key');
  assert(deletedValue === null, 'Valor deletado não deve existir');
  
  // Teste 4: Increment
  await cache.incr('test:counter');
  await cache.incr('test:counter');
  const counter = await cache.get('test:counter');
  assert(parseInt(counter) === 2, 'Contador deve ser 2');
}

async function testOpenAIService() {
  console.log('\n🧪 === Testando OpenAI Service ===\n');
  
  // Teste 1: Stats iniciais
  const initialStats = optimizedOpenAI.getStats();
  assert(initialStats !== null, 'Stats devem existir');
  
  // Teste 2: Detectar ludopatía
  const hasProblema1 = optimizedOpenAI.detectGamblingProblem('no puedo parar de jugar');
  assert(hasProblema1 === true, 'Deve detectar problema de jogo');
  
  const hasProblema2 = optimizedOpenAI.detectGamblingProblem('¿cuáles son los juegos?');
  assert(hasProblema2 === false, 'Não deve detectar problema em pergunta normal');
  
  // Teste 3: Gerar resposta
  const result = await optimizedOpenAI.generateResponse('¿Cuáles son los juegos más populares?');
  assert(result.response.length > 0, 'Resposta deve ter conteúdo');
  assert(result.response.includes('jugarenchile.com'), 'Resposta deve incluir jugarenchile.com');
  
  // Teste 4: Cache funcionando
  const result2 = await optimizedOpenAI.generateResponse('¿Cuáles son los juegos más populares?');
  assert(result2.fromCache === true, 'Segunda chamada deve vir do cache');
  
  // Teste 5: Resposta de suporte para ludopatía
  const supportResponse = await optimizedOpenAI.generateSupportResponse();
  assert(supportResponse.includes('600 360 7777'), 'Resposta de suporte deve incluir linha de ajuda');
  
  // Teste 6: Stats atualizados
  const finalStats = optimizedOpenAI.getStats();
  assert(finalStats.totalRequests >= 2, 'Deve ter pelo menos 2 requests');
  assert(finalStats.cacheHits >= 1, 'Deve ter pelo menos 1 cache hit');
}

async function testIntegration() {
  console.log('\n🧪 === Testando Integração Completa ===\n');
  
  // Teste 1: RAG + OpenAI
  const ragResults = await mockRagService.searchRelevantChunks('depósito', 2);
  const context = mockRagService.buildContext(ragResults);
  assert(context.length > 0, 'RAG deve fornecer contexto');
  
  const response = await optimizedOpenAI.generateResponse('¿Cómo deposito?');
  assert(response.response.includes('deposit') || response.response.includes('dinero'), 
    'Resposta deve ser sobre depósito');
  
  // Teste 2: Cache + RAG + OpenAI
  const response2 = await optimizedOpenAI.generateResponse('¿Cómo deposito?');
  assert(response2.fromCache === true, 'Deve usar cache na segunda chamada');
  
  // Teste 3: Ludopatía detection + Support response
  const gamblingMessage = 'he perdido mucho dinero y no puedo parar';
  const hasProblema = optimizedOpenAI.detectGamblingProblem(gamblingMessage);
  assert(hasProblema === true, 'Deve detectar problema');
  
  if (hasProblema) {
    const supportResp = await optimizedOpenAI.generateSupportResponse();
    assert(supportResp.includes('ayuda'), 'Deve oferecer ajuda');
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando suite de testes automatizados...\n');
  console.log('=' .repeat(60));
  
  try {
    await testRAGService();
    await testCacheService();
    await testOpenAIService();
    await testIntegration();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 === Resultados Finais ===\n');
    console.log(`Total de testes: ${testsPassed + testsFailed}`);
    console.log(`✅ Passaram: ${testsPassed}`);
    console.log(`❌ Falharam: ${testsFailed}`);
    
    if (testsFailed === 0) {
      console.log('\n🎉 Todos os testes passaram com sucesso!\n');
      process.exit(0);
    } else {
      console.log(`\n❌ ${testsFailed} teste(s) falharam\n`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Erro fatal durante os testes:', error);
    process.exit(1);
  }
}

runAllTests();
