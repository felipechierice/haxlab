#!/usr/bin/env node

/**
 * Script automatizado para deletar rankings e banir usuário
 * Usa Firebase CLI + REST API
 */

import { execSync } from 'child_process';
import https from 'https';

const nickname = process.argv[2];
const reason = process.argv[3] || 'Violação dos termos de uso';

if (!nickname) {
  console.error('❌ Uso: node scripts/auto-ban.mjs <nickname> [motivo]');
  console.error('   Exemplo: node scripts/auto-ban.mjs "RichardS" "Uso de cheat"');
  process.exit(1);
}

const PROJECT_ID = 'haxlab-ranking';

console.log(`🔨 Processando usuário: ${nickname}`);
console.log(`📝 Motivo: ${reason}`);
console.log('');

// Obter access token do Firebase
function getAccessToken() {
  try {
    console.log('🔑 Obtendo token de acesso...');
    const result = execSync('firebase login:ci --no-localhost 2>&1 || gcloud auth application-default print-access-token 2>&1 || gcloud auth print-access-token 2>&1', { encoding: 'utf8' }).trim();
    return result.split('\n').pop();
  } catch (error) {
    console.error('❌ Erro ao obter token. Execute: firebase login');
    process.exit(1);
  }
}

// Fazer requisição HTTPS
function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(res.statusCode === 204 ? {} : JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

// Query do Firestore
async function queryFirestore(token, collection, field, value) {
  const options = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const query = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value }
        }
      }
    }
  };

  const result = await httpsRequest(options, query);
  return result.filter(r => r.document).map(r => r.document);
}

// Deletar documento
async function deleteDocument(token, documentPath) {
  const options = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/${documentPath}`,
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  await httpsRequest(options);
}

// Criar documento
async function createDocument(token, collection, docId, data) {
  const options = {
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${docId}`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: value.toString() };
    }
  }

  await httpsRequest(options, { fields });
}

async function main() {
  const token = getAccessToken();
  
  const collections = ['rankings', 'community_rankings', 'playlist_completions', 'playlist_plays'];
  let totalDeleted = 0;

  // Deletar de cada coleção
  for (const collection of collections) {
    try {
      console.log(`📊 Procurando em ${collection}...`);
      const docs = await queryFirestore(token, collection, 'nickname', nickname);
      
      if (docs.length > 0) {
        console.log(`   Encontrados ${docs.length} documentos`);
        for (const doc of docs) {
          await deleteDocument(token, doc.name);
          totalDeleted++;
        }
        console.log(`   ✅ ${docs.length} deletados`);
      } else {
        console.log(`   Nenhum documento encontrado`);
      }
    } catch (error) {
      console.error(`   ⚠️  Erro em ${collection}:`, error.message);
    }
  }

  console.log('');
  console.log(`✅ Total deletado: ${totalDeleted} documentos`);
  console.log('');

  // Buscar UID do usuário
  console.log('🔍 Procurando UID e IPs do usuário...');
  try {
    const userDocs = await queryFirestore(token, 'users', 'nickname', nickname);
    
    if (userDocs.length > 0) {
      const uid = userDocs[0].fields.uid.stringValue;
      const lastIP = userDocs[0].fields.lastIP?.stringValue;
      
      console.log(`   ✅ UID encontrado: ${uid}`);
      if (lastIP) {
        console.log(`   📍 Último IP conhecido: ${lastIP}`);
      }
      console.log('');

      // Buscar histórico de IPs
      console.log('🔍 Buscando histórico de IPs...');
      const ipHistoryDocs = await queryFirestore(token, 'user_ip_history', 'uid', uid);
      const uniqueIPs = new Set();
      
      ipHistoryDocs.forEach(doc => {
        const ip = doc.fields.ip?.stringValue;
        if (ip) uniqueIPs.add(ip);
      });
      
      if (uniqueIPs.size > 0) {
        console.log(`   📊 IPs encontrados: ${Array.from(uniqueIPs).join(', ')}`);
        console.log('');
        
        // Perguntar se deve banir os IPs também
        console.log('💡 Dica: Para banir os IPs também, execute:');
        uniqueIPs.forEach(ip => {
          console.log(`   npm run ban-user --ip ${ip} "${reason}"`);
        });
        console.log('');
      } else {
        console.log('   ⚠️  Nenhum histórico de IP encontrado');
        console.log('');
      }

      // Desabilitar conta
      console.log('🔒 Desabilitando conta no Firebase Auth...');
      try {
        execSync(`firebase auth:export temp-users.json --project ${PROJECT_ID} 2>&1`, { stdio: 'ignore' });
        // Firebase CLI não tem comando direto para disable, então vamos criar o registro de banimento
        console.log('   ⚠️  Use o console para desabilitar: firebase console:open authentication');
      } catch (error) {
        console.log('   ⚠️  Desabilite manualmente no console');
      }

      // Adicionar registro de banimento
      console.log('🔨 Adicionando registro de banimento...');
      try {
        const banData = {
          uid: uid,
          nickname: nickname,
          reason: reason,
          bannedAt: Date.now(),
          bannedBy: 'admin'
        };
        
        if (lastIP) {
          banData.lastKnownIP = lastIP;
        }
        
        await createDocument(token, 'banned_users', uid, banData);
        console.log('   ✅ Usuário banido com sucesso!');
      } catch (error) {
        console.error('   ❌ Erro ao criar registro:', error.message);
      }
    } else {
      console.log('   ⚠️  UID não encontrado. Crie o registro de banimento manualmente.');
    }
  } catch (error) {
    console.error('   ❌ Erro ao buscar usuário:', error.message);
  }

  console.log('');
  console.log('🎯 Processo concluído!');
  console.log(`   • ${totalDeleted} documentos deletados`);
  console.log(`   • Usuário "${nickname}" banido por: ${reason}`);
}

main().catch(console.error);
