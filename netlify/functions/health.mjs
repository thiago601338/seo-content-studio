import { assertAuthorized, handleError, json } from './_lib/http.mjs'

export default async (req) => {
  try {
    assertAuthorized(req)
    const missing = []
    if (!process.env.OPENAI_API_KEY) missing.push('OPENAI_API_KEY')
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
    if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) missing.push('SUPABASE_SECRET_KEY')
    if (missing.length) {
      const error = new Error(`Configuração incompleta no Netlify: ${missing.join(', ')}.`)
      error.status = 500
      throw error
    }
    return json({ ok: true })
  } catch (error) {
    return handleError(error)
  }
}

export const config = { path: '/api/health' }
