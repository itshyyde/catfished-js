'use client';

import { useState } from 'react';
import { JoinPage } from '../components/JoinPage';
import { LobbyPage } from '../components/LobbyPage';
import { PreProfilePage } from '../components/PreProfilePage';
import { ProfilePage } from '../components/ProfilePage';

export default function DevPage() {
  const [currentStage, setCurrentStage] = useState('join');
  
  // Mock data for testing
  const mockGameData = {
    host: 'John',
    players: [
      { name: 'John', score: 0 },
      { name: 'Sarah', score: 0 },
      { name: 'Mike', score: 0 },
    ],
    gameState: 'lobby'
  };

  const mockAssignedPrompts = {
    assignedPersona: 'A very confident snail',
    assignedQuirk: 'running for president'
  };

  // Mock state for testing
  const [roomCode, setRoomCode] = useState('ABCD');
  const [playerName, setPlayerName] = useState('John');
  const [profileName, setProfileName] = useState('Snail President');
  const [profileBio, setProfileBio] = useState('A confident snail running for president');
  const [drawingSubmitted, setDrawingSubmitted] = useState(false);
  const [drawingCompleted, setDrawingCompleted] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [drawnImageUrl, setDrawnImageUrl] = useState('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzAwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1vY2sgRHJhd2luZzwvdGV4dD48L3N2Zz4=');
  const [error, setError] = useState('');

  const handleJoin = () => {
    console.log('Mock join clicked');
    setCurrentStage('lobby');
  };

  const handleStartGame = () => {
    console.log('Mock start game clicked');
    setCurrentStage('drawing');
  };

  const handleSubmitIdeas = () => {
    console.log('Mock submit ideas clicked');
    setDrawingSubmitted(true);
  };

  const handleDrawingComplete = (imageUrl: string) => {
    console.log('Mock drawing complete');
    setDrawnImageUrl(imageUrl);
    setDrawingCompleted(true);
  };

  const handleSubmitProfile = () => {
    console.log('Mock submit profile clicked');
    setProfileSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Stage Selector */}
        <div className="mb-8 bg-white rounded-xl p-6 border-4 border-gray-800 shadow-lg">
          <h1 className="text-3xl font-bold text-gray-800 mb-4 text-center">🎨 UI Development Mode</h1>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => setCurrentStage('join')}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${
                currentStage === 'join' 
                  ? 'bg-blue-500 text-white border-blue-600' 
                  : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
              }`}
            >
              🎮 Join Page
            </button>
            <button
              onClick={() => setCurrentStage('lobby')}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${
                currentStage === 'lobby' 
                  ? 'bg-blue-500 text-white border-blue-600' 
                  : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
              }`}
            >
              🎉 Lobby Page
            </button>
            <button
              onClick={() => setCurrentStage('preprofile')}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${
                currentStage === 'preprofile' 
                  ? 'bg-blue-500 text-white border-blue-600' 
                  : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
              }`}
            >
              🤔 Pre-Profile Stage
            </button>
            <button
              onClick={() => setCurrentStage('profile')}
              className={`px-4 py-2 rounded-lg font-bold border-2 transition-all ${
                currentStage === 'profile' 
                  ? 'bg-blue-500 text-white border-blue-600' 
                  : 'bg-gray-200 text-gray-700 border-gray-400 hover:bg-gray-300'
              }`}
            >
              🎨 Profile Stage (Drawing + Bio)
            </button>
          </div>
          
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Current Stage: <span className="font-bold">{currentStage}</span></p>
            <p className="mt-2">Use the buttons above to switch between different UI stages for development and testing.</p>
          </div>
        </div>

        {/* Component Renderer */}
        <div className="bg-white rounded-xl border-4 border-gray-800 shadow-lg overflow-hidden">
          {currentStage === 'join' && (
            <JoinPage
              roomCode={roomCode}
              setRoomCode={setRoomCode}
              playerName={playerName}
              setPlayerName={setPlayerName}
              onJoin={handleJoin}
              isLoading={false}
              error={error}
            />
          )}
          
          {currentStage === 'lobby' && (
            <LobbyPage
              roomCode={roomCode}
              gameData={mockGameData}
              playerName={playerName}
              onStartGame={handleStartGame}
            />
          )}
          
          {currentStage === 'preprofile' && (
            <PreProfilePage
              onSubmitIdeas={handleSubmitIdeas}
              preProfileSubmitted={drawingSubmitted}
              error={error}
            />
          )}
          
          {currentStage === 'profile' && (
            <ProfilePage
              assignedPersona={mockAssignedPrompts.assignedPersona}
              assignedQuirk={mockAssignedPrompts.assignedQuirk}
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
