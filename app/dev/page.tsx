'use client';

import { useState } from 'react';
import { JoinPage } from '../components/JoinPage';
import { LobbyPage } from '../components/LobbyPage';
import { PreProfilePage } from '../components/PreProfilePage';
import { ProfilePage } from '../components/ProfilePage';
import { VotingPage } from '../components/VotingPage';

const stages = ['join', 'lobby', 'preprofile', 'profile', 'voting'] as const;
type Stage = typeof stages[number];

export default function DevPage() {
  const [stage, setStage] = useState<Stage>('join');
  const [toolbarOpen, setToolbarOpen] = useState(true);

  // Mock data
  const [roomCode, setRoomCode] = useState('ABCD');
  const [playerName, setPlayerName] = useState('John');
  const [profileName, setProfileName] = useState('Snail President');
  const [profileBio, setProfileBio] = useState('A confident snail running for president');
  const [drawingSubmitted, setDrawingSubmitted] = useState(false);
  const [drawingCompleted, setDrawingCompleted] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [drawnImageUrl, setDrawnImageUrl] = useState('');
  const [error] = useState('');

  const mockGameData = {
    host: 'John',
    players: [
      { name: 'John', score: 0 },
      { name: 'Sarah', score: 0 },
      { name: 'Mike', score: 0 },
    ],
    gameState: 'lobby'
  };

  const noop = () => {};

  return (
    <>
      {/* Floating dev toolbar */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50">
        {toolbarOpen ? (
          <div className="bg-slate-900 text-white rounded-lg px-2 py-1.5 flex items-center gap-1 shadow-xl">
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStage(s);
                  setDrawingSubmitted(false);
                  setDrawingCompleted(false);
                  setProfileSubmitted(false);
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold uppercase transition-colors ${
                  stage === s
                    ? 'bg-lime-400 text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setToolbarOpen(false)}
              className="ml-1 text-slate-500 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setToolbarOpen(true)}
            className="bg-slate-900 text-lime-400 rounded-lg px-3 py-1.5 text-xs font-bold shadow-xl hover:bg-slate-800"
          >
            DEV
          </button>
        )}
      </div>

      {/* Full-screen component render */}
      {stage === 'join' && (
        <JoinPage
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onJoin={() => setStage('lobby')}
          onCreateGame={() => setStage('lobby')}
          isLoading={false}
          error={error}
        />
      )}

      {stage === 'lobby' && (
        <LobbyPage
          roomCode={roomCode}
          gameData={mockGameData}
          playerName={playerName}
          onStartGame={() => setStage('preprofile')}
          onLeaveGame={() => setStage('join')}
        />
      )}

      {stage === 'preprofile' && (
        <PreProfilePage
          onSubmitIdeas={() => setDrawingSubmitted(true)}
          preProfileSubmitted={drawingSubmitted}
          error={error}
          roundEndTime={new Date(Date.now() + 60000)}
          onAutoSubmit={() => setDrawingSubmitted(true)}
        />
      )}

      {stage === 'profile' && (
        <ProfilePage
          assignedPersona="A very confident snail"
          assignedQuirk="running for president"
          profileName={profileName}
          setProfileName={setProfileName}
          profileBio={profileBio}
          setProfileBio={setProfileBio}
          onDrawingComplete={(url) => { setDrawnImageUrl(url); setDrawingCompleted(true); }}
          onSubmitProfile={() => setProfileSubmitted(true)}
          drawingCompleted={drawingCompleted}
          drawnImageUrl={drawnImageUrl}
          profileSubmitted={profileSubmitted}
          error={error}
          roomCode={roomCode}
          playerName={playerName}
          profileEndTime={new Date(Date.now() + 120000)}
          onAutoSubmitProfile={() => setProfileSubmitted(true)}
        />
      )}

      {stage === 'voting' && (
        <VotingPage
          roomCode={roomCode}
          playerName={playerName}
          isHost={true}
          players={mockGameData.players}
          onVotingComplete={noop}
          onPlayAgain={() => setStage('lobby')}
        />
      )}
    </>
  );
}
