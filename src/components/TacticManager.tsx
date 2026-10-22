import { useState } from 'react';
import { useBoard } from '../store';

/** 左侧：战术方案管理（保存/载入/删除） */
export function TacticManager() {
  const doc = useBoard((s) => s.doc);
  const savedDocs = useBoard((s) => s.savedDocs);
  const st = useBoard.getState;
  const [name, setName] = useState('');

  return (
    <div className="panel tactic-manager">
      <h3>战术方案</h3>
      <div className="save-row">
        <input
          type="text"
          placeholder={doc.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          onClick={() => {
            const n = name.trim() || doc.name;
            st().saveAs(n);
            setName('');
          }}
        >
          保存
        </button>
      </div>
      <button className="new-board" onClick={() => st().newBoard()}>
        ＋ 新建空白板
      </button>
      <div className="saved-list">
        {savedDocs.length === 0 && <p className="muted">还没有保存的方案</p>}
        {savedDocs.map((d) => (
          <div key={d.id} className={`saved-item ${d.id === doc.id ? 'active' : ''}`}>
            <span className="saved-name" onClick={() => st().loadDoc(d.id)} title="点击载入">
              {d.name}
              <small>
                {d.pitchType}人制 · {d.frames.length}帧 · {new Date(d.updatedAt).toLocaleDateString('zh-CN')}
              </small>
            </span>
            <button className="frame-del" onClick={() => st().deleteSaved(d.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
