import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export function SectionCard({
  title,
  description,
  icon,
  accent = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`panel ${accent ? 'panel-accent' : ''}`}>
      <button className="panel-head" type="button" onClick={() => setOpen((v) => !v)}>
        <span className="panel-title-wrap">
          {icon && <span className="panel-icon">{icon}</span>}
          <span>
            <strong>{title}</strong>
            {description && <small>{description}</small>}
          </span>
        </span>
        <ChevronDown size={18} className={open ? 'rotate' : ''} />
      </button>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}
