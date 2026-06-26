import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Shape = 'square' | 'triangle' | 'diamond' | 'circle' | 'polygon';
type Cell = { r: number; c: number; walls: { n: boolean; e: boolean; s: boolean; w: boolean }; visited: boolean; active: boolean };
type Maze = { grid: Cell[][]; rows: number; cols: number; start: Cell; end: Cell; path: string[] };

const shapeLabels: Record<Shape, string> = {
  square: 'Квадрат',
  triangle: 'Треугольник',
  diamond: 'Ромб',
  circle: 'Круг',
  polygon: 'Многоугольник'
};

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isActive(shape: Shape, r: number, c: number, rows: number, cols: number) {
  const x = (c + 0.5) / cols;
  const y = (r + 0.5) / rows;
  if (shape === 'square') return true;
  if (shape === 'triangle') return y > 0.08 && x > 0.5 - y * 0.48 && x < 0.5 + y * 0.48;
  if (shape === 'diamond') return Math.abs(x - 0.5) + Math.abs(y - 0.5) < 0.49;
  if (shape === 'circle') return Math.hypot(x - 0.5, y - 0.5) < 0.49;
  const angle = Math.atan2(y - 0.5, x - 0.5);
  const radius = 0.47 * (0.92 + 0.08 * Math.cos(6 * angle));
  return Math.hypot(x - 0.5, y - 0.5) < radius;
}

function key(cell: Cell) { return `${cell.r}:${cell.c}`; }

function neighbors(grid: Cell[][], cell: Cell) {
  const dirs = [
    ['n', -1, 0, 's'], ['e', 0, 1, 'w'], ['s', 1, 0, 'n'], ['w', 0, -1, 'e']
  ] as const;
  const out: Array<{ dir: 'n'|'e'|'s'|'w'; back: 'n'|'e'|'s'|'w'; cell: Cell }> = [];
  for (const [dir, dr, dc, back] of dirs) {
    const n = grid[cell.r + dr]?.[cell.c + dc];
    if (n?.active) out.push({ dir, back, cell: n });
  }
  return out;
}


function carve(a: Cell, b: Cell, dir: 'n'|'e'|'s'|'w', back: 'n'|'e'|'s'|'w') {
  a.walls[dir] = false;
  b.walls[back] = false;
}

function generateDepthFirst(grid: Cell[][], start: Cell, rnd: () => number) {
  const stack = [start];
  start.visited = true;

  while (stack.length) {
    const current = stack[stack.length - 1];
    const choices = neighbors(grid, current).filter(n => !n.cell.visited);
    if (!choices.length) { stack.pop(); continue; }
    const picked = choices[Math.floor(rnd() * choices.length)];
    carve(current, picked.cell, picked.dir, picked.back);
    picked.cell.visited = true;
    stack.push(picked.cell);
  }
}

function generateDeadEndHeavy(grid: Cell[][], start: Cell, rnd: () => number) {
  // Randomized Prim обычно создает больше коротких веток и тупиков,
  // поэтому используем его для сложных уровней.
  const frontier: Array<{ from: Cell; to: Cell; dir: 'n'|'e'|'s'|'w'; back: 'n'|'e'|'s'|'w' }> = [];
  const addFrontier = (cell: Cell) => {
    for (const n of neighbors(grid, cell)) {
      if (!n.cell.visited) frontier.push({ from: cell, to: n.cell, dir: n.dir, back: n.back });
    }
  };

  start.visited = true;
  addFrontier(start);

  while (frontier.length) {
    const index = Math.floor(rnd() * frontier.length);
    const edge = frontier.splice(index, 1)[0];
    if (edge.to.visited) continue;
    carve(edge.from, edge.to, edge.dir, edge.back);
    edge.to.visited = true;
    addFrontier(edge.to);
  }
}

function makeMaze(shape: Shape, difficulty: number, seedText: string): Maze {
  const size = 6 + difficulty * 3;
  const rows = size;
  const cols = size;
  const grid: Cell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      r, c,
      walls: { n: true, e: true, s: true, w: true },
      visited: false,
      active: isActive(shape, r, c, rows, cols)
    }))
  );
  const active = grid.flat().filter(c => c.active);
  const rnd = mulberry32(hashSeed(`${seedText}-${shape}-${difficulty}`));
  const start = active.reduce((a, b) => (b.c < a.c || b.r > a.r ? b : a), active[0]);
  if (difficulty >= 6) generateDeadEndHeavy(grid, start, rnd);
  else generateDepthFirst(grid, start, rnd);

  // Дополнительные проходы для младших уровней, чтобы лабиринт был мягче.
  // На сложных уровнях проходы НЕ добавляем: так остается больше тупиков.
  const openings = Math.max(0, 6 - difficulty) * 4;
  for (let i = 0; i < openings; i++) {
    const cell = active[Math.floor(rnd() * active.length)];
    const ns = neighbors(grid, cell);
    const n = ns[Math.floor(rnd() * ns.length)];
    if (n) { cell.walls[n.dir] = false; n.cell.walls[n.back] = false; }
  }

  const end = farthestCell(grid, start).cell;
  const path = solve(grid, start, end);
  return { grid, rows, cols, start, end, path };
}

function farthestCell(grid: Cell[][], start: Cell) {
  const q: Array<{ cell: Cell; d: number }> = [{ cell: start, d: 0 }];
  const seen = new Set([key(start)]);
  let far = q[0];
  for (let i = 0; i < q.length; i++) {
    const item = q[i];
    if (item.d > far.d) far = item;
    for (const n of openNeighbors(grid, item.cell)) if (!seen.has(key(n))) {
      seen.add(key(n)); q.push({ cell: n, d: item.d + 1 });
    }
  }
  return far;
}

function openNeighbors(grid: Cell[][], cell: Cell) {
  const map = [ ['n', -1, 0], ['e', 0, 1], ['s', 1, 0], ['w', 0, -1] ] as const;
  return map.flatMap(([dir, dr, dc]) => !cell.walls[dir] && grid[cell.r + dr]?.[cell.c + dc]?.active ? [grid[cell.r + dr][cell.c + dc]] : []);
}

function solve(grid: Cell[][], start: Cell, end: Cell) {
  const q = [start];
  const prev = new Map<string, string>();
  const byKey = new Map(grid.flat().map(c => [key(c), c]));
  const seen = new Set([key(start)]);
  while (q.length) {
    const cell = q.shift()!;
    if (cell === end) break;
    for (const n of openNeighbors(grid, cell)) if (!seen.has(key(n))) {
      seen.add(key(n)); prev.set(key(n), key(cell)); q.push(n);
    }
  }
  const path = [key(end)];
  while (path[0] !== key(start)) {
    const p = prev.get(path[0]);
    if (!p) break;
    path.unshift(p);
  }
  return path.filter(k => byKey.has(k));
}

function MazeSvg({ maze, showSolution }: { maze: Maze; showSolution: boolean }) {
  const cell = 520 / Math.max(maze.rows, maze.cols);
  const pathSet = new Set(maze.path);
  return <svg id="maze-svg" viewBox={`0 0 ${maze.cols * cell} ${maze.rows * cell}`} role="img" aria-label="Лабиринт">
    <rect width="100%" height="100%" fill="white" rx="18" />
    {showSolution && maze.grid.flat().filter(c => pathSet.has(key(c))).map(c => <circle key={`p-${key(c)}`} cx={(c.c + .5) * cell} cy={(c.r + .5) * cell} r={cell * .18} className="solution" />)}
    {maze.grid.flat().filter(c => c.active).map(c => {
      const x = c.c * cell, y = c.r * cell;
      const d = [] as React.ReactNode[];
      if (c.walls.n) d.push(<line key="n" x1={x} y1={y} x2={x + cell} y2={y} />);
      if (c.walls.e) d.push(<line key="e" x1={x + cell} y1={y} x2={x + cell} y2={y + cell} />);
      if (c.walls.s) d.push(<line key="s" x1={x} y1={y + cell} x2={x + cell} y2={y + cell} />);
      if (c.walls.w) d.push(<line key="w" x1={x} y1={y} x2={x} y2={y + cell} />);
      return <g key={key(c)} className="wall">{d}</g>;
    })}
    <circle cx={(maze.start.c + .5) * cell} cy={(maze.start.r + .5) * cell} r={cell * .28} className="start" />
    <circle cx={(maze.end.c + .5) * cell} cy={(maze.end.r + .5) * cell} r={cell * .28} className="finish" />
  </svg>;
}

function App() {
  const [shape, setShape] = useState<Shape>('square');
  const [difficulty, setDifficulty] = useState(4);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8));
  const [showSolution, setShowSolution] = useState(false);
  const maze = useMemo(() => makeMaze(shape, difficulty, seed), [shape, difficulty, seed]);
  const wrapRef = useRef<HTMLDivElement>(null);

  async function shareMaze() {
    const url = `${location.origin}${location.pathname}?shape=${shape}&difficulty=${difficulty}&seed=${seed}`;
    if (navigator.share) await navigator.share({ title: 'Мой лабиринт', text: `Лабиринт: ${shapeLabels[shape]}, сложность ${difficulty}/10`, url });
    else await navigator.clipboard.writeText(url);
  }

  function downloadSvg() {
    const svg = document.getElementById('maze-svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `maze-${shape}-${difficulty}-${seed}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printMaze() {
    setShowSolution(false);
    window.setTimeout(() => window.print(), 80);
  }

  return <main className="app">
    <section className="hero">
      <p className="eyebrow">iOS PWA</p>
      <h1>Генератор лабиринтов для детей</h1>
      <p>Выбирай форму и сложность от 1 до 10. Создавай, сохраняй и делись лабиринтами.</p>
    </section>

    <section className="panel controls">
      <label>Форма</label>
      <div className="chips">{(Object.keys(shapeLabels) as Shape[]).map(s => <button className={shape === s ? 'active' : ''} onClick={() => setShape(s)} key={s}>{shapeLabels[s]}</button>)}</div>
      <label>Сложность: <b>{difficulty}/10</b></label>
      <input type="range" min="1" max="10" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} />
      <small>{difficulty <= 2 ? 'Для 3–5 лет' : difficulty <= 4 ? 'Для 6–8 лет' : difficulty <= 7 ? 'Для 9–12 лет' : 'Для 13–16 лет'}</small>
      <div className="row">
        <button onClick={() => { setSeed(Math.random().toString(36).slice(2, 8)); setShowSolution(false); }}>Сгенерировать</button>
        <button className="secondary" onClick={() => setShowSolution(v => !v)}>{showSolution ? 'Скрыть решение' : 'Показать решение'}</button>
      </div>
    </section>

    <section className="panel maze" ref={wrapRef}>
      <MazeSvg maze={maze} showSolution={showSolution} />
    </section>

    <section className="actions">
      <button onClick={downloadSvg}>Скачать SVG</button>
      <button onClick={printMaze}>Печать</button>
      <button onClick={shareMaze}>Поделиться</button>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
