/**
 * Simple AJAX utilities for API communication
 */

export async function ajax_post<T = any>(url: string, data: Record<string, any>): Promise<T> {
  try {
    const response = await fetch(`/${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AJAX POST failed:', error);
    throw error;
  }
}

export async function ajax_get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  try {
    const queryString = params 
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    
    const response = await fetch(`/${url}${queryString}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AJAX GET failed:', error);
    throw error;
  }
}
