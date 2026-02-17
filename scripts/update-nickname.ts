/**
 * Script para atualizar nickname nos rankings
 * 
 * Uso: npx ts-node scripts/update-nickname.ts
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  writeBatch
} from 'firebase/firestore';

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

// Configurações do script
const OLD_NICKNAME = 'HGQS6C6J';
const NEW_NICKNAME = 'Czar Vegetti I';

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateNicknameInCollection(collectionName: string): Promise<number> {
  console.log(`\n📂 Buscando registros em '${collectionName}'...`);
  
  const q = query(
    collection(db, collectionName),
    where('nickname', '==', OLD_NICKNAME)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    console.log(`   Nenhum registro encontrado.`);
    return 0;
  }
  
  console.log(`   Encontrados ${snapshot.size} registros.`);
  
  // Usar batch para atualizar múltiplos documentos de forma eficiente
  const batch = writeBatch(db);
  let count = 0;
  
  snapshot.forEach((docSnapshot) => {
    const docRef = doc(db, collectionName, docSnapshot.id);
    batch.update(docRef, { nickname: NEW_NICKNAME });
    count++;
    console.log(`   - ${docSnapshot.id}: ${docSnapshot.data().playlistName || docSnapshot.data().playlistId}`);
  });
  
  await batch.commit();
  console.log(`   ✅ ${count} registros atualizados!`);
  
  return count;
}

async function main() {
  console.log('========================================');
  console.log('🔄 Script de Atualização de Nickname');
  console.log('========================================');
  console.log(`\nDe: "${OLD_NICKNAME}"`);
  console.log(`Para: "${NEW_NICKNAME}"`);
  
  try {
    // Atualizar rankings oficiais
    const officialCount = await updateNicknameInCollection('rankings');
    
    // Atualizar rankings da comunidade
    const communityCount = await updateNicknameInCollection('community_rankings');
    
    // Atualizar também na coleção de completions (se existir)
    const completionsCount = await updateNicknameInCollection('playlist_completions');
    
    console.log('\n========================================');
    console.log('📊 Resumo:');
    console.log(`   - Rankings oficiais: ${officialCount}`);
    console.log(`   - Rankings comunidade: ${communityCount}`);
    console.log(`   - Completions: ${completionsCount}`);
    console.log(`   - Total: ${officialCount + communityCount + completionsCount}`);
    console.log('========================================');
    console.log('\n✅ Concluído com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
