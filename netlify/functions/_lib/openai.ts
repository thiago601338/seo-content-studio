const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const IMAGES_URL = 'https://api.openai.com/v1/images/generations';

function apiKey() {
  const value = process.env.OPENAI_API_KEY;
  if (!value) throw new Error('OPENAI_API_KEY nao configurada no Netlify.');
  return value;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      const body = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * Math.pow(2, attempt)));
        continue;
      }
      let message = `OpenAI retornou HTTP ${response.status}.`;
      try {
        const parsed = JSON.parse(body);
        message = parsed?.error?.message || message;
      } catch {
        if (body) message += ` ${body.slice(0, 500)}`;
      }
      throw new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * Math.pow(2, attempt)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha na OpenAI.');
}

export type TextGenerationInput = {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  webResearch?: boolean;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  model?: string;
};

export async function structuredResponse<T>(options: TextGenerationInput): Promise<T> {
  const payload: Record<string, unknown> = {
    model: options.model || process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-terra',
    instructions: options.instructions,
    input: options.input,
    reasoning: { effort: options.reasoningEffort || 'low' },
    text: {
      format: {
        type: 'json_schema',
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  };

  if (options.webResearch) {
    payload.tools = [{ type: 'web_search' }];
    payload.tool_choice = 'auto';
  }

  const response = await fetchWithRetry(RESPONSES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json() as any;
  let text = typeof data.output_text === 'string' ? data.output_text : '';
  if (!text && Array.isArray(data.output)) {
    for (const item of data.output) {
      for (const part of item?.content || []) {
        if (part?.type === 'output_text' && typeof part.text === 'string') text += part.text;
      }
    }
  }
  if (!text) throw new Error('A OpenAI nao retornou o JSON estruturado esperado.');

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Nao foi possivel interpretar a resposta estruturada da OpenAI.');
  }
}

export type GeneratedImage = {
  bytes: Uint8Array;
  mime: string;
  extension: string;
};

function imageFormatMeta(format: string) {
  if (format === 'jpeg' || format === 'jpg') return { mime: 'image/jpeg', extension: 'jpg' };
  if (format === 'png') return { mime: 'image/png', extension: 'png' };
  return { mime: 'image/webp', extension: 'webp' };
}

export async function generateImage(options: {
  prompt: string;
  size?: string;
  quality?: string;
  model?: string;
  outputFormat?: 'jpeg' | 'webp' | 'png';
  compression?: number;
}): Promise<GeneratedImage> {
  const outputFormat = options.outputFormat || 'jpeg';
  const payload: Record<string, unknown> = {
    model: options.model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
    prompt: options.prompt,
    size: options.size || '1536x1024',
    quality: options.quality || 'low',
    output_format: outputFormat,
    n: 1,
  };
  if (outputFormat === 'jpeg' || outputFormat === 'webp') {
    payload.output_compression = Math.max(1, Math.min(100, Number(options.compression ?? 82)));
  }

  const response = await fetchWithRetry(IMAGES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, 2);
  const data = await response.json() as any;
  const item = data?.data?.[0];
  if (!item) throw new Error('A OpenAI nao retornou imagem.');

  if (item.b64_json) {
    const meta = imageFormatMeta(outputFormat);
    return {
      bytes: Uint8Array.from(Buffer.from(item.b64_json, 'base64')),
      mime: meta.mime,
      extension: meta.extension,
    };
  }
  if (item.url) {
    const img = await fetch(item.url);
    if (!img.ok) throw new Error('Falha ao baixar a imagem gerada.');
    const buffer = new Uint8Array(await img.arrayBuffer());
    const contentType = img.headers.get('content-type') || imageFormatMeta(outputFormat).mime;
    return {
      bytes: buffer,
      mime: contentType,
      extension: contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'webp',
    };
  }
  throw new Error('Formato de imagem inesperado na resposta da OpenAI.');
}
