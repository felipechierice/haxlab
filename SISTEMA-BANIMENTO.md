# Sistema de Banimento - HaxLab

## 📋 Resumo da Implementação

Sistema completo de banimento de jogadores implementado com sucesso, incluindo banimento por conta (UID) e por IP, além de scripts para gerenciamento e deleção de dados.

## ✅ Funcionalidades Implementadas

### 1. Verificação de Banimento no Frontend

**Arquivo:** `src/auth.ts`

- ✅ Interfaces `BannedUser` e `BannedIP` definidas
- ✅ Função `isUserBanned(uid)` - verifica se usuário está banido
- ✅ Função `isIPBanned(ip)` - verifica se IP está banido
- ✅ Função `checkCurrentUserBanned()` - verifica banimento do usuário atual (UID + IP)
- ✅ Integração com login: verificação automática em `signInWithEmail()` e `signInWithGoogle()`
- ✅ Desconexão automática se usuário banido tentar fazer login

**Arquivo:** `src/contexts/AuthContext.tsx`

- ✅ Verificação de banimento no momento do login
- ✅ Verificação periódica a cada 30 segundos durante a sessão
- ✅ Desconexão automática e notificação ao usuário se banido durante sessão

### 2. Scripts de Administração

#### **`ban-user.mjs`** - Banir Usuário
- ✅ Banimento por UID (Firebase Auth + Firestore)
- ✅ Banimento por IP (Firestore)
- ✅ Banimento combinado (UID + IP)
- ✅ Desabilita conta no Firebase Auth
- ✅ Registra motivo, data e responsável

**Uso:**
```bash
npm run ban-user <uid> "Motivo" [--ip <endereço-ip>]
```

#### **`unban-user.mjs`** - Desbanir Usuário
- ✅ Remoção de banimento por UID
- ✅ Remoção de banimento por IP
- ✅ Reabilita conta no Firebase Auth

**Uso:**
```bash
npm run unban-user <uid> [--ip <endereço-ip>]
```

#### **`delete-user-rankings.mjs`** - Deletar Dados de Ranking
- ✅ Deleta todos os rankings oficiais
- ✅ Deleta todos os rankings de comunidade
- ✅ Deleta likes em playlists
- ✅ Deleta registros de completions
- ✅ Deleta registros de plays
- ✅ Busca por UID ou nickname

**Uso:**
```bash
npm run delete-user-rankings <uid-ou-nickname>
```

#### **`list-banned.mjs`** - Listar Banidos
- ✅ Lista todos os usuários banidos
- ✅ Lista todos os IPs banidos
- ✅ Exibe informações detalhadas (motivo, data, etc.)

**Uso:**
```bash
npm run list-banned
```

### 3. Regras de Segurança do Firestore

**Arquivo:** `firestore.rules`

- ✅ Coleção `banned_users` - leitura pública, escrita apenas via Admin SDK
- ✅ Coleção `banned_ips` - leitura pública, escrita apenas via Admin SDK
- ✅ Proteção contra modificações não autorizadas

### 4. Documentação

- ✅ `scripts/README-BANIMENTO.md` - guia completo de uso
- ✅ `scripts/service-account-key.example.json` - exemplo de configuração
- ✅ `scripts/.gitignore` - proteção de credenciais sensíveis

## 🔧 Configuração Necessária

### Passo 1: Instalar Dependências
```bash
npm install
# ou
pnpm install
```

### Passo 2: Obter Service Account Key
1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Vá para **Project Settings > Service Accounts**
3. Clique em **"Generate New Private Key"**
4. Salve o arquivo como `scripts/service-account-key.json`

⚠️ **IMPORTANTE**: Este arquivo contém credenciais sensíveis e já está no `.gitignore`

### Passo 3: Implantar Regras do Firestore
```bash
firebase deploy --only firestore:rules
```

## 📊 Estrutura de Dados

### Coleção `banned_users`
```typescript
{
  uid: string;           // UID do Firebase Auth
  email?: string;        // Email do usuário
  nickname?: string;     // Nickname do usuário
  reason: string;        // Motivo do banimento
  bannedAt: number;      // Timestamp (milliseconds)
  bannedBy: string;      // Administrador responsável
}
```

### Coleção `banned_ips`
```typescript
{
  ip: string;            // Endereço IP (formato: "192.168.1.1")
  reason: string;        // Motivo do banimento
  bannedAt: number;      // Timestamp (milliseconds)
  bannedBy: string;      // Administrador responsável
}
```

## 🎯 Fluxo de Banimento

### Quando um usuário é banido:

1. **No servidor (via script npm):**
   - Registro criado no Firestore (`banned_users` ou `banned_ips`)
   - Conta desabilitada no Firebase Auth (se banimento por UID)
   - Log de auditoria registrado

2. **No cliente (aplicação web):**
   - Verificação ao fazer login (bloqueio imediato)
   - Verificação periódica a cada 30 segundos se já logado
   - Desconexão automática com notificação ao usuário
   - Mensagem: "Sua conta foi banida. Motivo: [motivo]"

### Tentativas de acesso após banimento:

- ✅ Login bloqueado automaticamente
- ✅ Sessão existente encerrada em até 30 segundos
- ✅ Mensagem clara sobre o motivo do banimento

## 🔒 Segurança

- ✅ Service account key protegida no `.gitignore`
- ✅ Regras Firestore impedem modificações não autorizadas
- ✅ Apenas Admin SDK pode criar/remover banimentos
- ✅ Verificação tanto no cliente quanto no servidor

## 📝 Exemplos de Uso

### Banir um trapaceiro
```bash
npm run ban-user abc123def "Uso de cheats/hacks detectado"
```

### Banir conta + IP de spammer
```bash
npm run ban-user xyz789ghi "Spam em chat e criação de contas múltiplas" --ip 203.0.113.42
```

### Banir apenas IP (múltiplas contas)
```bash
npm run ban-user --ip 198.51.100.10 "Criação massiva de contas falsas"
```

### Deletar todos os rankings de um jogador banido
```bash
npm run delete-user-rankings abc123def
# ou por nickname
npm run delete-user-rankings "JogadorBanido123"
```

### Ver todos os banimentos ativos
```bash
npm run list-banned
```

### Desbanir após revisão
```bash
npm run unban-user abc123def --ip 203.0.113.42
```

## 🚀 Próximos Passos (Opcionais)

Possíveis melhorias futuras:
- Dashboard web para gerenciar banimentos
- Sistema de appeals (recurso de banimento)
- Banimento temporário com expiração automática
- Logs de auditoria mais detalhados
- Notificações por email ao banir
- Integração com Discord para notificações

## 📞 Suporte

Para questões sobre o sistema de banimento, consulte:
- `scripts/README-BANIMENTO.md` - documentação detalhada
- Código fonte em `src/auth.ts` e `src/contexts/AuthContext.tsx`
- Scripts em `scripts/*.mjs`

---

**Implementado em:** 19/02/2026  
**Status:** ✅ Completo e funcional
