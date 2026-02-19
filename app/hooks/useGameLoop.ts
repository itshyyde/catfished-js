'use client'

import { useEffect, useRef } from 'react'
import { db } from '@/lib/firebase'
import { doc, collection, onSnapshot, updateDoc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { useServerTime } from '../components/ServerTimeProvider'

interface Player {
    name: string
    score: number
}

interface GameData {
    gameState: string
    players: Player[]
    host: string
    currentRound?: number
}

interface UseGameLoopReturn {
    forceNextPhase: () => void
}

/**
 * Host-Driven Game Loop Hook
 * 
 * This hook implements a strict "Dictator" model where ONLY the Host can write
 * to gameState.currentPhase in Firestore. All other clients are read-only listeners.
 * 
 * This eliminates race conditions and deadlocks caused by multiple clients trying
 * to advance the game state simultaneously.
 */
export function useGameLoop(
    roomCode: string,
    playerName: string,
    isHost: boolean,
    gameData: GameData | null
): UseGameLoopReturn {
    const { serverNow } = useServerTime()
    const forcedRef = useRef(false)

    // ============================================================================
    // HOST ONLY - DICTATOR LOGIC
    // Only the Host is allowed to write to gameState
    // ============================================================================

    // Host: Watch submissions and advance from 'pre-profile' → 'profile'
    useEffect(() => {
        if (!isHost || !roomCode || !gameData) return
        if (gameData.gameState !== 'pre-profile') return

        const submissionsRef = collection(db, 'rooms', roomCode, 'submissions')
        const unsubscribe = onSnapshot(submissionsRef, async (snapshot) => {
            const submissions = snapshot.docs.map(d => ({
                playerName: d.id,
                persona: d.data().persona,
                quirk: d.data().quirk,
            }))

            // Check if all submitted or if roundEndTime has passed
            const roomRef = doc(db, 'rooms', roomCode)
            const roomSnap = await getDoc(roomRef)
            if (roomSnap.data()?.assignmentsCreated) return

            const roundEnd = roomSnap.data()?.roundEndTime
            const roundExpired = roundEnd && (roundEnd.toDate ? roundEnd.toDate() : new Date(roundEnd)).getTime() < Date.now()
            const allSubmitted = submissions.length >= gameData.players.length && gameData.players.length >= 2

            if (allSubmitted || (roundExpired && submissions.length > 0 && gameData.players.length >= 2)) {
                console.log('🎯 HOST: All submissions received, advancing to profile phase')

                // Fill in defaults for missing players
                for (const player of gameData.players) {
                    if (!submissions.find(s => s.playerName === player.name)) {
                        const submissionRef = doc(db, 'rooms', roomCode, 'submissions', player.name)
                        await setDoc(submissionRef, {
                            persona: 'Mystery Person',
                            quirk: 'being mysterious',
                            submittedAt: new Date(),
                        })
                        submissions.push({ playerName: player.name, persona: 'Mystery Person', quirk: 'being mysterious' })
                    }
                }

                // Shuffle: rotate by 1 so no one gets their own
                for (let i = 0; i < submissions.length; i++) {
                    const recipient = submissions[i].playerName
                    const donor = submissions[(i + 1) % submissions.length]
                    const assignmentRef = doc(db, 'rooms', roomCode, 'assignments', recipient)
                    await setDoc(assignmentRef, {
                        assignedPersona: donor.persona,
                        assignedQuirk: donor.quirk,
                    })
                }

                const profileEnd = new Date(serverNow())
                profileEnd.setSeconds(profileEnd.getSeconds() + 120)

                // HOST DICTATOR: Only the Host updates gameState
                await updateDoc(roomRef, {
                    gameState: 'profile',
                    assignmentsCreated: true,
                    profileEndTime: profileEnd,
                })
            }
        })

        return () => unsubscribe()
    }, [isHost, roomCode, gameData, serverNow])

    // Host: Watch profiles and advance from 'profile' → 'showcase'
    useEffect(() => {
        if (!isHost || !roomCode || !gameData) return
        if (gameData.gameState !== 'profile') return

        const profilesRef = collection(db, 'rooms', roomCode, 'profiles')
        const unsubscribe = onSnapshot(profilesRef, async (snapshot) => {
            try {
                const roomRef = doc(db, 'rooms', roomCode)
                const roomSnap = await getDoc(roomRef)
                if (!roomSnap.exists()) return
                const roomData = roomSnap.data()
                if (roomData?.gameState === 'showcase') return

                const playerCount = roomData?.players?.length || 0
                const profEnd = roomData?.profileEndTime
                const profileExpired = profEnd && (profEnd.toDate ? profEnd.toDate() : new Date(profEnd)).getTime() < Date.now()
                const allSubmitted = snapshot.docs.length >= playerCount && playerCount >= 2

                if (allSubmitted || (profileExpired && playerCount >= 2)) {
                    console.log('🎯 HOST: All profiles received, advancing to showcase phase')

                    // Fill in default profiles for missing players
                    const submittedNames = new Set(snapshot.docs.map(d => d.id))
                    const players = roomData?.players || []
                    for (const player of players) {
                        if (!submittedNames.has(player.name)) {
                            // double check if it really doesn't exist (in case local snapshot is stale)
                            const profileRef = doc(db, 'rooms', roomCode, 'profiles', player.name)
                            const profileSnap = await getDoc(profileRef)

                            if (!profileSnap.exists()) {
                                const assignmentRef = doc(db, 'rooms', roomCode, 'assignments', player.name)
                                const assignSnap = await getDoc(assignmentRef)
                                const assignData = assignSnap.exists() ? assignSnap.data() : {}

                                await setDoc(profileRef, {
                                    name: assignData?.assignedPersona || 'Mystery Person',
                                    bio: 'Being mysterious...',
                                    imageUrl: '',
                                    persona: assignData?.assignedPersona || '',
                                    quirk: assignData?.assignedQuirk || '',
                                    likes: [],
                                    submittedAt: new Date(),
                                })
                            }
                        }
                    }

                    // HOST DICTATOR: Only the Host updates gameState
                    await updateDoc(roomRef, {
                        gameState: 'showcase',
                        showcaseIndex: 0,
                        showcaseStarted: false,
                        showcaseReadyPlayers: [],
                    })
                }
            } catch (err) {
                console.error('Profile transition error:', err)
            }
        })

        return () => unsubscribe()
    }, [isHost, roomCode, gameData, playerName])

    // ============================================================================
    // FORCE NEXT PHASE - FAILSAFE BUTTON
    // Allows the Host to manually advance if the game gets stuck
    // ============================================================================

    const forceNextPhase = async () => {
        if (!isHost || !roomCode || !gameData || forcedRef.current) return
        forcedRef.current = true

        console.log('⚡ HOST: Force advancing to next phase from', gameData.gameState)

        const roomRef = doc(db, 'rooms', roomCode)

        try {
            // Determine the next phase based on current state
            const currentState = gameData.gameState
            let nextState = currentState

            if (currentState === 'lobby') {
                // Force start game
                const endTime = new Date(serverNow())
                endTime.setSeconds(endTime.getSeconds() + 60)
                await updateDoc(roomRef, {
                    gameState: 'pre-profile',
                    roundEndTime: endTime,
                    currentRound: 1,
                    assignmentsCreated: false,
                })
                nextState = 'pre-profile'
            } else if (currentState === 'pre-profile') {
                // Force to profile (fill defaults for missing submissions)
                const submissionsRef = collection(db, 'rooms', roomCode, 'submissions')
                const submissionsSnap = await getDoc(doc(submissionsRef, '_check'))

                for (const player of gameData.players) {
                    const submissionRef = doc(db, 'rooms', roomCode, 'submissions', player.name)
                    const snap = await getDoc(submissionRef)
                    if (!snap.exists()) {
                        await setDoc(submissionRef, {
                            persona: 'Mystery Person',
                            quirk: 'being mysterious',
                            submittedAt: new Date(),
                        })
                    }
                }

                // This will trigger the normal Host logic above
                nextState = 'profile'
            } else if (currentState === 'profile') {
                // Force to showcase (will be handled by the normal Host logic)
                nextState = 'showcase'
            } else if (currentState === 'showcase') {
                // Force to favorite
                const favEnd = new Date(serverNow())
                favEnd.setSeconds(favEnd.getSeconds() + 30)
                await updateDoc(roomRef, {
                    gameState: 'favorite',
                    favoriteEndTime: favEnd,
                })
                nextState = 'favorite'
            } else if (currentState === 'favorite') {
                // Force to results
                await updateDoc(roomRef, {
                    gameState: 'results',
                })
                nextState = 'results'
            }

            console.log(`⚡ HOST: Forced transition ${currentState} → ${nextState}`)
        } catch (err) {
            console.error('Force phase error:', err)
        } finally {
            // Reset after a delay to allow another force if needed
            setTimeout(() => {
                forcedRef.current = false
            }, 2000)
        }
    }

    return { forceNextPhase }
}
