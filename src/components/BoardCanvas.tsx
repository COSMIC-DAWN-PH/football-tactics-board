import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Group, Circle, Text as KText, Line, Rect, RegularPolygon, Arrow as KArrow } from 'react-konva';
import type Konva from 'konva';
import { useBoard } from '../store';
import { Pitch } from './Pitch';
import { stageRef } from '../refs';
import { PITCH_DIMS, HOME_COLOR, AWAY_COLOR } from '../types';
import type { Vec, DrawingT } from '../types';
import { uid, midpoint, clamp } from '../geometry';

const PAD = 10;

interface DraftDrawing {
  kind: 'arrow' | 'dashedArrow' | 'freehand' | 'zone';
  start: Vec;
  current: Vec;
  points: number[];
}

export function BoardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<Konva.Group>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [draft, setDraft] = useState<DraftDrawing | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const doc = useBoard((s) => s.doc);
  const tool = useBoard((s) => s.tool);
  const drawColor = useBoard((s) => s.drawColor);
  const selectedIds = useBoard((s) => s.selectedIds);
  const playing = useBoard((s) => s.playing);
  const exporting = useBoard((s) => s.exporting);
  const animPositions = useBoard((s) => s.animPositions);
  const frameIndex = useBoard((s) => s.frameIndex);
  const groupMode = useBoard((s) => s.groupMode);

  const { L, W } = PITCH_DIMS[doc.pitchType];
  const vertical = doc.orientation === 'v';

  // ---- 尺寸自适应 ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const scale = vertical
    ? Math.min((size.w - 2 * PAD) / W, (size.h - 2 * PAD) / L)
    : Math.min((size.w - 2 * PAD) / L, (size.h - 2 * PAD) / W);
  const stageW = (vertical ? W : L) * scale + 2 * PAD;
  const stageH = (vertical ? L : W) * scale + 2 * PAD;

  // 元素渲染位置（播放/导出时用插值位置）
  const posOf = useCallback(
    (id: string, fallback: Vec): Vec => animPositions?.[id] ?? fallback,
    [animPositions],
  );

  const interactive = tool === 'select' && !playing && !exporting;

  // 指针位置（像素）→ 场地坐标（米）
  const toMeters = (): Vec | null => {
    const stage = stageRef.current;
    const g = groupRef.current;
    if (!stage || !g) return null;
    const p = stage.getPointerPosition();
    if (!p) return null;
    return g.getAbsoluteTransform().copy().invert().point(p);
  };

  const clampToPitch = (v: Vec): Vec => ({
    x: clamp(v.x, -2, L + 2),
    y: clamp(v.y, -2, W + 2),
  });

  // ---- 指针事件：绘图 / 框选 ----
  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (playing || exporting) return;
    // 点到元素上时不触发画布操作（元素的拖拽/点击优先）
    if (e.target !== stageRef.current) return;
    const m = toMeters();
    if (!m) return;
    const st = useBoard.getState();

    if (tool === 'select') {
      const stage = stageRef.current;
      const p = stage?.getPointerPosition();
      if (p) setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
      return;
    }
    if (tool === 'text') {
      const text = window.prompt('输入标注文字：');
      if (text?.trim()) {
        st.addDrawing({ id: uid('t'), type: 'text', at: m, text: text.trim(), color: drawColor });
      }
      return;
    }
    if (tool === 'arrow' || tool === 'dashedArrow' || tool === 'freehand' || tool === 'zone') {
      setDraft({ kind: tool, start: m, current: m, points: [m.x, m.y] });
    }
  };

  const onPointerMove = () => {
    if (marquee) {
      const p = stageRef.current?.getPointerPosition();
      if (p) setMarquee({ ...marquee, x1: p.x, y1: p.y });
      return;
    }
    if (!draft) return;
    const m = toMeters();
    if (!m) return;
    if (draft.kind === 'freehand') {
      setDraft({ ...draft, current: m, points: [...draft.points, m.x, m.y] });
    } else {
      setDraft({ ...draft, current: m });
    }
  };

  const onPointerUp = () => {
    const st = useBoard.getState();
    if (marquee) {
      // 框选：把框转回场地坐标，选中心落在框内的球员/球
      const g = groupRef.current;
      if (g) {
        const inv = g.getAbsoluteTransform().copy().invert();
        const a = inv.point({ x: marquee.x0, y: marquee.y0 });
        const b = inv.point({ x: marquee.x1, y: marquee.y1 });
        const [minX, maxX] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
        const [minY, maxY] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
        const ids: string[] = [];
        for (const p of doc.players) {
          if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) ids.push(p.id);
        }
        if (doc.ball && doc.ball.x >= minX && doc.ball.x <= maxX && doc.ball.y >= minY && doc.ball.y <= maxY) {
          ids.push('ball');
        }
        st.setSelection(ids);
      }
      setMarquee(null);
      return;
    }
    if (!draft) return;
    const { kind, start, current, points } = draft;
    if (kind === 'arrow' || kind === 'dashedArrow') {
      const dist = Math.hypot(current.x - start.x, current.y - start.y);
      if (dist > 1) {
        st.addDrawing({
          id: uid('a'), type: 'arrow', dashed: kind === 'dashedArrow',
          from: start, to: current, color: drawColor,
        });
      }
    } else if (kind === 'freehand') {
      if (points.length >= 6) {
        st.addDrawing({ id: uid('f'), type: 'freehand', points, color: drawColor });
      }
    } else if (kind === 'zone') {
      const w = current.x - start.x;
      const h = current.y - start.y;
      if (Math.abs(w) > 1 && Math.abs(h) > 1) {
        st.addDrawing({
          id: uid('z'), type: 'zone',
          x: Math.min(start.x, current.x), y: Math.min(start.y, current.y),
          w: Math.abs(w), h: Math.abs(h), color: drawColor,
        });
      }
    }
    setDraft(null);
  };

  // ---- 元素拖拽 ----
  const onElemDragMove = (id: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const p = e.target.position(); // 父坐标系 = 米
    useBoard.getState().moveElement(id, clampToPitch(p));
  };
  const onElemDragEnd = (id: string) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const p = e.target.position();
    useBoard.getState().moveElement(id, clampToPitch(p));
    useBoard.getState().endMove();
  };

  const onElemClick = (id: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return;
    e.cancelBubble = true;
    useBoard.getState().toggleSelect(id);
  };

  // ---- 绘图渲染 ----
  const renderDrawing = (d: DrawingT) => {
    const erasable = tool === 'eraser';
    const onErase = erasable
      ? () => useBoard.getState().removeDrawing(d.id)
      : undefined;
    const hover = erasable ? { shadowColor: 'red', shadowBlur: 8 } : {};
    switch (d.type) {
      case 'arrow':
        return (
          <KArrow
            key={d.id}
            points={[d.from.x, d.from.y, d.to.x, d.to.y]}
            stroke={d.color}
            strokeWidth={0.35}
            dash={d.dashed ? [1.5, 1] : undefined}
            pointerLength={1.6}
            pointerWidth={1.4}
            fill={d.color}
            onClick={onErase}
            onTap={onErase}
            hitStrokeWidth={2}
            {...hover}
          />
        );
      case 'freehand':
        return (
          <Line
            key={d.id}
            points={d.points}
            stroke={d.color}
            strokeWidth={0.3}
            tension={0.5}
            lineCap="round"
            onClick={onErase}
            onTap={onErase}
            hitStrokeWidth={2}
            {...hover}
          />
        );
      case 'text':
        return (
          <KText
            key={d.id}
            x={d.at.x}
            y={d.at.y}
            text={d.text}
            fontSize={2.2}
            fill={d.color}
            fontStyle="bold"
            onClick={onErase}
            onTap={onErase}
            {...hover}
          />
        );
      case 'zone':
        return (
          <Rect
            key={d.id}
            x={d.x}
            y={d.y}
            width={d.w}
            height={d.h}
            fill={d.color + '44'}
            stroke={d.color}
            strokeWidth={0.2}
            dash={[1, 0.8]}
            onClick={onErase}
            onTap={onErase}
            {...hover}
          />
        );
    }
  };

  // ---- 草稿渲染 ----
  const renderDraft = () => {
    if (!draft) return null;
    if (draft.kind === 'arrow' || draft.kind === 'dashedArrow') {
      return (
        <KArrow
          points={[draft.start.x, draft.start.y, draft.current.x, draft.current.y]}
          stroke={drawColor}
          strokeWidth={0.35}
          dash={draft.kind === 'dashedArrow' ? [1.5, 1] : undefined}
          pointerLength={1.6}
          pointerWidth={1.4}
          fill={drawColor}
          opacity={0.7}
          listening={false}
        />
      );
    }
    if (draft.kind === 'freehand') {
      return (
        <Line
          points={draft.points}
          stroke={drawColor}
          strokeWidth={0.3}
          tension={0.5}
          opacity={0.7}
          listening={false}
        />
      );
    }
    return (
      <Rect
        x={Math.min(draft.start.x, draft.current.x)}
        y={Math.min(draft.start.y, draft.current.y)}
        width={Math.abs(draft.current.x - draft.start.x)}
        height={Math.abs(draft.current.y - draft.start.y)}
        fill={drawColor + '44'}
        stroke={drawColor}
        strokeWidth={0.2}
        dash={[1, 0.8]}
        listening={false}
      />
    );
  };

  // ---- 球员 ----
  const renderPlayer = (p: (typeof doc.players)[number]) => {
    const pos = posOf(p.id, { x: p.x, y: p.y });
    const color = p.team === 'home' ? HOME_COLOR : AWAY_COLOR;
    const selected = selectedIds.includes(p.id);
    return (
      <Group
        key={p.id}
        x={pos.x}
        y={pos.y}
        draggable={interactive}
        onDragMove={onElemDragMove(p.id)}
        onDragEnd={onElemDragEnd(p.id)}
        onClick={onElemClick(p.id)}
        onTap={onElemClick(p.id)}
      >
        <Circle
          radius={1.35}
          fill={color}
          stroke={selected ? '#ffe066' : '#fff'}
          strokeWidth={selected ? 0.35 : 0.15}
          shadowColor="black"
          shadowBlur={selected ? 6 : 2}
          shadowOpacity={0.4}
        />
        <KText
          text={String(p.number)}
          fontSize={1.5}
          fontStyle="bold"
          fill="#fff"
          x={-1.35}
          y={-0.75}
          width={2.7}
          align="center"
          listening={false}
        />
        {(p.name || p.note) && (
          <KText
            text={p.name || p.note}
            fontSize={1.4}
            fill="#fff"
            stroke="rgba(0,0,0,0.6)"
            strokeWidth={0.08}
            x={-4}
            y={1.6}
            width={8}
            align="center"
            listening={false}
          />
        )}
      </Group>
    );
  };

  // ---- 盯人绑定线 ----
  const renderBindings = () =>
    doc.players
      .filter((p) => p.bindToId)
      .map((p) => {
        const target = doc.players.find((t) => t.id === p.bindToId);
        if (!target) return null;
        const a = posOf(p.id, { x: p.x, y: p.y });
        const b = posOf(target.id, { x: target.x, y: target.y });
        return (
          <Line
            key={`bind_${p.id}`}
            points={[a.x, a.y, b.x, b.y]}
            stroke="#ff8787"
            strokeWidth={0.15}
            dash={[0.8, 0.8]}
            opacity={0.8}
            listening={false}
          />
        );
      });

  // ---- 路径编辑手柄（选中单个元素 + 当前帧 < 最后一帧）----
  const renderPathEditor = () => {
    if (!interactive || selectedIds.length !== 1) return null;
    const id = selectedIds[0];
    const frames = doc.frames;
    if (frames.length < 2 || frameIndex >= frames.length - 1) return null;
    const f0 = frames[frameIndex];
    const f1 = frames[frameIndex + 1];
    const p0 = f0.positions[id];
    const p1 = f1.positions[id];
    if (!p0 || !p1) return null;
    const cp = f0.paths[id] ?? midpoint(p0, p1);
    // 采样画曲线
    const pts: number[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const u = 1 - t;
      pts.push(u * u * p0.x + 2 * u * t * cp.x + t * t * p1.x);
      pts.push(u * u * p0.y + 2 * u * t * cp.y + t * t * p1.y);
    }
    return (
      <Group>
        <Line points={pts} stroke="#ffe066" strokeWidth={0.2} dash={[0.7, 0.7]} listening={false} />
        <Circle x={p0.x} y={p0.y} radius={0.5} fill="rgba(255,224,102,0.5)" listening={false} />
        <Circle x={p1.x} y={p1.y} radius={0.5} fill="rgba(255,224,102,0.9)" listening={false} />
        <Circle
          x={cp.x}
          y={cp.y}
          radius={0.8}
          fill="#ffe066"
          stroke="#000"
          strokeWidth={0.12}
          draggable
          onDragMove={(e) => {
            const p = e.target.position();
            useBoard.getState().setPathCtrl(frameIndex, id, clampToPitch(p));
          }}
        />
      </Group>
    );
  };

  return (
    <div ref={containerRef} className="board-container">
      <Stage
        ref={(node) => {
          stageRef.current = node;
        }}
        width={stageW}
        height={stageH}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <Layer listening={false}>
          <Rect x={0} y={0} width={stageW} height={stageH} fill="#1b5e20" cornerRadius={6} />
        </Layer>
        <Layer>
          <Group
            ref={groupRef}
            x={PAD}
            y={vertical ? stageH - PAD : PAD}
            rotation={vertical ? -90 : 0}
            scaleX={scale}
            scaleY={scale}
          >
            <Pitch type={doc.pitchType} />
            {renderBindings()}
            {doc.drawings.map(renderDrawing)}
            {renderDraft()}
            {doc.cones.map((c) => {
              const pos = posOf(c.id, { x: c.x, y: c.y });
              return (
                <RegularPolygon
                  key={c.id}
                  x={pos.x}
                  y={pos.y}
                  sides={3}
                  radius={0.9}
                  fill={c.color}
                  stroke="#00000066"
                  strokeWidth={0.1}
                  draggable={interactive}
                  onDragMove={onElemDragMove(c.id)}
                  onDragEnd={onElemDragEnd(c.id)}
                />
              );
            })}
            {doc.dummies.map((dm) => {
              const pos = posOf(dm.id, { x: dm.x, y: dm.y });
              return (
                <Rect
                  key={dm.id}
                  x={pos.x - 0.5}
                  y={pos.y - 1}
                  width={1}
                  height={2}
                  fill="#ffd43b"
                  stroke="#00000066"
                  strokeWidth={0.1}
                  cornerRadius={0.2}
                  draggable={interactive}
                  onDragMove={onElemDragMove(dm.id)}
                  onDragEnd={onElemDragEnd(dm.id)}
                />
              );
            })}
            {doc.players.map(renderPlayer)}
            {doc.ball && (() => {
              const pos = posOf('ball', { x: doc.ball.x, y: doc.ball.y });
              const selected = selectedIds.includes('ball');
              return (
                <Group
                  x={pos.x}
                  y={pos.y}
                  draggable={interactive}
                  onDragMove={onElemDragMove('ball')}
                  onDragEnd={onElemDragEnd('ball')}
                  onClick={onElemClick('ball')}
                  onTap={onElemClick('ball')}
                >
                  <Circle
                    radius={0.65}
                    fill="#fff"
                    stroke={selected ? '#ffe066' : '#333'}
                    strokeWidth={selected ? 0.3 : 0.12}
                    shadowColor="black"
                    shadowBlur={2}
                    shadowOpacity={0.4}
                  />
                </Group>
              );
            })()}
            {renderPathEditor()}
          </Group>
        </Layer>
        {/* 框选矩形（屏幕坐标） */}
        <Layer listening={false}>
          {marquee && (
            <Rect
              x={Math.min(marquee.x0, marquee.x1)}
              y={Math.min(marquee.y0, marquee.y1)}
              width={Math.abs(marquee.x1 - marquee.x0)}
              height={Math.abs(marquee.y1 - marquee.y0)}
              fill="rgba(255,224,102,0.15)"
              stroke="#ffe066"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
        </Layer>
      </Stage>
      {groupMode && selectedIds.length > 0 && (
        <div className="group-hint">成组移动中 · 已选 {selectedIds.length} 个</div>
      )}
    </div>
  );
}
