// Script para atualizar randomizeOrder de uma playlist da comunidade no Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updatePlaylistRandomize(playlistId, randomizeValue) {
  try {
    const playlistRef = doc(db, 'community_playlists', playlistId);
    
    // Primeiro, buscar o documento para verificar se existe
    const playlistDoc = await getDoc(playlistRef);
    
    if (!playlistDoc.exists()) {
      console.error(`❌ Playlist com ID "${playlistId}" não encontrada!`);
      process.exit(1);
    }
    
    const currentData = playlistDoc.data();
    console.log('\n📋 Playlist encontrada:');
    console.log(`   Nome: ${currentData.name}`);
    console.log(`   Autor: ${currentData.authorNickname}`);
    console.log(`   Cenários: ${currentData.scenarios?.length || 0}`);
    console.log(`   randomizeOrder atual: ${currentData.randomizeOrder || false}`);
    
    // Atualizar o campo randomizeOrder
    await updateDoc(playlistRef, {
      randomizeOrder: randomizeValue,
      updatedAt: Date.now()
    });
    
    console.log(`\n✅ Campo "randomizeOrder" atualizado para: ${randomizeValue}`);
    console.log('✅ Operação concluída com sucesso!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao atualizar playlist:', error);
    process.exit(1);
  }
}

// Parâmetros da linha de comando
const playlistId = process.argv[2] || 'mZP8uXxYdjyy1eusxb81';
const randomizeValue = process.argv[3] === 'false' ? false : true;

console.log('\n🔄 Atualizando playlist...');
console.log(`   ID: ${playlistId}`);
console.log(`   Novo valor de randomizeOrder: ${randomizeValue}\n`);

updatePlaylistRandomize(playlistId, randomizeValue);
