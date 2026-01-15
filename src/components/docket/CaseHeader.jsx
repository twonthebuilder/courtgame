/** @typedef {import('../../lib/types').CaseData} CaseData */

/**
 * Summarizes the headline case details, including judge, facts, and opposing counsel profile.
 *
 * @param {object} props - Component props.
 * @param {CaseData} props.data - Case data object containing defendant, charge, judge, and facts.
 * @returns {JSX.Element} The case header section.
 */
const CaseHeader = ({ data }) => {
  const opposingCounsel = data.opposing_counsel ?? {};
  const ageRange = opposingCounsel.age_range?.trim();
  const evidenceItems = data.evidence ?? [];

  return (
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
        <div className="bg-white p-3 rounded border border-slate-200 text-sm text-slate-600 space-y-2">
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase">Opposing Counsel</span>
            <p className="text-base font-semibold text-slate-700">
              {opposingCounsel.name || 'Unnamed counsel'}
            </p>
            {ageRange ? <p className="text-xs text-slate-500">{ageRange}</p> : null}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Bio</p>
            <p>{opposingCounsel.bio || 'No profile available yet.'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Style Tells</p>
            <p>{opposingCounsel.style_tells || 'Not provided.'}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Current Posture</p>
            <p>{opposingCounsel.current_posture || 'Not provided.'}</p>
          </div>
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
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase mb-1">Evidence</h3>
          <ul className="list-disc list-inside space-y-1">
            {evidenceItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CaseHeader;
