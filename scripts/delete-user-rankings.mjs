#!/usr/bin/env node

/**
 * Script para deletar todos os dados de ranking de um usuário do HaxLab
 * 
 * Uso:
 *   npm run delete-user-rankings <uid-ou-nickname>
 * 
 * Exemplos:
 *   npm run delete-user-rankings abc123def456
 *   npm run delete-user-rankings "NomeDoJogador"
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar argumentos
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error('❌ Uso incorreto!');
  console.error('');
  console.error('Uso:');
  console.error('  npm run delete-user-rankings <uid-ou-nickname>');
  console.error('');
  console.error('Exemplos:');
  console.error('  npm run delete-user-rankings abc123def456');
  console.error('  npm run delete-user-rankings "NomeDoJogador"');
  process.exit(1);
}

const identifier = args[0];

// Inicializar Firebase Admin
let serviceAccount;
try {
  const keyPath = join(__dirname, 'service-account-key.json');
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch (error) {
  console.error('❌ Erro: Não foi possível carregar o arquivo service-account-key.json');
  console.error('   Certifique-se de que o arquivo existe em scripts/service-account-key.json');
  console.error('   Você pode baixá-lo no Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function deleteUserRankings() {
  try {
    console.log(`🗑️  Procurando rankings do usuário: ${identifier}`);
    console.log('');

    let totalDeleted = 0;

    // Coleções de ranking para verificar
    const rankingCollections = [
      'rankings',           // Rankings oficiais
      'community_rankings'  // Rankings de comunidade
    ];

    // Tentar buscar por UID ou nickname
    for (const collectionName of rankingCollections) {
      console.log(`📊 Verificando coleção: ${collectionName}`);

      // Buscar por UID
      const uidQuery = await db.collection(collectionName)
        .where('uid', '==', identifier)
        .get();

      if (!uidQuery.empty) {
        console.log(`   Encontrados ${uidQuery.size} registros por UID`);
        const batch = db.batch();
        uidQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += uidQuery.size;
      }

      // Buscar por nickname
      const nicknameQuery = await db.collection(collectionName)
        .where('nickname', '==', identifier)
        .get();

      if (!nicknameQuery.empty) {
        console.log(`   Encontrados ${nicknameQuery.size} registros por nickname`);
        const batch = db.batch();
        nicknameQuery.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        totalDeleted += nicknameQuery.size;
      }
    }

    console.log('');
    if (totalDeleted > 0) {
      console.log(`✅ Total de ${totalDeleted} registros de ranking deletados com sucesso!`);
    } else {
      console.log('⚠️  Nenhum registro de ranking encontrado para este usuário.');
    }

    // Também deletar registros de likes/completions se existirem
    console.log('');
    console.log('🔍 Verificando registros adicionais...');

    let additionalDeleted = 0;

    // Deletar likes
    const likesQuery = await db.collection('playlist_likes')
      .where('userId', '==', identifier)
      .get();

    if (!likesQuery.empty) {
      console.log(`   Deletando ${likesQuery.size} likes...`);
      const batch = db.batch();
      likesQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      additionalDeleted += likesQuery.size;
    }

    // Deletar completions por nickname
    const completionsQuery = await db.collection('playlist_completions')
      .where('nickname', '==', identifier)
      .get();

    if (!completionsQuery.empty) {
      console.log(`   Deletando ${completionsQuery.size} completions...`);
      const batch = db.batch();
      completionsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      additionalDeleted += completionsQuery.size;
    }

    // Deletar plays por nickname
    const playsQuery = await db.collection('playlist_plays')
      .where('nickname', '==', identifier)
      .get();

    if (!playsQuery.empty) {
      console.log(`   Deletando ${playsQuery.size} registros de plays...`);
      const batch = db.batch();
      playsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      additionalDeleted += playsQuery.size;
    }

    if (additionalDeleted > 0) {
      console.log(`✅ ${additionalDeleted} registros adicionais deletados.`);
    }

    console.log('');
    console.log('🎯 Processo concluído!');
    console.log(`   Total geral: ${totalDeleted + additionalDeleted} registros deletados`);
  } catch (error) {
    console.error('❌ Erro ao deletar rankings:', error);
    process.exit(1);
  }
}

deleteUserRankings();
