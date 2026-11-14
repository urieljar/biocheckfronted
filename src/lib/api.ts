const BASE_URL = '/api'

interface ApiResponse<T = unknown> {
  ok: boolean
  message?: string
  data?: T
  [key: string]: unknown
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  })

  let data: ApiResponse<T>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Respuesta no válida del servidor (${res.status})`)
  }

  if (!res.ok) {
    const error = new Error(data?.message || `Error en la solicitud (${res.status})`)
    // El código HTTP queda disponible para distinguir sesión inválida de fallos de red.
    ;(error as Error & { status?: number }).status = res.status
    throw error
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
}
