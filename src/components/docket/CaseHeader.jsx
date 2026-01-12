/** @typedef {import('../../lib/types').CaseData} CaseData */

/**
 * Summarizes the headline case details, including judge, facts, and the opposing statement.
 *
 * @param {object} props - Component props.
 * @param {CaseData} props.data - Case data object containing defendant, charge, judge, and facts.
 * @returns {JSX.Element} The case header section.
 */
const CaseHeader = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200 font-serif">
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase">Defendant</h3>
        <p className="text-xl font-bold text-slate-800">{data.defendant}</p>
      </div>
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase">Charge</h3>
        <p className="text-lg font-bold text-red-700">{data.charge}</p>
      </div>
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase">Judge</h3>
        <p className="text-md font-bold text-slate-700">{data.judge.name}</p>
        <p className="text-sm italic text-slate-500">{data.judge.bias}</p>
      </div>
    </div>
    <div className="space-y-4 text-sm text-slate-700">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Facts of the Case</h3>
        <ul className="list-disc list-inside space-y-1">
          {data.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>
      <div className="bg-white p-3 rounded border border-slate-200 italic text-slate-600">
        <span className="block text-xs font-bold text-slate-400 uppercase not-italic mb-1">
          Opposing Counsel
        </span>
        "{data.opposing_statement}"
      </div>
    </div>
  </div>
);

export default CaseHeader;
