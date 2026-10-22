import type { Vec, Keyframe } from './types';

let counter = 0;
export function uid(prefix = 'e'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function quadBezier(p0: Vec, cp: Vec, p1: Vec, t: number): Vec {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y,
  };
}

export function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** 关键帧序列总时长（不含最后一帧的 duration） */
export function totalDuration(frames: Keyframe[]): number {
  let sum = 0;
  for (let i = 0; i < frames.length - 1; i++) sum += frames[i].duration;
  return sum;
}

/**
 * 计算某一时间点（ms）所有元素的插值位置。
 * bindings: { followerId: { targetId, offset } } —— 盯人绑定，播放时跟随目标。
 */
export function positionsAt(
  frames: Keyframe[],
  timeMs: number,
  bindings: Record<string, { targetId: string; offset: Vec }>,
): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  if (frames.length === 0) return out;
  if (frames.length === 1 || timeMs <= 0) {
    Object.assign(out, frames[0].positions);
  } else {
    // 找到所处段
    let t = timeMs;
    let seg = 0;
    while (seg < frames.length - 2 && t > frames[seg].duration) {
      t -= frames[seg].duration;
      seg += 1;
    }
    const f0 = frames[seg];
    const f1 = frames[seg + 1];
    const u = f0.duration <= 0 ? 1 : Math.min(1, t / f0.duration);
    const ids = new Set([...Object.keys(f0.positions), ...Object.keys(f1.positions)]);
    for (const id of ids) {
      const p0 = f0.positions[id] ?? f1.positions[id];
      const p1 = f1.positions[id] ?? f0.positions[id];
      if (!p0 || !p1) continue;
      const cp = f0.paths?.[id];
      out[id] = cp ? quadBezier(p0, cp, p1, u) : lerp(p0, p1, u);
    }
  }
  // 盯人绑定：跟随者 = 目标位置 + 偏移
  for (const [fid, b] of Object.entries(bindings)) {
    const tp = out[b.targetId];
    if (tp) out[fid] = { x: tp.x + b.offset.x, y: tp.y + b.offset.y };
  }
  return out;
}

/** 把当前棋盘上所有元素位置抓成 positions 表（用于新建关键帧） */
export function capturePositions(doc: {
  players: { id: string; x: number; y: number }[];
  cones: { id: string; x: number; y: number }[];
  dummies: { id: string; x: number; y: number }[];
  ball: { x: number; y: number } | null;
}): Record<string, Vec> {
  const pos: Record<string, Vec> = {};
  for (const p of doc.players) pos[p.id] = { x: p.x, y: p.y };
  for (const c of doc.cones) pos[c.id] = { x: c.x, y: c.y };
  for (const d of doc.dummies) pos[d.id] = { x: d.x, y: d.y };
  if (doc.ball) pos['ball'] = { x: doc.ball.x, y: doc.ball.y };
  return pos;
}

export function easingInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
