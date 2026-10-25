export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('hcm_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || `Request failed with status ${res.status}`);
  }

  return json;
}
