import { useState, useEffect, useRef, Fragment } from 'react';
import { Stage, Layer, Rect, Line, Transformer } from 'react-konva';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const COLORS = ['#378ADD', '#D85A30', '#639922', '#D4537E', '#2C2C2A'];

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || 'default-room';
}

const roomName = getRoomFromURL();

const WS_URL = import.meta.env.PROD
  ? 'wss://collab-whiteboard-1-pwqv.onrender.com'
  : 'ws://localhost:1234';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider(WS_URL, roomName, ydoc);
const yShapesMap = ydoc.getMap('shapes');
const undoManager = new Y.UndoManager(yShapesMap);

function App() {
  const [shapes, setShapesLocal] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState([]);
  const [fitScale, setFitScale] = useState(1);

  const [toolMode, setToolMode] = useState('select');
  const [penColor, setPenColor] = useState(COLORS[4]);

  // --- Pan & zoom state ---
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });

  const shapeRefs = useRef({});
  const transformerRef = useRef();

  const isDrawingRef = useRef(false);
  const currentLineIdRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      const availableWidth = window.innerWidth - 20;
      const newScale = Math.min(1, availableWidth / CANVAS_WIDTH);
      setFitScale(newScale);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    const userName = 'User-' + Math.floor(Math.random() * 1000);
    const userColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    provider.awareness.setLocalStateField('user', { name: userName, color: userColor });
    return () => {
      provider.awareness.setLocalStateField('user', null);
    };
  }, []);

  useEffect(() => {
    function updateCursors() {
      const states = Array.from(provider.awareness.getStates().entries());
      const others = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .filter(([, state]) => state.cursor)
        .map(([clientId, state]) => ({
          clientId,
          x: state.cursor.x,
          y: state.cursor.y,
          name: state.user?.name || 'User',
          color: state.user?.color || '#000',
        }));
      setRemoteCursors(others);
    }
    provider.awareness.on('change', updateCursors);
    return () => provider.awareness.off('change', updateCursors);
  }, []);

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
      type: 'rect',
      x: 100,
      y: 100,
      width: 100,
      height: 80,
      fill: '#D85A30',
    };
    yShapesMap.set(id, newShape);
  }

  // --- Zoom: mouse wheel, centered on cursor position ---
  function handleWheel(e) {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldZoom = zoom;
    const pointer = stage.getPointerPosition();

    // Position of the pointer relative to the canvas content, before zoom
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldZoom,
      y: (pointer.y - stagePos.y) / oldZoom,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const zoomFactor = 1.05;
    let newZoom = direction > 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
    newZoom = Math.max(0.3, Math.min(3, newZoom)); // clamp zoom between 30% and 300%

    const newPos = {
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom,
    };

    setZoom(newZoom);
    setStagePos(newPos);
  }

  // --- Pan: drag on empty canvas (select mode only) ---
  function handleStageMouseDown(e) {
    const clickedOnEmpty = e.target === e.target.getStage();

    if (toolMode === 'pen') {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      const pos = {
        x: (pointer.x - stagePos.x) / zoom,
        y: (pointer.y - stagePos.y) / zoom,
      };
      const id = String(Date.now());
      const newLine = {
        id,
        type: 'pen',
        points: [pos.x, pos.y],
        stroke: penColor,
        strokeWidth: 4,
      };
      yShapesMap.set(id, newLine);
      isDrawingRef.current = true;
      currentLineIdRef.current = id;
      return;
    }

    if (clickedOnEmpty) {
      setSelectedId(null);
      isPanningRef.current = true;
      const stage = e.target.getStage();
      lastPanPointRef.current = stage.getPointerPosition();
    }
  }

  function handleStageMouseMove(e) {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Broadcast cursor position (convert to canvas-space coordinates)
    const canvasPos = {
      x: (pointer.x - stagePos.x) / zoom,
      y: (pointer.y - stagePos.y) / zoom,
    };
    provider.awareness.setLocalStateField('cursor', canvasPos);

    if (toolMode === 'pen' && isDrawingRef.current && currentLineIdRef.current) {
      const line = yShapesMap.get(currentLineIdRef.current);
      if (line) {
        yShapesMap.set(currentLineIdRef.current, {
          ...line,
          points: [...line.points, canvasPos.x, canvasPos.y],
        });
      }
      return;
    }

    if (isPanningRef.current) {
      const dx = pointer.x - lastPanPointRef.current.x;
      const dy = pointer.y - lastPanPointRef.current.y;
      setStagePos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPointRef.current = pointer;
    }
  }

  function handleStageMouseUp() {
    if (toolMode === 'pen') {
      isDrawingRef.current = false;
      currentLineIdRef.current = null;
    }
    isPanningRef.current = false;
  }

  function resetView() {
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
  }

  function changeColor(color) {
    if (toolMode === 'pen') {
      setPenColor(color);
      return;
    }
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

  const totalScale = fitScale * zoom;

  return (
    <div>
      <h1>My Whiteboard Project — Room: {roomName}</h1>
      <p style={{ color: connected ? 'green' : 'red' }}>
        {connected ? 'Connected to server' : 'Disconnected'}
      </p>

      <button onClick={addShape}>Add Rectangle</button>
      {' '}
      <button
        onClick={() => setToolMode('select')}
        style={{ fontWeight: toolMode === 'select' ? 'bold' : 'normal' }}
      >
        Select
      </button>
      <button
        onClick={() => setToolMode('pen')}
        style={{ fontWeight: toolMode === 'pen' ? 'bold' : 'normal' }}
      >
        Pen
      </button>
      {' '}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => changeColor(color)}
          style={{
            backgroundColor: color,
            width: 24,
            height: 24,
            marginLeft: 4,
            border: (toolMode === 'pen' ? penColor : null) === color ? '2px solid black' : 'none',
          }}
        />
      ))}
      {' '}
      <button onClick={deleteSelected} disabled={!selectedId}>
        Delete Selected
      </button>
      {' '}
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
      {' '}
      <button onClick={resetView}>Reset View</button>
      <span style={{ marginLeft: 8, fontSize: 13 }}>{Math.round(zoom * 100)}%</span>

      <Stage
        width={CANVAS_WIDTH * fitScale}
        height={CANVAS_HEIGHT * fitScale}
        scaleX={totalScale}
        scaleY={totalScale}
        x={stagePos.x}
        y={stagePos.y}
        style={{ border: '1px solid #ccc', touchAction: 'none' }}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageMouseDown}
        onTouchMove={handleStageMouseMove}
        onTouchEnd={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer>
          {shapes.map((shape) => {
            if (shape.type === 'pen') {
              return (
                <Line
                  key={shape.id}
                  points={shape.points}
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  tension={0.4}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              );
            }

            return (
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
                draggable={toolMode === 'select'}
                onClick={() => toolMode === 'select' && setSelectedId(shape.id)}
                onTap={() => toolMode === 'select' && setSelectedId(shape.id)}
                onDragEnd={(e) => handleDragEnd(shape.id, e.target)}
                onTransformEnd={() => handleTransformEnd(shape.id)}
              />
            );
          })}

          {remoteCursors.map((cursor) => (
            <Fragment key={cursor.clientId}>
              <Rect
                x={cursor.x - 5}
                y={cursor.y - 5}
                width={10}
                height={10}
                fill={cursor.color}
                cornerRadius={5}
                listening={false}
              />
            </Fragment>
          ))}

          <Transformer ref={transformerRef} />
        </Layer>
      </Stage>
    </div>
  );
}

export default App;