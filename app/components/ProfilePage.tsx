import { DrawingCanvas } from './DrawingCanvas';

interface ProfilePageProps {
  assignedPersona: string;
  assignedQuirk: string;
  profileName: string;
  setProfileName: (name: string) => void;
  profileBio: string;
  setProfileBio: (bio: string) => void;
  onDrawingComplete: (imageUrl: string) => void;
  onSubmitProfile: () => void;
  drawingCompleted: boolean;
  drawnImageUrl: string;
  profileSubmitted: boolean;
  error: string;
  roomCode: string;
  playerName: string;
}

export function ProfilePage({
  assignedPersona,
  assignedQuirk,
  profileName,
  setProfileName,
  profileBio,
  setProfileBio,
  onDrawingComplete,
  onSubmitProfile,
  drawingCompleted,
  drawnImageUrl,
  profileSubmitted,
  error,
  roomCode,
  playerName
}: ProfilePageProps) {
  // --- "Waiting" Screen ---
  if (profileSubmitted) {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white p-8 rounded-2xl border-4 border-slate-900 text-center transform rotate-3 shadow-[8px_8px_0px_#a855f7]">
            <h1 className="font-bebas text-8xl uppercase text-slate-900 mb-4">
              All Set!
            </h1>
            <p className="font-inter text-lg font-bold text-slate-700 uppercase">
              Waiting on other players...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Phase 2: Submission Form (shows drawn image + name/bio inputs) ---
  if (drawingCompleted) {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-lg border-4 border-slate-900 overflow-hidden">
            {/* Profile Image - Clear and visible */}
            <div className="relative bg-white p-6">
              <img 
                src={drawnImageUrl} 
                alt="Profile"
                className="w-full h-80 object-contain"
              />
            </div>

            {/* Info Section */}
            <div className="px-6 pb-6 space-y-4">
              {/* Name Input */}
              <div>
                <label className="block font-inter text-lg font-bold text-slate-900 mb-2 uppercase">
                  Name
                </label>
                <input
                  id="profileName"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 text-2xl font-bold text-slate-900 border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500"
                  placeholder="Enter name..."
                  style={{ color: 'black' }}
                />
              </div>
              
              {/* Bio Input */}
              <div>
                <label className="block font-inter text-lg font-bold text-slate-900 mb-2 uppercase">
                  Bio
                </label>
                <textarea
                  id="profileBio"
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 text-lg font-medium text-slate-900 border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500 resize-none"
                  placeholder="Something interesting..."
                  style={{ color: 'black' }}
                />
              </div>
              
              {/* Submit Button */}
              <button
                onClick={onSubmitProfile}
                disabled={!profileName.trim() || !profileBio.trim()}
                className="w-full bg-purple-600 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-purple-700 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-2xl"
              >
                Submit
              </button>
              
              {error && (
                <div className="mt-4 p-3 bg-red-400 border-4 border-slate-900 rounded-xl">
                  <div className="text-white font-bold text-center uppercase">{error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // --- Phase 1: Drawing Canvas (just prompt + drawing tools + checkmark) ---
  return (
    <DrawingCanvas
      assignedPersona={assignedPersona}
      assignedQuirk={assignedQuirk}
      onDrawingComplete={onDrawingComplete}
      disabled={false}
      roomCode={roomCode}
      playerName={playerName}
    />
  );
}
