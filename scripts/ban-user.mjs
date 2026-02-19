#!/usr/bin/env node

/**
 * Script para banir usuários do HaxLab
 * 
 * Uso:
 *   npm run ban-user <uid> <motivo> [--ip <endereço-ip>]
 * 
 * Exemplos:
 *   npm run ban-user abc123def456 "Violação dos termos de uso"
 *   npm run ban-user abc123def456 "Trapaça" --ip 192.168.1.100
 *   npm run ban-user --ip 192.168.1.100 "Spam"
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar argumentos
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('❌ Uso incorreto!');
  console.error('');
  console.error('Uso:');
  console.error('  npm run ban-user <uid> <motivo> [--ip <endereço-ip>]');
  console.error('');
  console.error('Exemplos:');
  console.error('  npm run ban-user abc123def456 "Violação dos termos de uso"');
  console.error('  npm run ban-user abc123def456 "Trapaça" --ip 192.168.1.100');
  console.error('  npm run ban-user --ip 192.168.1.100 "Spam"');
  process.exit(1);
}

// Parse dos argumentos
let uid = null;
let reason = null;
let ip = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip') {
    ip = args[i + 1];
    i++;
  } else if (!uid && !args[i].startsWith('--')) {
    uid = args[i];
  } else if (!reason && !args[i].startsWith('--')) {
    reason = args[i];
  }
}

if (!uid && !ip) {
  console.error('❌ Erro: Você deve fornecer um UID ou um IP para banir!');
  process.exit(1);
}

if (!reason) {
  console.error('❌ Erro: Você deve fornecer um motivo para o banimento!');
  process.exit(1);
}

// Inicializar Firebase Admin
let serviceAccount;
try {
  // Tentar carregar a service account key
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
const auth = getAuth();

async function banUser() {
  try {
    const bannedBy = 'admin'; // Pode ser customizado
    const bannedAt = Date.now();

    // Banir por UID
    if (uid) {
      console.log(`🔨 Banindo usuário ${uid}...`);

      // Buscar informações do usuário
      let userEmail = null;
      let userNickname = null;

      try {
        const authUser = await auth.getUser(uid);
        userEmail = authUser.email;
        userNickname = authUser.displayName;
      } catch (error) {
        console.warn('⚠️  Não foi possível obter informações do Firebase Auth');
      }

      // Buscar perfil no Firestore
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userNickname = userData.nickname || userNickname;
          userEmail = userData.email || userEmail;
        }
      } catch (error) {
        console.warn('⚠️  Não foi possível obter informações do Firestore');
      }

      // Adicionar banimento no Firestore
      await db.collection('banned_users').doc(uid).set({
        uid,
        email: userEmail,
        nickname: userNickname,
        reason,
        bannedAt,
        bannedBy
      });

      // Desabilitar conta no Firebase Auth
      try {
        await auth.updateUser(uid, { disabled: true });
        console.log('✅ Conta desabilitada no Firebase Auth');
      } catch (error) {
        console.warn('⚠️  Não foi possível desabilitar a conta no Firebase Auth:', error.message);
      }

      console.log('✅ Usuário banido com sucesso!');
      console.log(`   UID: ${uid}`);
      if (userEmail) console.log(`   Email: ${userEmail}`);
      if (userNickname) console.log(`   Nickname: ${userNickname}`);
      console.log(`   Motivo: ${reason}`);
    }

    // Banir por IP
    if (ip) {
      console.log(`🔨 Banindo IP ${ip}...`);

      // Sanitizar IP para usar como ID do documento
      const ipDocId = ip.replace(/\./g, '_');

      await db.collection('banned_ips').doc(ipDocId).set({
        ip,
        reason,
        bannedAt,
        bannedBy
      });

      console.log('✅ IP banido com sucesso!');
      console.log(`   IP: ${ip}`);
      console.log(`   Motivo: ${reason}`);
    }

    console.log('');
    console.log('🎯 Banimento concluído!');
  } catch (error) {
    console.error('❌ Erro ao banir:', error);
    process.exit(1);
  }
}

banUser();
