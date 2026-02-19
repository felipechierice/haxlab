#!/usr/bin/env node

/**
 * Script para desbanir usuários do HaxLab
 * 
 * Uso:
 *   npm run unban-user <uid> [--ip <endereço-ip>]
 * 
 * Exemplos:
 *   npm run unban-user abc123def456
 *   npm run unban-user abc123def456 --ip 192.168.1.100
 *   npm run unban-user --ip 192.168.1.100
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

if (args.length < 1) {
  console.error('❌ Uso incorreto!');
  console.error('');
  console.error('Uso:');
  console.error('  npm run unban-user <uid> [--ip <endereço-ip>]');
  console.error('');
  console.error('Exemplos:');
  console.error('  npm run unban-user abc123def456');
  console.error('  npm run unban-user abc123def456 --ip 192.168.1.100');
  console.error('  npm run unban-user --ip 192.168.1.100');
  process.exit(1);
}

// Parse dos argumentos
let uid = null;
let ip = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ip') {
    ip = args[i + 1];
    i++;
  } else if (!uid && !args[i].startsWith('--')) {
    uid = args[i];
  }
}

if (!uid && !ip) {
  console.error('❌ Erro: Você deve fornecer um UID ou um IP para desbanir!');
  process.exit(1);
}

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
const auth = getAuth();

async function unbanUser() {
  try {
    // Desbanir por UID
    if (uid) {
      console.log(`✅ Desbanindo usuário ${uid}...`);

      // Remover banimento do Firestore
      await db.collection('banned_users').doc(uid).delete();

      // Reabilitar conta no Firebase Auth
      try {
        await auth.updateUser(uid, { disabled: false });
        console.log('✅ Conta reabilitada no Firebase Auth');
      } catch (error) {
        console.warn('⚠️  Não foi possível reabilitar a conta no Firebase Auth:', error.message);
      }

      console.log('✅ Usuário desbanido com sucesso!');
      console.log(`   UID: ${uid}`);
    }

    // Desbanir por IP
    if (ip) {
      console.log(`✅ Desbanindo IP ${ip}...`);

      const ipDocId = ip.replace(/\./g, '_');
      await db.collection('banned_ips').doc(ipDocId).delete();

      console.log('✅ IP desbanido com sucesso!');
      console.log(`   IP: ${ip}`);
    }

    console.log('');
    console.log('🎯 Desbanimento concluído!');
  } catch (error) {
    console.error('❌ Erro ao desbanir:', error);
    process.exit(1);
  }
}

unbanUser();
