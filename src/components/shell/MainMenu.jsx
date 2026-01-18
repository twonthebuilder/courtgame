import { Scale } from 'lucide-react';

/**
 * Main menu shell for routing into setup.
 *
 * @param {object} props - Component props.
 * @param {() => void} props.onPlay - Handler for transitioning to setup.
 * @returns {JSX.Element} The main menu layout.
 */
const MainMenu = ({ onPlay }) => (
  <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
    <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-xl border-4 border-amber-500">
      <Scale className="w-16 h-16 text-amber-500" />
    </div>
    <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-2 tracking-tighter">
      POCKET<span className="text-amber-600">COURT</span>
    </h1>
    <p className="text-slate-500 mb-10 text-lg font-medium max-w-md">v15.0: GitHub Ready Edition</p>
    <div className="flex w-full max-w-sm flex-col gap-4">
      <button
        type="button"
        onClick={onPlay}
        className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-transform hover:bg-amber-600 active:scale-95"
      >
        Play
      </button>
      <button
        type="button"
        disabled
        className="rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-400"
      >
        Settings (stub)
      </button>
      <button
        type="button"
        disabled
        className="rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-400"
      >
        Quit (stub)
      </button>
    </div>
  </div>
);

export default MainMenu;
