import { RefreshCw } from 'lucide-react';

/**
 * Shows a standardized loading indicator with a status message.
 *
 * @param {object} props - Component props.
 * @param {string} props.message - Loading message to display.
 * @returns {JSX.Element} The loading view.
 */
const LoadingView = ({ message }) => (
  <div className="py-8 text-center animate-pulse">
    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
    <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{message}</span>
  </div>
);

export default LoadingView;
