#!/usr/bin/env node

/**
 * Script para listar todos os usuários e IPs banidos do HaxLab
 * 
 * Uso:
 *   npm run list-banned
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function listBanned() {
  try {
    console.log('🔍 Listando usuários e IPs banidos...');
    console.log('');

    // Listar usuários banidos
    const bannedUsers = await db.collection('banned_users').get();
    
    if (!bannedUsers.empty) {
      console.log('👤 USUÁRIOS BANIDOS:');
      console.log('━'.repeat(80));
      bannedUsers.docs.forEach((doc, index) => {
        const data = doc.data();
        const date = new Date(data.bannedAt).toLocaleString('pt-BR');
        console.log(`${index + 1}. UID: ${data.uid}`);
        if (data.nickname) console.log(`   Nickname: ${data.nickname}`);
        if (data.email) console.log(`   Email: ${data.email}`);
        console.log(`   Motivo: ${data.reason}`);
        console.log(`   Banido em: ${date}`);
        console.log(`   Banido por: ${data.bannedBy}`);
        console.log('');
      });
      console.log(`Total: ${bannedUsers.size} usuário(s) banido(s)`);
    } else {
      console.log('✅ Nenhum usuário banido.');
    }

    console.log('');

    // Listar IPs banidos
    const bannedIPs = await db.collection('banned_ips').get();
    
    if (!bannedIPs.empty) {
      console.log('🌐 IPS BANIDOS:');
      console.log('━'.repeat(80));
      bannedIPs.docs.forEach((doc, index) => {
        const data = doc.data();
        const date = new Date(data.bannedAt).toLocaleString('pt-BR');
        console.log(`${index + 1}. IP: ${data.ip}`);
        console.log(`   Motivo: ${data.reason}`);
        console.log(`   Banido em: ${date}`);
        console.log(`   Banido por: ${data.bannedBy}`);
        console.log('');
      });
      console.log(`Total: ${bannedIPs.size} IP(s) banido(s)`);
    } else {
      console.log('✅ Nenhum IP banido.');
    }

    console.log('');
    console.log('🎯 Listagem concluída!');
  } catch (error) {
    console.error('❌ Erro ao listar banidos:', error);
    process.exit(1);
  }
}

listBanned();
