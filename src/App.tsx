import { useEffect } from 'react';
import { BoardCanvas } from './components/BoardCanvas';
import { Toolbar } from './components/Toolbar';
import { PlayerEditor } from './components/PlayerEditor';
import { AnimationPanel } from './components/AnimationPanel';
import { TacticManager } from './components/TacticManager';
import { useBoard } from './store';

export default function App() {
  // Delete 键删除选中元素
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const st = useBoard.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedIds.length > 0) {
        st.removeElements(st.selectedIds);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        st.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        st.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚽ 足球战术板</h1>
        <DocNameInput />
      </header>
      <Toolbar />
      <div className="app-main">
        <aside className="side left">
          <TacticManager />
        </aside>
        <main className="center">
          <BoardCanvas />
        </main>
        <aside className="side right">
          <PlayerEditor />
        </aside>
      </div>
      <AnimationPanel />
    </div>
  );
}

function DocNameInput() {
  const name = useBoard((s) => s.doc.name);
  return (
    <input
      className="doc-name"
      value={name}
      onChange={(e) => useBoard.getState().setDocName(e.target.value)}
      title="战术名称"
    />
  );
}
