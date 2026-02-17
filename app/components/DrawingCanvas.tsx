import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Paintbrush, Pen, Eraser, Undo, Check, Loader2, PaintBucket, Minus, Square, Circle } from 'lucide-react'
import { storage, ensureAuth, db } from '../../lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, setDoc } from 'firebase/firestore'

interface DrawingCanvasProps {
  assignedPersona: string
  assignedQuirk: string
  onDrawingComplete: (imageUrl: string) => void
  disabled?: boolean
  roomCode: string
  playerName: string
}

type ToolType = 'brush' | 'pen' | 'eraser' | 'fill' | 'line' | 'rect' | 'circle'

const CANVAS_SIZE = 800

const colors = [
  '#000000', '#FFFFFF', '#78716C', '#6B7280',
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#1E3A5F', '#06B6D4', '#A855F7',
  '#EC4899', '#F472B6', '#D946EF', '#8B4513',
  '#DEB887', '#FDBCB4',
]

const BRUSH_SIZES = [2, 5, 10, 18, 30]

export function DrawingCanvas({
  assignedPersona,
  assignedQuirk,
  onDrawingComplete,
  disabled: externalDisabled = false,
  roomCode,
  playerName
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<ToolType>('brush')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(10)
  const [history, setHistory] = useState<ImageData[]>([])
  const [canvasInitialized, setCanvasInitialized] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // For shape tool preview
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const preShapeImageRef = useRef<ImageData | null>(null)

  const disabled = externalDisabled || isUploading

  // Initialize canvas with fixed resolution
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    setCanvasInitialized(true)
  }, [])

  // Initialize history after canvas is ready
  useEffect(() => {
    if (!canvasInitialized || history.length > 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    setHistory([imageData])
  }, [canvasInitialized, history.length])

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

  // --- Flood fill ---
  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    const data = imageData.data
    const width = CANVAS_SIZE
    const height = CANVAS_SIZE

    // Parse fill color
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

    // Don't fill if target color matches fill color
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

    // Scanline flood fill
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

      // Find left and right bounds
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

      // Fill the span and check above/below
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

  // --- Drawing helpers ---
  const applyToolStyle = (ctx: CanvasRenderingContext2D) => {
    if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = brushSize * 2.5
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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

  const handleSave = async () => {
    if (disabled) return
    const canvas = canvasRef.current
    if (!canvas) return

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
      alert('Failed to save drawing. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const primaryTools: { id: ToolType; icon: React.ReactNode; activeColor: string }[] = [
    { id: 'brush', icon: <Paintbrush className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-pink-500' },
    { id: 'pen', icon: <Pen className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-cyan-400' },
    { id: 'eraser', icon: <Eraser className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-yellow-300' },
    { id: 'fill', icon: <PaintBucket className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-orange-400' },
  ]

  const shapeTools: { id: ToolType; icon: React.ReactNode; activeColor: string }[] = [
    { id: 'line', icon: <Minus className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-purple-400' },
    { id: 'rect', icon: <Square className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-green-400' },
    { id: 'circle', icon: <Circle className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />, activeColor: 'bg-blue-400' },
  ]

  const renderToolButton = (t: { id: ToolType; icon: React.ReactNode; activeColor: string }) => (
    <button
      key={t.id}
      onClick={() => setTool(t.id)}
      disabled={disabled}
      className={`flex-1 h-12 sm:h-14 rounded-xl flex items-center justify-center transition-all shadow-lg ${
        tool === t.id ? `${t.activeColor} scale-105` : 'bg-white hover:bg-gray-100'
      } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {t.icon}
    </button>
  )

  const renderColorButton = (c: string) => (
    <button
      key={c}
      onClick={() => setColor(c)}
      disabled={disabled}
      className={`w-10 h-10 rounded-lg flex-shrink-0 transition-all ${
        color === c ? 'scale-110 ring-4 ring-pink-500' : 'hover:scale-105'
      } border-3 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={{ backgroundColor: c }}
    />
  )

  return (
    <div className="w-full min-h-screen bg-lime-300 flex flex-col items-center justify-center p-3 sm:p-6">
      {/* Prompt Display */}
      <div className="mb-4 bg-white rounded-2xl p-4 sm:p-6 shadow-lg border-4 border-slate-900 max-w-2xl w-full">
        <h2 className="font-inter text-sm font-bold text-slate-900 mb-2 text-center uppercase tracking-widest">Your Prompt:</h2>
        <p className="font-bebas text-3xl sm:text-4xl text-slate-900 text-center uppercase tracking-wide">
          {assignedPersona}, {assignedQuirk}
        </p>
      </div>

      {/* Main Drawing Area */}
      <div className="w-full max-w-2xl">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {/* Canvas - Square */}
          <div className="flex-1">
            <div className="w-full aspect-square bg-white rounded-2xl shadow-lg overflow-hidden border-4 border-slate-900">
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
                style={{ cursor: disabled ? 'not-allowed' : tool === 'fill' ? 'crosshair' : 'crosshair' }}
              />
            </div>
          </div>
          {/* Color Palette - Desktop: 2-column grid */}
          <div className="hidden sm:flex flex-col gap-1 justify-center">
            <div className="grid grid-cols-2 gap-1">
              {colors.map(renderColorButton)}
            </div>
            {/* Custom color picker */}
            <label className="relative w-full h-10 mt-1 cursor-pointer block">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={disabled}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
              <div className="w-full h-full rounded-lg border-3 border-slate-900 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold drop-shadow-md">Custom</span>
              </div>
            </label>
          </div>
        </div>

        {/* Color Palette - Mobile: scrollable row */}
        <div className="flex sm:hidden gap-2 mt-3 overflow-x-auto pb-2">
          {colors.map(renderColorButton)}
          {/* Custom color picker for mobile */}
          <label className="relative w-10 h-10 flex-shrink-0 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={disabled}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
            <div className="w-10 h-10 rounded-lg border-3 border-slate-900 bg-gradient-to-br from-red-500 via-green-500 to-blue-500" />
          </label>
        </div>

        {/* Brush Sizes */}
        <div className="flex gap-2 sm:gap-3 mt-3 items-center justify-center">
          <span className="font-inter text-xs font-bold text-slate-700 uppercase mr-1">Size:</span>
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              disabled={disabled}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all border-3 border-slate-900 ${
                brushSize === size ? 'bg-pink-500 scale-110' : 'bg-white hover:bg-gray-100'
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

        {/* Primary Tools */}
        <div className="flex gap-2 sm:gap-3 mt-3">
          {primaryTools.map(renderToolButton)}
        </div>

        {/* Shape Tools */}
        <div className="flex gap-2 sm:gap-3 mt-2">
          {shapeTools.map(renderToolButton)}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
          <button
            onClick={handleUndo}
            disabled={history.length <= 1 || disabled}
            className="flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2 bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg border-4 border-slate-900 font-bold text-slate-900 uppercase text-lg"
          >
            <Undo className="w-6 h-6 sm:w-7 sm:h-7" />
            Undo
          </button>
          <button
            onClick={handleSave}
            disabled={disabled}
            className="flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 transition-all shadow-[4px_4px_0px_#1e293b] active:shadow-none active:translate-x-1 active:translate-y-1 border-4 border-slate-900 font-bold text-white uppercase text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-6 h-6 sm:w-7 sm:h-7" />
                Done
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
