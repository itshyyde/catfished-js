import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Highlighter, Pen, Eraser, Undo, Check, Loader2, PaintBucket, Minus, Square, Circle, Trash2 } from 'lucide-react'
import { storage, ensureAuth, db } from '../../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc } from 'firebase/firestore'
import { CountdownTimer } from './CountdownTimer'

interface DrawingCanvasProps {
  assignedPersona: string
  assignedQuirk: string
  onDrawingComplete: (imageUrl: string) => void
  disabled?: boolean
  roomCode: string
  playerName: string
  endTime?: Date | null
  totalDuration?: number
  onTimerExpired?: () => void
}

type ToolType = 'highlighter' | 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle'

const CANVAS_SIZE = 800

const colors = [
  '#000000', '#FFFFFF', '#78716C', '#6B7280',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#1E3A5F', '#06B6D4', '#A855F7',
  '#EC4899', '#F472B6', '#D946EF', '#8B4513',
  '#DEB887', '#FDBCB4',
]

const BRUSH_SIZES = [3, 10, 24]

const allTools: { id: ToolType; icon: React.ReactNode; activeColor: string }[] = [
  { id: 'pen', icon: <Pen className="w-5 h-5 text-slate-900" />, activeColor: 'bg-cyan-400' },
  { id: 'highlighter', icon: <Highlighter className="w-5 h-5 text-slate-900" />, activeColor: 'bg-pink-500' },
  { id: 'eraser', icon: <Eraser className="w-5 h-5 text-slate-900" />, activeColor: 'bg-yellow-300' },
  { id: 'fill', icon: <PaintBucket className="w-5 h-5 text-slate-900" />, activeColor: 'bg-orange-400' },
  { id: 'line', icon: <Minus className="w-5 h-5 text-slate-900" />, activeColor: 'bg-purple-400' },
  { id: 'rect', icon: <Square className="w-5 h-5 text-slate-900" />, activeColor: 'bg-green-400' },
  { id: 'circle', icon: <Circle className="w-5 h-5 text-slate-900" />, activeColor: 'bg-blue-400' },
]

export function DrawingCanvas({
  assignedPersona,
  assignedQuirk,
  onDrawingComplete,
  disabled: externalDisabled = false,
  roomCode,
  playerName,
  endTime,
  totalDuration,
  onTimerExpired
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<ToolType>('pen')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(10)
  const [history, setHistory] = useState<ImageData[]>([])
  const [canvasInitialized, setCanvasInitialized] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const preShapeImageRef = useRef<ImageData | null>(null)

  const disabled = externalDisabled || isUploading

  // Detect desktop vs mobile so we only render ONE canvas (ref can only attach to one DOM node)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)')
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    // Restore previous drawing if we have history (e.g. desktop/mobile toggle)
    if (history.length > 0) {
      ctx.putImageData(history[history.length - 1], 0, 0)
    } else {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }
    setCanvasInitialized(true)
  }, [isDesktop])

  useEffect(() => {
    if (!canvasInitialized || history.length > 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    setHistory([imageData])
  }, [canvasInitialized, history.length])

  // Keyboard shortcut: Ctrl/Cmd+Z for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    setHistory((prev) => [...prev, imageData])
  }, [])

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    const data = imageData.data
    const width = CANVAS_SIZE
    const height = CANVAS_SIZE

    const temp = document.createElement('canvas')
    temp.width = 1; temp.height = 1
    const tmpCtx = temp.getContext('2d')!
    tmpCtx.fillStyle = fillColor
    tmpCtx.fillRect(0, 0, 1, 1)
    const fc = tmpCtx.getImageData(0, 0, 1, 1).data
    const fillR = fc[0], fillG = fc[1], fillB = fc[2], fillA = fc[3]

    const sx = Math.floor(startX)
    const sy = Math.floor(startY)
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return

    const startIdx = (sy * width + sx) * 4
    const targetR = data[startIdx]
    const targetG = data[startIdx + 1]
    const targetB = data[startIdx + 2]
    const targetA = data[startIdx + 3]

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return

    const tolerance = 30
    const matchesTarget = (idx: number) => {
      return Math.abs(data[idx] - targetR) <= tolerance &&
        Math.abs(data[idx + 1] - targetG) <= tolerance &&
        Math.abs(data[idx + 2] - targetB) <= tolerance &&
        Math.abs(data[idx + 3] - targetA) <= tolerance
    }
    const setPixel = (idx: number) => {
      data[idx] = fillR
      data[idx + 1] = fillG
      data[idx + 2] = fillB
      data[idx + 3] = fillA
    }

    const stack: [number, number][] = [[sx, sy]]
    const visited = new Uint8Array(width * height)

    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      const vi = y * width + x
      if (visited[vi]) continue
      visited[vi] = 1
      const idx = vi * 4
      if (!matchesTarget(idx)) continue

      let lx = x
      while (lx > 0) {
        const li = (y * width + (lx - 1)) * 4
        if (!matchesTarget(li) || visited[y * width + (lx - 1)]) break
        lx--
      }
      let rx = x
      while (rx < width - 1) {
        const ri = (y * width + (rx + 1)) * 4
        if (!matchesTarget(ri) || visited[y * width + (rx + 1)]) break
        rx++
      }

      for (let cx = lx; cx <= rx; cx++) {
        const ci = (y * width + cx) * 4
        setPixel(ci)
        visited[y * width + cx] = 1
        if (y > 0 && !visited[(y - 1) * width + cx] && matchesTarget(((y - 1) * width + cx) * 4)) {
          stack.push([cx, y - 1])
        }
        if (y < height - 1 && !visited[(y + 1) * width + cx] && matchesTarget(((y + 1) * width + cx) * 4)) {
          stack.push([cx, y + 1])
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [])

  const applyToolStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = 1.0
    if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = brushSize * 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else if (tool === 'highlighter') {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize * 2.5
      ctx.globalAlpha = 0.65
      ctx.lineCap = 'butt'
      ctx.lineJoin = 'bevel'
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
  }

  const drawShapePreview = (ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }) => {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'line') {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
    } else if (tool === 'rect') {
      ctx.beginPath()
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else if (tool === 'circle') {
      const rx = Math.abs(end.x - start.x) / 2
      const ry = Math.abs(end.y - start.y) / 2
      const cx = start.x + (end.x - start.x) / 2
      const cy = start.y + (end.y - start.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  const isShapeTool = tool === 'line' || tool === 'rect' || tool === 'circle'

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    const { x, y } = getCanvasCoords(e)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (tool === 'fill') {
      floodFill(x, y, color)
      saveToHistory()
      return
    }
    setIsDrawing(true)
    if (isShapeTool) {
      shapeStartRef.current = { x, y }
      preShapeImageRef.current = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    } else {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = getCanvasCoords(e)
    if (isShapeTool) {
      if (!shapeStartRef.current || !preShapeImageRef.current) return
      ctx.putImageData(preShapeImageRef.current, 0, 0)
      drawShapePreview(ctx, shapeStartRef.current, { x, y })
    } else {
      ctx.lineTo(x, y)
      applyToolStyle(ctx)
      ctx.stroke()
    }
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
      shapeStartRef.current = null
      preShapeImageRef.current = null
      saveToHistory()
    }
  }

  const handleUndo = () => {
    if (history.length <= 1 || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const newHistory = history.slice(0, -1)
    const previousState = newHistory[newHistory.length - 1]
    ctx.putImageData(previousState, 0, 0)
    setHistory(newHistory)
  }

  const handleClear = () => {
    if (disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    saveToHistory()
  }

  // Ref to track if we're already saving to prevent double-submit
  const isSavingRef = useRef(false)

  const handleSave = useCallback(async () => {
    if (disabled || isSavingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    isSavingRef.current = true
    setIsUploading(true)

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Failed to create blob"))
        }, 'image/jpeg', 0.8)
      })

      await ensureAuth()
      const storageRef = ref(storage, `drawings/${roomCode}/${playerName}.jpg`)
      await uploadBytes(storageRef, blob)
      const downloadURL = await getDownloadURL(storageRef)

      const drawingDocRef = doc(db, 'rooms', roomCode, 'drawings', playerName)
      await setDoc(drawingDocRef, {
        url: downloadURL,
        uploadedAt: new Date(),
        playerName: playerName
      })

      onDrawingComplete(downloadURL)
    } catch (error) {
      console.error('Error uploading drawing:', error)
      // If auto-save fails, we might still want to proceed? 
      // For now, alert ONLY if it was manual. 
      // But we can't easily distinguish here without passing a flag.
      // Let's just log it.
    } finally {
      setIsUploading(false)
      isSavingRef.current = false
    }
  }, [disabled, roomCode, playerName, onDrawingComplete])

  // Handle timer expiration: Auto-save the drawing!
  const handleTimerExpired = useCallback(async () => {
    if (isSavingRef.current) return
    console.log("⏰ Timer expired! Auto-saving drawing...")
    await handleSave()
    if (onTimerExpired) onTimerExpired()
  }, [handleSave, onTimerExpired])

  const renderToolButton = (t: { id: ToolType; icon: React.ReactNode; activeColor: string }) => (
    <button
      key={t.id}
      onClick={() => setTool(t.id)}
      disabled={disabled}
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${tool === t.id ? `${t.activeColor} scale-105 shadow-[2px_2px_0px_#1e293b]` : 'bg-white hover:bg-gray-100'
        } border-2 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {t.icon}
    </button>
  )

  const renderColorButton = (c: string) => (
    <button
      key={c}
      onClick={() => setColor(c)}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg flex-shrink-0 transition-all ${color === c ? 'scale-110 ring-3 ring-pink-500 ring-offset-1' : 'hover:scale-105'
        } border-2 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{ backgroundColor: c }}
    />
  )

  const renderCanvas = () => (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      className="w-full h-full touch-none"
      style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
    />
  )

  // === DESKTOP LAYOUT ===
  if (isDesktop) {
    return (
      <div className="h-screen bg-lime-300 bg-game grid grid-rows-[auto_1fr_auto] grid-cols-[auto_1fr] overflow-hidden">
        {/* Top bar */}
        <div className="col-span-2 bg-white border-b-3 border-slate-900 shadow-[0_3px_0px_#1e293b] px-4 py-2 flex items-center gap-4">
          {/* Left: Timer */}
          <div className="flex-shrink-0">
            {endTime && <CountdownTimer endTime={endTime} totalDuration={totalDuration} onExpired={handleTimerExpired} />}
          </div>

          {/* Center: Prompt */}
          <div className="flex-1 text-center min-w-0">
            <p className="font-bebas text-2xl text-slate-900 uppercase tracking-wide truncate">
              {assignedPersona}, {assignedQuirk}
            </p>
          </div>

          {/* Right: Done button */}
          <button
            onClick={handleSave}
            disabled={disabled || isUploading}
            className="flex-shrink-0 h-10 px-5 rounded-xl flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 transition-all shadow-[3px_3px_0px_#1e293b] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 border-3 border-slate-900 font-bold text-white uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Check className="w-4 h-4" /> Done</>
            )}
          </button>
        </div>

        {/* Left sidebar */}
        <div className="bg-white/90 border-r-3 border-slate-900 px-2 py-3 flex flex-col items-center gap-2 overflow-y-auto">
          {/* Undo + Clear */}
          <button
            onClick={handleUndo}
            disabled={history.length <= 1 || disabled}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-2 border-slate-900"
          >
            <Undo className="w-5 h-5 text-slate-900" />
          </button>
          <button
            onClick={handleClear}
            disabled={disabled}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-300 hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-2 border-slate-900"
          >
            <Trash2 className="w-5 h-5 text-slate-900" />
          </button>

          <div className="w-8 h-px bg-slate-300 my-1" />

          {/* All 7 tools */}
          {allTools.map(t => renderToolButton(t))}

          <div className="w-8 h-px bg-slate-300 my-1" />

          {/* 3 brush sizes */}
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              disabled={disabled}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 border-slate-900 ${brushSize === size ? 'bg-pink-500 scale-105 shadow-[2px_2px_0px_#1e293b]' : 'bg-white hover:bg-gray-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div
                className="rounded-full bg-slate-900"
                style={{
                  width: `${Math.max(4, size * 0.8)}px`,
                  height: `${Math.max(4, size * 0.8)}px`,
                }}
              />
            </button>
          ))}
        </div>

        {/* Canvas area */}
        <div className="flex items-center justify-center p-4 overflow-hidden">
          <div className="aspect-square h-full max-h-full max-w-full bg-white rounded-2xl shadow-[4px_4px_0px_#1e293b] overflow-hidden border-3 border-slate-900">
            {renderCanvas()}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="col-span-2 bg-white/90 border-t-3 border-slate-900 px-4 py-2 flex items-center justify-center gap-1.5 overflow-x-auto">
          {colors.map(c => renderColorButton(c))}
          <label className="relative w-8 h-8 flex-shrink-0 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={disabled}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
            <div className="w-8 h-8 rounded-lg border-2 border-slate-900 bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
          </label>
        </div>
      </div>
    )
  }



  // === MOBILE LAYOUT ===
  return (
    <div className="h-screen bg-lime-300 bg-game flex flex-col overflow-hidden">
      {/* Top: Prompt + Timer + Done */}
      <div className="bg-white border-b-3 border-slate-900 shadow-[0_3px_0px_#1e293b] px-3 py-2 flex items-center gap-2">
        {endTime && <CountdownTimer endTime={endTime} totalDuration={totalDuration} onExpired={handleTimerExpired} />}
        <p className="flex-1 font-bebas text-lg text-slate-900 uppercase tracking-wide truncate text-center">
          {assignedPersona}, {assignedQuirk}
        </p>
        <button
          onClick={handleSave}
          disabled={disabled || isUploading}
          className="flex-shrink-0 h-9 px-4 rounded-xl flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 transition-all shadow-[2px_2px_0px_#1e293b] active:shadow-none active:translate-x-0.5 active:translate-y-0.5 border-2 border-slate-900 font-bold text-white uppercase text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Check className="w-4 h-4" /> Done</>
          )}
        </button>
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div className="aspect-square h-full max-h-full max-w-full bg-white rounded-2xl shadow-[4px_4px_0px_#1e293b] overflow-hidden border-3 border-slate-900">
          {renderCanvas()}
        </div>
      </div>

      {/* Tools row: Undo + Clear + divider + 7 tools + divider + 3 sizes */}
      <div className="flex items-center justify-center gap-1.5 px-2 py-1.5">
        <button
          onClick={handleUndo}
          disabled={history.length <= 1 || disabled}
          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-2 border-slate-900"
        >
          <Undo className="w-4 h-4 text-slate-900" />
        </button>
        <button
          onClick={handleClear}
          disabled={disabled}
          className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center bg-red-300 hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all border-2 border-slate-900"
        >
          <Trash2 className="w-4 h-4 text-slate-900" />
        </button>
        <div className="w-px h-7 bg-slate-400 mx-0.5" />
        {allTools.map(t => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            disabled={disabled}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${tool === t.id ? `${t.activeColor} scale-105 shadow-[2px_2px_0px_#1e293b]` : 'bg-white hover:bg-gray-100'
              } border-2 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.icon}
          </button>
        ))}
        <div className="w-px h-7 bg-slate-400 mx-0.5" />
        {BRUSH_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => setBrushSize(size)}
            disabled={disabled}
            className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center transition-all border-2 border-slate-900 ${brushSize === size ? 'bg-pink-500 scale-105' : 'bg-white hover:bg-gray-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div
              className="rounded-full bg-slate-900"
              style={{
                width: `${Math.max(3, size * 0.6)}px`,
                height: `${Math.max(3, size * 0.6)}px`,
              }}
            />
          </button>
        ))}
      </div>

      {/* Bottom: Scrollable color row */}
      <div className="flex gap-1.5 px-2 py-1.5 overflow-x-auto border-t border-slate-300">
        {colors.map(c => renderColorButton(c))}
        <label className="relative w-8 h-8 flex-shrink-0 cursor-pointer">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          <div className="w-8 h-8 rounded-lg border-2 border-slate-900 bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
        </label>
      </div>
    </div>
  )
}
