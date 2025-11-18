import axios from 'axios';

class TawkClient {
  constructor() {
    this.apiKey = process.env.TAWK_API_KEY;
    this.propertyId = process.env.TAWK_PROPERTY_ID;
    this.baseUrl = 'https://api.tawk.to/v3';
  }

  /**
   * Envía un mensaje a un chat específico en Tawk.to
   */
  async sendMessage(chatId, message) {
    if (!this.apiKey || !this.propertyId) {
      console.warn('⚠️  Credenciales de Tawk.to no configuradas - mensaje no enviado');
      console.log('Mensaje que se enviaría:', message);
      return { success: false, error: 'Credenciales no configuradas' };
    }

    try {
      const url = `${this.baseUrl}/chats/${chatId}/messages`;
      
      const response = await axios.post(
        url,
        {
          message: message,
          type: 'agent' // Mensaje enviado como agente
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Mensaje enviado a Tawk.to exitosamente');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ Error enviando mensaje a Tawk.to:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      }
      
      return { 
        success: false, 
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Marca un chat como leído
   */
  async markChatAsRead(chatId) {
    if (!this.apiKey || !this.propertyId) {
      return { success: false, error: 'Credenciales no configuradas' };
    }

    try {
      const url = `${this.baseUrl}/chats/${chatId}/read`;
      
      await axios.put(
        url,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Error marcando chat como leído:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtiene información de un chat
   */
  async getChatInfo(chatId) {
    if (!this.apiKey || !this.propertyId) {
      return { success: false, error: 'Credenciales no configuradas' };
    }

    try {
      const url = `${this.baseUrl}/chats/${chatId}`;
      
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error obteniendo info del chat:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Verifica si las credenciales están configuradas
   */
  isConfigured() {
    return !!(this.apiKey && this.propertyId);
  }

  /**
   * Obtiene el estado de configuración
   */
  getConfigStatus() {
    return {
      apiKeyConfigured: !!this.apiKey,
      propertyIdConfigured: !!this.propertyId,
      fullyConfigured: this.isConfigured()
    };
  }
}

// Exportar instancia singleton
const tawkClient = new TawkClient();
export default tawkClient;
