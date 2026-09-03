import { ArrowDown, ArrowUp, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { ArticleDraftRow, Heading } from '../lib/types';

export function OutlineCard({ row, index, onChange, onRegenerate }: {
  row: ArticleDraftRow;
  index: number;
  onChange: (next: ArticleDraftRow) => void;
  onRegenerate: () => void;
}) {
  if (!row.outline) return null;
  const updateHeading = (i: number, patch: Partial<Heading>) => {
    const headings = row.outline!.headings.map((h, idx) => idx === i ? { ...h, ...patch } : h);
    onChange({ ...row, outline: { ...row.outline!, headings } });
  };
  const move = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= row.outline!.headings.length) return;
    const headings = [...row.outline!.headings];
    [headings[i], headings[to]] = [headings[to], headings[i]];
    onChange({ ...row, outline: { ...row.outline!, headings } });
  };
  const remove = (i: number) => {
    const headings = row.outline!.headings.filter((_, idx) => idx !== i);
    onChange({ ...row, outline: { ...row.outline!, headings } });
  };
  const add = () => {
    const headings = [...row.outline!.headings, { level: 'h2' as const, text: 'Nova secao' }];
    onChange({ ...row, outline: { ...row.outline!, headings } });
  };

  return (
    <article className="outline-card">
      <div className="outline-top">
        <div><span className="outline-number">{index + 1}</span><small>{row.keyword || row.topic || 'Artigo'}</small></div>
        <button className="btn ghost small" type="button" onClick={onRegenerate}><RefreshCw size={14} /> Regenerar</button>
      </div>
      <label className="field"><span>Titulo</span><input value={row.outline.title} onChange={(e) => onChange({ ...row, requested_title: e.target.value, outline: { ...row.outline!, title: e.target.value } })} /></label>
      <div className="outline-meta"><span>Intencao: <b>{row.outline.search_intent}</b></span><span>Tema: {row.outline.suggested_topic}</span></div>
      <div className="heading-list">
        {row.outline.headings.map((heading, i) => (
          <div className={`heading-row ${heading.level}`} key={`${i}-${heading.text}`}>
            <select value={heading.level} onChange={(e) => updateHeading(i, { level: e.target.value as 'h2' | 'h3' })}><option value="h2">H2</option><option value="h3">H3</option></select>
            <input value={heading.text} onChange={(e) => updateHeading(i, { text: e.target.value })} />
            <button type="button" className="icon-btn" onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="icon-btn danger" onClick={() => remove(i)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="btn ghost small" onClick={add}><Plus size={14} /> Adicionar heading</button>
    </article>
  );
}
