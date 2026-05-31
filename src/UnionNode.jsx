import { Handle, Position } from '@xyflow/react';

// Узел-союз между супругами: сердечко. Брак рисуется супруг→союз→супруг,
// стрелки на детей выходят из союза (handle 'b'), не от каждого родителя.
export default function UnionNode() {
  return (
    <div className="ft-union">
      <Handle id="l" type="target" position={Position.Left} />
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <span className="ft-heart">♥</span>
    </div>
  );
}
