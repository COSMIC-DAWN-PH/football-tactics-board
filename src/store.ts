import { create } from 'zustand';
import type {
  TacticDoc, PlayerT, ConeT, DummyT, DrawingT, Keyframe, Vec, Tool,
  PitchType, Orientation, Team,
} from './types';
import { HOME_COLOR, AWAY_COLOR } from './types';
import { uid, capturePositions, totalDuration, positionsAt, clamp } from './geometry';
import { formationPositions } from './formations';

// ===== 快照（撤销/重做）=====
interface Snapshot {
  players: PlayerT[];
  cones: ConeT[];
  dummies: DummyT[];
  ball: TacticDoc['ball'];
  drawings: DrawingT[];
}

function takeSnapshot(doc: TacticDoc): Snapshot {
  return structuredClone({
    players: doc.players, cones: doc.cones, dummies: doc.dummies,
    ball: doc.ball, drawings: doc.drawings,
  });
}

function newDoc(name = '未命名战术'): TacticDoc {
  return {
    id: uid('doc'), name, pitchType: '11', orientation: 'h',
    players: [], cones: [], dummies: [], ball: { id: 'ball', kind: 'ball', x: 52.5, y: 34 },
    drawings: [], frames: [], updatedAt: Date.now(),
  };
}

const STORAGE_KEY = 'football-tactics-docs';

export function loadSavedDocs(): TacticDoc[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as TacticDoc[];
  } catch {
    return [];
  }
}

function persistSavedDocs(docs: TacticDoc[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
}

interface BoardState {
  doc: TacticDoc;
  tool: Tool;
  drawColor: string;
  selectedIds: string[];
  groupMode: boolean;
  // 动画
  frameIndex: number; // 当前编辑/跳转到的关键帧
  playing: boolean;
  loop: boolean;
  animPositions: Record<string, Vec> | null;
  animTimeMs: number;
  exporting: boolean; // GIF 导出中（锁定交互）
  // 历史
  history: Snapshot[];
  future: Snapshot[];
  // 已保存方案列表
  savedDocs: TacticDoc[];

  // ---- 基础 ----
  setTool: (t: Tool) => void;
  setDrawColor: (c: string) => void;
  setDocName: (n: string) => void;
  setPitchType: (t: PitchType) => void;
  setOrientation: (o: Orientation) => void;
  setGroupMode: (v: boolean) => void;
  setLoop: (v: boolean) => void;

  // ---- 选择 ----
  setSelection: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;

  // ---- 元素增删 ----
  addPlayer: (team: Team) => void;
  addCone: () => void;
  addDummy: () => void;
  toggleBall: () => void;
  removeElements: (ids: string[]) => void;
  applyFormation: (name: string, team: Team) => void;
  clearPlayers: (team?: Team) => void;

  // ---- 移动 / 编辑 ----
  moveElement: (id: string, to: Vec) => void;
  endMove: () => void;
  updatePlayer: (id: string, patch: Partial<PlayerT>) => void;
  setBind: (playerId: string, targetId: string | null) => void;

  // ---- 绘图 ----
  addDrawing: (d: DrawingT) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;

  // ---- 撤销 / 重做 ----
  undo: () => void;
  redo: () => void;

  // ---- 关键帧 ----
  addFrame: () => void;
  deleteFrame: (index: number) => void;
  gotoFrame: (index: number) => void;
  setFrameDuration: (index: number, ms: number) => void;
  setPathCtrl: (frameIndex: number, elementId: string, cp: Vec) => void;
  clearFrames: () => void;

  // ---- 播放 ----
  play: () => void;
  pause: () => void;
  stopPlayback: () => void;

  // ---- 存储 ----
  saveAs: (name: string) => void;
  loadDoc: (id: string) => void;
  deleteSaved: (id: string) => void;
  newBoard: () => void;
  importDoc: (doc: TacticDoc) => void;

  // GIF 导出辅助
  setExporting: (v: boolean) => void;
  setAnimForExport: (pos: Record<string, Vec> | null) => void;
}

let rafHandle: number | null = null;

export const useBoard = create<BoardState>((set, get) => {
  /** 修改 doc 并记录历史（element/drawing 级别操作前调用） */
  const commit = (mutate: (doc: TacticDoc) => Partial<TacticDoc>, recordHistory = true) => {
    const { doc, history } = get();
    const snap = takeSnapshot(doc);
    const next = { ...doc, ...mutate(doc), updatedAt: Date.now() };
    set({
      doc: next,
      history: recordHistory ? [...history.slice(-49), snap] : history,
      future: [],
    });
  };

  /** 盯人绑定表（播放/GIF 导出用） */
  const bindings = (): Record<string, { targetId: string; offset: Vec }> => {
    const out: Record<string, { targetId: string; offset: Vec }> = {};
    for (const p of get().doc.players) {
      if (p.bindToId && p.bindOffset) out[p.id] = { targetId: p.bindToId, offset: p.bindOffset };
    }
    return out;
  };

  return {
    doc: newDoc(),
    tool: 'select',
    drawColor: '#ffd43b',
    selectedIds: [],
    groupMode: false,
    frameIndex: 0,
    playing: false,
    loop: false,
    animPositions: null,
    animTimeMs: 0,
    exporting: false,
    history: [],
    future: [],
    savedDocs: loadSavedDocs(),

    setTool: (t) => set({ tool: t, selectedIds: [] }),
    setDrawColor: (c) => set({ drawColor: c }),
    setDocName: (n) => set((s) => ({ doc: { ...s.doc, name: n } })),
    setPitchType: (t) => set((s) => ({ doc: { ...s.doc, pitchType: t } })),
    setOrientation: (o) => set((s) => ({ doc: { ...s.doc, orientation: o } })),
    setGroupMode: (v) => set({ groupMode: v }),
    setLoop: (v) => set({ loop: v }),

    setSelection: (ids) => set({ selectedIds: ids }),
    toggleSelect: (id) =>
      set((s) => ({
        selectedIds: s.selectedIds.includes(id)
          ? s.selectedIds.filter((x) => x !== id)
          : [...s.selectedIds, id],
      })),
    clearSelection: () => set({ selectedIds: [] }),

    addPlayer: (team) => {
      const { doc } = get();
      const sameTeam = doc.players.filter((p) => p.team === team);
      const n = sameTeam.length + 1;
      commit((d) => ({
        players: [
          ...d.players,
          {
            id: uid('p'), kind: 'player', team,
            x: 20 + sameTeam.length * 3, y: team === 'home' ? 10 : 58,
            number: n, name: '', note: '', bindToId: null, bindOffset: null,
          },
        ],
      }));
    },

    addCone: () => {
      commit((d) => ({
        cones: [...d.cones, { id: uid('c'), kind: 'cone', x: 50, y: 30, color: '#ff922b' }],
      }));
    },

    addDummy: () => {
      commit((d) => ({
        dummies: [...d.dummies, { id: uid('d'), kind: 'dummy', x: 55, y: 34 }],
      }));
    },

    toggleBall: () => {
      commit((d) => ({
        ball: d.ball ? null : { id: 'ball', kind: 'ball', x: 52.5, y: 34 },
      }));
    },

    removeElements: (ids) => {
      commit((d) => ({
        players: d.players.filter((p) => !ids.includes(p.id)),
        cones: d.cones.filter((c) => !ids.includes(c.id)),
        dummies: d.dummies.filter((dm) => !ids.includes(dm.id)),
        ball: d.ball && ids.includes('ball') ? null : d.ball,
      }));
      set((s) => ({ selectedIds: s.selectedIds.filter((x) => !ids.includes(x)) }));
    },

    applyFormation: (name, team) => {
      const { doc } = get();
      const positions = formationPositions(name, doc.pitchType, team);
      if (positions.length === 0) return;
      commit((d) => {
        const others = d.players.filter((p) => p.team !== team);
        const newPlayers: PlayerT[] = positions.map((pos, i) => ({
          id: uid('p'), kind: 'player', team,
          x: pos.x, y: pos.y,
          number: i + 1, name: '', note: '', bindToId: null, bindOffset: null,
        }));
        return { players: [...others, ...newPlayers] };
      });
    },

    clearPlayers: (team) => {
      commit((d) => ({
        players: team ? d.players.filter((p) => p.team !== team) : [],
      }));
    },

    /** 拖动中实时更新位置（不入历史；盯人跟随 + 成组移动在此生效） */
    moveElement: (id, to) => {
      const { doc, groupMode, selectedIds } = get();
      const L = 9999; // 边界在 UI 层 clamp，这里直接信任传入
      const player = doc.players.find((p) => p.id === id);
      const movingIds = new Set<string>(
        player && groupMode && selectedIds.includes(id) ? selectedIds : [id],
      );
      // 跟随者：绑定了 movingIds 中某人、且自己不在移动集合里
      const followers = doc.players.filter(
        (p) => p.bindToId && movingIds.has(p.bindToId) && !movingIds.has(p.id),
      );

      const deltaFor = (eid: string): Vec => {
        if (eid === 'ball' && doc.ball) return { x: to.x - doc.ball.x, y: to.y - doc.ball.y };
        const el =
          doc.players.find((p) => p.id === eid) ??
          doc.cones.find((c) => c.id === eid) ??
          doc.dummies.find((dm) => dm.id === eid);
        return el ? { x: to.x - el.x, y: to.y - el.y } : { x: 0, y: 0 };
      };
      const baseDelta = deltaFor(id);

      const players = doc.players.map((p) => {
        if (movingIds.has(p.id)) {
          const d = deltaFor(p.id);
          return { ...p, x: p.x + d.x, y: p.y + d.y };
        }
        const f = followers.find((fp) => fp.id === p.id);
        if (f) return { ...p, x: p.x + baseDelta.x, y: p.y + baseDelta.y };
        return p;
      });
      const cones = doc.cones.map((c) =>
        c.id === id ? { ...c, x: to.x, y: to.y } : c,
      );
      const dummies = doc.dummies.map((dm) =>
        dm.id === id ? { ...dm, x: to.x, y: to.y } : dm,
      );
      const ball = doc.ball && id === 'ball' ? { ...doc.ball, x: to.x, y: to.y } : doc.ball;
      set({ doc: { ...doc, players, cones, dummies, ball } });
      void L;
    },

    /** 拖拽结束：入历史 + 若被拖的是绑定者本人则更新偏移 */
    endMove: () => {
      const { doc, history } = get();
      // 更新跟随者偏移（跟随者被单独拖动后）
      const players = doc.players.map((p) => {
        if (!p.bindToId) return p;
        const target = doc.players.find((t) => t.id === p.bindToId);
        if (!target) return { ...p, bindToId: null, bindOffset: null };
        return { ...p, bindOffset: { x: p.x - target.x, y: p.y - target.y } };
      });
      const next = { ...doc, players, updatedAt: Date.now() };
      set({ doc: next, history: [...history.slice(-49), takeSnapshot(doc)], future: [] });
    },

    updatePlayer: (id, patch) => {
      commit((d) => ({
        players: d.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }), false); // 文本编辑不入历史
    },

    setBind: (playerId, targetId) => {
      commit((d) => ({
        players: d.players.map((p) => {
          if (p.id !== playerId) return p;
          if (!targetId) return { ...p, bindToId: null, bindOffset: null };
          const target = d.players.find((t) => t.id === targetId);
          if (!target || target.id === playerId) return p;
          return {
            ...p, bindToId: targetId,
            bindOffset: { x: p.x - target.x, y: p.y - target.y },
          };
        }),
      }));
    },

    addDrawing: (drawing) => {
      commit((d) => ({ drawings: [...d.drawings, drawing] }));
    },

    removeDrawing: (id) => {
      commit((d) => ({ drawings: d.drawings.filter((x) => x.id !== id) }));
    },

    clearDrawings: () => {
      commit((d) => ({ drawings: [] }));
    },

    undo: () => {
      const { history, doc, future } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      set({
        doc: { ...doc, ...structuredClone(prev), updatedAt: Date.now() },
        history: history.slice(0, -1),
        future: [takeSnapshot(doc), ...future].slice(0, 50),
      });
    },

    redo: () => {
      const { history, doc, future } = get();
      if (future.length === 0) return;
      const [next, ...rest] = future;
      set({
        doc: { ...doc, ...structuredClone(next), updatedAt: Date.now() },
        history: [...history.slice(-49), takeSnapshot(doc)],
        future: rest,
      });
    },

    // ===== 关键帧 =====
    addFrame: () => {
      const { doc } = get();
      const frame: Keyframe = {
        id: uid('f'),
        positions: capturePositions(doc),
        duration: 1200,
        paths: {},
      };
      set({
        doc: { ...doc, frames: [...doc.frames, frame], updatedAt: Date.now() },
        frameIndex: doc.frames.length,
      });
    },

    deleteFrame: (index) => {
      const { doc, frameIndex } = get();
      const frames = doc.frames.filter((_, i) => i !== index);
      set({
        doc: { ...doc, frames, updatedAt: Date.now() },
        frameIndex: clamp(frameIndex, 0, Math.max(0, frames.length - 1)),
      });
    },

    /** 跳转到某帧：把该帧位置加载到棋盘上（从它继续编辑） */
    gotoFrame: (index) => {
      const { doc } = get();
      const frame = doc.frames[index];
      if (!frame) return;
      const pos = frame.positions;
      const players = doc.players.map((p) =>
        pos[p.id] ? { ...p, x: pos[p.id].x, y: pos[p.id].y } : p,
      );
      const cones = doc.cones.map((c) =>
        pos[c.id] ? { ...c, x: pos[c.id].x, y: pos[c.id].y } : c,
      );
      const dummies = doc.dummies.map((dm) =>
        pos[dm.id] ? { ...dm, x: pos[dm.id].x, y: pos[dm.id].y } : dm,
      );
      const ball = doc.ball && pos['ball']
        ? { ...doc.ball, x: pos['ball'].x, y: pos['ball'].y }
        : doc.ball;
      set({ doc: { ...doc, players, cones, dummies, ball }, frameIndex: index });
    },

    setFrameDuration: (index, ms) => {
      const { doc } = get();
      const frames = doc.frames.map((f, i) => (i === index ? { ...f, duration: ms } : f));
      set({ doc: { ...doc, frames, updatedAt: Date.now() } });
    },

    setPathCtrl: (fi, elementId, cp) => {
      const { doc } = get();
      const frames = doc.frames.map((f, i) =>
        i === fi ? { ...f, paths: { ...f.paths, [elementId]: cp } } : f,
      );
      set({ doc: { ...doc, frames, updatedAt: Date.now() } });
    },

    clearFrames: () => {
      set((s) => ({ doc: { ...s.doc, frames: [] }, frameIndex: 0, animPositions: null }));
    },

    // ===== 播放 =====
    play: () => {
      const { doc, playing } = get();
      if (playing || doc.frames.length < 2) return;
      const total = totalDuration(doc.frames);
      if (total <= 0) return;
      set({ playing: true });
      const startedAt = performance.now() - get().animTimeMs;
      const step = (now: number) => {
        const st = get();
        if (!st.playing) return;
        let t = now - startedAt;
        if (st.loop) {
          t = Math.min(t % (total + 400), total); // 播完停 400ms 再循环
        } else if (t >= total) {
          // 播完：停在最后一帧
          set({
            playing: false,
            animTimeMs: total,
            animPositions: positionsAt(st.doc.frames, total, bindings()),
          });
          return;
        }
        set({ animTimeMs: t, animPositions: positionsAt(st.doc.frames, t, bindings()) });
        rafHandle = requestAnimationFrame(step);
      };
      rafHandle = requestAnimationFrame(step);
    },

    pause: () => {
      if (rafHandle) cancelAnimationFrame(rafHandle);
      set({ playing: false });
    },

    stopPlayback: () => {
      if (rafHandle) cancelAnimationFrame(rafHandle);
      set({ playing: false, animPositions: null, animTimeMs: 0 });
    },

    // ===== 存储 =====
    saveAs: (name) => {
      const doc = { ...get().doc, name, updatedAt: Date.now() };
      set({ doc });
      const docs = loadSavedDocs().filter((d) => d.id !== doc.id);
      docs.push(doc);
      persistSavedDocs(docs);
      set({ savedDocs: docs });
    },

    loadDoc: (id) => {
      const found = loadSavedDocs().find((d) => d.id === id);
      if (!found) return;
      set({
        doc: structuredClone(found),
        history: [], future: [], selectedIds: [],
        frameIndex: 0, animPositions: null, playing: false,
      });
    },

    deleteSaved: (id) => {
      const docs = loadSavedDocs().filter((d) => d.id !== id);
      persistSavedDocs(docs);
      set({ savedDocs: docs });
    },

    newBoard: () => {
      set({
        doc: newDoc(), history: [], future: [], selectedIds: [],
        frameIndex: 0, animPositions: null, playing: false,
      });
    },

    importDoc: (doc) => {
      const d = { ...doc, id: doc.id || uid('doc'), updatedAt: Date.now() };
      set({
        doc: d, history: [], future: [], selectedIds: [],
        frameIndex: 0, animPositions: null, playing: false,
      });
    },

    setExporting: (v) => set({ exporting: v }),
    setAnimForExport: (pos) => set({ animPositions: pos }),
  };
});

export { HOME_COLOR, AWAY_COLOR };
