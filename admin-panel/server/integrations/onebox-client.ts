/**
 * OneBox CRM API Client
 * 
 * Интеграция с OneBox CRM для:
 * - Получения задач на взвешивание
 * - Отправки результатов взвешивания
 * - Обновления статусов заказов
 * 
 * API Documentation: https://swagger.1b.app
 */

interface OneBoxConfig {
  baseUrl: string;
  apiToken: string;
  timeout?: number;
}

interface OneBoxOrder {
  id: number;
  order_number: string;
  status_id: number;
  products: OneBoxProduct[];
  custom_fields?: Record<string, any>;
}

interface OneBoxProduct {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  weight?: number;
  custom_fields?: Record<string, any>;
}

interface WeighingResult {
  orderId: number;
  productId: number;
  weight: number;
  unit: string;
  timestamp: Date;
  scaleId: string;
  operatorId?: string;
}

export class OneBoxClient {
  private config: OneBoxConfig;

  constructor(config: OneBoxConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Make authenticated API request to OneBox
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v2${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiToken}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OneBox API error ${response.status}: ${errorText}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('OneBox API request timeout');
      }
      throw error;
    }
  }

  /**
   * Get orders pending weighing
   * 
   * Filters orders by status that indicates "awaiting weighing"
   */
  async getOrdersForWeighing(workflowId: number, statusId?: number): Promise<OneBoxOrder[]> {
    const response = await this.request<any>('POST', '/order/get/', {
      workflow_id: workflowId,
      status_id: statusId,
      limit: 100,
    });

    return response.data || [];
  }

  /**
   * Get single order by ID
   */
  async getOrder(orderId: number): Promise<OneBoxOrder | null> {
    const response = await this.request<any>('POST', '/order/get/', {
      id: orderId,
    });

    return response.data?.[0] || null;
  }

  /**
   * Update order with weighing result
   * 
   * Updates the order's custom field with the actual weight
   */
  async updateOrderWeight(
    orderId: number,
    productId: number,
    weight: number,
    unit: string = 'kg'
  ): Promise<boolean> {
    try {
      await this.request('POST', '/order/set/', {
        id: orderId,
        products: [{
          id: productId,
          custom_fields: {
            actual_weight: weight,
            weight_unit: unit,
            weighed_at: new Date().toISOString(),
          },
        }],
      });
      return true;
    } catch (error) {
      console.error('Failed to update order weight:', error);
      return false;
    }
  }

  /**
   * Update order status after weighing
   */
  async updateOrderStatus(orderId: number, statusId: number): Promise<boolean> {
    try {
      await this.request('POST', '/order/set/', {
        id: orderId,
        status_id: statusId,
      });
      return true;
    } catch (error) {
      console.error('Failed to update order status:', error);
      return false;
    }
  }

  /**
   * Send weighing result to OneBox
   * 
   * Complete flow: update weight + update status
   */
  async sendWeighingResult(
    result: WeighingResult,
    nextStatusId?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update product weight
      const weightUpdated = await this.updateOrderWeight(
        result.orderId,
        result.productId,
        result.weight,
        result.unit
      );

      if (!weightUpdated) {
        return { success: false, error: 'Failed to update weight' };
      }

      // Update status if provided
      if (nextStatusId) {
        const statusUpdated = await this.updateOrderStatus(result.orderId, nextStatusId);
        if (!statusUpdated) {
          return { success: false, error: 'Weight updated but status change failed' };
        }
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test connection to OneBox API
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    const startTime = Date.now();
    
    try {
      // Try to get current user info or any simple endpoint
      await this.request('GET', '/user/current/');
      
      return {
        success: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

/**
 * Create OneBox client from settings
 */
export function createOneBoxClient(settings: {
  baseUrl: string;
  apiToken: string;
  timeout?: number;
}): OneBoxClient | null {
  if (!settings.baseUrl || !settings.apiToken) {
    return null;
  }

  return new OneBoxClient({
    baseUrl: settings.baseUrl.replace(/\/$/, ''), // Remove trailing slash
    apiToken: settings.apiToken,
    timeout: settings.timeout ? settings.timeout * 1000 : 30000,
  });
}
