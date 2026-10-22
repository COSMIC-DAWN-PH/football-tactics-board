import { useBoard } from '../store';
import type { Tool, PitchType, Orientation, Team } from '../types';
import { FORMATION_NAMES, formationSize } from '../formations';
import { exportPNG, exportGIF, exportJSON, importJSON } from '../export';
import { useState } from 'react';

const TOOLS: { key: Tool; label: string; title: string }[] = [
  { key: 'select', label: '👆 选择', title: '选择/拖动球员，空白处框选' },
  { key: 'arrow', label: '➡️ 跑位', title: '实线箭头：跑位路线' },
  { key: 'dashedArrow', label: '⇢ 传球', title: '虚线箭头：传球路线' },
  { key: 'freehand', label: '✏️ 手绘', title: '自由画线' },
  { key: 'text', label: '🔤 文字', title: '点击场地添加文字标注' },
  { key: 'zone', label: '▧ 区域', title: '拖出一块高亮区域' },
  { key: 'eraser', label: '🧹 橡皮', title: '点击绘图删除' },
];

const COLORS = ['#ffd43b', '#ffffff', '#ff6b6b', '#4dabf7', '#51cf66', '#000000'];

export function Toolbar() {
  const tool = useBoard((s) => s.tool);
  const drawColor = useBoard((s) => s.drawColor);
  const doc = useBoard((s) => s.doc);
  const groupMode = useBoard((s) => s.groupMode);
  const exporting = useBoard((s) => s.exporting);
  const selectedIds = useBoard((s) => s.selectedIds);
  const st = useBoard.getState;
  const [gifProgress, setGifProgress] = useState<string>('');

  const formationValid = (name: string) =>
    formationSize(name, doc.pitchType) > 0;

  return (
    <div className="toolbar">
      {/* 工具 */}
      <div className="tb-row">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            title={t.title}
            className={tool === t.key ? 'active' : ''}
            onClick={() => st().setTool(t.key)}
          >
            {t.label}
          </button>
        ))}
        <span className="sep" />
        {COLORS.map((c) => (
          <button
            key={c}
            className={`color-dot ${drawColor === c ? 'active' : ''}`}
            style={{ background: c }}
            onClick={() => st().setDrawColor(c)}
          />
        ))}
      </div>

      {/* 元素与阵型 */}
      <div className="tb-row">
        <button onClick={() => st().addPlayer('home')}>＋主队</button>
        <button onClick={() => st().addPlayer('away')}>＋客队</button>
        <button onClick={() => st().toggleBall()}>{doc.ball ? '➖ 去球' : '⚽ 加球'}</button>
        <button onClick={() => st().addCone()}>🔺 标志碟</button>
        <button onClick={() => st().addDummy()}>🧍 假人</button>
        <span className="sep" />
        <select id="formation-select" defaultValue="">
          <option value="" disabled>选择阵型</option>
          {FORMATION_NAMES.filter(formationValid).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const sel = document.getElementById('formation-select') as HTMLSelectElement;
            if (sel.value) st().applyFormation(sel.value, 'home' as Team);
          }}
        >套主队</button>
        <button
          onClick={() => {
            const sel = document.getElementById('formation-select') as HTMLSelectElement;
            if (sel.value) st().applyFormation(sel.value, 'away' as Team);
          }}
        >套客队</button>
        <button onClick={() => st().clearPlayers()}>清空球员</button>
      </div>

      {/* 场地 / 组移动 / 撤销 / 导出 */}
      <div className="tb-row">
        <select
          value={doc.pitchType}
          onChange={(e) => st().setPitchType(e.target.value as PitchType)}
        >
          <option value="11">11 人制</option>
          <option value="8">8 人制</option>
          <option value="5">5 人制</option>
        </select>
        <select
          value={doc.orientation}
          onChange={(e) => st().setOrientation(e.target.value as Orientation)}
        >
          <option value="h">横向</option>
          <option value="v">纵向</option>
        </select>
        <span className="sep" />
        <button
          className={groupMode ? 'active' : ''}
          title="开启后拖动任一选中球员，整组平移"
          onClick={() => st().setGroupMode(!groupMode)}
        >
          🔗 成组移动
        </button>
        {selectedIds.length > 0 && (
          <button onClick={() => st().removeElements(selectedIds)}>
            🗑 删除选中({selectedIds.length})
          </button>
        )}
        <span className="sep" />
        <button onClick={() => st().undo()}>↩ 撤销</button>
        <button onClick={() => st().redo()}>↪ 重做</button>
        <button onClick={() => st().clearDrawings()}>清除绘图</button>
        <span className="sep" />
        <button onClick={() => exportPNG(doc.name)}>📷 PNG</button>
        <button
          disabled={exporting || doc.frames.length < 2}
          title={doc.frames.length < 2 ? '至少需要 2 个关键帧' : '把动画导出成 GIF'}
          onClick={async () => {
            setGifProgress('生成中…');
            await exportGIF(doc.name, setGifProgress);
            setGifProgress('');
          }}
        >
          🎞 GIF{gifProgress ? ` ${gifProgress}` : ''}
        </button>
        <button onClick={() => exportJSON(doc)}>💾 导出JSON</button>
        <label className="import-btn">
          📂 导入JSON
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJSON(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}
