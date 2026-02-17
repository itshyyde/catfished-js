'use client'

import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { sfx } from '../../lib/sfx'

export function MuteToggle() {
  const [muted, setMuted] = useState(sfx.muted)

  return (
    <button
      onClick={() => {
        const newMuted = sfx.toggle()
        setMuted(newMuted)
      }}
      className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center opacity-60 hover:opacity-100 transition-all hover:border-slate-900"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
    >
      {muted ? (
        <VolumeX className="w-5 h-5 text-slate-500" />
      ) : (
        <Volume2 className="w-5 h-5 text-slate-700" />
      )}
    </button>
  )
}
