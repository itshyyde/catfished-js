interface PreProfilePageProps {
  onSubmitIdeas: () => void;
  preProfileSubmitted: boolean;
  error: string;
}

export function PreProfilePage({
  onSubmitIdeas,
  preProfileSubmitted,
  error
}: PreProfilePageProps) {
  // --- "Waiting" Screen for Pre-Profile Phase ---
  if (preProfileSubmitted) {
    return (
      <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white p-8 rounded-2xl border-4 border-slate-900 text-center transform -rotate-2 shadow-[8px_8px_0px_#ec4899]">
            <h1 className="font-bebas text-8xl uppercase text-slate-900 mb-4">
              Got It!
            </h1>
            <p className="font-inter text-lg font-bold text-slate-700 uppercase">
              Waiting on other players...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lime-300 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white p-8 rounded-2xl shadow-lg border-4 border-slate-900 relative">
          <div className="absolute -top-4 -left-4 bg-pink-400 text-white font-bold px-4 py-2 rounded-full text-sm border-2 border-slate-900 uppercase">
            Round 1
          </div>
          
          <div className="text-center mb-8">
            <h1 className="font-bebas text-6xl sm:text-7xl uppercase text-slate-900 mb-4">
              Who? Doing What?
            </h1>
          </div>
          
          <div className="space-y-5">
            <div>
              <label htmlFor="persona" className="block font-inter text-lg font-bold text-slate-900 mb-2 uppercase">
                Person
              </label>
              <input
                id="persona"
                type="text"
                className="w-full px-4 py-3 text-xl font-bold border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500"
                placeholder="Barack Obama"
                style={{ color: 'black' }}
              />
            </div>
            
            <div>
              <label htmlFor="quirk" className="block font-inter text-lg font-bold text-slate-900 mb-2 uppercase">
                Doing What?
              </label>
              <input
                id="quirk"
                type="text"
                className="w-full px-4 py-3 text-xl font-bold border-4 border-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-pink-500"
                placeholder="Skydiving"
                style={{ color: 'black' }}
              />
            </div>
            
            <button
              onClick={onSubmitIdeas}
              className="w-full bg-pink-500 text-white font-bold py-4 px-8 rounded-xl border-4 border-slate-900 shadow-[4px_4px_0px_#1e293b] hover:bg-pink-600 active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase text-2xl"
            >
              Submit
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
