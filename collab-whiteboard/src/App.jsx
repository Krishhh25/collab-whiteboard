import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';

const COLORS = ['#378ADD', '#D85A30', '#639922', '#D4537E', '#2C2C2A'];

function App() {
  const [shapes, setShapesState] = useState([
    { id: 1, x: 50, y: 50, width: 100, height: 80, fill: '#378ADD' },
  ]);
  const [selectedId, setSelectedId] = useState(null);

  const [size, setSize] = useState({
    width: window.innerWidth - 40,
    height: window.innerHeight - 150,
  });

  const shapeRefs = useRef({});
  const transformerRef = useRef();

  // --- Undo/redo history ---
  const historyRef = useRef([shapes]); // array of past shape-array snapshots
  const historyIndexRef = useRef(0);   // where we currently are in that array

  function setShapes(newShapes, { recordHistory = true } = {}) {
    setShapesState(newShapes);
    if (recordHistory) {
      
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(newShapes);
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }
  }

  function undo() {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setShapesState(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setShapesState(historyRef.current[historyIndexRef.current]);
    setSelectedId(null);
  }

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth - 40,
        height: window.innerHeight - 150,
      });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedId && shapeRefs.current[selectedId]) {
      transformerRef.current.nodes([shapeRefs.current[selectedId]]);
      transformerRef.current.getLayer().batchDraw();
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedId]);

  // Load saved shapes on first render
useEffect(() => {
  const saved = localStorage.getItem('whiteboard-shapes');
  if (saved) {
    const parsedShapes = JSON.parse(saved);
    setShapesState(parsedShapes);
    historyRef.current = [parsedShapes];
    historyIndexRef.current = 0;
  }
}, []);

// Save shapes whenever they change
useEffect(() => {
  localStorage.setItem('whiteboard-shapes', JSON.stringify(shapes));
}, [shapes]);// Load saved shapes on first render
useEffect(() => {
  const saved = localStorage.getItem('whiteboard-shapes');
  if (saved) {
    const parsedShapes = JSON.parse(saved);
    setShapesState(parsedShapes);
    historyRef.current = [parsedShapes];
    historyIndexRef.current = 0;
  }
}, []);

const [hydrated, setHydrated] = useState(false);

// Load saved shapes on first render
useEffect(() => {
  const saved = localStorage.getItem('whiteboard-shapes');
  if (saved) {
    const parsedShapes = JSON.parse(saved);
    setShapesState(parsedShapes);
    historyRef.current = [parsedShapes];
    historyIndexRef.current = 0;
  }
  setHydrated(true);
}, []);

// Save shapes whenever they change — but only after loading has finished
useEffect(() => {
  if (!hydrated) return;
  localStorage.setItem('whiteboard-shapes', JSON.stringify(shapes));
}, [shapes, hydrated]);

  function addShape() {
    const newShape = {
      id: Date.now(),
      x: 100,
      y: 100,
      width: 100,
      height: 80,
      fill: '#D85A30',
    };
    setShapes([...shapes, newShape]);
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }

  function changeColor(color) {
    if (!selectedId) return;
    setShapes(
      shapes.map((shape) =>
        shape.id === selectedId ? { ...shape, fill: color } : shape
      )
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    setShapes(shapes.filter((shape) => shape.id !== selectedId));
    setSelectedId(null);
  }

  function handleTransformEnd(id) {
    const node = shapeRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    setShapes(
      shapes.map((shape) =>
        shape.id === id
          ? {
              ...shape,
              x: node.x(),
              y: node.y(),
              width: Math.max(20, node.width() * scaleX),
              height: Math.max(20, node.height() * scaleY),
            }
          : shape
      )
    );
  }

  return (
    <div>
      <h1>My Whiteboard Project</h1>
      <button onClick={addShape}>Add Rectangle</button>
      {' '}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => changeColor(color)}
          style={{ backgroundColor: color, width: 24, height: 24, marginLeft: 4 }}
        />
      ))}
      {' '}
      <button onClick={deleteSelected} disabled={!selectedId}>
        Delete Selected
      </button>
      {' '}
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>

      <Stage
        width={size.width}
        height={size.height}
        style={{ border: '1px solid #ccc' }}
        onMouseDown={handleStageClick}
      >
        <Layer>
          {shapes.map((shape) => (
            <Rect
              key={shape.id}
              ref={(node) => {
                if (node) shapeRefs.current[shape.id] = node;
              }}
              x={shape.x}
              y={shape.y}
              width={shape.width}
              height={shape.height}
              fill={shape.fill}
              draggable
              onClick={() => setSelectedId(shape.id)}
              onTap={() => setSelectedId(shape.id)}
              onDragEnd={(e) => {
                const node = e.target;
                setShapes(
                  shapes.map((s) =>
                    s.id === shape.id ? { ...s, x: node.x(), y: node.y() } : s
                  )
                );
              }}
              onTransformEnd={() => handleTransformEnd(shape.id)}
            />
          ))}
          <Transformer ref={transformerRef} />
        </Layer>
      </Stage>
    </div>
  );
}

export default App;