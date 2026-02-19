'use client'

import { useState, useEffect, useRef } from 'react'
import { useServerTime } from './ServerTimeProvider'

interface CountdownTimerProps {
  endTime: Date
  totalDuration?: number
  onExpired?: () => void
}

export function CountdownTimer({ endTime, totalDuration = 30, onExpired }: CountdownTimerProps) {
  const { serverNow } = useServerTime()
  const [timeLeft, setTimeLeft] = useState(0)
  const [mounted, setMounted] = useState(false)
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    setMounted(true)
    const update = () => {
      const now = serverNow()
      const diff = Math.max(0, Math.ceil((endTime.getTime() - now) / 1000))
      setTimeLeft(diff)

      if (diff <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpired?.()
      }
    }

    update() // Initial call
    const interval = setInterval(update, 100)
    return () => clearInterval(interval)
  }, [endTime, onExpired, serverNow])

  if (!mounted) return null // Prevent hydration mismatch

  // Visuals
  // "Glowing Aura" Top Progress Bar
  const durationSafe = Math.max(1, totalDuration)
  const progress = Math.min(100, Math.max(0, (timeLeft / durationSafe) * 100))

  const isUrgent = timeLeft <= 10
  const isCritical = timeLeft <= 5
  // Colors: Gradient from Green -> Yellow -> Red
  // We can just use a fixed gradient background and shrink the width

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-3 z-50 overflow-hidden pointer-events-none" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        {/* Background track */}
        <div className="absolute inset-0 bg-slate-900/20" />

        {/* Progress Bar with Glow */}
        <div
          className="h-full transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(255,255,255,0.8)]"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, 
              ${progress > 60 ? '#4ade80' : progress > 30 ? '#facc15' : '#ef4444'} 0%, 
              ${progress > 60 ? '#22c55e' : progress > 30 ? '#eab308' : '#dc2626'} 100%)`,
            boxShadow: `0 0 20px ${progress > 60 ? '#4ade80' : progress > 30 ? '#facc15' : '#ef4444'}`
          }}
        />

        {/* Number badge (optional, but good to keep for clarity) */}
        <div className={`absolute top-4 right-4 bg-white/90 backdrop-blur border-2 border-slate-900 px-3 py-1 rounded-full font-bebas text-xl text-slate-900 shadow-md ${isUrgent ? 'animate-pulse text-red-600 border-red-600' : ''}`}>
          {timeLeft}s
        </div>
      </div>

      {/* Low Time Warning Overlay - Red Vignette */}
      <div
        className={`fixed inset-0 pointer-events-none transition-opacity duration-500 z-40 
          ${isUrgent ? 'opacity-100' : 'opacity-0'}`}
        style={{
          background: 'radial-gradient(circle, transparent 60%, rgba(220, 38, 38, 0.4) 100%)',
          boxShadow: 'inset 0 0 50px rgba(220, 38, 38, 0.5)'
        }}
      >
        {isCritical && (
          <div className="absolute inset-0 bg-red-500/10 animate-pulse" />
        )}
      </div>
    </>
  )
}
