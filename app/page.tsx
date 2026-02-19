'use client';

import { useState, useEffect, useRef } from 'react';
import { db, ensureAuth } from '../lib/firebase';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot, collection } from 'firebase/firestore';
import { JoinPage } from './components/JoinPage';
import { LobbyPage } from './components/LobbyPage';
import { PreProfilePage } from './components/PreProfilePage';
import { ProfilePage } from './components/ProfilePage';
import { VotingPage } from './components/VotingPage';
import { MuteToggle } from './components/MuteToggle';
import { ServerTimeProvider, useServerTime } from './components/ServerTimeProvider';
import { useGameLoop } from './hooks/useGameLoop';
import { sfx } from '../lib/sfx';

interface Player {
  name: string;
  score: number;
}

interface GameData {
  gameState: string;
  players: Player[];
  host: string;
  currentRound?: number;
}

interface GameSession {
  roomCode: string;
  playerName: string;
}

// Helper functions for localStorage
const getSession = (): GameSession | null => {
  if (typeof window === 'undefined') return null;
  const session = localStorage.getItem('gameSession');
  return session ? JSON.parse(session) : null;
};

const setSession = (session: GameSession) => {
  localStorage.setItem('gameSession', JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem('gameSession');
};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const getLastPlayerName = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('lastPlayerName') || '';
};

const setLastPlayerName = (name: string) => {
  localStorage.setItem('lastPlayerName', name);
};


function ForceNextPhaseButton({ onForce, isHost }: { onForce: () => void; isHost: boolean }) {
  if (!isHost) return null

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={onForce}
        className="bg-yellow-400 text-slate-900 font-inter text-xs font-bold uppercase px-3 py-2 rounded-lg border-2 border-slate-900 shadow-[2px_2px_0px_#1e293b] hover:bg-yellow-300 active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1"
      >
        <span>⚡</span>
        <span>Force Next Phase</span>
      </button>
    </div>
  );
}

function LeaveGameButton({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={onLeave}
        className="bg-white text-red-500 font-inter text-xs font-bold uppercase px-3 py-2 rounded-lg border-2 border-slate-300 opacity-50 hover:opacity-100 hover:border-red-500 transition-all"
      >
        Leave Game
      </button>
    </div>
  );
}

export default function HomePage() {
  const [roomCode, setRoomCode] = useState('');
  return (
    <ServerTimeProvider roomCode={roomCode}>
      <HomePageInner roomCode={roomCode} setRoomCode={setRoomCode} />
    </ServerTimeProvider>
  );
}

function HomePageInner({ roomCode, setRoomCode }: { roomCode: string; setRoomCode: (v: string) => void }) {
  const { serverNow } = useServerTime();
  // Dev mode check
  const isDevMode = typeof window !== 'undefined' && window.location.search.includes('dev=true');
  const devStage = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('stage') : null;
  const [playerName, setPlayerName] = useState(''); // Will be set after client-side mount
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [gameData, setGameData] = useState<GameData | null>(null);
  const [view, setView] = useState<'join' | 'lobby' | 'drawing' | 'profile' | 'voting'>('join');

  // State for the drawing (pre-profile) phase
  const [drawingSubmitted, setDrawingSubmitted] = useState(false);

  // State for the profile drawing phase
  const [assignedPersona, setAssignedPersona] = useState('');
  const [assignedQuirk, setAssignedQuirk] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [drawingCompleted, setDrawingCompleted] = useState(false);
  const [drawnImageUrl, setDrawnImageUrl] = useState<string>('');
  const canvasRef = useRef<any>(null);
  const [roundEndTime, setRoundEndTime] = useState<Date | null>(null);
  const [profileEndTime, setProfileEndTime] = useState<Date | null>(null);

  // ============================================================================
  // HOST-DRIVEN GAME LOOP
  // Only the Host can write to gameState - all others are read-only listeners
  // ============================================================================
  const isHost = gameData?.host === playerName
  const { forceNextPhase } = useGameLoop(roomCode, playerName, isHost, gameData)


  // Dev mode logic - override normal flow for UI development
  if (isDevMode && devStage) {
    // Mock data for dev mode
    const mockGameData = {
      host: 'John',
      players: [
        { name: 'John', score: 0 },
        { name: 'Sarah', score: 0 },
        { name: 'Mike', score: 0 },
      ],
      gameState: devStage === 'lobby' ? 'lobby' : devStage === 'drawing' ? 'pre-profile' : 'profile'
    };

    const mockAssignedPrompts = {
      assignedPersona: 'A very confident snail',
      assignedQuirk: 'running for president'
    };

    // Override state for dev mode
    if (devStage === 'join') {
      return (
        <JoinPage
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onJoin={() => console.log('Dev mode join clicked')}
          onCreateGame={() => console.log('Dev mode create clicked')}
          isLoading={false}
          error={error}
        />
      );
    }

    if (devStage === 'lobby') {
      return (
        <LobbyPage
          roomCode="ABCD"
          gameData={mockGameData}
          playerName="John"
          onStartGame={() => console.log('Dev mode start game clicked')}
          onLeaveGame={() => console.log('Dev mode leave game')}
        />
      );
    }

    if (devStage === 'preprofile') {
      return (
        <PreProfilePage
          onSubmitIdeas={() => console.log('Dev mode submit ideas clicked')}
          preProfileSubmitted={false}
          error=""
        />
      );
    }

    if (devStage === 'profile') {
      return (
        <ProfilePage
          assignedPersona={mockAssignedPrompts.assignedPersona}
          assignedQuirk={mockAssignedPrompts.assignedQuirk}
          profileName={profileName}
          setProfileName={setProfileName}
          profileBio={profileBio}
          setProfileBio={setProfileBio}
          onDrawingComplete={(imageUrl) => console.log('Dev mode drawing complete', imageUrl)}
          onSubmitProfile={() => console.log('Dev mode submit profile clicked')}
          drawingCompleted={true}
          drawnImageUrl="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzAwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1vY2sgRHJhd2luZzwvdGV4dD48L3N2Zz4="
          profileSubmitted={false}
          error=""
          roomCode="ABCD"
          playerName="John"
        />
      );
    }

    if (devStage === 'voting') {
      return (
        <VotingPage
          roomCode="ABCD"
          playerName="John"
          isHost={true}
          players={[{ name: 'John', score: 0 }, { name: 'Sarah', score: 0 }]}
          onVotingComplete={() => console.log('Dev mode voting complete')}
          onPlayAgain={() => console.log('Dev mode play again')}
        />
      );
    }
  }

  // Preload SFX on mount
  useEffect(() => {
    sfx.preloadAll()
  }, [])

  // This effect runs ONCE when the app loads to check for a reconnect
  useEffect(() => {
    const checkAndRestoreSession = async () => {
      // Authenticate first
      try {
        await ensureAuth();
        console.log('✅ Authenticated on app load');
      } catch (error) {
        console.error('❌ Failed to authenticate:', error);
        return;
      }

      // Pre-fill with last used name
      setPlayerName(getLastPlayerName());

      const session = getSession();
      if (session?.roomCode && session?.playerName) {
        // We have a session, let's see if it's still valid
        const roomRef = doc(db, "rooms", session.roomCode);
        try {
          const docSnap = await getDoc(roomRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const isPlayerInRoom = data.players?.some((p: Player) => p.name === session.playerName);

            if (isPlayerInRoom) {
              // The room exists and the player is still in it. Let's reconnect!
              console.log('✅ Restoring session for room:', session.roomCode);
              setRoomCode(session.roomCode);
              setPlayerName(session.playerName);

              // Restore to the correct view based on game state
              const gameState = data.gameState;
              if (gameState === 'lobby') {
                setView('lobby');
              } else if (gameState === 'pre-profile') {
                setView('drawing');
              } else if (gameState === 'profile') {
                setView('profile');
              } else if (gameState === 'showcase' || gameState === 'voting' || gameState === 'favorite' || gameState === 'results') {
                setView('voting');
              } else {
                setView('lobby'); // Default to lobby if unknown state
              }
            } else {
              // Player not in room anymore
              console.log('🚫 Player not in room, clearing session...');
              clearSession();
              setError('You were removed from the room or the game ended.');
              setView('join');
              setRoomCode('');
            }
          } else {
            // The room doesn't exist anymore (host disconnected)
            console.log('🚫 Room no longer exists, clearing session...');
            clearSession();
            setError('The room has been closed.');
            setView('join');
            setRoomCode('');
          }
        } catch (err) {
          console.error('❌ Failed to restore session:', err);
          clearSession();
          setError('Failed to reconnect to the room.');
          setView('join');
          setRoomCode('');
        }
      }
    };
    checkAndRestoreSession();
  }, []); // The empty array [] means this runs only once on mount

  // This effect listens for real-time game updates once in the lobby, drawing, profile, or voting
  useEffect(() => {
    if ((view !== 'lobby' && view !== 'drawing' && view !== 'profile' && view !== 'voting') || !roomCode) return;

    const roomRef = doc(db, "rooms", roomCode);
    const unsubscribe = onSnapshot(
      roomRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GameData & { roundEndTime?: unknown; profileEndTime?: unknown };
          setGameData(data);

          // Track timer end times from room doc
          if (data.roundEndTime) {
            const ret = (data.roundEndTime as { toDate?: () => Date });
            setRoundEndTime(ret.toDate ? ret.toDate() : new Date(data.roundEndTime as string));
          }
          if (data.profileEndTime) {
            const pet = (data.profileEndTime as { toDate?: () => Date });
            setProfileEndTime(pet.toDate ? pet.toDate() : new Date(data.profileEndTime as string));
          }

          // Check if game state changed to pre-profile (drawing phase) — from lobby or voting (next round)
          if (data.gameState === 'pre-profile' && (view === 'lobby' || view === 'voting')) {
            sfx.play('gameStart');
            setView('drawing');
            setDrawingSubmitted(false);
            // Reset profile state for new round
            setProfileSubmitted(false);
            setDrawingCompleted(false);
            setDrawnImageUrl('');
            setAssignedPersona('');
            setAssignedQuirk('');
            setProfileName('');
            setProfileBio('');
          }

          // Check if game state changed to profile (profile creation phase)
          if (data.gameState === 'profile' && view === 'drawing') {
            setView('profile');
            setProfileSubmitted(false);
            setDrawingCompleted(false);
            setDrawnImageUrl('');
            fetchAssignedPrompts();
          }

          // Check if game state changed to showcase/favorite/results phases
          if ((data.gameState === 'showcase' || data.gameState === 'favorite' || data.gameState === 'results') && view === 'profile') {
            setView('voting');
          }

          // Play again: return to lobby from voting
          if (data.gameState === 'lobby' && view === 'voting') {
            setView('lobby');
            setDrawingSubmitted(false);
            setProfileSubmitted(false);
            setDrawingCompleted(false);
            setDrawnImageUrl('');
          }
        } else {
          // Room was deleted (host disconnected)
          console.log('🚨 Room deleted - host disconnected');
          setError("Host disconnected. The room has been closed.");
          setView('join');
          setRoomCode('');
          clearSession();
        }
      },
      (error) => {
        // Handle errors (permissions, network issues, etc.)
        console.error('❌ Error listening to room:', error);
        setError("Lost connection to room. Please rejoin.");
        setView('join');
        setRoomCode('');
        clearSession();
      }
    );

    return () => unsubscribe();
  }, [view, roomCode]);

  const fetchAssignedPrompts = async () => {
    const roomRef = doc(db, "rooms", roomCode);
    const assignmentRef = doc(roomRef, "assignments", playerName);

    try {
      const assignmentSnap = await getDoc(assignmentRef);
      if (assignmentSnap.exists()) {
        const data = assignmentSnap.data();
        setAssignedPersona(data.assignedPersona || '');
        setAssignedQuirk(data.assignedQuirk || '');
        setProfileName(data.assignedPersona || ''); // Pre-fill with assigned persona
      }
    } catch (err) {
      console.error("Failed to fetch assigned prompts:", err);
    }
  };

  // Auto-fetch prompts when entering profile view (handles page refresh / session restore)
  useEffect(() => {
    if (view === 'profile' && roomCode && playerName && !assignedPersona) {
      fetchAssignedPrompts();
    }
  }, [view, roomCode, playerName]);

  // Auto-restore drawing URL on reconnect (handles page refresh / session restore)
  useEffect(() => {
    if (view === 'profile' && roomCode && playerName && !drawnImageUrl) {
      const restoreDrawing = async () => {
        try {
          const drawingRef = doc(db, 'rooms', roomCode, 'drawings', playerName);
          const drawingSnap = await getDoc(drawingRef);
          if (drawingSnap.exists()) {
            const url = drawingSnap.data().url;
            if (url) {
              setDrawnImageUrl(url);
              setDrawingCompleted(true);
            }
          }
        } catch (err) {
          console.error('Failed to restore drawing:', err);
        }
      };
      restoreDrawing();
    }
  }, [view, roomCode, playerName]);

  // Auto-remove player when they close the tab
  useEffect(() => {
    if (view !== 'lobby' || !roomCode || !playerName) return;

    const handleBeforeUnload = () => {
      // This runs when the player closes the tab
      const roomRef = doc(db, "rooms", roomCode);
      // Find the exact player object from gameData to remove (score may not be 0)
      const currentPlayer = gameData?.players?.find(p => p.name === playerName);
      if (currentPlayer) {
        updateDoc(roomRef, {
          players: arrayRemove(currentPlayer)
        });
      } else {
        updateDoc(roomRef, {
          players: arrayRemove({ name: playerName, score: 0 })
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [view, roomCode, playerName, gameData]);

  // ============================================================================
  // NOTE: Phase transitions (pre-profile → profile, profile → showcase) are now
  // handled by the useGameLoop hook with Host-only write logic. This eliminates
  // the race conditions that caused "Waiting for players" deadlocks.
  // ============================================================================

  const handleJoinGame = async () => {
    const upperRoomCode = roomCode.toUpperCase().trim();
    if (!upperRoomCode || !playerName) {
      setError('Please fill out all fields.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Ensure user is authenticated before accessing Firestore
      await ensureAuth();

      const roomRef = doc(db, "rooms", upperRoomCode);
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        const currentPlayers = docSnap.data().players || [];

        if (currentPlayers.some((p: Player) => p.name === playerName)) {
          setError("A player with that name is already in the room.");
          return;
        }

        await updateDoc(roomRef, {
          players: arrayUnion({ name: playerName, score: 0 })
        });

        if (currentPlayers.length === 0) {
          await updateDoc(roomRef, { host: playerName });
        }

        // Save the successful session
        setLastPlayerName(playerName);
        setSession({ roomCode: upperRoomCode, playerName });
        sfx.play('join');
        setView('lobby');
      } else {
        setError("That room doesn't exist. Check your code!");
      }
    } catch (err) {
      console.error(err);
      setError("Could not connect to the game. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGame = async () => {
    if (!playerName) {
      setError('Please enter your name.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await ensureAuth();

      // Generate a unique room code
      let code = generateRoomCode();
      let attempts = 0;
      while (attempts < 10) {
        const roomRef = doc(db, 'rooms', code);
        const existing = await getDoc(roomRef);
        if (!existing.exists()) break;
        code = generateRoomCode();
        attempts++;
      }

      const roomRef = doc(db, 'rooms', code);
      await setDoc(roomRef, {
        gameState: 'lobby',
        players: [{ name: playerName, score: 0 }],
        host: playerName,
        showcaseIndex: 0,
        showcaseStarted: false,
        showcaseReadyPlayers: [],
        currentRound: 1,
        createdAt: new Date(),
      });

      setRoomCode(code);
      setLastPlayerName(playerName);
      setSession({ roomCode: code, playerName });
      sfx.play('join');
      setView('lobby');
    } catch (err) {
      console.error(err);
      setError('Failed to create game. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGame = async () => {
    try {
      await ensureAuth();
      const roomRef = doc(db, "rooms", roomCode);
      const docSnap = await getDoc(roomRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedPlayers = data.players?.filter((p: Player) => p.name !== playerName) || [];
        if (updatedPlayers.length === 0) {
          // Last player leaving — could delete room, but just leave it
          await updateDoc(roomRef, { players: updatedPlayers });
        } else {
          // If leaving player is host, transfer host to next player
          const updates: Record<string, unknown> = { players: updatedPlayers };
          if (data.host === playerName) {
            updates.host = updatedPlayers[0].name;
          }
          await updateDoc(roomRef, updates);
        }
      }
    } catch (err) {
      console.error('Failed to leave game:', err);
    }
    clearSession();
    setView('join');
    setRoomCode('');
    setGameData(null);
    setError('');
  };

  const handleStartGame = async () => {
    if (gameData?.host !== playerName) return;

    const roomRef = doc(db, "rooms", roomCode);

    // Calculate the end time 60 seconds from now
    const endTime = new Date(serverNow());
    endTime.setSeconds(endTime.getSeconds() + 60); // <-- Changed from 30 to 60

    await updateDoc(roomRef, {
      gameState: 'pre-profile', // <-- Use the new state name
      roundEndTime: endTime,    // <-- Set the master clock
      currentRound: 1,
      assignmentsCreated: false, // Reset so host detection effect runs fresh
    });
  };

  if (view === 'join') {
    return (
      <JoinPage
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        playerName={playerName}
        setPlayerName={setPlayerName}
        onJoin={handleJoinGame}
        onCreateGame={handleCreateGame}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  if (view === 'lobby') {
    return (
      <>
        <LobbyPage
          roomCode={roomCode}
          gameData={gameData}
          playerName={playerName}
          onStartGame={handleStartGame}
          onLeaveGame={handleLeaveGame}
        />
        <MuteToggle />
      </>
    );
  }

  if (view === 'drawing') {
    const handleSubmitIdeas = async () => {
      const persona = (document.getElementById('persona') as HTMLInputElement)?.value;
      const quirk = (document.getElementById('quirk') as HTMLInputElement)?.value;

      if (!persona || !quirk) {
        setError('Please fill out both fields.');
        return;
      }

      try {
        await ensureAuth();

        const roomRef = doc(db, "rooms", roomCode);
        const submissionRef = doc(roomRef, "submissions", playerName);

        await updateDoc(submissionRef, {
          persona,
          quirk,
          submittedAt: new Date()
        }).catch(async () => {
          await setDoc(submissionRef, {
            persona,
            quirk,
            submittedAt: new Date()
          });
        });

        setError('');
        sfx.play('submit');
        setDrawingSubmitted(true);
      } catch (err) {
        console.error('Failed to submit:', err);
        setError('Failed to submit. Please try again.');
      }
    };

    const handleAutoSubmitIdeas = async () => {
      if (drawingSubmitted) return;
      const persona = (document.getElementById('persona') as HTMLInputElement)?.value || 'Mystery Person';
      const quirk = (document.getElementById('quirk') as HTMLInputElement)?.value || 'being mysterious';

      try {
        await ensureAuth();
        const roomRef = doc(db, "rooms", roomCode);
        const submissionRef = doc(roomRef, "submissions", playerName);
        await setDoc(submissionRef, {
          persona,
          quirk,
          submittedAt: new Date()
        });
        setError('');
        setDrawingSubmitted(true);
      } catch (err) {
        console.error('Auto-submit failed:', err);
      }
    };

    return (
      <>
        <PreProfilePage
          onSubmitIdeas={handleSubmitIdeas}
          preProfileSubmitted={drawingSubmitted}
          error={error}
          roundEndTime={roundEndTime}
          onAutoSubmit={handleAutoSubmitIdeas}
          currentRound={gameData?.currentRound || 1}
        />
        <ForceNextPhaseButton onForce={forceNextPhase} isHost={isHost} />
        <LeaveGameButton onLeave={handleLeaveGame} />
        <MuteToggle />
      </>
    );
  }

  if (view === 'profile') {
    const handleDrawingComplete = (imageUrl: string) => {
      setDrawnImageUrl(imageUrl);
      setDrawingCompleted(true);
    };

    const handleSubmitProfile = async () => {
      if (!profileName || !profileBio) {
        setError('Please fill out all fields.');
        return;
      }

      try {
        const roomRef = doc(db, "rooms", roomCode);
        const profileRef = doc(roomRef, "profiles", playerName);

        await setDoc(profileRef, {
          name: profileName,
          bio: profileBio,
          imageUrl: drawnImageUrl,
          persona: assignedPersona,
          quirk: assignedQuirk,
          likes: [], // Initialize empty likes array
          submittedAt: new Date()
        });

        setError('');
        sfx.play('submit');
        setProfileSubmitted(true);
      } catch (err) {
        console.error('Failed to submit profile:', err);
        setError('Failed to submit profile. Please try again.');
      }
    };

    const handleAutoSubmitProfile = async () => {
      if (profileSubmitted) return;

      try {
        await ensureAuth();
        const roomRef = doc(db, "rooms", roomCode);
        const profileRef = doc(roomRef, "profiles", playerName);

        await setDoc(profileRef, {
          name: profileName.trim() || assignedPersona || 'Mystery Person',
          bio: profileBio.trim() || 'Being mysterious...',
          imageUrl: drawnImageUrl || '',
          persona: assignedPersona,
          quirk: assignedQuirk,
          likes: [],
          submittedAt: new Date()
        });

        setError('');
        setProfileSubmitted(true);
      } catch (err) {
        console.error('Auto-submit profile failed:', err);
      }
    };

    return (
      <>
        <ProfilePage
          assignedPersona={assignedPersona}
          assignedQuirk={assignedQuirk}
          profileName={profileName}
          setProfileName={setProfileName}
          profileBio={profileBio}
          setProfileBio={setProfileBio}
          onDrawingComplete={handleDrawingComplete}
          onSubmitProfile={handleSubmitProfile}
          drawingCompleted={drawingCompleted}
          drawnImageUrl={drawnImageUrl}
          profileSubmitted={profileSubmitted}
          error={error}
          roomCode={roomCode}
          playerName={playerName}
          profileEndTime={profileEndTime}
          onAutoSubmitProfile={handleAutoSubmitProfile}
        />
        <ForceNextPhaseButton onForce={forceNextPhase} isHost={isHost} />
        <LeaveGameButton onLeave={handleLeaveGame} />
        <MuteToggle />
      </>
    );
  }

  if (view === 'voting') {
    const handleVotingComplete = () => {
      // Voting phase complete, could transition to results or next phase
      console.log('Voting phase completed');
    };

    return (
      <>
        <VotingPage
          roomCode={roomCode}
          playerName={playerName}
          isHost={gameData?.host === playerName}
          players={gameData?.players || []}
          onVotingComplete={handleVotingComplete}
          currentRound={gameData?.currentRound || 1}
          onNextRound={async () => {
            const roomRef = doc(db, 'rooms', roomCode);
            const currentRound = gameData?.currentRound || 1;

            // Calculate round scores
            const profilesRef = collection(db, 'rooms', roomCode, 'profiles');
            const profilesSnap = await getDocs(profilesRef);
            const profilesList = profilesSnap.docs.map(d => ({
              id: d.id,
              ...d.data()
            })) as { id: string; likes?: string[]; favoritePick?: string }[];

            // Calculate round scores for each player
            const roundScores: Record<string, number> = {};
            (gameData?.players || []).forEach(p => { roundScores[p.name] = 0; });

            profilesList.forEach(profile => {
              if (roundScores[profile.id] !== undefined) {
                roundScores[profile.id] += (profile.likes?.length || 0) * 5;
              }
            });
            profilesList.forEach(profile => {
              if (!profile.favoritePick || roundScores[profile.favoritePick] === undefined || roundScores[profile.id] === undefined) return;
              const picked = profilesList.find(p => p.id === profile.favoritePick);
              if (picked?.favoritePick === profile.id) {
                roundScores[profile.id] += 35;
              } else {
                roundScores[profile.favoritePick] += 10;
              }
            });

            // Accumulate scores into players array
            const updatedPlayers = (gameData?.players || []).map(p => ({
              name: p.name,
              score: p.score + (roundScores[p.name] || 0),
            }));

            // Clean subcollections
            const subcollections = ['profiles', 'submissions', 'assignments', 'drawings'];
            for (const sub of subcollections) {
              const colRef = collection(db, 'rooms', roomCode, sub);
              const snapshot = await getDocs(colRef);
              const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
              await Promise.all(deletePromises);
            }

            const endTime = new Date(serverNow());
            endTime.setSeconds(endTime.getSeconds() + 60);

            await updateDoc(roomRef, {
              gameState: 'pre-profile',
              currentRound: currentRound + 1,
              players: updatedPlayers,
              showcaseIndex: 0,
              showcaseStarted: false,
              showcaseReadyPlayers: [],
              assignmentsCreated: false,
              timerEndTime: null,
              favoriteEndTime: null,
              roundEndTime: endTime,
              profileEndTime: null,
            });
          }}
          onPlayAgain={async () => {
            const roomRef = doc(db, 'rooms', roomCode);

            // Calculate final round scores
            const profilesRef = collection(db, 'rooms', roomCode, 'profiles');
            const profilesSnap = await getDocs(profilesRef);
            const profilesList = profilesSnap.docs.map(d => ({
              id: d.id,
              ...d.data()
            })) as { id: string; likes?: string[]; favoritePick?: string }[];

            const roundScores: Record<string, number> = {};
            (gameData?.players || []).forEach(p => { roundScores[p.name] = 0; });

            profilesList.forEach(profile => {
              if (roundScores[profile.id] !== undefined) {
                roundScores[profile.id] += (profile.likes?.length || 0) * 5;
              }
            });
            profilesList.forEach(profile => {
              if (!profile.favoritePick || roundScores[profile.favoritePick] === undefined || roundScores[profile.id] === undefined) return;
              const picked = profilesList.find(p => p.id === profile.favoritePick);
              if (picked?.favoritePick === profile.id) {
                roundScores[profile.id] += 35;
              } else {
                roundScores[profile.favoritePick] += 10;
              }
            });

            // Clean up subcollections from the finished round
            const subcollections = ['profiles', 'submissions', 'assignments', 'drawings'];
            for (const sub of subcollections) {
              const colRef = collection(db, 'rooms', roomCode, sub);
              const snapshot = await getDocs(colRef);
              const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
              await Promise.all(deletePromises);
            }

            // Reset player scores to 0 for new game
            const resetPlayers = (gameData?.players || []).map(p => ({
              name: p.name,
              score: 0,
            }));

            await updateDoc(roomRef, {
              gameState: 'lobby',
              currentRound: 1,
              players: resetPlayers,
              showcaseIndex: 0,
              showcaseStarted: false,
              showcaseReadyPlayers: [],
              assignmentsCreated: false,
              timerEndTime: null,
              favoriteEndTime: null,
              roundEndTime: null,
              profileEndTime: null,
            });
          }}
        />
        <LeaveGameButton onLeave={handleLeaveGame} />
        <MuteToggle />
      </>
    );
  }

  return null;
}
