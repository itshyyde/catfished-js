interface JoinPageProps {
  roomCode: string;
  setRoomCode: (code: string) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  onJoin: () => void;
  onCreateGame: () => void;
  isLoading: boolean;
  error: string;
}

export function JoinPage({
  roomCode,
  setRoomCode,
  playerName,
  setPlayerName,
  onJoin,
  onCreateGame,
  isLoading,
  error
}: JoinPageProps) {
  return (
    <div className="min-h-screen bg-lime-300 bg-game flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-2xl shadow-[6px_6px_0px_#1e293b] border-4 border-slate-900 relative transform -rotate-2">
          <div className="absolute -top-4 -left-4 bg-cyan-300 text-slate-900 font-bold px-4 py-2 rounded-full text-sm border-2 border-slate-900 rotate-[-8deg] uppercase">
            Play
          </div>

          <div className="text-center mb-8">
            <h1 className="font-bebas text-9xl uppercase tracking-tight text-slate-900 mb-4" style={{ WebkitTextStroke: '2px white' }}>
              Catfished
            </h1>
            <p className="font-inter text-lg text-slate-700 uppercase font-bold">
              The Dating Profile Party Game
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="playerName" className="block text-sm font-bold text-slate-900 mb-2 uppercase">
                Your Name
              </label>
              <input
                id="playerName"
                name="playerName"
                type="text"
                required
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 text-xl font-bold border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500"
                style={{ color: 'black' }}
              />
            </div>

            <div>
              <label htmlFor="roomCode" className="block text-sm font-bold text-slate-900 mb-2 uppercase">
                Game Code
              </label>
              <input
                id="roomCode"
                name="roomCode"
                type="text"
                required
                placeholder="FISH"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-4 text-4xl font-bold text-center border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500 uppercase tracking-widest"
                style={{ color: 'black' }}
              />
            </div>

            <button
              onClick={onJoin}
              disabled={isLoading || !roomCode || !playerName}
              className="w-full bg-purple-600 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-purple-700 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xl"
            >
              {isLoading ? 'Joining...' : 'Join Game'}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-1 bg-slate-900 rounded"></div>
              <span className="font-bebas text-2xl text-slate-900 uppercase">Or</span>
              <div className="flex-1 h-1 bg-slate-900 rounded"></div>
            </div>

            <button
              onClick={onCreateGame}
              disabled={isLoading || !playerName}
              className="w-full bg-green-500 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-green-600 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xl"
            >
              {isLoading ? 'Creating...' : 'Create Game'}
            </button>
          </div>

          {error && (
            <div className="mt-6 p-3 bg-red-400 border-4 border-slate-900 rounded-xl">
              <div className="text-white font-bold text-center uppercase">{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
