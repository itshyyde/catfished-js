'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Heart, HeartCrack, Trophy, Crown } from 'lucide-react'
import { db, ensureAuth } from '../../lib/firebase'
import { doc, collection, onSnapshot, updateDoc, arrayUnion, getDoc } from 'firebase/firestore'
import { CountdownTimer } from './CountdownTimer'
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
}

interface Profile {
  id: string
  name: string
  bio: string
  imageUrl: string
  persona: string
  quirk: string
  likes: string[]
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
    if (!profile.favoritePick || !scores[profile.favoritePick]) return

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

export function VotingPage({ roomCode, playerName, isHost, players, onVotingComplete, onPlayAgain }: VotingPageProps) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [gameState, setGameState] = useState<string>('showcase')
  const [showcaseIndex, setShowcaseIndex] = useState<number>(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [hasPickedMatch, setHasPickedMatch] = useState<boolean>(false)
  const [timerEndTime, setTimerEndTime] = useState<Date | null>(null)
  const [favoriteEndTime, setFavoriteEndTime] = useState<Date | null>(null)
  const [imagesPreloaded, setImagesPreloaded] = useState<boolean>(false)
  const favoriteAutoPickedRef = useRef(false)
  const resultsPlayedRef = useRef(false)

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
          favoriteAutoPickedRef.current = false
        }

        setGameState(newGameState)
        setShowcaseIndex(newShowcaseIndex)

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
          favoritePick: data.favoritePick
        }
      })
      setProfiles(profilesList)
    })

    return () => unsubscribe()
  }, [roomCode])

  // Preload images when entering showcase
  useEffect(() => {
    if (gameState !== 'showcase' || profiles.length === 0 || imagesPreloaded) return

    let loaded = 0
    const total = profiles.filter(p => p.imageUrl).length
    if (total === 0) {
      setImagesPreloaded(true)
      return
    }

    const timeout = setTimeout(() => {
      setImagesPreloaded(true)
    }, 10000)

    profiles.forEach(profile => {
      if (!profile.imageUrl) return
      const img = new Image()
      img.onload = img.onerror = () => {
        loaded++
        if (loaded >= total) {
          clearTimeout(timeout)
          setImagesPreloaded(true)
        }
      }
      img.src = profile.imageUrl
    })

    return () => clearTimeout(timeout)
  }, [gameState, profiles.length, imagesPreloaded])

  // Update current profile when showcase index changes
  useEffect(() => {
    if (showcaseIndex >= 0 && showcaseIndex < profiles.length) {
      setCurrentProfile(profiles[showcaseIndex])
      setHasVoted(false)
      sfx.play('showcaseWhoosh')
    }
  }, [showcaseIndex, profiles.length])

  // Host: auto-advance showcase with timer (waits for preload)
  useEffect(() => {
    if (!isHost || gameState !== 'showcase' || profiles.length === 0 || !imagesPreloaded) return

    const advanceShowcase = async () => {
      const roomRef = doc(db, 'rooms', roomCode)
      const nextIndex = showcaseIndex + 1

      if (nextIndex < profiles.length) {
        const nextEndTime = new Date()
        nextEndTime.setSeconds(nextEndTime.getSeconds() + SHOWCASE_SECONDS)
        await updateDoc(roomRef, {
          showcaseIndex: nextIndex,
          timerEndTime: nextEndTime,
        })
      } else {
        // All profiles shown, move to favorite pick
        const favEnd = new Date()
        favEnd.setSeconds(favEnd.getSeconds() + FAVORITE_SECONDS)
        await updateDoc(roomRef, {
          gameState: 'favorite',
          favoriteEndTime: favEnd,
        })
      }
    }

    // Set initial timer for first profile
    if (showcaseIndex === 0 && !timerEndTime) {
      const endTime = new Date()
      endTime.setSeconds(endTime.getSeconds() + SHOWCASE_SECONDS)
      const roomRef = doc(db, 'rooms', roomCode)
      updateDoc(roomRef, { timerEndTime: endTime })
    }

    const timer = setTimeout(advanceShowcase, SHOWCASE_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [isHost, gameState, showcaseIndex, profiles.length, roomCode, imagesPreloaded])

  // Host: detect all favorite picks -> advance to results
  useEffect(() => {
    if (!isHost || gameState !== 'favorite') return

    const allPicked = profiles.length >= players.length &&
      profiles.every(p => p.favoritePick !== undefined)

    if (allPicked && profiles.length > 0) {
      const roomRef = doc(db, 'rooms', roomCode)
      getDoc(roomRef).then(snap => {
        if (snap.data()?.gameState === 'favorite') {
          updateDoc(roomRef, { gameState: 'results' })
        }
      })
    }
  }, [isHost, gameState, profiles, players.length, roomCode])

  // Host: force-advance to results after favorite timer expires + 2s grace
  useEffect(() => {
    if (!isHost || gameState !== 'favorite' || !favoriteEndTime) return

    const msUntilExpire = favoriteEndTime.getTime() - Date.now() + 2000
    if (msUntilExpire <= 0) return

    const timer = setTimeout(async () => {
      const roomRef = doc(db, 'rooms', roomCode)
      const snap = await getDoc(roomRef)
      if (snap.data()?.gameState === 'favorite') {
        await updateDoc(roomRef, { gameState: 'results' })
      }
    }, msUntilExpire)

    return () => clearTimeout(timer)
  }, [isHost, gameState, favoriteEndTime, roomCode])

  const sendVote = async (type: 'like' | 'dislike') => {
    if (!currentProfile || hasVoted || currentProfile.id === playerName) return

    try {
      await ensureAuth()

      if (type === 'like') {
        const profileRef = doc(db, 'rooms', roomCode, 'profiles', currentProfile.id)
        await updateDoc(profileRef, {
          likes: arrayUnion(playerName)
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

  // RESULTS PHASE
  if (gameState === 'results') {
    if (!resultsPlayedRef.current) {
      resultsPlayedRef.current = true
      sfx.play('resultsReveal')
    }
    const scores = calculateScores(profiles, players)
    const mutualMatches = scores.filter(s => s.mutualMatch)

    return (
      <div className="min-h-screen bg-lime-300 p-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Header */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-6 text-center shadow-[8px_8px_0px_#8b5cf6]">
            <Trophy className="w-12 h-12 mx-auto mb-2 text-yellow-500" strokeWidth={3} />
            <h1 className="font-bebas text-6xl uppercase text-slate-900">Results</h1>
          </div>

          {/* Mutual Matches */}
          {mutualMatches.length > 0 && (
            <div className="bg-pink-400 rounded-2xl border-4 border-slate-900 p-6 text-center shadow-[4px_4px_0px_#1e293b]">
              <Heart className="w-10 h-10 mx-auto mb-2 text-white" strokeWidth={3} fill="white" />
              <h2 className="font-bebas text-3xl uppercase text-white mb-2">It&apos;s a Match!</h2>
              {mutualMatches.map(s => (
                <p key={s.name} className="font-inter text-lg text-white font-bold">
                  {s.name} & {s.mutualPartner}
                </p>
              ))}
            </div>
          )}

          {/* Scoreboard */}
          <div className="space-y-3">
            {scores.map((entry, i) => (
              <div
                key={entry.name}
                className={`bg-white rounded-2xl border-4 border-slate-900 p-4 flex items-center gap-4 ${
                  i === 0 ? 'shadow-[4px_4px_0px_#eab308]' : 'shadow-[4px_4px_0px_#1e293b]'
                }`}
              >
                <div className={`w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center font-bebas text-2xl ${
                  i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-orange-400' : 'bg-white'
                }`}>
                  {i === 0 ? <Crown className="w-6 h-6" strokeWidth={3} /> : i + 1}
                </div>

                <div className="flex-1">
                  <div className="font-inter font-bold text-lg text-slate-900">
                    {entry.name}
                    {entry.name === playerName && <span className="text-sm text-slate-500 ml-2">(you)</span>}
                  </div>
                  <div className="font-inter text-sm text-slate-500">
                    {entry.likePoints > 0 && <span>{entry.likePoints}pts likes</span>}
                    {entry.favoritePoints > 0 && <span> + {entry.favoritePoints}pts fav</span>}
                    {entry.mutualMatch && <span> (mutual!)</span>}
                  </div>
                </div>

                <div className="font-bebas text-3xl text-slate-900">
                  {entry.total}
                </div>
              </div>
            ))}
          </div>

          {/* Play Again */}
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
        </div>
      </div>
    )
  }

  // FAVORITE PICK PHASE
  if (gameState === 'favorite') {
    return (
      <div className="min-h-screen bg-lime-300 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-6 mb-6 text-center shadow-[8px_8px_0px_#ec4899]">
            <h1 className="font-bebas text-5xl uppercase text-slate-900 mb-2">Pick Your Favorite!</h1>
            <p className="font-inter text-lg text-slate-700">Who had the best profile?</p>
            {favoriteEndTime && (
              <div className="mt-3">
                <CountdownTimer endTime={favoriteEndTime} onExpired={handleFavoriteExpired} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {profiles
              .filter(p => p.id !== playerName)
              .map((profile) => (
                <button
                  key={profile.id}
                  disabled={hasPickedMatch}
                  onClick={() => sendFavoritePick(profile.id)}
                  className={`bg-white rounded-2xl border-4 border-slate-900 overflow-hidden text-left transition-all ${
                    hasPickedMatch
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-[6px_6px_0px_#1e293b] hover:-translate-y-1 active:shadow-none active:translate-y-0'
                  }`}
                >
                  <div className="p-4">
                    <img
                      src={profile.imageUrl}
                      alt={profile.name}
                      className="w-full aspect-square object-contain rounded-xl border-4 border-slate-900 bg-white"
                    />
                  </div>

                  <div className="px-4 pb-4">
                    <h3 className="font-inter text-2xl font-bold text-slate-900 mb-2">{profile.name}</h3>
                    <p className="font-inter text-sm text-slate-700 line-clamp-2">{profile.bio}</p>
                  </div>
                </button>
              ))}
          </div>

          {hasPickedMatch && (
            <div className="mt-6 text-center">
              <div className="bg-green-400 text-white font-bold text-xl py-4 px-8 rounded-xl border-4 border-slate-900 inline-block">
                Favorite Picked! Waiting for results...
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // LOADING / PRELOADING
  if (!currentProfile || profiles.length === 0 || !imagesPreloaded) {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-8 text-center">
            <div className="animate-pulse text-6xl mb-4">&#x23F3;</div>
            <h2 className="font-bebas text-4xl uppercase text-slate-900 mb-2">
              {profiles.length > 0 && !imagesPreloaded ? 'Loading Images...' : 'Loading...'}
            </h2>
            <p className="font-inter text-slate-700">
              {profiles.length > 0 && !imagesPreloaded ? 'Preparing the showcase' : 'Waiting for profiles'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentProfile.id === playerName

  // SHOWCASE PHASE - Profile card + voting
  return (
    <div className="min-h-screen bg-lime-300 flex flex-col p-4">
      {/* Header with progress and timer */}
      <div className="max-w-md mx-auto w-full mb-4">
        <div className="bg-white rounded-2xl border-4 border-slate-900 p-4 flex justify-between items-center shadow-[4px_4px_0px_#1e293b]">
          <span className="font-bebas text-3xl uppercase text-slate-900">Showcase</span>
          <div className="flex items-center gap-3">
            {timerEndTime && (
              <CountdownTimer endTime={timerEndTime} />
            )}
            <span className="font-inter font-bold text-lg bg-slate-900 text-white px-4 py-2 rounded-full">
              {showcaseIndex + 1} / {profiles.length}
            </span>
          </div>
        </div>
      </div>

      {isOwnProfile ? (
        /* Own profile being shown */
        <div className="max-w-md mx-auto w-full flex-1 flex items-center">
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-12 text-center shadow-[8px_8px_0px_#1e293b] w-full">
            <div className="text-8xl mb-6">&#x1F31F;</div>
            <h2 className="font-bebas text-6xl uppercase text-slate-900 mb-4">It&apos;s Your Turn!</h2>
            <p className="font-inter text-slate-700 text-xl">Your profile is being shown</p>
          </div>
        </div>
      ) : (
        <>
          {/* Profile Card */}
          <div className="max-w-md mx-auto w-full flex-1">
            <div className="bg-white rounded-2xl border-4 border-slate-900 overflow-hidden shadow-[8px_8px_0px_#ec4899]">
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

          {/* Vote Buttons - side by side */}
          <div className="max-w-md mx-auto w-full mt-4">
            {hasVoted ? (
              <div className="text-center">
                <div className="bg-white text-slate-900 font-bold text-xl py-4 px-8 rounded-2xl border-4 border-slate-900 inline-block shadow-[4px_4px_0px_#1e293b]">
                  Vote Recorded!
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => sendVote('dislike')}
                  className="flex-1 py-6 rounded-2xl border-4 border-slate-900 font-bold text-2xl uppercase transition-all bg-red-400 text-white hover:bg-red-500 hover:shadow-[4px_4px_0px_#1e293b] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                  <HeartCrack className="w-10 h-10 mx-auto mb-1" strokeWidth={3} />
                  Nope
                </button>
                <button
                  onClick={() => sendVote('like')}
                  className="flex-1 py-6 rounded-2xl border-4 border-slate-900 font-bold text-2xl uppercase transition-all bg-green-400 text-white hover:bg-green-500 hover:shadow-[4px_4px_0px_#1e293b] active:shadow-none active:translate-x-1 active:translate-y-1"
                >
                  <Heart className="w-10 h-10 mx-auto mb-1" strokeWidth={3} fill="currentColor" />
                  Like
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
