/**
 * Presents the docket title, jurisdiction, and docket number header strip.
 *
 * @param {object} props - Component props.
 * @param {string} props.title - Case title.
 * @param {string} props.jurisdiction - Jurisdiction label.
 * @param {number} props.docketNumber - Generated docket number.
 * @returns {JSX.Element} The docket header layout.
 */
const DocketHeader = ({ title, jurisdiction, docketNumber }) => (
  <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
    <div>
      <h1 className="text-4xl font-black font-serif text-slate-900 uppercase tracking-tighter leading-none">
        {title}
      </h1>
      <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">
        Official Docket • {jurisdiction}
      </p>
    </div>
    <div className="text-right">
      <div className="text-xs font-bold text-slate-400 uppercase">Docket No.</div>
      <div className="font-mono text-slate-600">{docketNumber}</div>
    </div>
  </div>
);

export default DocketHeader;
