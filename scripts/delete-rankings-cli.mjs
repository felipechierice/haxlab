#!/usr/bin/env node

/**
 * Script para deletar rankings e banir usuário usando Firebase CLI
 * 
 * Uso: 
 *   node scripts/delete-and-ban-cli.mjs <nickname> [motivo]
 * 
 * Exemplo:
 *   node scripts/delete-and-ban-cli.mjs "RichardS" "Trapaça detectada"
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const nickname = process.argv[2];
const reason = process.argv[3] || 'Violação dos termos de uso';

if (!nickname) {
  console.error('❌ Uso: node scripts/delete-and-ban-cli.mjs <nickname> [motivo]');
  console.error('   Exemplo: node scripts/delete-and-ban-cli.mjs "RichardS" "Trapaça"');
  process.exit(1);
}

console.log(`🔨 Processando usuário: ${nickname}`);
console.log(`📝 Motivo: ${reason}`);
console.log('');

// Função para obter o access token do Firebase CLI
function getAccessToken() {
  try {
    const token = execSync('firebase login:ci --no-localhost 2>/dev/null || firebase login:use 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (!token) {
      // Tentar obter do arquivo de configuração
      const configPath = process.env.HOME + '/.config/firebase/config.json';
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      return config.tokens?.access_token || null;
    }
    return token;
  } catch (error) {
    return null;
  }
}

const projectId = 'haxlab-ranking';

console.log('⚠️  IMPORTANTE: Para deletar rankings e banir o usuário, você precisa:');
console.log('');
console.log('📝 Opção 1 - Via Firebase Console (Recomendado):');
console.log('');
console.log('1️⃣  Deletar Rankings:');
console.log(`   → Acesse: https://console.firebase.google.com/project/${projectId}/firestore`);
console.log(`   → Na coleção "rankings", filtre por: nickname == "${nickname}"`);
console.log('   → Selecione todos e delete');
console.log(`   → Repita para "community_rankings" com nickname == "${nickname}"`);
console.log(`   → Repita para "playlist_completions" com nickname == "${nickname}"`);
console.log(`   → Repita para "playlist_plays" com nickname == "${nickname}"`);
console.log('');
console.log('2️⃣  Banir Usuário:');
console.log(`   → Acesse: https://console.firebase.google.com/project/${projectId}/authentication/users`);
console.log(`   → Procure pelo usuário com nickname "${nickname}"`);
console.log('   → Copie o UID do usuário');
console.log('   → Clique em "⋮" > "Disable account"');
console.log('');
console.log('3️⃣  Adicionar registro de banimento:');
console.log(`   → Volte para Firestore: https://console.firebase.google.com/project/${projectId}/firestore`);
console.log('   → Crie um documento na coleção "banned_users" com ID = UID do usuário');
console.log('   → Adicione os campos:');
console.log(`      • uid: "${'{UID_DO_USUARIO}'}"` );
console.log(`      • nickname: "${nickname}"`);
console.log(`      • reason: "${reason}"`);
console.log(`      • bannedAt: ${Date.now()}`);
console.log(`      • bannedBy: "admin"`);
console.log('');
console.log('━'.repeat(80));
console.log('');
console.log('📝 Opção 2 - Via Scripts com Admin SDK:');
console.log('');
console.log('1. Configure a service account key:');
console.log('   → Baixe do Firebase Console > Project Settings > Service Accounts');
console.log('   → Salve como scripts/service-account-key.json');
console.log('');
console.log('2. Execute os scripts:');
console.log(`   npm run delete-user-rankings "${nickname}"`);
console.log(`   npm run ban-user {UID} "${reason}"`);
console.log('');
