#!/usr/bin/env node

/**
 * Script para consultar IPs de um usuário
 * 
 * Uso: node scripts/get-user-ips.mjs <nickname-ou-uid>
 */

import { execSync } from 'child_process';
import https from 'https';

const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Uso: node scripts/get-user-ips.mjs <nickname-ou-uid>');
  console.error('   Exemplo: node scripts/get-user-ips.mjs "RichardS"');
  process.exit(1);
}

const PROJECT_ID = 'haxlab-ranking';

console.log(`🔍 Buscando IPs de: ${identifier}`);
console.log('');

// Obter access token do Firebase
function getAccessToken() {
  try {
    const result = execSync('gcloud auth print-access-token 2>&1', { encoding: 'utf8' }).trim();
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

async function main() {
  const token = getAccessToken();
  
  let uid = identifier;
  let nickname = identifier;
  
  // Tentar buscar por nickname primeiro
  try {
    const userDocs = await queryFirestore(token, 'users', 'nickname', identifier);
    
    if (userDocs.length > 0) {
      uid = userDocs[0].fields.uid.stringValue;
      nickname = userDocs[0].fields.nickname.stringValue;
      const lastIP = userDocs[0].fields.lastIP?.stringValue;
      const lastIPTimestamp = userDocs[0].fields.lastIPTimestamp?.integerValue;
      
      console.log('👤 INFORMAÇÕES DO USUÁRIO:');
      console.log(`   UID: ${uid}`);
      console.log(`   Nickname: ${nickname}`);
      if (lastIP) {
        console.log(`   Último IP: ${lastIP}`);
        if (lastIPTimestamp) {
          const date = new Date(parseInt(lastIPTimestamp));
          console.log(`   Data: ${date.toLocaleString('pt-BR')}`);
        }
      }
      console.log('');
    }
  } catch (error) {
    console.log('⚠️  Não encontrado como nickname, tentando como UID...');
    console.log('');
  }
  
  // Buscar histórico de IPs
  try {
    console.log('📊 HISTÓRICO DE IPS:');
    const ipHistoryDocs = await queryFirestore(token, 'user_ip_history', 'uid', uid);
    
    if (ipHistoryDocs.length > 0) {
      const ips = ipHistoryDocs.map(doc => ({
        ip: doc.fields.ip?.stringValue,
        timestamp: parseInt(doc.fields.timestamp?.integerValue || '0'),
        nickname: doc.fields.nickname?.stringValue
      }));
      
      // Ordenar por timestamp
      ips.sort((a, b) => b.timestamp - a.timestamp);
      
      // Agrupar por IP
      const ipMap = new Map();
      ips.forEach(({ ip, timestamp }) => {
        if (!ipMap.has(ip)) {
          ipMap.set(ip, []);
        }
        ipMap.get(ip).push(timestamp);
      });
      
      console.log('');
      let index = 1;
      for (const [ip, timestamps] of ipMap.entries()) {
        const lastSeen = new Date(Math.max(...timestamps));
        const firstSeen = new Date(Math.min(...timestamps));
        console.log(`${index}. IP: ${ip}`);
        console.log(`   Primeira vez: ${firstSeen.toLocaleString('pt-BR')}`);
        console.log(`   Última vez: ${lastSeen.toLocaleString('pt-BR')}`);
        console.log(`   Total de registros: ${timestamps.length}`);
        console.log('');
        index++;
      }
      
      console.log('━'.repeat(80));
      console.log(`Total: ${ipMap.size} IP(s) único(s) | ${ips.length} registro(s) total`);
      console.log('');
      
      // Mostrar comando para banir
      console.log('💡 Para banir também por IP, execute:');
      for (const ip of ipMap.keys()) {
        console.log(`   npm run ban-user --ip ${ip} "Motivo do banimento"`);
      }
    } else {
      console.log('   ⚠️  Nenhum histórico de IP encontrado');
    }
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error.message);
  }
}

main().catch(console.error);
