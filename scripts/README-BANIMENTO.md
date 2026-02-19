# Sistema de Banimento do HaxLab

Este diretório contém scripts para gerenciar banimentos e dados de usuários do HaxLab.

## Pré-requisitos

1. **Firebase Admin SDK Service Account Key**
   - Acesse o [Firebase Console](https://console.firebase.google.com/)
   - Vá para Project Settings > Service Accounts
   - Clique em "Generate New Private Key"
   - Salve o arquivo como `scripts/service-account-key.json`
   - **IMPORTANTE**: Nunca commite este arquivo no Git!

2. **Instalar dependências**
   ```bash
   npm install
   # ou
   pnpm install
   ```

## Scripts Disponíveis

### 1. Banir Usuário

Bane um usuário por UID e/ou IP, impedindo login e continuidade de jogo.

```bash
# Banir por UID
npm run ban-user <uid> "Motivo do banimento"

# Banir por UID e IP
npm run ban-user <uid> "Motivo do banimento" --ip 192.168.1.100

# Banir apenas por IP
npm run ban-user --ip 192.168.1.100 "Motivo do banimento"
```

**Exemplos:**
```bash
npm run ban-user abc123def456 "Uso de trapaças"
npm run ban-user xyz789ghi012 "Violação dos termos de uso" --ip 203.0.113.42
npm run ban-user --ip 198.51.100.10 "Spam em múltiplas contas"
```

**O que acontece ao banir:**
- O registro é adicionado à coleção `banned_users` ou `banned_ips` no Firestore
- A conta é desabilitada no Firebase Auth (para banimentos por UID)
- O usuário é imediatamente desconectado se estiver online
- Tentativas futuras de login são bloqueadas

### 2. Desbanir Usuário

Remove o banimento de um usuário por UID e/ou IP.

```bash
# Desbanir por UID
npm run unban-user <uid>

# Desbanir por UID e IP
npm run unban-user <uid> --ip 192.168.1.100

# Desbanir apenas por IP
npm run unban-user --ip 192.168.1.100
```

**Exemplos:**
```bash
npm run unban-user abc123def456
npm run unban-user xyz789ghi012 --ip 203.0.113.42
npm run unban-user --ip 198.51.100.10
```

### 3. Deletar Rankings de Usuário

Deleta todos os dados de ranking e atividades de um usuário (banido ou não).

```bash
# Deletar por UID
npm run delete-user-rankings <uid>

# Deletar por nickname
npm run delete-user-rankings "NomeDoJogador"
```

**Exemplos:**
```bash
npm run delete-user-rankings abc123def456
npm run delete-user-rankings "JogadorBanido123"
```

**O que é deletado:**
- Todos os registros de ranking em playlists oficiais
- Todos os registros de ranking em playlists da comunidade
- Likes em playlists
- Registros de completions
- Registros de plays

### 4. Listar Banidos

Lista todos os usuários e IPs atualmente banidos.

```bash
npm run list-banned
```

**Saída:**
```
👤 USUÁRIOS BANIDOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. UID: abc123def456
   Nickname: JogadorProblematico
   Email: jogador@example.com
   Motivo: Uso de trapaças
   Banido em: 19/02/2026, 10:30:45
   Banido por: admin

Total: 1 usuário(s) banido(s)

🌐 IPS BANIDOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. IP: 203.0.113.42
   Motivo: Spam em múltiplas contas
   Banido em: 19/02/2026, 11:15:22
   Banido por: admin

Total: 1 IP(s) banido(s)
```

## Fluxo de Banimento

### Quando um usuário é banido:

1. **No servidor (via script):**
   - Registro criado no Firestore (`banned_users` ou `banned_ips`)
   - Conta desabilitada no Firebase Auth

2. **No cliente (aplicação web):**
   - Verificação de banimento ao fazer login
   - Verificação periódica se o usuário já está logado
   - Desconexão imediata e bloqueio de funcionalidades

### Quando um usuário tenta acessar após ser banido:

1. Tentativa de login é bloqueada
2. Mensagem exibida: "Sua conta foi banida. Motivo: [motivo]"
3. Usuário é deslogado automaticamente

## Segurança

⚠️ **IMPORTANTE:**
- O arquivo `service-account-key.json` contém credenciais sensíveis
- Nunca commite este arquivo no repositório Git
- Mantenha-o em local seguro
- Use variáveis de ambiente em produção
- Apenas administradores devem ter acesso a esses scripts

## Estrutura de Dados

### Coleção `banned_users`
```typescript
{
  uid: string;           // UID do Firebase Auth
  email?: string;        // Email do usuário (se disponível)
  nickname?: string;     // Nickname do usuário (se disponível)
  reason: string;        // Motivo do banimento
  bannedAt: number;      // Timestamp do banimento
  bannedBy: string;      // Quem aplicou o banimento
}
```

### Coleção `banned_ips`
```typescript
{
  ip: string;            // Endereço IP
  reason: string;        // Motivo do banimento
  bannedAt: number;      // Timestamp do banimento
  bannedBy: string;      // Quem aplicou o banimento
}
```

## Troubleshooting

### Erro: "service-account-key.json not found"
- Certifique-se de ter baixado a chave do Firebase Console
- Verifique se o arquivo está em `scripts/service-account-key.json`

### Erro: "Permission denied"
- Verifique se a service account tem permissões adequadas
- No Firebase Console, vá para IAM & Admin e confirme as permissões

### Usuário não é desconectado imediatamente
- A verificação de banimento acontece ao fazer login e periodicamente
- Para desconexão imediata, pode ser necessário reiniciar o servidor/aplicação

## Suporte

Para questões ou problemas com o sistema de banimento, entre em contato com a equipe de desenvolvimento do HaxLab.
