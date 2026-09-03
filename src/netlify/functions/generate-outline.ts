import type { Config } from '@netlify/functions';
import { requireUser } from './_lib/auth';
import { errorMessage, json, readJson } from './_lib/http';
import { structuredResponse } from './_lib/openai';
import { outlinePrompt, outlineSchema } from './_lib/prompts';

type Body = {
  keyword?: string;
  target_url?: string;
  requested_title?: string;
  topic?: string;
  support_keywords?: string[];
  config?: Record<string, any>;
};

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Metodo nao permitido.' }, 405);
  try {
    await requireUser(req);
    const body = await readJson<Body>(req);
    const cfg = body.config || {};
    if (!(body.keyword || body.target_url || body.requested_title || body.topic)) {
      return json({ error: 'Informe pelo menos palavra-chave, link, titulo ou briefing.' }, 422);
    }
    if (body.target_url && !body.keyword) {
      return json({ error: 'Quando houver link externo, informe a palavra-chave/ancora correspondente.' }, 422);
    }

    const prompt = outlinePrompt({
      keyword: body.keyword,
      targetUrl: body.target_url,
      requestedTitle: body.requested_title,
      topic: body.topic,
      supportKeywords: body.support_keywords || [],
      wordCount: Math.max(300, Math.min(800, Number(cfg.word_count || 800))),
      keywordInTitle: cfg.keyword_in_title !== false,
      contentType: cfg.content_type,
      searchIntent: cfg.search_intent,
      tone: cfg.tone,
      pointOfView: cfg.point_of_view,
      targetCountry: cfg.target_country,
      readability: cfg.readability,
      structureDepth: cfg.structure_depth,
      allowH3: cfg.allow_h3 !== false,
      includeFaq: Boolean(cfg.include_faq),
      includeTakeaways: Boolean(cfg.include_takeaways),
      introHook: cfg.intro_hook,
      notes: cfg.notes,
    });

    const outline = await structuredResponse<any>({
      instructions: prompt.instructions,
      input: prompt.user,
      schemaName: 'article_outline',
      schema: outlineSchema,
      webResearch: Boolean(cfg.web_research),
      reasoningEffort: cfg.reasoning_effort || 'low',
      model: cfg.model || undefined,
    });

    return json({ outline });
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};

export const config: Config = { path: '/api/generate-outline' };
