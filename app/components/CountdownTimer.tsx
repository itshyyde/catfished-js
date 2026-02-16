'use client'

import { useState, useEffect } from 'react'

interface CountdownTimerProps {
  endTime: Date
  onExpired?: () => void
}

export function CountdownTimer({ endTime, onExpired }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 1000))
    return diff
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.ceil((endTime.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)

      if (diff <= 0) {
        clearInterval(interval)
        onExpired?.()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime, onExpired])

  const isUrgent = secondsLeft <= 10

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-4 border-slate-900 font-bebas text-2xl uppercase ${
      isUrgent ? 'bg-red-400 text-white animate-pulse' : 'bg-white text-slate-900'
    }`}>
      <span>{secondsLeft}s</span>
    </div>
  )
}
