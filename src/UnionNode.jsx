import { Handle, Position } from '@xyflow/react';

// Узел-союз между супругами: сердечко. Брак рисуется супруг→союз→супруг,
// стрелки на детей выходят из союза (handle 'b'), не от каждого родителя.
// data.downExpandable → у пары есть скрытые дети; клик по сердечку их раскрывает.
export default function UnionNode({ data }) {
  const { downExpandable, onExpandDown, ukey } = data || {};
  const cls = downExpandable ? 'ft-heart ft-heart-exp' : 'ft-heart';
  return (
    <div className="ft-union">
      <Handle id="l" type="target" position={Position.Left} />
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <span className={cls} title={downExpandable ? 'Показать детей' : undefined}
        onClick={downExpandable ? e => { e.stopPropagation(); onExpandDown?.(ukey); } : undefined}>♥</span>
    </div>
  );
}
