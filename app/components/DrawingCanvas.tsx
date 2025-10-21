import React, { useEffect, useState, useRef } from 'react'
import { Paintbrush, Pen, Eraser, Undo, Check } from 'lucide-react'
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

export function DrawingCanvas({
  assignedPersona,
  assignedQuirk,
  onDrawingComplete,
  disabled = false,
  roomCode,
  playerName
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<'brush' | 'pen' | 'eraser'>('brush')
  const [color, setColor] = useState('#000000')
  const [history, setHistory] = useState<ImageData[]>([])
  const [canvasInitialized, setCanvasInitialized] = useState(false)

  const colors = [
    '#000000',
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#3B82F6',
    '#A855F7',
    '#78716C',
    '#FFFFFF',
  ]

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const updateCanvasSize = () => {
      const container = canvas.parentElement
      if (container) {
        const width = container.clientWidth
        const height = container.clientHeight
        // Only update if we have valid dimensions
        if (width > 0 && height > 0) {
          canvas.width = width
          canvas.height = height
          // Fill with white background
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          setCanvasInitialized(true)
        }
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  // Initialize history after canvas is ready
  useEffect(() => {
    if (!canvasInitialized || history.length > 0) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // Double-check dimensions before capturing
    if (canvas.width > 0 && canvas.height > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setHistory([imageData])
    }
  }, [canvasInitialized, history.length])

  const saveToHistory = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (canvas.width === 0 || canvas.height === 0) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory((prev) => [...prev, imageData])
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return
    setIsDrawing(true)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x =
      'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y =
      'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x =
      'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y =
      'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)

    if (tool === 'eraser') {
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 20
    } else if (tool === 'pen') {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
    } else {
      ctx.strokeStyle = color
      ctx.lineWidth = 8
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false)
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
    
    try {
      // Convert canvas to Blob (JPEG with 80% quality for smaller file size)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      })
      
      if (!blob) {
        throw new Error('Failed to convert canvas to blob')
      }
      
      // Ensure user is authenticated
      await ensureAuth()
      
      // Upload Blob to Firebase Storage
      const storageRef = ref(storage, `drawings/${roomCode}/${playerName}.jpg`)
      await uploadBytes(storageRef, blob)
      
      // Get the public download URL
      const downloadURL = await getDownloadURL(storageRef)
      
      // Store the URL in Firestore under rooms/{roomCode}/drawings/{playerName}
      const drawingDocRef = doc(db, 'rooms', roomCode, 'drawings', playerName)
      await setDoc(drawingDocRef, { 
        url: downloadURL,
        uploadedAt: new Date(),
        playerName: playerName
      })
      
      console.log('✅ Drawing uploaded successfully:', downloadURL)
      onDrawingComplete(downloadURL)
      
    } catch (error) {
      console.error('❌ Error uploading drawing:', error)
      alert('Failed to save drawing. Please try again.')
    }
  }

  return (
    <div className="w-full min-h-screen bg-lime-300 flex flex-col items-center justify-center p-3 sm:p-6">
      {/* Prompt Display */}
      <div className="mb-6 bg-white rounded-2xl p-6 shadow-lg border-4 border-slate-900 max-w-2xl w-full">
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
                style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
              />
            </div>
          </div>
          {/* Color Palette - Vertical on larger screens */}
          <div className="hidden sm:flex flex-col gap-2 justify-center">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                disabled={disabled}
                className={`w-12 h-12 rounded-xl flex-shrink-0 transition-all shadow-lg ${
                  color === c ? 'scale-110 ring-4 ring-pink-500' : 'hover:scale-105'
                } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{
                  backgroundColor: c,
                }}
              />
            ))}
          </div>
        </div>
        {/* Color Palette - Horizontal on mobile */}
        <div className="flex sm:hidden gap-2 mt-3 overflow-x-auto pb-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              disabled={disabled}
              className={`w-12 h-12 rounded-xl flex-shrink-0 transition-all shadow-lg ${
                color === c ? 'scale-110 ring-4 ring-pink-500' : 'hover:scale-105'
              } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{
                backgroundColor: c,
              }}
            />
          ))}
        </div>
        {/* Tools */}
        <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
          <button
            onClick={() => setTool('brush')}
            disabled={disabled}
            className={`flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center transition-all shadow-lg ${
              tool === 'brush' 
                ? 'bg-pink-500 scale-105' 
                : 'bg-white hover:bg-gray-100'
            } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Paintbrush className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />
          </button>
          <button
            onClick={() => setTool('pen')}
            disabled={disabled}
            className={`flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center transition-all shadow-lg ${
              tool === 'pen' 
                ? 'bg-cyan-400 scale-105' 
                : 'bg-white hover:bg-gray-100'
            } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Pen className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            disabled={disabled}
            className={`flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center transition-all shadow-lg ${
              tool === 'eraser' 
                ? 'bg-yellow-300 scale-105' 
                : 'bg-white hover:bg-gray-100'
            } border-4 border-slate-900 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Eraser className="w-6 h-6 sm:w-7 sm:h-7 text-slate-900" />
          </button>
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
            className="flex-1 h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 transition-all shadow-[4px_4px_0px_#1e293b] active:shadow-none active:translate-x-1 active:translate-y-1 border-4 border-slate-900 font-bold text-white uppercase text-lg"
          >
            <Check className="w-6 h-6 sm:w-7 sm:h-7" />
            Done
          </button>
        </div>
      </div>
    </div>
  )
}