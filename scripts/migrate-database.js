import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from '../src/database/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function migrate() {
  console.log('🔄 Iniciando migração do banco de dados...\n');

  try {
    // Conectar ao banco
    await db.connect();
    console.log('✅ Conectado ao PostgreSQL\n');

    // Ler arquivo de schema
    const schemaPath = path.join(__dirname, '../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Executando schema SQL...\n');

    // Executar schema
    await db.query(schema);

    console.log('✅ Schema aplicado com sucesso!\n');

    // Verificar tabelas criadas
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Tabelas criadas:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Migração concluída com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante migração:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.disconnect();
    process.exit(0);
  }
}

migrate();
