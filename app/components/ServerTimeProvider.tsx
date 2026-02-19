'use client'

import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import { db } from '@/lib/firebase'
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

/**
 * Firebase server time synchronization.
 *
 * Each client calibrates its clock against the Firestore server by writing
 * a serverTimestamp and reading it back. The offset (server - local) is used
 * to adjust all countdown timers so they display consistently across devices.
 */

interface ServerTimeContext {
    offset: number           // milliseconds: server - local (positive = server ahead)
    serverNow: () => number  // returns server-adjusted current time
    calibrated: boolean
}

const ServerTimeCtx = createContext<ServerTimeContext>({
    offset: 0,
    serverNow: () => Date.now(),
    calibrated: false,
})

export function useServerTime() {
    return useContext(ServerTimeCtx)
}

export function ServerTimeProvider({ children, roomCode }: { children: React.ReactNode; roomCode: string }) {
    const [offset, setOffset] = useState(0)
    const [calibrated, setCalibrated] = useState(false)
    const offsetRef = useRef(0)

    useEffect(() => {
        if (!roomCode) return

        let cancelled = false

        async function calibrate() {
            try {
                const calibRef = doc(db, 'rooms', roomCode, '_meta', 'clock')
                const localBefore = Date.now()
                await setDoc(calibRef, { t: serverTimestamp() })
                const snap = await getDoc(calibRef)
                const localAfter = Date.now()

                if (cancelled) return

                const serverTime = (snap.data()?.t as Timestamp)?.toDate?.()?.getTime()
                if (serverTime) {
                    // Estimate: server timestamp was captured at the midpoint of our round-trip
                    const localMid = (localBefore + localAfter) / 2
                    const clockOffset = serverTime - localMid
                    offsetRef.current = clockOffset
                    setOffset(clockOffset)
                }
                setCalibrated(true)
            } catch (err) {
                console.warn('Clock calibration failed, using local time:', err)
                setCalibrated(true) // don't block the game
            }
        }

        calibrate()
        return () => { cancelled = true }
    }, [roomCode])

    // Memoize serverNow so it doesn't cause useEffect re-runs in consumers
    const serverNow = useCallback(() => {
        return Date.now() + offsetRef.current
    }, []) // stable reference — reads from ref

    // Update ref when offset changes
    useEffect(() => {
        offsetRef.current = offset
    }, [offset])

    return (
        <ServerTimeCtx.Provider value={{ offset, serverNow, calibrated }}>
            {children}
        </ServerTimeCtx.Provider>
    )
}
