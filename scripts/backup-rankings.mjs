/**
 * Script para fazer backup dos rankings do HaxLab
 * 
 * USO:
 *   node scripts/backup-rankings.mjs
 * 
 * Salva os rankings em arquivos JSON na pasta scripts/backups/
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração do Firebase (mesma do projeto)
const firebaseConfig = {
  apiKey: "AIzaSyCM4kVzke9iC9yzRI8_A5vgLeyxhKPYQYE",
  authDomain: "haxlab-ranking.firebaseapp.com",
  projectId: "haxlab-ranking",
  storageBucket: "haxlab-ranking.firebasestorage.app",
  messagingSenderId: "757442993193",
  appId: "1:757442993193:web:9f1b084ce42afc873f5038",
  databaseURL: "https://haxlab-ranking-default-rtdb.firebaseio.com",
  measurementId: "G-VSD7RLYFKB"
};

console.log('🎮 HaxLab - Backup Rankings Script');
console.log('===================================');

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Faz backup de uma coleção
 */
async function backupCollection(collectionName) {
  console.log(`\n📂 Backing up collection: ${collectionName}`);
  
  const querySnapshot = await getDocs(collection(db, collectionName));
  const count = querySnapshot.size;
  
  if (count === 0) {
    console.log(`   No documents found in ${collectionName}`);
    return [];
  }
  
  const data = [];
  querySnapshot.forEach((docSnapshot) => {
    data.push({
      id: docSnapshot.id,
      ...docSnapshot.data()
    });
  });
  
  console.log(`   Found ${count} documents`);
  return data;
}

async function main() {
  try {
    // Criar pasta de backups se não existir
    const backupsDir = join(__dirname, 'backups');
    if (!existsSync(backupsDir)) {
      mkdirSync(backupsDir, { recursive: true });
    }
    
    // Timestamp para o backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    // Backup rankings oficiais
    const officialRankings = await backupCollection('rankings');
    const officialFile = join(backupsDir, `rankings-official-${timestamp}.json`);
    writeFileSync(officialFile, JSON.stringify(officialRankings, null, 2));
    console.log(`   ✅ Saved to: ${officialFile}`);
    
    // Backup rankings da comunidade
    const communityRankings = await backupCollection('community_rankings');
    const communityFile = join(backupsDir, `rankings-community-${timestamp}.json`);
    writeFileSync(communityFile, JSON.stringify(communityRankings, null, 2));
    console.log(`   ✅ Saved to: ${communityFile}`);
    
    // Backup completo (ambos)
    const allRankings = {
      timestamp: new Date().toISOString(),
      official: officialRankings,
      community: communityRankings,
      totals: {
        official: officialRankings.length,
        community: communityRankings.length,
        total: officialRankings.length + communityRankings.length
      }
    };
    const allFile = join(backupsDir, `rankings-all-${timestamp}.json`);
    writeFileSync(allFile, JSON.stringify(allRankings, null, 2));
    console.log(`\n📦 Complete backup saved to: ${allFile}`);
    
    console.log('\n===================================');
    console.log('✅ BACKUP COMPLETE');
    console.log(`   Official Rankings: ${officialRankings.length}`);
    console.log(`   Community Rankings: ${communityRankings.length}`);
    console.log(`   Total: ${officialRankings.length + communityRankings.length}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
