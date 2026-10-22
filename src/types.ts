// ===== 数据模型 =====

export interface Vec {
  x: number; // 米，沿球场长度方向
  y: number; // 米，沿球场宽度方向
}

export type Team = 'home' | 'away';

export interface PlayerT {
  id: string;
  kind: 'player';
  team: Team;
  x: number;
  y: number;
  number: number;
  name: string;
  note: string; // 角色备注，例如 "盯对方10号"
  bindToId: string | null; // 盯人绑定目标（对方球员 id）
  bindOffset: Vec | null; // 绑定时记录的相对偏移
}

export interface BallT {
  id: 'ball';
  kind: 'ball';
  x: number;
  y: number;
}

export interface ConeT {
  id: string;
  kind: 'cone';
  x: number;
  y: number;
  color: string;
}

export interface DummyT {
  id: string;
  kind: 'dummy';
  x: number;
  y: number;
}

export type ElementT = PlayerT | BallT | ConeT | DummyT;

export type DrawingT =
  | { id: string; type: 'arrow'; dashed: boolean; from: Vec; to: Vec; color: string }
  | { id: string; type: 'freehand'; points: number[]; color: string }
  | { id: string; type: 'text'; at: Vec; text: string; color: string }
  | { id: string; type: 'zone'; x: number; y: number; w: number; h: number; color: string };

export interface Keyframe {
  id: string;
  positions: Record<string, Vec>; // 元素 id -> 位置
  duration: number; // 到下一帧的过渡时长 ms
  // 该帧到下一帧之间，某元素的贝塞尔控制点（绝对坐标）；无则直线
  paths: Record<string, Vec>;
}

export type PitchType = '11' | '8' | '5';
export type Orientation = 'h' | 'v';

export interface TacticDoc {
  id: string;
  name: string;
  pitchType: PitchType;
  orientation: Orientation;
  players: PlayerT[];
  cones: ConeT[];
  dummies: DummyT[];
  ball: BallT | null;
  drawings: DrawingT[];
  frames: Keyframe[];
  updatedAt: number;
}

export type Tool =
  | 'select'
  | 'arrow'
  | 'dashedArrow'
  | 'freehand'
  | 'text'
  | 'zone'
  | 'eraser';

export const PITCH_DIMS: Record<PitchType, { L: number; W: number }> = {
  '11': { L: 105, W: 68 },
  '8': { L: 65, W: 45 },
  '5': { L: 40, W: 20 },
};

export const HOME_COLOR = '#e0245e';
export const AWAY_COLOR = '#1c7ed6';
