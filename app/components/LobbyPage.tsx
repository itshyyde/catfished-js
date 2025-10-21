interface Player {
  name: string;
  score: number;
}

interface GameData {
  host: string;
  players: Player[];
  gameState: string;
}

interface LobbyPageProps {
  roomCode: string;
  gameData: GameData | null;
  playerName: string;
  onStartGame: () => void;
}

const playerColors = ['bg-pink-500', 'bg-cyan-400', 'bg-purple-600', 'bg-orange-400', 'bg-lime-500', 'bg-rose-500'];

export function LobbyPage({
  roomCode,
  gameData,
  playerName,
  onStartGame
}: LobbyPageProps) {
  return (
    <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border-4 border-slate-900 relative">
          <div className="absolute -top-4 -right-4 bg-yellow-300 text-slate-900 font-bold px-4 py-2 rounded-full text-sm border-2 border-slate-900 uppercase">
            Lobby
          </div>
          
          <div className="text-center mb-8">
            <h1 className="font-bebas text-8xl uppercase tracking-tight text-slate-900 mb-2" style={{ WebkitTextStroke: '3px white' }}>
              {roomCode.toUpperCase()}
            </h1>
            <p className="font-inter text-lg text-slate-700 uppercase font-bold">
              Game Code
            </p>
          </div>
          
          <div className="mb-8">
            <h2 className="font-inter text-sm font-bold text-slate-900 mb-6 uppercase tracking-widest">Players:</h2>
            <div className="grid grid-cols-2 gap-6">
              {gameData?.players.map((player, index) => {
                const rotations = ['rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 'rotate-1', '-rotate-1'];
                const shadows = [
                  'shadow-[6px_6px_0px_#ec4899]',  // pink
                  'shadow-[6px_6px_0px_#22d3ee]',  // cyan
                  'shadow-[6px_6px_0px_#a855f7]',  // purple
                  'shadow-[6px_6px_0px_#fb923c]',  // orange
                  'shadow-[6px_6px_0px_#84cc16]',  // lime
                  'shadow-[6px_6px_0px_#f43f5e]',  // rose
                ];
                
                return (
                  <div 
                    key={player.name} 
                    className={`relative ${playerColors[index % playerColors.length]} p-8 rounded-xl text-white border-4 border-slate-900 transform ${rotations[index % rotations.length]} ${shadows[index % shadows.length]} hover:scale-105 transition-transform flex items-center justify-center min-h-[120px]`}
                  >
                    <span className="font-bebas text-5xl uppercase tracking-tight text-center leading-none">{player.name}</span>
                    {player.name === gameData.host && (
                      <span className="absolute -top-3 -right-3 bg-yellow-300 text-slate-900 px-3 py-1 rounded-full text-xs font-bold border-2 border-slate-900 uppercase transform rotate-12">
                        👑 Host
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            {gameData?.host === playerName ? (
              <button
                onClick={onStartGame}
                className="w-full bg-purple-600 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-purple-700 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase text-2xl"
              >
                Start Game
              </button>
            ) : (
              <div className="p-6 bg-cyan-200 rounded-xl border-4 border-slate-900">
                <p className="font-inter text-lg font-bold text-slate-900 uppercase">
                  Waiting for {gameData?.host}...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
