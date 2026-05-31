import { Handle, Position } from '@xyflow/react';
import { renderCardHTML } from './card.js';
import { photoUrl } from './db.js';

// Кастомная нода React Flow: переиспользует renderCardHTML (HTML карточки)
// + 4 хэндла для связей (top/bottom — родитель/ребёнок, left/right — супруги).
// data.familyColor задаёт акцент «крови рода» через CSS-переменную.
// Имя файла фото превращается в публичный URL Supabase Storage перед рендером.
export default function PersonNode({ data }) {
  const { person, familyColor } = data;
  const display = person.photo ? { ...person, photo: photoUrl(person.photo) } : person;
  return (
    <div className="ft-node" style={{ '--blood': familyColor }}>
      <Handle id="t" type="target" position={Position.Top} />
      <Handle id="l" type="target" position={Position.Left} />
      <div dangerouslySetInnerHTML={{ __html: renderCardHTML(display) }} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="r" type="source" position={Position.Right} />
    </div>
  );
}
