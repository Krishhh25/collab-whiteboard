import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const COLORS = ['#378ADD', '#D85A30', '#639922', '#D4537E', '#2C2C2A'];

// --- Get room name from URL, default to "default-room" if none given ---
function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || 'default-room';
}

const roomName = getRoomFromURL();

// --- Yjs setup (created once, outside the component, so it persists across re-renders) ---
const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', roomName, ydoc);
const yShapesMap = ydoc.getMap('shapes');
const undoManager = new Y.UndoManager(yShapesMap);

function App() {
  const [shapes, setShapesLocal] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);

  const [size, setSize] = useState({
    width: window.innerWidth - 40,
    height: window.innerHeight - 150,
  });

  const shapeRefs = useRef({});
  const transformerRef = useRef();

  useEffect(() => {
    function syncFromYjs() {
      const shapesArray = Array.from(yShapesMap.values());
      setShapesLocal(shapesArray);
    }
    yShapesMap.observe(syncFromYjs);
    syncFromYjs();
    return () => yShapesMap.unobserve(syncFromYjs);
  }, []);

  useEffect(() => {
    function handleStatus(event) {
      setConnected(event.status === 'connected');
    }
    provider.on('status', handleStatus);
    return () => provider.off('status', handleStatus);
  }, []);

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

  function addShape() {
    const id = String(Date.now());
    const newShape = {
      id,
      x: 100,
      y: 100,
      width: 100,
      height: 80,
      fill: '#D85A30',
    };
    yShapesMap.set(id, newShape);
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }

  function changeColor(color) {
    if (!selectedId) return;
    const shape = yShapesMap.get(selectedId);
    if (shape) {
      yShapesMap.set(selectedId, { ...shape, fill: color });
    }
  }

  function undo() {
    undoManager.undo();
  }

  function redo() {
    undoManager.redo();
  }

  function deleteSelected() {
    if (!selectedId) return;
    yShapesMap.delete(selectedId);
    setSelectedId(null);
  }

  function handleTransformEnd(id) {
    const node = shapeRefs.current[id];
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const shape = yShapesMap.get(id);
    if (shape) {
      yShapesMap.set(id, {
        ...shape,
        x: node.x(),
        y: node.y(),
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
      });
    }
  }

  function handleDragEnd(id, node) {
    const shape = yShapesMap.get(id);
    if (shape) {
      yShapesMap.set(id, { ...shape, x: node.x(), y: node.y() });
    }
  }

  return (
    <div>
      <h1>My Whiteboard Project — Room: {roomName}</h1>
      <p style={{ color: connected ? 'green' : 'red' }}>
        {connected ? 'Connected to server' : 'Disconnected'}
      </p>
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
              onDragEnd={(e) => handleDragEnd(shape.id, e.target)}
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