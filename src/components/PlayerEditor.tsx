import { useBoard } from '../store';

/** 右侧：选中球员的编辑面板（号码/姓名/备注/盯人绑定） */
export function PlayerEditor() {
  const doc = useBoard((s) => s.doc);
  const selectedIds = useBoard((s) => s.selectedIds);
  const st = useBoard.getState;

  const player =
    selectedIds.length === 1
      ? doc.players.find((p) => p.id === selectedIds[0])
      : undefined;

  if (!player) {
    return (
      <div className="panel player-editor">
        <h3>球员设置</h3>
        <p className="muted">
          用「选择」工具点击一个球员即可编辑。
          <br />
          空白处拖拽可框选多个。
        </p>
      </div>
    );
  }

  const opponents = doc.players.filter((p) => p.team !== player.team);

  return (
    <div className="panel player-editor">
      <h3>球员设置（{player.team === 'home' ? '主队' : '客队'}）</h3>
      <label>
        号码
        <input
          type="number"
          min={1}
          max={99}
          value={player.number}
          onChange={(e) => st().updatePlayer(player.id, { number: Number(e.target.value) || 1 })}
        />
      </label>
      <label>
        姓名
        <input
          type="text"
          placeholder="如：张三"
          value={player.name}
          onChange={(e) => st().updatePlayer(player.id, { name: e.target.value })}
        />
      </label>
      <label>
        备注（角色/任务）
        <input
          type="text"
          placeholder="如：盯对方10号"
          value={player.note}
          onChange={(e) => st().updatePlayer(player.id, { note: e.target.value })}
        />
      </label>
      <label>
        盯人绑定（拖动目标时自动跟随）
        <select
          value={player.bindToId ?? ''}
          onChange={(e) => st().setBind(player.id, e.target.value || null)}
        >
          <option value="">不绑定</option>
          {opponents.map((o) => (
            <option key={o.id} value={o.id}>
              对方 {o.number} 号{o.name ? `（${o.name}）` : ''}
            </option>
          ))}
        </select>
      </label>
      {player.bindToId && (
        <p className="muted">
          已绑定：拖对方球员时此球员会保持相对距离跟随，动画播放时同样生效。
        </p>
      )}
      <button
        className="danger"
        onClick={() => st().removeElements([player.id])}
      >
        删除该球员
      </button>
    </div>
  );
}
