'use client'

import React, { useEffect, useState } from 'react'
import { Heart, HeartCrack } from 'lucide-react'
import { db, ensureAuth } from '../../lib/firebase'
import { doc, collection, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore'

interface VotingPageProps {
  roomCode: string
  playerName: string
  onVotingComplete: () => void
}

interface Profile {
  id: string
  name: string
  bio: string
  imageUrl: string
  persona: string
  quirk: string
  likes: string[]
  matchPick?: string
}

export function VotingPage({ roomCode, playerName, onVotingComplete }: VotingPageProps) {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [gameState, setGameState] = useState<string>('showcase')
  const [showcaseIndex, setShowcaseIndex] = useState<number>(0)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [hasVoted, setHasVoted] = useState<boolean>(false)
  const [hasPickedMatch, setHasPickedMatch] = useState<boolean>(false)

  // Listen to room state changes
  useEffect(() => {
    const roomRef = doc(db, 'rooms', roomCode)
    const unsubscribe = onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        const newGameState = data.gameState || 'showcase'
        const newShowcaseIndex = data.showcaseIndex ?? 0
        
        // Reset favorite pick flag when entering favorite phase
        if (newGameState === 'favorite' && gameState !== 'favorite') {
          setHasPickedMatch(false)
        }
        
        setGameState(newGameState)
        setShowcaseIndex(newShowcaseIndex)
        
        console.log(`🎮 State: ${newGameState}, Index: ${newShowcaseIndex}`)
      }
    })

    return () => unsubscribe()
  }, [roomCode, gameState])

  // Listen to profiles collection
  useEffect(() => {
    const profilesCollectionRef = collection(db, 'rooms', roomCode, 'profiles')
    const unsubscribe = onSnapshot(profilesCollectionRef, (snapshot) => {
      const profilesList: Profile[] = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name || '',
          bio: data.bio || '',
          imageUrl: data.imageUrl || '',
          persona: data.persona || '',
          quirk: data.quirk || '',
          likes: data.likes || [],
          matchPick: data.matchPick
        }
      })
      setProfiles(profilesList)
    })

    return () => unsubscribe()
  }, [roomCode])

  // Update current profile when showcase index changes
  useEffect(() => {
    if (showcaseIndex >= 0 && showcaseIndex < profiles.length) {
      setCurrentProfile(profiles[showcaseIndex])
      setHasVoted(false) // Reset vote for new profile
      console.log(`📍 Switched to profile ${showcaseIndex + 1}/${profiles.length}`)
    }
  }, [showcaseIndex, profiles.length])

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
      
      setHasVoted(true)
      
    } catch (error) {
      console.error('Error sending vote:', error)
    }
  }

  const sendFavoritePick = async (profileId: string) => {
    if (hasPickedMatch || profileId === playerName) return

    try {
      await ensureAuth()
      
      const myProfileRef = doc(db, 'rooms', roomCode, 'profiles', playerName)
      await updateDoc(myProfileRef, {
        favoritePick: profileId
      })
      
      setHasPickedMatch(true)
      console.log(`💘 Picked ${profileId} as favorite`)
    } catch (error) {
      console.error('Error sending favorite pick:', error)
    }
  }

  // FAVORITE PICK PHASE - Gallery view of all profiles
  if (gameState === 'favorite') {
    return (
      <div className="min-h-screen bg-lime-300 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-6 mb-6 text-center shadow-[8px_8px_0px_#ec4899]">
            <h1 className="font-bebas text-5xl uppercase text-slate-900 mb-2">Pick Your Favorite!</h1>
            <p className="font-inter text-lg text-slate-700">Who was the best overall? (+5 points)</p>
          </div>

          {/* Profile Grid */}
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
                  {/* Profile Image */}
                  <div className="p-4">
                    <img 
                      src={profile.imageUrl} 
                      alt={profile.name}
                      className="w-full h-48 object-contain rounded-xl border-4 border-slate-900 bg-white"
                    />
                  </div>
                  
                  {/* Profile Info */}
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
                ✅ Favorite Picked! Waiting for results...
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // RESULTS PHASE
  if (gameState === 'results') {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-8 text-center shadow-[8px_8px_0px_#8b5cf6]">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="font-bebas text-6xl uppercase text-slate-900 mb-4">Results!</h2>
            <p className="font-inter text-slate-700 text-lg">Check out the final scores!</p>
          </div>
        </div>
      </div>
    )
  }

  // LOADING / WAITING
  if (!currentProfile || profiles.length === 0) {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-8 text-center">
            <div className="animate-pulse text-6xl mb-4">⏳</div>
            <h2 className="font-bebas text-4xl uppercase text-slate-900 mb-2">Loading...</h2>
            <p className="font-inter text-slate-700">Waiting for profiles</p>
          </div>
        </div>
      </div>
    )
  }

  const isOwnProfile = currentProfile.id === playerName

  // SHOWCASE/VOTING PHASE - Players ONLY see voting buttons, NOT the profile content
  // Profile content is ONLY shown on the Unity TV screen
  return (
    <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Header Card - Shows progress */}
        <div className="bg-white rounded-2xl border-4 border-slate-900 p-6 mb-6 text-center shadow-[8px_8px_0px_#1e293b]">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bebas text-3xl uppercase text-slate-900">SHOWCASE</span>
            <span className="font-inter font-bold text-lg bg-slate-900 text-white px-4 py-2 rounded-full">
              {showcaseIndex + 1} / {profiles.length}
            </span>
          </div>
          <p className="font-inter text-slate-700 text-lg">
            Vote on each profile!
          </p>
        </div>
        
        {/* Voting Interface - NO profile content shown here */}
        {isOwnProfile ? (
          <div className="bg-white rounded-2xl border-4 border-slate-900 p-12 text-center shadow-[8px_8px_0px_#1e293b]">
            <div className="text-8xl mb-6">🌟</div>
            <h2 className="font-bebas text-6xl uppercase text-slate-900 mb-4">It&apos;s Your Turn!</h2>
            <p className="font-inter text-slate-700 text-xl">Your profile is on the screen</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Like Button */}
            <button
              onClick={() => sendVote('like')}
              disabled={hasVoted}
              className={`w-full py-16 rounded-3xl border-6 border-slate-900 font-bold text-3xl uppercase transition-all ${
                hasVoted
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-green-400 text-white hover:bg-green-500 hover:shadow-[8px_8px_0px_#1e293b] active:shadow-none active:translate-x-2 active:translate-y-2'
              }`}
            >
              <Heart className="w-20 h-20 mx-auto mb-3" strokeWidth={3} fill={hasVoted ? undefined : "currentColor"} />
              <div>LIKE</div>
            </button>

            {/* Dislike Button */}
            <button
              onClick={() => sendVote('dislike')}
              disabled={hasVoted}
              className={`w-full py-16 rounded-3xl border-6 border-slate-900 font-bold text-3xl uppercase transition-all ${
                hasVoted
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-red-400 text-white hover:bg-red-500 hover:shadow-[8px_8px_0px_#1e293b] active:shadow-none active:translate-x-2 active:translate-y-2'
              }`}
            >
              <HeartCrack className="w-20 h-20 mx-auto mb-3" strokeWidth={3} />
              <div>NOPE</div>
            </button>

            {/* Vote Confirmation */}
            {hasVoted && (
              <div className="text-center mt-6">
                <div className="bg-white text-slate-900 font-bold text-2xl py-4 px-8 rounded-2xl border-4 border-slate-900 inline-block shadow-[4px_4px_0px_#1e293b]">
                  ✅ Vote Recorded!
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
