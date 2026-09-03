export type Heading = { level: 'h2' | 'h3'; text: string };

export type Outline = {
  suggested_topic: string;
  title: string;
  search_intent: string;
  support_keywords: string[];
  headings: Heading[];
};

export type ArticleDraftRow = {
  local_id: string;
  selected: boolean;
  keyword: string;
  target_url: string;
  requested_title: string;
  topic: string;
  support_keywords: string;
  outline?: Outline;
  planning?: boolean;
  error?: string;
};

export type WPCategory = { id: number; name: string; slug: string; count?: number };
export type WPAuthor = { id: number; name: string; slug: string };

export type Site = {
  id: string;
  user_id: string;
  name: string;
  base_url: string;
  wp_username: string;
  default_category_id: number | null;
  default_author_id: number | null;
  metadata: {
    categories?: WPCategory[];
    authors?: WPAuthor[];
    current_user?: WPAuthor;
    connector?: { ok?: boolean; connector_version?: string } | null;
    synced_at?: string;
  };
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WriterConfig = {
  site_id: string;
  publish_to_wordpress: boolean;
  save_to_drive: boolean;
  word_count: number;
  keyword_in_title: boolean;
  content_type: string;
  search_intent: string;
  tone: string;
  point_of_view: string;
  target_country: string;
  readability: string;
  structure_depth: string;
  allow_h3: boolean;
  include_faq: boolean;
  include_takeaways: boolean;
  intro_hook: string;
  web_research: boolean;
  reasoning_effort: 'none' | 'low' | 'medium' | 'high';
  model: string;
  cover_image: boolean;
  body_images: number;
  image_size: string;
  image_quality: string;
  image_style: string;
  internal_links: number;
  extra_links: Array<{ anchor: string; url: string }>;
  include_conclusion: boolean;
  use_lists: boolean;
  use_tables: boolean;
  use_bold: boolean;
  category_id: number | '';
  author_id: number | '';
  publication_status: 'draft' | 'review' | 'publish' | 'private';
  schedule_start: string;
  interval_minutes: number;
  sponsored: boolean;
  notes: string;
};

export type GeneratedMedia = {
  kind: 'cover' | 'body';
  slot: number;
  url: string;
  path: string;
  filename: string;
  mime: string;
  alt: string;
};

export type ArticleRecord = {
  id: string;
  user_id?: string;
  batch_id: string | null;
  site_id: string | null;
  keyword: string;
  requested_title?: string;
  generated_title: string | null;
  generated_html?: string | null;
  excerpt?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  generated_tags?: string[];
  generated_media?: GeneratedMedia[];
  cover_image_url?: string | null;
  publish_to_wordpress?: boolean;
  save_to_drive?: boolean;
  drive_file_id?: string | null;
  drive_doc_url?: string | null;
  status: 'queued' | 'processing' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  progress_label: string;
  error: string | null;
  wp_post_id: number | null;
  wp_post_url: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  run_version?: number;
  config?: Record<string, any>;
  sites?: { name: string; base_url: string } | null;
};

export type DriveStatus = {
  connected: boolean;
  email: string | null;
  display_name: string | null;
};
