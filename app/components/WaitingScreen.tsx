'use client'

import { useEffect, useState } from 'react'
import { sfx } from '../../lib/sfx'

const LOADING_MESSAGES = [
    "Curating vibes...",
    "Syncing timelines...",
    "Preparing the stage...",
    "Aligning chakras...",
    "Warming up the crowd...",
    "Polishing pixels...",
    "Calibrating cuteness...",
    "Summoning aesthetics...",
    "Loading personality...",
    "Generating hype..."
]

export function WaitingScreen({
    status = "waiting",
    playerCount = 0,
    readyCount = 0
}: {
    status?: "waiting" | "collecting" | "loading"
    playerCount?: number
    readyCount?: number
}) {
    const [messageIndex, setMessageIndex] = useState(0)

    // Rotate messages every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
        }, 3000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen bg-lime-300 bg-game flex flex-col items-center justify-center p-4 overflow-hidden relative">
            {/* Background Pulse Animation */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                <div className="w-[40vw] h-[40vw] border-4 border-slate-900/20 rounded-full animate-ping [animation-duration:3s]" />
                <div className="w-[30vw] h-[30vw] border-4 border-slate-900/20 rounded-full animate-ping [animation-duration:3s] [animation-delay:1s]" />
                <div className="w-[20vw] h-[20vw] border-4 border-slate-900/20 rounded-full animate-ping [animation-duration:3s] [animation-delay:2s]" />
            </div>

            {/* Center Radar Scanner */}
            <div className="relative z-10 flex flex-col items-center">
                <div className="relative w-40 h-40 mb-8">
                    {/* Static outer ring */}
                    <div className="absolute inset-0 border-8 border-slate-900 rounded-full bg-white shadow-[8px_8px_0px_#1e293b]" />

                    {/* Rotating scanner */}
                    <div className="absolute inset-2 rounded-full animate-spin [animation-duration:1.5s] border-t-8 border-r-8 border-transparent border-t-pink-500 border-r-pink-300" />

                    {/* Inner pulsating core */}
                    <div className="absolute inset-6 bg-slate-900 rounded-full animate-pulse flex items-center justify-center">
                        <div className="text-4xl">👀</div>
                    </div>
                </div>

                {/* Text Content */}
                <div className="text-center space-y-4 max-w-md">
                    <h2 className="font-bebas text-5xl sm:text-6xl text-slate-900 tracking-wide uppercase drop-shadow-md">
                        {LOADING_MESSAGES[messageIndex]}
                    </h2>

                    {playerCount > 0 && (
                        <div className="font-inter text-slate-900 font-bold text-lg tracking-widest uppercase bg-white px-4 py-2 rounded-full border-3 border-slate-900 shadow-[4px_4px_0px_#1e293b] inline-block">
                            {status === 'collecting' ? (
                                <span>Collected {readyCount}/{playerCount} Profiles</span>
                            ) : status === 'loading' ? (
                                <span>Loaded {readyCount}/{playerCount} Images</span>
                            ) : (
                                <span>Waiting for others...</span>
                            )}
                        </div>
                    )}

                    {/* Progress Bar (only if counts exist) */}
                    {playerCount > 0 && (
                        <div className="w-64 h-6 bg-white rounded-full overflow-hidden mx-auto mt-6 border-3 border-slate-900 shadow-[4px_4px_0px_#1e293b]">
                            <div
                                className="h-full bg-pink-500 transition-all duration-500 ease-out border-r-3 border-slate-900"
                                style={{ width: `${(readyCount / playerCount) * 100}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
