'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Heart, HeartCrack, Trophy, Crown, Check } from 'lucide-react'
import { db, ensureAuth } from '../../lib/firebase'
import { doc, collection, onSnapshot, updateDoc, arrayUnion, getDoc, serverTimestamp } from 'firebase/firestore'
import { CountdownTimer } from './CountdownTimer'
import { WaitingScreen } from './WaitingScreen'
import { useServerTime } from './ServerTimeProvider'
import { sfx } from '../../lib/sfx'

interface Player {
  name: string
  score: number
}

interface VotingPageProps {
  roomCode: string
  playerName: string
  isHost: boolean
  players: Player[]
  onVotingComplete: () => void
  onPlayAgain: () => void
  currentRound?: number
  onNextRound?: () => void
}

interface Profile {
  id: string
  name: string
  bio: string
  imageUrl: string
  persona: string
  quirk: string
  likes: string[]
  voters?: string[]
  favoritePick?: string
}

interface ScoreEntry {
  name: string
  total: number
  likePoints: number
  favoritePoints: number
  mutualMatch: boolean
  mutualPartner?: string
}

const SHOWCASE_SECONDS = 15
const FAVORITE_SECONDS = 30

function calculateScores(profiles: Profile[], players: Player[]): ScoreEntry[] {
  const scores: Record<string, ScoreEntry> = {}

  players.forEach(p => {
    scores[p.name] = { name: p.name, total: 0, likePoints: 0, favoritePoints: 0, mutualMatch: false }
  })

  profiles.forEach(profile => {
    const name = profile.id
    if (!scores[name]) return

    // +5 per like received
    const likePoints = (profile.likes?.length || 0) * 5
    scores[name].likePoints = likePoints
    scores[name].total += likePoints
  })

  // Favorite points
  profiles.forEach(profile => {
    if (!profile.favoritePick || !scores[profile.favoritePick] || !scores[profile.id]) return

    const pickedProfile = profiles.find(p => p.id === profile.favoritePick)
    if (pickedProfile?.favoritePick === profile.id) {
      // Mutual match: +35
      if (!scores[profile.id].mutualMatch) {
        scores[profile.id].mutualMatch = true
        scores[profile.id].mutualPartner = profile.favoritePick
        scores[profile.id].favoritePoints += 35
        scores[profile.id].total += 35
      }
    } else {
      // One-sided: picked player gets +10
      scores[profile.favoritePick].favoritePoints += 10
      scores[profile.favoritePick].total += 10
    }
  })

  return Object.values(scores).sort((a, b) => b.total - a.total)
}

export function VotingPage({ roomCode, playerName, isHost, players, onVotingComplete, onPlayAgain, currentRound = 1, onNextRound }: VotingPageProps) {
  const { serverNow } = useServerTime()
  const [gameState, setGameState] = useState<string>('showcase')
  const [showcaseIndex, setShowcaseIndex] = useState<number>(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [hasPickedMatch, setHasPickedMatch] = useState<boolean>(false)
  const [timerEndTime, setTimerEndTime] = useState<Date | null>(null)
  const [favoriteEndTime, setFavoriteEndTime] = useState<Date | null>(null)
  const [imagesReady, setImagesReady] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())
  const [showcaseStarted, setShowcaseStarted] = useState(false)
  const readyReportedRef = useRef(false)
  const [favoritePicked, setFavoritePicked] = useState<string | null>(null)
  const favoriteAutoPickedRef = useRef(false)
  const resultsPlayedRef = useRef(false)
  const lastShowcaseIdRef = useRef<string | null>(null)
  const matchOverlayShownRef = useRef(false)

  // Next round state
  const [nextRoundEndTime, setNextRoundEndTime] = useState<Date | null>(null)
  const nextRoundTriggeredRef = useRef(false)

  // Match overlay hooks (must be top-level, not inside conditional)
  const matchEmojis = ['💕', '💘', '💖', '✨', '🔥', '💫', '🌟', '❤️‍🔥']
  // Derive emoji deterministically from roomCode so all clients see the same one
  const emojiIndex = roomCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % matchEmojis.length
  const matchEmojiRef = useRef(matchEmojis[emojiIndex])
  const [showMatchOverlay, setShowMatchOverlay] = useState(false)

  // Trigger match overlay when entering results with mutuals (only once)
  useEffect(() => {
    if (gameState !== 'results') return
    if (matchOverlayShownRef.current) return
    const scores = calculateScores(profiles, players)
    const hasMutuals = scores.some(s => s.mutualMatch)
    if (!hasMutuals) return
    matchOverlayShownRef.current = true
    setShowMatchOverlay(true)
    const timer = setTimeout(() => setShowMatchOverlay(false), 3500)
    return () => clearTimeout(timer)
  }, [gameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Set up next-round auto-advance timer when entering results (rounds 1-2)
  useEffect(() => {
    if (gameState !== 'results') return
    if (currentRound >= 3 || !onNextRound) return
    if (nextRoundEndTime) return // already set

    const endTime = new Date(serverNow())
    endTime.setSeconds(endTime.getSeconds() + 10)
    setNextRoundEndTime(endTime)
  }, [gameState, currentRound, onNextRound, nextRoundEndTime])

  // Listen to room state changes
  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomCode)
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        const newGameState = data.gameState || 'showcase'
        const newShowcaseIndex = data.showcaseIndex ?? 0

        if (newGameState === 'favorite' && gameState !== 'favorite') {
          setHasPickedMatch(false)
          setFavoritePicked(null)
          favoriteAutoPickedRef.current = false
        }

        setGameState(newGameState)
        setShowcaseIndex(newShowcaseIndex)
        setShowcaseStarted(!!data.showcaseStarted)

        if (data.timerEndTime) {
          setTimerEndTime(data.timerEndTime.toDate ? data.timerEndTime.toDate() : new Date(data.timerEndTime))
        }
        if (data.favoriteEndTime) {
          setFavoriteEndTime(data.favoriteEndTime.toDate ? data.favoriteEndTime.toDate() : new Date(data.favoriteEndTime))
        }
      }
    })

    return () => unsubscribe()
  }, [roomCode, gameState])

  // Listen to profiles collection
  useEffect(() => {
    const profilesCollectionRef = collection(db, 'rooms', roomCode, 'profiles')
    const unsubscribe = onSnapshot(profilesCollectionRef, (snapshot) => {
      const profilesList: Profile[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          name: data.name || '',
          bio: data.bio || '',
          imageUrl: data.imageUrl || '',
          persona: data.persona || '',
          quirk: data.quirk || '',
          likes: data.likes || [],
          voters: data.voters || [],
          favoritePick: data.favoritePick
        }
      })
      // Sort by document ID for stable ordering — Firestore snapshots
      // don't guarantee order, and shuffled indices cause showcase flicker
      profilesList.sort((a, b) => a.id.localeCompare(b.id))
      setProfiles(profilesList)
    })

    return () => unsubscribe()
  }, [roomCode])

  // DOM-based image preloading: track loaded images via a persistent Set
  const handleImageLoaded = useCallback((profileId: string) => {
    setLoadedImages(prev => {
      const next = new Set(prev)
      next.add(profileId)
      return next
    })
  }, [])

  // Compute readiness: all expected profiles collected AND all their images loaded
  const profilesWithImages = profiles.filter(p => p.imageUrl)
  const allProfilesCollected = profiles.length >= players.length
  const allImagesLoaded = profilesWithImages.length > 0
    ? profilesWithImages.every(p => loadedImages.has(p.id))
    : allProfilesCollected  // no images = nothing to wait for
  const showcaseReady = allProfilesCollected && allImagesLoaded

  // Safety timeout: don't block forever (15 seconds max)
  useEffect(() => {
    if (gameState !== 'showcase' || imagesReady) return
    const timeout = setTimeout(() => setImagesReady(true), 15000)
    return () => clearTimeout(timeout)
  }, [gameState, imagesReady])

  // Mark ready as soon as all images are confirmed loaded
  useEffect(() => {
    if (showcaseReady && !imagesReady) {
      setImagesReady(true)
    }
  }, [showcaseReady, imagesReady])

  // === ASSET LOADING GATE ===
  // When THIS client's images are ready, report to Firestore
  useEffect(() => {
    if (!imagesReady || readyReportedRef.current || gameState !== 'showcase') return
    readyReportedRef.current = true
    const roomRef = doc(db, 'rooms', roomCode)
    updateDoc(roomRef, { showcaseReadyPlayers: arrayUnion(playerName) })
  }, [imagesReady, gameState, roomCode, playerName])

  // ============================================================================
  // HOST ONLY - DICTATOR LOGIC: Start showcase when all players ready
  // ============================================================================
  useEffect(() => {
    if (!isHost || gameState !== 'showcase' || showcaseStarted) return

    const roomRef = doc(db, 'rooms', roomCode)
    const unsubscribe = onSnapshot(roomRef, (snap) => {
      const data = snap.data()
      if (!data) return
      const readyPlayers: string[] = data.showcaseReadyPlayers || []
      // Start if everyone is ready OR if we have at least 2 players and it's been waiting too long 
      // (The timeout failsafe below covers the "too long" case, this just checks explicit readiness)
      if (readyPlayers.length >= players.length && players.length >= 2) {
        // All clients ready — HOST DICTATOR: start the showcase!
        console.log('🎯 HOST: All players ready, starting showcase')
        const endTime = new Date(serverNow())
        endTime.setSeconds(endTime.getSeconds() + SHOWCASE_SECONDS)
        updateDoc(roomRef, {
          showcaseStarted: true,
          timerEndTime: endTime,
        })
      }
    })
    return () => unsubscribe()
  }, [isHost, gameState, showcaseStarted, roomCode, players.length, serverNow])

  // HOST FAILSAFE: Force start showcase after 10s if stuck waiting for players to load images
  useEffect(() => {
    if (!isHost || gameState !== 'showcase' || showcaseStarted) return

    const timeout = setTimeout(() => {
      console.log('⏰ HOST: Force starting showcase due to timeout')
      const roomRef = doc(db, 'rooms', roomCode)
      const endTime = new Date(serverNow())
      endTime.setSeconds(endTime.getSeconds() + SHOWCASE_SECONDS)
      updateDoc(roomRef, {
        showcaseStarted: true,
        timerEndTime: endTime,
      })
    }, 10000) // 10 seconds max wait for loading

    return () => clearTimeout(timeout)
  }, [isHost, gameState, showcaseStarted, roomCode, serverNow])

  // Derive current profile live from profiles array
  const currentProfile = (showcaseIndex >= 0 && showcaseIndex < profiles.length)
    ? profiles[showcaseIndex]
    : null

  // Side effects when the showcased profile actually changes (sound, vote reset)
  useEffect(() => {
    if (!currentProfile || !showcaseStarted) return
    if (currentProfile.id !== lastShowcaseIdRef.current) {
      lastShowcaseIdRef.current = currentProfile.id
      setHasVoted(false)
      sfx.play('showcaseWhoosh')
    }
  }, [currentProfile?.id, showcaseStarted]) // eslint-disable-line react-hooks/exhaustive-deps

  // Host: advance showcase — extracted as stable callback for CountdownTimer.onExpired
  const advanceShowcaseRef = useRef<() => void>(() => { })
  const advanceShowcase = useCallback(() => {
    advanceShowcaseRef.current()
  }, [])

  // ============================================================================
  // HOST ONLY - DICTATOR LOGIC: Advance showcase
  // ============================================================================
  useEffect(() => {
    advanceShowcaseRef.current = async () => {
      if (!isHost || gameState !== 'showcase') return
      const roomRef = doc(db, 'rooms', roomCode)
      const nextIndex = showcaseIndex + 1

      if (nextIndex < profiles.length) {
        console.log('🎯 HOST: Advancing to profile', nextIndex)
        const nextEndTime = new Date(serverNow())
        nextEndTime.setSeconds(nextEndTime.getSeconds() + SHOWCASE_SECONDS)
        // HOST DICTATOR: Only Host writes showcaseIndex
        await updateDoc(roomRef, {
          showcaseIndex: nextIndex,
          timerEndTime: nextEndTime,
        })
      } else {
        // All profiles shown, move to favorite pick
        console.log('🎯 HOST: All profiles shown, moving to favorite')
        const favEnd = new Date(serverNow())
        favEnd.setSeconds(favEnd.getSeconds() + FAVORITE_SECONDS)
        // HOST DICTATOR: Only Host writes gameState
        await updateDoc(roomRef, {
          gameState: 'favorite',
          favoriteEndTime: favEnd,
        })
      }
    }
  })

  // Host: initial timer is now set by the loading gate effect above
  // No need for a separate timer init effect

  // Host: skip timer to 3s when all players have voted on current profile
  useEffect(() => {
    if (!isHost || gameState !== 'showcase' || profiles.length === 0) return
    const current = profiles[showcaseIndex]
    if (!current) return

    const voters = current.voters || []
    const expectedVoters = players.filter(p => p.name !== current.id).length
    if (expectedVoters <= 0 || voters.length < expectedVoters) return

    // All voted — shorten timer to 3 seconds from now
    const skipEndTime = new Date(serverNow())
    skipEndTime.setSeconds(skipEndTime.getSeconds() + 3)
    const roomRef = doc(db, 'rooms', roomCode)
    updateDoc(roomRef, { timerEndTime: skipEndTime })
    // CountdownTimer's onExpired will call advanceShowcase when it hits 0
  }, [isHost, gameState, showcaseIndex, profiles, players, roomCode])

  // ============================================================================
  // HOST ONLY - DICTATOR LOGIC: Detect all favorite picks -> advance to results
  // ============================================================================
  useEffect(() => {
    if (!isHost || gameState !== 'favorite') return

    const allPicked = profiles.length >= players.length &&
      profiles.every(p => p.favoritePick !== undefined)

    if (allPicked && profiles.length > 0) {
      console.log('🎯 HOST: All favorites picked, advancing to results')
      const roomRef = doc(db, 'rooms', roomCode)
      getDoc(roomRef).then(snap => {
        if (snap.data()?.gameState === 'favorite') {
          // HOST DICTATOR: Only Host writes gameState
          updateDoc(roomRef, { gameState: 'results' })
        }
      })
    }
  }, [isHost, gameState, profiles, players.length, roomCode])

  // ============================================================================
  // HOST ONLY - DICTATOR LOGIC: Force-advance to results after favorite timer expires
  // ============================================================================
  useEffect(() => {
    if (!isHost || gameState !== 'favorite' || !favoriteEndTime) return

    const msUntilExpire = favoriteEndTime.getTime() - Date.now() + 2000
    if (msUntilExpire <= 0) return

    const timer = setTimeout(async () => {
      console.log('🎯 HOST: Favorite timer expired, forcing to results')
      const roomRef = doc(db, 'rooms', roomCode)
      const snap = await getDoc(roomRef)
      if (snap.data()?.gameState === 'favorite') {
        // HOST DICTATOR: Only Host writes gameState
        await updateDoc(roomRef, { gameState: 'results' })
      }
    }, msUntilExpire)

    return () => clearTimeout(timer)
  }, [isHost, gameState, favoriteEndTime, roomCode])

  const sendVote = async (type: 'like' | 'dislike') => {
    if (!currentProfile || hasVoted || currentProfile.id === playerName) return

    try {
      await ensureAuth()

      const profileRef = doc(db, 'rooms', roomCode, 'profiles', currentProfile.id)
      if (type === 'like') {
        await updateDoc(profileRef, {
          likes: arrayUnion(playerName),
          voters: arrayUnion(playerName),
        })
      } else {
        // Track nope vote too so host knows everyone has voted
        await updateDoc(profileRef, {
          voters: arrayUnion(playerName),
        })
      }

      sfx.play(type === 'like' ? 'voteLike' : 'voteNope')
      setHasVoted(true)
    } catch (error) {
      console.error('Error sending vote:', error)
    }
  }

  const sendFavoritePick = useCallback(async (profileId: string) => {
    if (hasPickedMatch || profileId === playerName) return

    try {
      await ensureAuth()

      const myProfileRef = doc(db, 'rooms', roomCode, 'profiles', playerName)
      await updateDoc(myProfileRef, {
        favoritePick: profileId
      })

      setFavoritePicked(profileId)
      setHasPickedMatch(true)
    } catch (error) {
      console.error('Error sending favorite pick:', error)
    }
  }, [hasPickedMatch, playerName, roomCode])

  // Auto-pick favorite when timer expires
  const handleFavoriteExpired = useCallback(() => {
    if (hasPickedMatch || favoriteAutoPickedRef.current) return
    favoriteAutoPickedRef.current = true

    const firstNonSelf = profiles.find(p => p.id !== playerName)
    if (firstNonSelf) {
      sendFavoritePick(firstNonSelf.id)
    }
  }, [hasPickedMatch, profiles, playerName, sendFavoritePick])

  const handleNextRoundExpired = useCallback(() => {
    if (nextRoundTriggeredRef.current || !onNextRound || !isHost) return
    nextRoundTriggeredRef.current = true
    onNextRound()
  }, [onNextRound, isHost])

  // ============================================================================
  // FORCE NEXT PHASE - FAILSAFE
  // Allows Host to manually skip to next phase if game gets stuck
  // ============================================================================
  const forceAdvance = useCallback(async () => {
    if (!isHost) return
    console.log('⚡ HOST: Force advancing from', gameState)
    const roomRef = doc(db, 'rooms', roomCode)

    if (gameState === 'showcase') {
      // Force to favorite
      const favEnd = new Date(serverNow())
      favEnd.setSeconds(favEnd.getSeconds() + FAVORITE_SECONDS)
      await updateDoc(roomRef, {
        gameState: 'favorite',
        favoriteEndTime: favEnd,
      })
    } else if (gameState === 'favorite') {
      // Force to results
      await updateDoc(roomRef, { gameState: 'results' })
    }
  }, [isHost, gameState, roomCode, serverNow])

  const isFinalRound = currentRound >= 3

  // RESULTS PHASE
  if (gameState === 'results') {
    if (!resultsPlayedRef.current) {
      resultsPlayedRef.current = true
      sfx.play('resultsReveal')
    }
    const scores = calculateScores(profiles, players)

    return (
      <div className="min-h-screen bg-lime-300 bg-game p-4 flex items-center justify-center">
        {/* Full-screen match overlay */}
        {showMatchOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center animate-match-bg-burst overflow-hidden"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.95), rgba(219,39,119,0.98))' }}
          >
            {/* Burst lines */}
            <div className="absolute inset-0 animate-match-burst-lines" />

            {/* Gloss shimmer sweep */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%]"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, transparent 35%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.3) 44%, rgba(255,255,255,0.6) 48%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.6) 52%, rgba(255,255,255,0.3) 56%, rgba(255,255,255,0.1) 60%, transparent 65%, transparent 100%)',
                  transform: 'translateX(-180%) rotate(25deg)',
                  animation: 'match-overlay-gloss 2.5s ease-in-out 1.5s 1 forwards',
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              {/* Sparkle top-left */}
              <div className="absolute -top-16 -left-16 text-4xl"
                style={{ animation: 'match-sparkle-spin 2s ease-out forwards' }}>
                ✨
              </div>

              {/* Emoji */}
              <div className="text-7xl animate-match-emoji-bounce">
                {matchEmojiRef.current}
              </div>

              {/* Text */}
              <h1 className="font-bebas text-6xl sm:text-7xl uppercase text-white animate-match-text-slide animate-match-glow-pulse drop-shadow-[0_3px_0px_rgba(0,0,0,0.3)]">
                It&apos;s a Match!
              </h1>

              {/* Sparkle bottom-right */}
              <div className="absolute -bottom-12 -right-16 text-4xl"
                style={{ animation: 'match-sparkle-spin 2s ease-out 0.5s forwards', opacity: 0 }}>
                💖
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md w-full space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-6 text-center shadow-[8px_8px_0px_#8b5cf6] animate-slide-up">
            <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-500" strokeWidth={3} />
            <h1 className="font-bebas text-6xl uppercase text-slate-900">
              {isFinalRound ? 'Final Results' : `Round ${currentRound} Results`}
            </h1>
          </div>

          {/* Scoreboard */}
          <div className="space-y-3">
            {scores.map((entry, i) => {
              const playerObj = players.find(p => p.name === entry.name)
              const previousScore = playerObj?.score || 0
              const cumulativeTotal = entry.total + previousScore

              return (
                <div
                  key={entry.name}
                  className={`relative rounded-2xl border-4 border-slate-900 p-4 flex items-center gap-4 animate-slide-up ${entry.mutualMatch
                    ? 'bg-pink-100 shadow-[4px_4px_0px_#ec4899] animate-match-gloss'
                    : i === 0
                      ? 'bg-white shadow-[4px_4px_0px_#eab308]'
                      : 'bg-white shadow-[4px_4px_0px_#1e293b]'
                    }`}
                  style={{ animationDelay: `${0.15 + i * 0.1}s` }}
                >
                  {/* Rank circle with crooked emoji badge for matches */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center font-bebas text-2xl ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-orange-400' : 'bg-white'
                      }`}>
                      {i === 0 ? <Crown className="w-6 h-6" strokeWidth={3} /> : i + 1}
                    </div>
                    {entry.mutualMatch && (
                      <span className="absolute -top-2 -right-2 text-lg transform rotate-12 drop-shadow-sm">
                        {matchEmojiRef.current}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="font-inter font-bold text-lg text-slate-900">
                      {entry.name}
                      {entry.name === playerName && <span className="text-sm text-slate-500 ml-2">(you)</span>}
                    </div>
                    <div className="font-inter text-sm text-slate-500">
                      {entry.likePoints > 0 && <span>{entry.likePoints}pts likes</span>}
                      {entry.favoritePoints > 0 && <span> + {entry.favoritePoints}pts fav</span>}
                      {entry.mutualMatch && <span className="text-pink-500 font-bold"> {matchEmojiRef.current} mutual!</span>}
                    </div>
                    {previousScore > 0 && (
                      <div className="font-inter text-xs text-slate-400">
                        +{entry.total} this round
                      </div>
                    )}
                  </div>

                  <div className="font-bebas text-3xl text-slate-900">
                    {cumulativeTotal}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Next Round / Play Again */}
          {isFinalRound ? (
            <>
              {isHost && (
                <button
                  onClick={onPlayAgain}
                  className="w-full bg-green-500 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-green-600 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase text-xl"
                >
                  Play Again
                </button>
              )}
              {!isHost && (
                <div className="text-center">
                  <p className="font-inter text-slate-700 font-bold">Waiting for host to start a new game...</p>
                </div>
              )}
            </>
          ) : (
            <>
              {isHost && onNextRound && (
                <button
                  onClick={() => {
                    if (nextRoundTriggeredRef.current) return
                    nextRoundTriggeredRef.current = true
                    onNextRound()
                  }}
                  className="w-full bg-blue-500 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-blue-600 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase text-xl flex items-center justify-center gap-3"
                >
                  Next Round
                  {nextRoundEndTime && (
                    <CountdownTimer endTime={nextRoundEndTime} totalDuration={10} onExpired={handleNextRoundExpired} />
                  )}
                </button>
              )}
              {!isHost && (
                <div className="bg-white rounded-xl border-3 border-slate-900 p-4 text-center shadow-[3px_3px_0px_#1e293b] flex items-center justify-center gap-3">
                  <p className="font-inter text-slate-700 font-bold">Next round starting soon...</p>
                  {nextRoundEndTime && (
                    <CountdownTimer endTime={nextRoundEndTime} totalDuration={10} onExpired={handleNextRoundExpired} />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // FAVORITE PICK PHASE — Compact centered layout
  if (gameState === 'favorite') {
    return (
      <div className="min-h-screen bg-lime-300 bg-game flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-4 text-center shadow-[8px_8px_0px_#ec4899]">
            <h1 className="font-bebas text-5xl uppercase text-slate-900 mb-1">Pick Your Favorite!</h1>
            <p className="font-inter text-sm text-slate-700">Who had the best profile?</p>
            {favoriteEndTime && (
              <CountdownTimer
                endTime={favoriteEndTime}
                totalDuration={FAVORITE_SECONDS}
                onExpired={handleFavoriteExpired}
              />
            )}
          </div>

          {/* Profile cards — compact list */}
          <div className="space-y-3">
            {profiles
              .filter(p => p.id !== playerName)
              .map((profile) => {
                const isSelected = favoritePicked === profile.id
                return (
                  <button
                    key={profile.id}
                    disabled={hasPickedMatch}
                    onClick={() => sendFavoritePick(profile.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-3 text-left transition-all ${isSelected
                      ? 'bg-pink-100 border-pink-500 shadow-[3px_3px_0px_#ec4899]'
                      : hasPickedMatch
                        ? 'bg-white border-slate-900 shadow-[3px_3px_0px_#1e293b] opacity-50 cursor-not-allowed'
                        : 'bg-white border-slate-900 shadow-[3px_3px_0px_#1e293b] hover:shadow-[3px_3px_0px_#ec4899] hover:border-pink-500 active:shadow-none active:translate-x-0.5 active:translate-y-0.5'
                      }`}
                  >
                    <img
                      src={profile.imageUrl}
                      alt={profile.name}
                      className="w-16 h-16 rounded-xl border-2 border-slate-900 bg-white object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-inter text-lg font-bold text-slate-900 truncate">{profile.name}</h3>
                      <p className="font-inter text-sm text-slate-600 line-clamp-1">{profile.bio}</p>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500 border-2 border-slate-900 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
          </div>

          {hasPickedMatch && (
            <div className="bg-green-400 text-white font-bold text-lg py-3 px-6 rounded-xl border-3 border-slate-900 text-center shadow-[3px_3px_0px_#1e293b]">
              Favorite Picked! Waiting for results...
            </div>
          )}
        </div>
      </div>
    )
  }

  // LOADING / PRELOADING — gate on showcaseStarted from Firestore (not local imagesReady)
  if (!currentProfile || profiles.length === 0 || !showcaseStarted) {
    const collected = Math.min(profiles.length, players.length)
    const loaded = loadedImages.size
    const total = profilesWithImages.length
    const isCollecting = !allProfilesCollected
    const isLoadingImages = allProfilesCollected && !imagesReady

    return (
      <div className="relative">
        <WaitingScreen
          status={isCollecting ? 'collecting' : isLoadingImages ? 'loading' : 'waiting'}
          playerCount={isCollecting ? players.length : isLoadingImages ? total : 0}
          readyCount={isCollecting ? collected : loaded}
        />
        {/* Hidden preloader images — actual DOM img tags that fire onLoad */}
        <div aria-hidden="true" className="fixed top-[-9999px] left-[-9999px] w-px h-px overflow-hidden">
          {profilesWithImages.map(p => (
            <img
              key={p.id}
              src={p.imageUrl}
              alt=""
              onLoad={() => handleImageLoaded(p.id)}
              onError={() => handleImageLoaded(p.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  const isOwnProfile = currentProfile.id === playerName

  // SHOWCASE PHASE - Tinder-style card + floating circular buttons
  return (
    <div className="min-h-screen bg-lime-300 bg-game flex flex-col">
      {/* Card + buttons wrapper: centered in full space */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4">
        {/* Compact header bar — floats above the card */}
        <div className="max-w-md w-full mb-4">
          <div className="bg-white rounded-xl border-3 border-slate-900 px-4 py-2 flex justify-between items-center shadow-[3px_3px_0px_#1e293b]">
            <span className="font-bebas text-2xl uppercase text-slate-900">Showcase</span>
            <div className="flex items-center gap-2">
              {timerEndTime && (
                <CountdownTimer
                  endTime={timerEndTime}
                  totalDuration={SHOWCASE_SECONDS}
                  onExpired={isHost ? advanceShowcase : undefined}
                />
              )}
              <span className="font-inter font-bold text-sm bg-slate-900 text-white px-3 py-1 rounded-full">
                {showcaseIndex + 1}/{profiles.length}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div
          key={currentProfile.id}
          className="max-w-md w-full animate-card-enter"
        >
          <div className="relative bg-white rounded-2xl border-4 border-slate-900 overflow-hidden shadow-[8px_8px_0px_#ec4899]">
            {/* Own profile badge */}
            {isOwnProfile && (
              <div className="absolute top-3 left-3 z-10 bg-pink-500 text-white font-bold px-3 py-1.5 rounded-full text-sm border-2 border-slate-900 rotate-[-6deg] shadow-[2px_2px_0px_#1e293b] uppercase">
                🌟 This is you!
              </div>
            )}
            <img
              src={currentProfile.imageUrl}
              alt={currentProfile.name}
              className="w-full aspect-square object-contain bg-white border-b-4 border-slate-900"
            />
            <div className="p-5">
              <h2 className="font-bebas text-4xl uppercase text-slate-900">{currentProfile.name}</h2>
              <p className="font-inter text-lg text-slate-700 mt-2">{currentProfile.bio}</p>
            </div>
          </div>
        </div>

        {/* Floating circular vote buttons — only for other profiles */}
        {!isOwnProfile && (
          <div className="mt-6">
            {hasVoted ? (
              <div className="flex items-center justify-center gap-3 transition-all">
                <div className="w-16 h-16 rounded-full border-4 border-slate-300 bg-slate-100 flex items-center justify-center opacity-50 scale-75 transition-all">
                  <HeartCrack className="w-7 h-7 text-slate-400" strokeWidth={3} />
                </div>
                <span className="font-bebas text-2xl text-slate-700 uppercase">Voted!</span>
                <div className="w-16 h-16 rounded-full border-4 border-slate-300 bg-slate-100 flex items-center justify-center opacity-50 scale-75 transition-all">
                  <Heart className="w-7 h-7 text-slate-400" strokeWidth={3} />
                </div>
              </div>
            ) : (
              <div className="flex gap-8 justify-center">
                <button
                  onClick={() => sendVote('dislike')}
                  className="w-16 h-16 rounded-full bg-white border-4 border-red-400 shadow-[3px_3px_0px_#1e293b] flex items-center justify-center transition-all hover:scale-110 hover:bg-red-400 hover:border-red-500 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 group"
                >
                  <HeartCrack className="w-7 h-7 text-red-500 group-hover:text-white transition-colors" strokeWidth={3} />
                </button>
                <button
                  onClick={() => sendVote('like')}
                  className="w-16 h-16 rounded-full bg-white border-4 border-green-400 shadow-[3px_3px_0px_#1e293b] flex items-center justify-center transition-all hover:scale-110 hover:bg-green-400 hover:border-green-500 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 group"
                >
                  <Heart className="w-7 h-7 text-green-500 group-hover:text-white transition-colors" strokeWidth={3} fill="currentColor" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Host Force Button - floats at bottom left */}
      {isHost && (
        <div className="fixed bottom-4 left-4 z-50">
          <button
            onClick={forceAdvance}
            className="bg-yellow-400 text-slate-900 font-inter text-xs font-bold uppercase px-3 py-2 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#1e293b] hover:bg-yellow-300 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1"
          >
            <span>⚡</span>
            <span>Force Next</span>
          </button>
        </div>
      )}
    </div>
  )
}
