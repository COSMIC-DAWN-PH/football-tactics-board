import type Konva from 'konva';

/** 全局 Stage 引用（导出 PNG/GIF 用） */
export const stageRef: { current: Konva.Stage | null } = { current: null };
