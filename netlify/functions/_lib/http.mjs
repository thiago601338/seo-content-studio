import crypto from 'node:crypto'

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function assertAuthorized(req) {
  const expected = process.env.APP_PASSWORD || ''
  if (!expected) throw new Error('APP_PASSWORD não configurada no Netlify.')
  const provided = req.headers.get('x-app-password') || ''
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const error = new Error('Senha inválida.')
    error.status = 401
    throw error
  }
}

export async function parseJson(req) {
  try {
    return await req.json()
  } catch {
    const error = new Error('JSON inválido.')
    error.status = 400
    throw error
  }
}

export function handleError(error) {
  console.error(error)
  return json({ error: error?.message || 'Erro interno.' }, error?.status || 500)
}

export function requireMethod(req, method) {
  if (req.method !== method) {
    const error = new Error(`Método ${req.method} não permitido.`)
    error.status = 405
    throw error
  }
}
