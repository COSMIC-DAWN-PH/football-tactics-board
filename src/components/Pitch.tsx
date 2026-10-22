import { Rect, Line, Circle, Group, Arc } from 'react-konva';
import type { PitchType } from '../types';
import { PITCH_DIMS } from '../types';

const LINE = 'rgba(255,255,255,0.85)';
const GRASS_A = '#2f9e44';
const GRASS_B = '#2b8a3e';

/** 场地划线（单位：米，原点在左下角外边界） */
export function Pitch({ type }: { type: PitchType }) {
  const { L, W } = PITCH_DIMS[type];
  const stripes = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    stripes.push(
      <Rect
        key={i}
        x={(L / n) * i}
        y={0}
        width={L / n}
        height={W}
        fill={i % 2 === 0 ? GRASS_A : GRASS_B}
      />,
    );
  }

  const sw = 0.15; // 线宽（米）
  const common = { stroke: LINE, strokeWidth: sw, listening: false };

  // 各规格场地尺寸（近似）
  const box = type === '11'
    ? { penalty: 16.5, penaltyW: 40.32, goal: 5.5, goalW: 18.32, penSpot: 11, circle: 9.15, corner: 1 }
    : type === '8'
      ? { penalty: 12, penaltyW: 26, goal: 4, goalW: 12, penSpot: 9, circle: 6, corner: 0.8 }
      : { penalty: 9, penaltyW: 14, goal: 0, goalW: 0, penSpot: 6, circle: 3, corner: 0.5 };

  const cY = W / 2;
  const cX = L / 2;

  return (
    <Group listening={false}>
      {/* 草皮条纹 */}
      {stripes}
      {/* 外边界 */}
      <Rect x={0} y={0} width={L} height={W} {...common} />
      {/* 中线 + 中圈 + 中点 */}
      <Line points={[cX, 0, cX, W]} {...common} />
      <Circle x={cX} y={cY} radius={box.circle} {...common} />
      <Circle x={cX} y={cY} radius={0.3} fill={LINE} />
      {/* 两侧禁区 / 球门区 / 点球点 / 弧顶 */}
      {[0, 1].map((side) => {
        const flip = side === 1;
        const bx = flip ? L - box.penalty : 0;
        const gx = flip ? L - box.goal : 0;
        const spotX = flip ? L - box.penSpot : box.penSpot;
        // 弧顶：以点球点为圆心、box.circle 为半径，画朝向中场的弧
        const arcX = spotX;
        const angle = 55; // 近似
        return (
          <Group key={side}>
            <Rect
              x={bx}
              y={cY - box.penaltyW / 2}
              width={box.penalty}
              height={box.penaltyW}
              {...common}
            />
            {box.goal > 0 && (
              <Rect
                x={gx}
                y={cY - box.goalW / 2}
                width={box.goal}
                height={box.goalW}
                {...common}
              />
            )}
            <Circle x={spotX} y={cY} radius={0.25} fill={LINE} />
            <Arc
              x={arcX}
              y={cY}
              innerRadius={box.circle}
              outerRadius={box.circle}
              angle={angle * 2}
              rotation={flip ? 180 - angle : -angle}
              {...common}
            />
            {/* 球门 */}
            <Rect
              x={flip ? L : -1.2}
              y={cY - (type === '11' ? 3.66 : type === '8' ? 2.5 : 1.5)}
              width={1.2}
              height={type === '11' ? 7.32 : type === '8' ? 5 : 3}
              stroke={LINE}
              strokeWidth={0.2}
              fill="rgba(255,255,255,0.15)"
            />
          </Group>
        );
      })}
      {/* 角旗弧 */}
      {[
        { x: 0, y: 0, rot: 0 },
        { x: L, y: 0, rot: 90 },
        { x: L, y: W, rot: 180 },
        { x: 0, y: W, rot: 270 },
      ].map((c, i) => (
        <Arc
          key={i}
          x={c.x}
          y={c.y}
          innerRadius={box.corner}
          outerRadius={box.corner}
          angle={90}
          rotation={c.rot}
          {...common}
        />
      ))}
    </Group>
  );
}
