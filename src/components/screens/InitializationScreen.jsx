import { useEffect, useState } from 'react';
import { Gavel as GavelIcon, Info, RefreshCw } from 'lucide-react';

const TIPS = [
  'Judges have specific biases. Read their bio carefully.',
  "In 'Silly' mode, humor is a valid legal strategy.",
  'If you strike the same juror as the opposition, they are gone for sure.',
  "A 'Bench Trial' means no jury—you only have to please the Judge.",
  "Pre-Trial motions carry 40% of the weight. Don't slack off.",
  'Nuance mode judges are strict textualists. Be precise.',
  'Evidence suppression is a great way to cripple the prosecution.',
];

const STEPS = [
  'Accessing Court Archives...',
  'Digitizing Docket...',
  'Assigning Presiding Judge...',
  'Reviewing Conflict of Interest...',
  'Checking Jury Pool Availability...',
  'Notifying Opposing Counsel...',
  'Finalizing Docket...',
];

/**
 * Displays a themed loading sequence while the game generates a new case.
 *
 * @param {object} props - Component props.
 * @param {string} props.role - The selected player role (defense/prosecution).
 * @returns {JSX.Element} The initialization screen.
 */
const InitializationScreen = ({ role }) => {
  const [step, setStep] = useState(0);
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in"
      data-role={role}
    >
      <div className="relative mb-8">
        <RefreshCw className="w-16 h-16 text-amber-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <GavelIcon className="w-6 h-6 text-slate-700" />
        </div>
      </div>

      <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Building Case</h2>

      <div className="h-8 mb-8">
        <p className="text-slate-500 font-mono text-sm uppercase tracking-widest animate-pulse">
          {STEPS[step]}
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg max-w-md w-full shadow-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Info className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-600 uppercase">Pro Tip</span>
        </div>
        <p className="text-sm text-slate-700 font-medium italic">"{TIPS[tipIndex]}"</p>
      </div>
    </div>
  );
};

export default InitializationScreen;
