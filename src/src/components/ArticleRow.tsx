import { Trash2 } from 'lucide-react';
import type { ArticleDraftRow } from '../lib/types';

export function ArticleRow({ row, index, onChange, onRemove }: {
  row: ArticleDraftRow;
  index: number;
  onChange: (next: ArticleDraftRow) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof ArticleDraftRow, value: any) => onChange({ ...row, [key]: value, outline: key === 'selected' ? row.outline : undefined });
  return (
    <div className={`article-grid-row ${!row.selected ? 'muted-row' : ''}`}>
      <div className="row-select"><input type="checkbox" checked={row.selected} onChange={(e) => set('selected', e.target.checked)} /><b>{index + 1}</b></div>
      <input value={row.keyword} onChange={(e) => set('keyword', e.target.value)} placeholder="palavra-chave" />
      <input value={row.requested_title} onChange={(e) => set('requested_title', e.target.value)} placeholder="IA cria se vazio" />
      <input value={row.support_keywords} onChange={(e) => set('support_keywords', e.target.value)} placeholder="termos, separados por virgula" />
      <input value={row.topic} onChange={(e) => set('topic', e.target.value)} placeholder="IA cria se vazio" />
      <input value={row.target_url} onChange={(e) => set('target_url', e.target.value)} placeholder="https://..." />
      <div className="row-state">
        {row.planning ? <span className="badge blue">Gerando...</span> : row.error ? <span className="badge red">Erro</span> : row.outline ? <span className="badge green">Estrutura pronta</span> : <span className="badge">Aguardando</span>}
        <button type="button" className="icon-btn danger" onClick={onRemove} title="Excluir"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}
