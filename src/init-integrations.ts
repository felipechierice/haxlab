/**
 * Inicialização e configuração de integrações entre módulos
 */

// Conectar função de IP do auth.ts com firebase.ts para evitar circular dependency
import { setGetClientIPFunc } from './firebase';

// Função local para obter IP (mesma lógica do auth.ts)
async function getClientIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.error('Error getting client IP:', error);
    return null;
  }
}

// Configurar a função no módulo firebase
setGetClientIPFunc(getClientIP);

export {};
