import GIF from 'gif.js';
import workerUrl from 'gif.js/dist/gif.worker.js?url';
import { stageRef } from './refs';
import { useBoard } from './store';
import { totalDuration, positionsAt } from './geometry';
import type { TacticDoc, Vec } from './types';

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function exportPNG(name: string) {
  const stage = stageRef.current;
  if (!stage) return;
  const url = stage.toDataURL({ pixelRatio: 2 });
  download(url, `${name || '战术板'}.png`);
}

export function exportJSON(doc: TacticDoc) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `${doc.name || '战术'}.json`);
  URL.revokeObjectURL(url);
}

export function importJSON(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const doc = JSON.parse(String(reader.result)) as TacticDoc;
      if (!doc.players || !doc.pitchType) throw new Error('bad file');
      useBoard.getState().importDoc(doc);
    } catch {
      window.alert('导入失败：文件格式不正确');
    }
  };
  reader.readAsText(file);
}

const raf2 = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** 把关键帧动画逐帧渲染并导出为 GIF */
export async function exportGIF(name: string, onProgress: (s: string) => void) {
  const stage = stageRef.current;
  const st = useBoard.getState();
  const { doc } = st;
  if (!stage || doc.frames.length < 2) return;

  const total = totalDuration(doc.frames);
  const step = 100; // 10fps
  const frameCount = Math.min(120, Math.max(2, Math.round(total / step) + 1));

  const bindings: Record<string, { targetId: string; offset: Vec }> = {};
  for (const p of doc.players) {
    if (p.bindToId && p.bindOffset) {
      bindings[p.id] = { targetId: p.bindToId, offset: p.bindOffset };
    }
  }

  st.setExporting(true);
  try {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerUrl,
      width: stage.width(),
      height: stage.height(),
    });

    for (let i = 0; i < frameCount; i++) {
      const t = Math.min(total, (total * i) / (frameCount - 1));
      st.setAnimForExport(positionsAt(doc.frames, t, bindings));
      await raf2(); // 等 React + Konva 重绘
      gif.addFrame(stage.toCanvas({ pixelRatio: 1 }), { delay: step, copy: true });
      onProgress(`${i + 1}/${frameCount} 帧`);
    }

    await new Promise<void>((resolve) => {
      gif.on('finished', (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        download(url, `${name || '战术动画'}.gif`);
        URL.revokeObjectURL(url);
        resolve();
      });
      gif.render();
    });
  } finally {
    st.setAnimForExport(null);
    st.setExporting(false);
  }
}
