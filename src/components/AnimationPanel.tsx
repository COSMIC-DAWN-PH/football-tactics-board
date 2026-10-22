import { useBoard } from '../store';
import { totalDuration } from '../geometry';

/** 底部：关键帧时间轴 + 播放控制 */
export function AnimationPanel() {
  const doc = useBoard((s) => s.doc);
  const frameIndex = useBoard((s) => s.frameIndex);
  const playing = useBoard((s) => s.playing);
  const loop = useBoard((s) => s.loop);
  const animTimeMs = useBoard((s) => s.animTimeMs);
  const animPositions = useBoard((s) => s.animPositions);
  const st = useBoard.getState;

  const frames = doc.frames;
  const total = totalDuration(frames);

  return (
    <div className="panel anim-panel">
      <div className="anim-controls">
        <button onClick={() => st().addFrame()} title="把当前棋盘状态存为一个关键帧">
          ＋ 添加关键帧
        </button>
        <button disabled={frames.length < 2} onClick={() => (playing ? st().pause() : st().play())}>
          {playing ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button
          disabled={!animPositions && !playing}
          onClick={() => st().stopPlayback()}
        >
          ⏹ 停止
        </button>
        <label className="loop-label">
          <input type="checkbox" checked={loop} onChange={(e) => st().setLoop(e.target.checked)} />
          循环
        </label>
        {frames.length > 0 && (
          <button className="danger" onClick={() => st().clearFrames()}>
            清空帧
          </button>
        )}
        <span className="muted">
          {frames.length} 帧 · 总时长 {(total / 1000).toFixed(1)}s
          {animPositions ? ` · 播放至 ${(animTimeMs / 1000).toFixed(1)}s` : ''}
        </span>
      </div>

      {frames.length > 0 && (
        <div className="frame-list">
          {frames.map((f, i) => (
            <div
              key={f.id}
              className={`frame-chip ${i === frameIndex ? 'active' : ''}`}
              onClick={() => st().gotoFrame(i)}
              title="点击跳到该帧（加载到棋盘继续编辑）"
            >
              <span className="frame-no">F{i + 1}</span>
              {i < frames.length - 1 && (
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={f.duration}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => st().setFrameDuration(i, Number(e.target.value) || 1200)}
                  title="到下一帧的过渡时长（毫秒）"
                />
              )}
              <button
                className="frame-del"
                onClick={(e) => {
                  e.stopPropagation();
                  st().deleteFrame(i);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {frames.length >= 2 && (
        <p className="muted hint">
          提示：点帧跳转 → 拖球员 →「＋添加关键帧」。选中单个球员时，棋盘上会出现黄色曲线手柄，可微调这一段的跑位弧线。
        </p>
      )}
    </div>
  );
}
