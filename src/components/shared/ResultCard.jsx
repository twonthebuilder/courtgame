/**
 * Shared visual container for verdict, ruling, and sanctions result blocks.
 *
 * @param {object} props - Component props.
 * @param {string} [props.title] - Card title text.
 * @param {React.ReactNode} props.children - Card content.
 * @param {string} [props.className] - Additional container classes.
 * @param {string} [props.titleClassName] - Additional title classes.
 * @returns {JSX.Element} Result card wrapper.
 */
const ResultCard = ({
  title,
  children,
  className = '',
  titleClassName = '',
}) => (
  <div
    className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm min-w-0 ${className}`.trim()}
  >
    {title ? (
      <h4 className={`text-xs font-bold text-slate-400 uppercase mb-2 ${titleClassName}`.trim()}>
        {title}
      </h4>
    ) : null}
    {children}
  </div>
);

export default ResultCard;
