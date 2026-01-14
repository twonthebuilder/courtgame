/**
 * Provides the primary paper-like container for the living docket.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Content to render inside the paper container.
 * @returns {JSX.Element} The paper container wrapper.
 */
const PaperContainer = ({ children }) => (
  <div className="bg-white shadow-xl min-h-[80vh] p-8 md:p-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
    {children}
  </div>
);

export default PaperContainer;
