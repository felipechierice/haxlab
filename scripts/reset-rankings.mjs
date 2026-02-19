/**
 * Script para resetar todos os rankings do HaxLab
 * 
 * USO:
 *   node scripts/reset-rankings.mjs [--official] [--community] [--dry-run]
 * 
 * OPÇÕES:
 *   --official    Reseta apenas rankings de playlists oficiais
 *   --community   Reseta apenas rankings de playlists da comunidade
 *   --dry-run     Mostra o que seria deletado sem executar
 *   (sem flags)   Reseta TODOS os rankings
 * 
 * EXEMPLOS:
 *   node scripts/reset-rankings.mjs --dry-run           # Ver o que seria deletado
 *   node scripts/reset-rankings.mjs --official          # Resetar só oficiais
 *   node scripts/reset-rankings.mjs --community         # Resetar só comunidade
 *   node scripts/reset-rankings.mjs                     # Resetar TUDO
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';

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

// Parsear argumentos
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const officialOnly = args.includes('--official');
const communityOnly = args.includes('--community');

// Se nenhum flag específico, reseta ambos
const resetOfficial = !communityOnly || officialOnly;
const resetCommunity = !officialOnly || communityOnly;

console.log('🎮 HaxLab - Reset Rankings Script');
console.log('==================================');
console.log(`Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '⚠️  LIVE (will delete data)'}`);
console.log(`Reset Official Rankings: ${resetOfficial ? '✅ Yes' : '❌ No'}`);
console.log(`Reset Community Rankings: ${resetCommunity ? '✅ Yes' : '❌ No'}`);
console.log('');

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Deleta todos os documentos de uma coleção
 */
async function deleteCollection(collectionName, dryRun = false) {
  console.log(`\n📂 Processing collection: ${collectionName}`);
  
  const querySnapshot = await getDocs(collection(db, collectionName));
  const count = querySnapshot.size;
  
  if (count === 0) {
    console.log(`   No documents found in ${collectionName}`);
    return 0;
  }
  
  console.log(`   Found ${count} documents`);
  
  if (dryRun) {
    // Modo dry-run: apenas mostrar preview dos dados
    console.log(`   Preview of documents that would be deleted:`);
    let preview = 0;
    querySnapshot.forEach((docSnapshot) => {
      if (preview < 5) {
        const data = docSnapshot.data();
        console.log(`     - ${data.nickname} | ${data.playlistName} | Score: ${data.score} | Time: ${data.time}s`);
        preview++;
      }
    });
    if (count > 5) {
      console.log(`     ... and ${count - 5} more`);
    }
    return count;
  }
  
  // Modo live: deletar em batches de 500 (limite do Firestore)
  const batchSize = 500;
  let deleted = 0;
  
  const docs = querySnapshot.docs;
  
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + batchSize);
    
    chunk.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });
    
    await batch.commit();
    deleted += chunk.length;
    console.log(`   Deleted ${deleted}/${count} documents...`);
  }
  
  console.log(`   ✅ Successfully deleted ${deleted} documents from ${collectionName}`);
  return deleted;
}

async function main() {
  let totalDeleted = 0;
  
  try {
    // Resetar rankings oficiais
    if (resetOfficial) {
      const officialCount = await deleteCollection('rankings', dryRun);
      totalDeleted += officialCount;
    }
    
    // Resetar rankings da comunidade
    if (resetCommunity) {
      const communityCount = await deleteCollection('community_rankings', dryRun);
      totalDeleted += communityCount;
    }
    
    console.log('\n==================================');
    if (dryRun) {
      console.log(`🔍 DRY RUN COMPLETE`);
      console.log(`   Would delete ${totalDeleted} total ranking entries`);
      console.log(`\n   To execute for real, run without --dry-run flag`);
    } else {
      console.log(`✅ RESET COMPLETE`);
      console.log(`   Deleted ${totalDeleted} total ranking entries`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
