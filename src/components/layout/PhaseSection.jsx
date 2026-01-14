/**
 * Provides a labeled docket section with an optional icon and consistent styling.
 *
 * @param {object} props - Component props.
 * @param {string} props.title - Section title label.
 * @param {React.ReactNode} props.children - Content to render inside the section.
 * @param {React.ComponentType} [props.icon] - Optional icon component to display beside the title.
 * @param {string} [props.className] - Additional class names to apply to the wrapper.
 * @returns {JSX.Element} The docket section wrapper.
 */
const PhaseSection = ({ title, children, icon: Icon, className = '' }) => (
  <section className={`border-b-2 border-slate-300 pb-8 mb-8 ${className}`}>
    <div className="flex items-center gap-2 mb-4 text-slate-400 uppercase tracking-widest text-xs font-bold">
      {Icon && <Icon className="w-4 h-4" />}
      {title}
    </div>
    {children}
  </section>
);

export default PhaseSection;
