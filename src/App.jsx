import React, { useState, useEffect, useRef } from 'react';
import { Gavel, Scale, BookOpen, User, ArrowRight, RefreshCw, Shield, AlertTriangle, FileText, XCircle, MapPin, BrainCircuit, CheckCircle, ScrollText, ArrowUpCircle, Copy, Check, Swords, GraduationCap, Gavel as GavelIcon, Info, Drama, Landmark, Zap, Trophy, Crown, Sparkles, Users, Ban, MinusCircle, History, ClipboardCopy, Fingerprint, Stamp, Hourglass } from 'lucide-react';

/* ========================================================================
   MODULE: utils/constants.js
   Action: Move this to a dedicated constants file.
   ======================================================================== */
const API_KEY = ""; // System injects key at runtime

/* ========================================================================
   MODULE: utils/helpers.js
   Action: Move utility functions here.
   ======================================================================== */
const copyToClipboard = (text) => {
  if (!navigator.clipboard) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
      return;
  }
  navigator.clipboard.writeText(text);
};

const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw e;
  }
};

/* ========================================================================
   MODULE: utils/prompts.js
   Action: Group all LLM Prompt Generators here.
   ======================================================================== */

const getGeneratorPrompt = (difficulty, jurisdiction, playerRole) => {
  let tone = "";
  if (difficulty === 'silly') tone = "wacky, humorous, and absurd. Think cartoons.";
  else if (difficulty === 'regular') tone = "mundane, everyday disputes. Traffic, small contracts.";
  else if (difficulty === 'nuance') tone = "complex, serious, morally ambiguous crimes.";

  return `
    You are a creative legal scenario generator. Player is **${playerRole.toUpperCase()}**.
    
    1. DETERMINE TRIAL TYPE:
    - If case is minor/mundane -> is_jury_trial = false (Bench Trial).
    - If case is crime/tort/public interest -> is_jury_trial = true.
    
    2. JURY POOL (Generate 8 regardless, used only if jury trial):
    - Name, age, job, and a HIDDEN BIAS.
    
    Return ONLY valid JSON:
    {
      "title": "Case Name",
      "defendant": "Name",
      "charge": "Charge",
      "is_jury_trial": boolean,
      "judge": { "name": "Name", "philosophy": "Style", "background": "History", "bias": "Bias" },
      "jurors": [
        {"id": 1, "name": "Name", "age": 30, "job": "Job", "bias_hint": "Public description", "hidden_bias": "Secret bias"}
      ],
      "facts": ["Fact 1", "Fact 2", "Fact 3"],
      "witnesses": [{"name": "Name", "role": "Role", "statement": "Statement"}],
      "evidence": ["Item 1", "Item 2"],
      "opposing_statement": "Opening statement"
    }
  `;
};

const getJuryStrikePrompt = (caseData, playerStrikes, playerRole) => {
  const opponentRole = playerRole === 'defense' ? 'Prosecutor' : 'Defense Attorney';
  return `
    Phase: VOIR DIRE. Case: ${caseData.title}.
    Player (${playerRole}) struck IDs: ${JSON.stringify(playerStrikes)}.
    
    As AI ${opponentRole}, strike 2 jurors who hurt YOUR case.
    
    Return ONLY valid JSON:
    {
      "opponent_strikes": [id1, id2],
      "opponent_reasoning": "Why the AI struck these jurors.",
      "seated_juror_ids": [list of remaining ids],
      "judge_comment": "Judge's brief comment on the final jury."
    }
  `;
};

const getMotionPrompt = (caseData, argument, difficulty) => `
    Judge ${caseData.judge.name} ruling on Pre-Trial Motion.
    Motion: "${argument}"
    Bias: ${caseData.judge.bias}.
    Difficulty: ${difficulty}.
    
    Return JSON:
    {
      "ruling": "GRANTED", "DENIED", or "PARTIALLY GRANTED",
      "outcome_text": "Explanation.",
      "score": number (0-100)
    }
`;

const getFinalVerdictPrompt = (caseData, motionResult, seatedJurors, argument, difficulty) => {
  const isBench = !caseData.is_jury_trial;
  return `
    Phase: VERDICT. Type: ${isBench ? 'BENCH' : 'JURY'}.
    Case: ${JSON.stringify(caseData)}
    Motion Result: ${motionResult.ruling} (${motionResult.score})
    Jury: ${JSON.stringify(seatedJurors)}
    Argument: "${argument}"
    
    1. JUDGE SCORE (0-100) based on Difficulty ${difficulty}.
    ${!isBench ? `2. JURY DELIBERATION: Do biases align? Vote Guilty/Not Guilty. 2v2=Hung.` : ''}
    3. LEGENDARY CHECK (>100 score).
    
    Return JSON:
    {
      "jury_verdict": "Guilty/Not Guilty/Hung/NA",
      "jury_reasoning": "Reasoning...",
      "jury_score": number (or 0 if N/A),
      "judge_score": number,
      "judge_opinion": "Opinion...",
      "final_ruling": "Outcome",
      "is_jnov": boolean,
      "final_weighted_score": number,
      "achievement_title": "Title or null"
    }
  `;
};

/* ========================================================================
   MODULE: components/ui/DocketSection.jsx
   Action: Shared UI wrapper for docket items.
   ======================================================================== */
const DocketSection = ({ title, children, icon: Icon, className = "" }) => (
  <section className={`border-b-2 border-slate-300 pb-8 mb-8 ${className}`}>
    <div className="flex items-center gap-2 mb-4 text-slate-400 uppercase tracking-widest text-xs font-bold">
      {Icon && <Icon className="w-4 h-4" />}
      {title}
    </div>
    {children}
  </section>
);

const LoadingView = ({ message }) => (
    <div className="py-8 text-center animate-pulse">
        <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
        <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{message}</span>
    </div>
);

/* ========================================================================
   MODULE: components/screens/InitializationScreen.jsx
   Action: The "Court Clerk" loading screen.
   ======================================================================== */
const InitializationScreen = ({ role }) => {
    const [step, setStep] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    
    const TIPS = [
        "Judges have specific biases. Read their bio carefully.",
        "In 'Silly' mode, humor is a valid legal strategy.",
        "If you strike the same juror as the opposition, they are gone for sure.",
        "A 'Bench Trial' means no jury—you only have to please the Judge.",
        "Pre-Trial motions carry 40% of the weight. Don't slack off.",
        "Nuance mode judges are strict textualists. Be precise.",
        "Evidence suppression is a great way to cripple the prosecution."
    ];

    const steps = [
        "Accessing Court Archives...",
        "Digitizing Docket...",
        "Assigning Presiding Judge...",
        "Reviewing Conflict of Interest...",
        "Checking Jury Pool Availability...",
        "Notifying Opposing Counsel...",
        "Finalizing Docket..."
    ];

    useEffect(() => {
        setTipIndex(Math.floor(Math.random() * TIPS.length));
        const interval = setInterval(() => {
            setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-in fade-in">
            <div className="relative mb-8">
                <RefreshCw className="w-16 h-16 text-amber-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <GavelIcon className="w-6 h-6 text-slate-700" />
                </div>
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">
                Building Case
            </h2>
            
            <div className="h-8 mb-8">
                <p className="text-slate-500 font-mono text-sm uppercase tracking-widest animate-pulse">
                    {steps[step]}
                </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg max-w-md w-full shadow-sm">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-600 uppercase">Pro Tip</span>
                </div>
                <p className="text-sm text-slate-700 font-medium italic">
                    "{TIPS[tipIndex]}"
                </p>
            </div>
        </div>
    );
};

/* ========================================================================
   MODULE: components/screens/StartScreen.jsx
   ======================================================================== */
const StartScreen = ({ onStart }) => {
  const [difficulty, setDifficulty] = useState('regular');
  const [jurisdiction, setJurisdiction] = useState('USA');
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-xl border-4 border-amber-500"><Scale className="w-16 h-16 text-amber-500" /></div>
      <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-2 tracking-tighter">POCKET<span className="text-amber-600">COURT</span></h1>
      <p className="text-slate-500 mb-8 text-lg font-medium max-w-md">v15.0: GitHub Ready Edition</p>
      <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 w-full max-w-md mb-8 space-y-6">
        <div>
           <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Game Mode</label>
           <div className="grid grid-cols-3 gap-2">
              {['silly', 'regular', 'nuance'].map(d => (
                  <button key={d} onClick={() => setDifficulty(d)} className={`p-2 rounded-lg text-sm font-bold capitalize transition-all border-2 ${difficulty === d ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}>{d}</button>
              ))}
           </div>
        </div>
        <div>
           <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Jurisdiction</label>
           <div className="grid grid-cols-3 gap-2">
              {['USA', 'Canada', 'Fictional'].map(j => (
                  <button key={j} onClick={() => setJurisdiction(j)} className={`p-2 rounded-lg text-sm font-bold capitalize transition-all border-2 ${jurisdiction === j ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}>{j}</button>
              ))}
           </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <button onClick={() => onStart('prosecution', difficulty, jurisdiction)} className="p-4 bg-red-100 hover:bg-red-200 border-2 border-red-300 rounded-xl font-bold text-red-900 flex items-center justify-center gap-2 transition-transform active:scale-95"><Gavel className="w-5 h-5" /> PROSECUTION</button>
        <button onClick={() => onStart('defense', difficulty, jurisdiction)} className="p-4 bg-blue-100 hover:bg-blue-200 border-2 border-blue-300 rounded-xl font-bold text-blue-900 flex items-center justify-center gap-2 transition-transform active:scale-95"><Shield className="w-5 h-5" /> DEFENSE</button>
      </div>
    </div>
  );
};

/* ========================================================================
   MODULE: components/docket/CaseHeader.jsx
   ======================================================================== */
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
            {data.facts.map((f, i) => <li key={i}>{f}</li>)}
         </ul>
       </div>
       <div className="bg-white p-3 rounded border border-slate-200 italic text-slate-600">
          <span className="block text-xs font-bold text-slate-400 uppercase not-italic mb-1">Opposing Counsel</span>
          "{data.opposing_statement}"
       </div>
    </div>
  </div>
);

/* ========================================================================
   MODULE: components/docket/JurySection.jsx
   ======================================================================== */
const JurySection = ({ pool, seatedIds, opponentStrikes, onStrike, myStrikes, isLocked, judgeComment }) => {
  if (isLocked) {
     const seated = pool.filter(j => seatedIds.includes(j.id));
     return (
        <div className="bg-white p-6 rounded-lg border border-slate-200">
           <div className="flex justify-between items-start mb-4">
              <div>
                  <h3 className="font-bold text-slate-700 text-lg mb-1">Seated Jury</h3>
                  <p className="text-sm text-slate-500 italic">"{judgeComment}"</p>
              </div>
              <div className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-400 font-bold uppercase">
                  Voir Dire Complete
              </div>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {seated.map(j => (
                  <div key={j.id} className="bg-slate-50 border border-slate-200 p-3 rounded text-center">
                      <div className="font-bold text-slate-800">{j.name}</div>
                      <div className="text-xs text-slate-500 uppercase">{j.job}</div>
                  </div>
              ))}
           </div>
           <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex gap-4">
              <span>Defense Strikes: {myStrikes.length}</span>
              <span>Prosecution Strikes: {opponentStrikes.length}</span>
           </div>
        </div>
     );
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
        <p className="text-sm text-slate-600 mb-4">Select <strong>2 jurors</strong> to strike from the pool. Opposing counsel will do the same.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {pool.map(j => (
                <button 
                    key={j.id}
                    onClick={() => onStrike(j.id)}
                    className={`p-3 rounded border-2 text-left transition-all ${
                        myStrikes.includes(j.id) 
                        ? 'border-red-500 bg-red-50 relative' 
                        : 'border-slate-200 hover:border-amber-400'
                    }`}
                >
                    {myStrikes.includes(j.id) && (
                        <div className="absolute top-1 right-1 text-red-600 font-black text-xs">X</div>
                    )}
                    <div className="font-bold text-slate-800 text-sm truncate">{j.name}</div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1 truncate">{j.job}, {j.age}</div>
                    <div className="text-xs text-slate-600 italic leading-tight">"{j.bias_hint}"</div>
                </button>
            ))}
        </div>
    </div>
  );
};

/* ========================================================================
   MODULE: components/docket/MotionSection.jsx
   ======================================================================== */
const MotionSection = ({ onSubmit, ruling, isLocked }) => {
    const [text, setText] = useState("");

    if (isLocked) {
        return (
            <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-6 animate-in fade-in">
                <div className="flex-1">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Your Motion</h4>
                    <p className="font-serif text-slate-700 italic">"{text}"</p>
                </div>
                <div className="w-full md:w-1/3 bg-slate-50 p-4 rounded border border-slate-200 relative overflow-hidden">
                    <div className={`absolute top-2 right-2 border-2 px-2 py-1 rounded text-xs font-black uppercase tracking-widest -rotate-12 ${
                        ruling.ruling === 'GRANTED' ? 'border-green-600 text-green-600' : 
                        ruling.ruling === 'DENIED' ? 'border-red-600 text-red-600' : 'border-amber-600 text-amber-600'
                    }`}>
                        {ruling.ruling}
                    </div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Judge's Ruling</h4>
                    <p className="text-sm text-slate-800 font-medium mt-6">"{ruling.outcome_text}"</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
             <p className="text-sm text-slate-600 mb-3">Draft a pre-trial motion to <strong>Dismiss</strong> or <strong>Suppress Evidence</strong>.</p>
             <textarea 
                className="w-full h-32 p-3 border border-slate-300 rounded font-serif text-slate-800 mb-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Your Honor, the defense moves to..."
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end">
                <button onClick={() => onSubmit(text)} disabled={!text.trim()} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold text-sm hover:bg-indigo-700">File Motion</button>
            </div>
        </div>
    );
};

/* ========================================================================
   MODULE: components/docket/ArgumentSection.jsx
   ======================================================================== */
const ArgumentSection = ({ onSubmit, verdict, isLocked, isJuryTrial }) => {
    const [text, setText] = useState("");

    if (isLocked) {
        return (
            <div className="bg-white p-6 rounded-lg border border-slate-200 animate-in fade-in">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Closing Argument</h4>
                <p className="font-serif text-slate-800 whitespace-pre-wrap">{text}</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
             <p className="text-sm text-slate-600 mb-3">
                 {isJuryTrial ? "Address the Jury (Facts) and Judge (Law)." : "Address the Judge (Law & Facts)."}
             </p>
             <textarea 
                className="w-full h-48 p-4 border border-slate-300 rounded font-serif text-lg text-slate-800 mb-4 focus:ring-2 focus:ring-amber-500 outline-none"
                placeholder="Ladies and Gentlemen..."
                value={text}
                onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end">
                <button onClick={() => onSubmit(text)} disabled={!text.trim()} className="bg-amber-500 text-white px-8 py-3 rounded font-bold hover:bg-amber-600 flex items-center gap-2">
                    Rest Case <GavelIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

/* ========================================================================
   MODULE: components/docket/VerdictSection.jsx
   ======================================================================== */
const VerdictSection = ({ result }) => {
    const isLegendary = result.final_weighted_score > 100;
    const isGuilty = result.final_ruling.toLowerCase().includes('guilty') && !result.final_ruling.toLowerCase().includes('not');
    
    return (
        <div className={`p-8 rounded-xl border-4 text-center relative overflow-hidden animate-in zoom-in ${isLegendary ? 'bg-amber-50 border-amber-400' : 'bg-slate-50 border-slate-300'}`}>
            {isLegendary && (
                <div className="absolute top-0 left-0 w-full bg-amber-400 text-amber-900 text-xs font-black uppercase tracking-widest py-1">Legendary Outcome</div>
            )}
            
            <h2 className={`text-4xl font-black uppercase mb-2 mt-4 ${isGuilty ? 'text-red-700' : 'text-green-700'}`}>
                {result.final_ruling}
            </h2>
            <div className="text-6xl font-black text-slate-800 mb-6">{Math.round(result.final_weighted_score)}<span className="text-lg text-slate-400 font-normal">/100</span></div>

            {result.achievement_title && (
                <div className="inline-block bg-white px-4 py-2 rounded-full border border-amber-300 text-amber-600 font-bold text-sm mb-6 shadow-sm">
                    <Trophy className="w-4 h-4 inline mr-2" /> {result.achievement_title}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                 <div className="bg-white p-4 rounded border border-slate-200">
                     <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Judge's Opinion</h4>
                     <p className="font-serif text-slate-700 text-sm">"{result.judge_opinion}"</p>
                 </div>
                 {result.jury_verdict !== "N/A" && (
                    <div className="bg-white p-4 rounded border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Jury Reasoning</h4>
                        <p className="font-serif text-slate-700 text-sm">"{result.jury_reasoning}"</p>
                    </div>
                 )}
            </div>
        </div>
    );
};


/* ========================================================================
   MODULE: App.jsx
   Action: Main application logic and state management.
   ======================================================================== */

export default function PocketCourt() {
  const [gameState, setGameState] = useState('start'); // start, initializing, playing
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [history, setHistory] = useState({}); 
  
  const [config, setConfig] = useState({ difficulty: 'regular', jurisdiction: 'USA', role: 'defense' });
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  // --- ACTIONS ---

  const generateCase = async (role, difficulty, jurisdiction) => {
      // 1. Move to Initialization Screen immediately
      setGameState('initializing');
      setError(null);
      setConfig({ role, difficulty, jurisdiction });
      
      try {
          const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Generate" }] }], systemInstruction: { parts: [{ text: getGeneratorPrompt(difficulty, jurisdiction, role) }] }, generationConfig: { responseMimeType: "application/json" } })
          });
          const data = JSON.parse(res.candidates[0].content.parts[0].text);
          
          setHistory({ 
              case: data,
              jury: data.is_jury_trial ? { pool: data.jurors, myStrikes: [], locked: false } : { skipped: true },
              motion: { locked: false }, // If skipped, we move straight to motions. If not skipped, motions waits for jury lock.
              trial: { locked: false }
          });
          
          // 2. Move to Docket View
          setGameState('playing');
      } catch (e) { 
          console.error(e); 
          setError("Docket creation failed. Please try again."); 
          setGameState('start'); 
      }
  };

  const submitStrikes = async (strikes) => {
      setLoadingMsg("Judge is ruling on strikes...");
      try {
          const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Strike" }] }], systemInstruction: { parts: [{ text: getJuryStrikePrompt(history.case, strikes, config.role) }] }, generationConfig: { responseMimeType: "application/json" } })
          });
          const data = JSON.parse(res.candidates[0].content.parts[0].text);
          
          setHistory(prev => ({
              ...prev,
              jury: { ...prev.jury, myStrikes: strikes, opponentStrikes: data.opponent_strikes, seatedIds: data.seated_juror_ids, comment: data.judge_comment, locked: true },
              motion: { locked: false } 
          }));
          setLoadingMsg(null);
      } catch (e) { console.error(e); setError("Strike failed."); setLoadingMsg(null); }
  };

  const submitMotion = async (text) => {
      setLoadingMsg("Filing motion...");
      try {
          const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Motion" }] }], systemInstruction: { parts: [{ text: getMotionPrompt(history.case, text, config.difficulty) }] }, generationConfig: { responseMimeType: "application/json" } })
          });
          const data = JSON.parse(res.candidates[0].content.parts[0].text);
          
          setHistory(prev => ({
              ...prev,
              motion: { text, ruling: data, locked: true },
              trial: { locked: false } 
          }));
          setLoadingMsg(null);
      } catch (e) { console.error(e); setError("Motion failed."); setLoadingMsg(null); }
  };

  const submitArgument = async (text) => {
      setLoadingMsg("The Court is deliberating...");
      try {
          const seatedJurors = history.jury.skipped ? [] : history.case.jurors.filter(j => history.jury.seatedIds.includes(j.id));
          const res = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: "Verdict" }] }], systemInstruction: { parts: [{ text: getFinalVerdictPrompt(history.case, history.motion.ruling, seatedJurors, text, config.difficulty) }] }, generationConfig: { responseMimeType: "application/json" } })
          });
          const data = JSON.parse(res.candidates[0].content.parts[0].text);
          
          setHistory(prev => ({
              ...prev,
              trial: { text, verdict: data, locked: true }
          }));
          setLoadingMsg(null);
      } catch (e) { console.error(e); setError("Verdict failed."); setLoadingMsg(null); }
  };

  const handleCopyFull = () => {
      let log = `DOCKET: ${history.case.title}\nJUDGE: ${history.case.judge.name}\n\n`;
      log += `FACTS:\n${history.case.facts.join('\n')}\n\n`;
      
      if (history.jury && !history.jury.skipped && history.jury.locked) {
          log += `JURY SEATED (${history.jury.seatedIds.length}):\n${history.jury.comment}\n\n`;
      }
      
      if (history.motion && history.motion.locked) {
          log += `MOTION:\n"${history.motion.text}"\nRULING: ${history.motion.ruling.ruling} - "${history.motion.ruling.outcome_text}"\n\n`;
      }
      
      if (history.trial && history.trial.locked) {
          log += `ARGUMENT:\n"${history.trial.text}"\n\nVERDICT: ${history.trial.verdict.final_ruling} (Score: ${Math.round(history.trial.verdict.final_weighted_score)})\nOPINION: "${history.trial.verdict.judge_opinion}"`;
      }
      
      copyToClipboard(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [history, loadingMsg]);

  // --- MAIN RENDER ---

  if (gameState === 'start') return <StartScreen onStart={generateCase} />;
  if (gameState === 'initializing') return <InitializationScreen role={config.role} />;

  return (
    <div className="min-h-screen bg-neutral-100 text-slate-900 font-sans pb-24">
      {/* Navbar */}
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setGameState('start')}>
            <Scale className="w-6 h-6 text-amber-500" />
            <span className="font-bold tracking-tight">POCKET<span className="text-amber-500">COURT</span></span>
          </div>
          <div className="flex gap-2">
               <button onClick={handleCopyFull} className="flex items-center gap-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded transition-colors border border-slate-700">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardCopy className="w-4 h-4 text-slate-400" />}
                    {copied ? 'COPIED' : 'COPY DOCKET'}
               </button>
          </div>
        </div>
      </header>

      {/* THE LIVING DOCKET */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        
        {/* Paper Container */}
        <div className="bg-white shadow-xl min-h-[80vh] p-8 md:p-12 relative animate-in fade-in slide-in-from-bottom-8 duration-700">
             {/* Paper Header */}
             <div className="border-b-4 border-slate-900 pb-4 mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black font-serif text-slate-900 uppercase tracking-tighter leading-none">{history.case.title}</h1>
                    <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">Official Docket • {config.jurisdiction}</p>
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase">Docket No.</div>
                    <div className="font-mono text-slate-600">{Math.floor(Math.random() * 90000) + 10000}</div>
                </div>
             </div>

             {/* 1. Case Info */}
             <DocketSection title="Case Information" icon={BookOpen}>
                <CaseHeader data={history.case} />
             </DocketSection>

             {/* 2. Jury Section (If Applicable) */}
             {!history.jury.skipped && (
                 <DocketSection title="Jury Selection" icon={Users}>
                    <JurySection 
                        pool={history.case.jurors} 
                        isLocked={history.jury.locked}
                        myStrikes={history.jury.myStrikes || []}
                        opponentStrikes={history.jury.opponentStrikes || []}
                        seatedIds={history.jury.seatedIds || []}
                        judgeComment={history.jury.comment}
                        onStrike={(id) => {
                             const current = history.jury.myStrikes || [];
                             if (current.includes(id)) {
                                 setHistory(prev => ({...prev, jury: {...prev.jury, myStrikes: current.filter(x => x !== id)}}));
                             } else if (current.length < 2) {
                                 setHistory(prev => ({...prev, jury: {...prev.jury, myStrikes: [...current, id]}}));
                             }
                        }}
                    />
                    {!history.jury.locked && (
                         <div className="mt-4 text-right">
                             <button 
                                onClick={() => submitStrikes(history.jury.myStrikes)} 
                                disabled={!history.jury.myStrikes || history.jury.myStrikes.length !== 2}
                                className="bg-amber-500 text-white font-bold py-2 px-6 rounded hover:bg-amber-600 disabled:opacity-50"
                             >
                                Confirm Strikes
                             </button>
                         </div>
                    )}
                 </DocketSection>
             )}

             {/* 3. Motions Section */}
             {/* Appears if jury skipped OR jury locked */}
             {(history.jury.skipped || history.jury.locked) && (
                 <DocketSection title="Pre-Trial Motions" icon={FileText}>
                     <MotionSection 
                        isLocked={history.motion.locked}
                        ruling={history.motion.ruling}
                        onSubmit={submitMotion}
                     />
                 </DocketSection>
             )}

             {/* 4. Trial Section */}
             {/* Appears if motion locked */}
             {history.motion && history.motion.locked && (
                 <DocketSection title="Trial Phase" icon={Gavel}>
                     <ArgumentSection 
                        isLocked={history.trial.locked}
                        text={history.trial.text}
                        isJuryTrial={history.case.is_jury_trial}
                        onSubmit={submitArgument}
                     />
                 </DocketSection>
             )}

             {/* 5. Verdict Section */}
             {history.trial && history.trial.locked && (
                 <DocketSection title="Final Judgment" icon={Scale} className="border-none mb-0 pb-0">
                     <VerdictSection result={history.trial.verdict} />
                     <div className="mt-12 text-center pt-8 border-t border-slate-100">
                         <button onClick={() => setGameState('start')} className="text-slate-400 hover:text-slate-800 font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 mx-auto">
                            <RefreshCw className="w-4 h-4" /> Start New Case
                         </button>
                     </div>
                 </DocketSection>
             )}

             {/* Loading Indicator */}
             {loadingMsg && (
                 <div className="py-8 text-center animate-pulse" ref={scrollRef}>
                     <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
                     <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{loadingMsg}</span>
                 </div>
             )}
             
             {/* Invisible div for auto-scrolling */}
             <div ref={scrollRef} />
        </div>
      </main>
    </div>
  );
}
