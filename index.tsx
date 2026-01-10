
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import jsQR from "https://esm.sh/jsqr@1.4.0";
import { User, Event, Registration } from './types';
import { DB } from './db';

// --- CONSTANTS ---
const UNIVERSITY_LOGO = "/logo.png";
const LOGO_FALLBACK = "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/University_of_Colombo_crest.png/512px-University_of_Colombo_crest.png";
const BACKGROUND_IMAGE = "/background.jpeg";

// --- GEMINI API CONNECTOR ---

const AIService = {
  generateDescription: async (title: string, dept: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a compelling description (max 3 sentences) for a university workshop titled "${title}" in the "${dept}" department at University of Colombo.`,
    });
    return response.text;
  },

  generatePoster: async (title: string, dept: string, venue: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `A professional university event poster for "${title}". Faculty of Technology style. Modern tech theme.`;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      return part ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
    } catch (error) { return null; }
  },

  askAssistant: async (query: string, events: Event[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const eventContext = events.map(e => `- ${e.title} at ${e.venue}`).join('\n');
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are FoT-Bot, an AI assistant for the University of Colombo Faculty of Technology. Help users with these events:\n${eventContext}\n\nUser Question: ${query}`,
    });
    return response.text;
  }
};

const LogoImage = ({ className, alt }: { className?: string, alt?: string }) => {
  const [src, setSrc] = useState(UNIVERSITY_LOGO);
  return <img src={src} alt={alt || "UoC FoT"} className={className} onError={() => setSrc(LOGO_FALLBACK)} />;
};

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    DB.init().then(() => {
      const saved = localStorage.getItem('unievents_current_user');
      if (saved) {
        try { setCurrentUser(JSON.parse(saved)); setView('dashboard'); } catch (e) { localStorage.removeItem('unievents_current_user'); }
      }
      setDbReady(true);
    });
  }, []);

  if (!dbReady) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><i className="fas fa-circle-notch fa-spin fa-3x text-red-800"></i></div>;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <Navbar currentUser={currentUser} onLogout={() => { setCurrentUser(null); localStorage.removeItem('unievents_current_user'); setView('landing'); }} setView={setView} />
      <main className={`flex-grow ${view === 'landing' ? '' : 'container mx-auto px-4 py-8'}`}>
        {view === 'landing' && <LandingPage setView={setView} />}
        {view === 'login' && <LoginForm onLogin={(u: User) => { setCurrentUser(u); localStorage.setItem('unievents_current_user', JSON.stringify(u)); setView('dashboard'); }} setView={setView} />}
        {view === 'register' && <RegisterForm onLogin={(u: User) => { setCurrentUser(u); localStorage.setItem('unievents_current_user', JSON.stringify(u)); setView('dashboard'); }} setView={setView} />}
        {view === 'dashboard' && currentUser && <Dashboard user={currentUser} />}
        {currentUser && <AssistantWrapper />}
      </main>
      <footer className="bg-white border-t py-12 text-center text-gray-500 text-sm">
        <LogoImage className="h-10 w-auto opacity-40 mx-auto mb-6" />
        <p className="font-bold tracking-widest text-[10px] uppercase text-gray-400">University of Colombo • Faculty of Technology</p>
        <p className="mt-2">© 2024 Institutional Event Management. All Rights Reserved.</p>
      </footer>
    </div>
  );
};

const Navbar = ({ currentUser, onLogout, setView }: any) => (
  <nav className="bg-white border-b sticky top-0 z-40 shadow-sm px-6 py-4 backdrop-blur-md bg-opacity-95">
    <div className="container mx-auto flex justify-between items-center">
      <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setView(currentUser ? 'dashboard' : 'landing')}>
        <LogoImage className="w-10 h-10 object-contain transition group-hover:scale-110" />
        <div className="flex flex-col">
          <span className="text-lg font-black tracking-tighter text-red-900 leading-none">UoC FoT Hub</span>
          <span className="text-[8px] font-black uppercase text-gray-400 tracking-widest">Innovation Center</span>
        </div>
      </div>
      <div className="flex items-center space-x-6">
        {currentUser ? (
          <>
            <div className="hidden md:block text-right">
              <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Active session</p>
              <p className="text-xs font-black text-red-900">{currentUser.name}</p>
            </div>
            <button onClick={onLogout} className="text-gray-300 hover:text-red-800 transition p-2"><i className="fas fa-power-off text-xl"></i></button>
          </>
        ) : (
          <button onClick={() => setView('login')} className="bg-red-800 text-white px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-900 transition">Portal Login</button>
        )}
      </div>
    </div>
  </nav>
);

const LandingPage = ({ setView }: any) => (
  <div 
    className="relative min-h-[90vh] flex flex-col items-center justify-center py-20 text-center animate-fade-in px-4 bg-cover bg-center"
    style={{ backgroundImage: `url('${BACKGROUND_IMAGE}')` }}
  >
    <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"></div>
    <div className="relative z-10 max-w-6xl mx-auto">
      <div className="mb-12">
        <LogoImage className="w-32 h-32 mb-6 animate-float mx-auto brightness-110" />
        <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 mb-8">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Official Institutional System</span>
        </div>
      </div>
      <h1 className="text-5xl md:text-7xl font-black mb-10 leading-[1.1] tracking-tighter text-white drop-shadow-2xl">
        <span className="block">University Of Colombo</span>
        <span className="block">Faculty of Technology</span>
        <span className="bg-gradient-to-r from-red-600 via-red-500 to-red-600 bg-clip-text text-transparent italic drop-shadow-md">
          Event Registration & Check in System
        </span>
      </h1>
      <p className="text-xl text-gray-200 max-w-3xl mx-auto mb-14 font-medium leading-relaxed drop-shadow-lg">
        The primary gateway for technical symposiums and faculty workshops.
      </p>
      <div className="flex flex-wrap justify-center gap-6">
        <button onClick={() => setView('register')} className="bg-red-800 text-white px-12 py-5 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-red-900 transition uppercase tracking-widest">Join Symposium</button>
        <button onClick={() => setView('login')} className="bg-white/10 backdrop-blur-lg text-white border-2 border-white/30 px-12 py-5 rounded-[2rem] font-black text-lg hover:bg-white/20 transition uppercase tracking-widest">Staff Portal</button>
      </div>
    </div>
  </div>
);

const LoginForm = ({ onLogin, setView }: any) => {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const sub = async (e: any) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const u = await DB.findUserByEmail(email);
      if (u && u.password === pw) {
        if (u.role === 'organizer' && u.status === 'pending') setErr('Account pending faculty verification.');
        else onLogin(u);
      } else setErr('Invalid institutional credentials.');
    } catch (err) { setErr('Connection timed out.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-14 rounded-[4rem] shadow-2xl mt-10 border border-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-900 to-red-600"></div>
      <button onClick={() => setView('landing')} className="mb-6 text-[10px] font-black uppercase text-gray-400 hover:text-red-800 transition flex items-center gap-2">
        <i className="fas fa-chevron-left"></i> Back to Home
      </button>
      <h2 className="text-4xl font-black mb-10 text-center tracking-tighter">Login</h2>
      {err && <div className="bg-red-50 text-red-800 p-5 rounded-2xl mb-8 text-xs font-black border border-red-100 flex items-center"><i className="fas fa-exclamation-circle mr-3"></i> {err}</div>}
      <form onSubmit={sub} className="space-y-8">
        <div>
          <label className="text-[10px] font-black uppercase text-gray-300 tracking-widest ml-4 mb-2 block">Email</label>
          <input type="email" required className="w-full bg-gray-50 border-none rounded-2xl px-8 py-5 font-bold outline-none focus:ring-2 focus:ring-red-800 transition" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-gray-300 tracking-widest ml-4 mb-2 block">Password</label>
          <input type="password" required className="w-full bg-gray-50 border-none rounded-2xl px-8 py-5 font-bold outline-none focus:ring-2 focus:ring-red-800 transition" value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-red-800 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-red-100 disabled:opacity-50">Sign In</button>
        <p className="text-center text-xs text-gray-400 font-bold cursor-pointer hover:text-red-800 transition" onClick={() => setView('register')}>Don't have an account? Register</p>
      </form>
    </div>
  );
};

const RegisterForm = ({ onLogin, setView }: any) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' as any });
  const [load, setLoad] = useState(false);

  const sub = async (e: any) => {
    e.preventDefault();
    setLoad(true);
    try {
      const u = await DB.createUser(form);
      if (u.role === 'organizer') { alert('Staff account creation successful. Awaiting Faculty Admin verification.'); setView('login'); }
      else onLogin(u);
    } catch (e) { alert('Registration failed. Email might already exist.'); }
    finally { setLoad(false); }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-14 rounded-[4rem] shadow-2xl mt-10 border border-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-900 to-red-600"></div>
      <button onClick={() => setView('landing')} className="mb-6 text-[10px] font-black uppercase text-gray-400 hover:text-red-800 transition flex items-center gap-2">
        <i className="fas fa-chevron-left"></i> Back to Home
      </button>
      <h2 className="text-4xl font-black mb-10 text-center tracking-tighter">Registration</h2>
      <form onSubmit={sub} className="space-y-5">
        <input type="text" placeholder="Full Name" required className="w-full bg-gray-50 border-none rounded-2xl px-8 py-4 font-bold" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input type="email" placeholder="Institutional Email" required className="w-full bg-gray-50 border-none rounded-2xl px-8 py-4 font-bold" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        <div className="bg-gray-50 rounded-2xl p-2 flex">
          <button type="button" onClick={() => setForm({...form, role: 'student'})} className={`flex-grow py-3 rounded-xl font-black text-[10px] uppercase transition ${form.role === 'student' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Student</button>
          <button type="button" onClick={() => setForm({...form, role: 'organizer'})} className={`flex-grow py-3 rounded-xl font-black text-[10px] uppercase transition ${form.role === 'organizer' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Staff</button>
        </div>
        <input type="password" placeholder="Password" required className="w-full bg-gray-50 border-none rounded-2xl px-8 py-4 font-bold" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        <button type="submit" disabled={load} className="w-full bg-red-800 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest mt-6 shadow-2xl shadow-red-100">Create Account</button>
        <p className="text-center text-xs text-gray-400 font-bold cursor-pointer hover:text-red-800 transition" onClick={() => setView('login')}>Already have an account? Login</p>
      </form>
    </div>
  );
};

const Dashboard = ({ user }: { user: User }) => (
  <div className="animate-fade-in">
    <div className="flex items-center space-x-4 mb-14">
      <div className="w-2 h-12 bg-red-800 rounded-full"></div>
      <div>
        <h2 className="text-4xl font-black tracking-tighter">Command Center</h2>
        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Faculty of Technology Portal</p>
      </div>
    </div>
    {user.role === 'admin' && <AdminDashboard />}
    {user.role === 'organizer' && <OrganizerDashboard user={user} />}
    {user.role === 'student' && <StudentDashboard user={user} />}
  </div>
);

const StudentDashboard = ({ user }: { user: User }) => {
  const [tab, setTab] = useState<'browse' | 'my'>('browse');
  const [events, setEvents] = useState<Event[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [load, setLoad] = useState(true);

  const refresh = async () => {
    setLoad(true);
    const [evs, my] = await Promise.all([DB.getEvents(), DB.getRegistrationsByUser(user._id)]);
    setEvents(evs.filter(e => e.status === 'approved'));
    setRegs(my);
    setLoad(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="container mx-auto px-4">
      <div className="flex space-x-4 bg-white p-2 rounded-2xl border inline-flex mb-12 shadow-sm">
        <button onClick={() => setTab('browse')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'browse' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Explore Events</button>
        <button onClick={() => setTab('my')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'my' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>My Digital Passes</button>
      </div>
      
      {load ? <div className="text-center py-32 text-red-800"><i className="fas fa-circle-notch fa-spin fa-4x"></i></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {tab === 'browse' ? (
            events.length === 0 ? <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-widest">No workshops scheduled.</div> : 
            events.map(e => (
              <div key={e._id} className="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-2xl transition duration-500 transform hover:-translate-y-2 group cursor-pointer" onClick={async () => {
                if (regs.some(r => r.eventId === e._id)) return alert('You are already registered for this event.');
                await DB.registerForEvent(user._id, user.name, e._id, e.title);
                refresh();
              }}>
                <div className="h-48 bg-gray-50 relative overflow-hidden">
                  <img src={e.posterUrl || 'https://via.placeholder.com/800x450?text=UoC+Tech+Event'} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg border border-white">
                    <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">{e.department}</span>
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-black mb-4 tracking-tighter group-hover:text-red-800 transition">{e.title}</h3>
                  <div className="flex flex-col space-y-3 mt-auto">
                    <div className="flex items-center text-xs font-bold text-gray-400">
                      <i className="far fa-calendar-alt w-6 text-red-800"></i> {e.date}
                    </div>
                    <div className="flex items-center text-xs font-bold text-gray-400">
                      <i className="far fa-clock w-6 text-red-800"></i> {e.startTime} - {e.endTime}
                    </div>
                    <div className="flex items-center text-xs font-bold text-gray-400">
                      <i className="fas fa-map-pin w-6 text-red-800"></i> {e.venue}
                    </div>
                  </div>
                  <button className="mt-8 w-full bg-red-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-50 hover:bg-red-900 transition">Register Now</button>
                </div>
              </div>
            ))
          ) : (
            regs.length === 0 ? <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-widest">Zero active registrations.</div> :
            regs.map(r => (
              <div key={r._id} className="bg-white rounded-[3.5rem] border border-gray-100 p-10 flex flex-col items-center text-center shadow-sm hover:shadow-xl transition duration-500">
                <span className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-6 ${r.status === 'checked-in' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>{r.status}</span>
                <h3 className="text-2xl font-black mb-6 tracking-tighter leading-tight">{r.eventTitle}</h3>
                <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 mb-8 shadow-inner">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${r.qrPayload}`} className="w-40 h-40 rounded-3xl shadow-2xl" />
                </div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Pass ID: {r._id.slice(0, 8)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const OrganizerDashboard = ({ user }: { user: User }) => {
  const [tab, setTab] = useState<'list' | 'create' | 'scan'>('list');
  const [events, setEvents] = useState<Event[]>([]);

  const refresh = async () => {
    const all = await DB.getEvents();
    setEvents(all.filter(e => e.organizerId === user._id));
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="container mx-auto px-4">
      <div className="flex space-x-4 bg-white p-2 rounded-2xl border inline-flex mb-12 shadow-sm">
        <button onClick={() => setTab('list')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'list' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>My Events</button>
        <button onClick={() => setTab('create')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'create' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>New Proposal</button>
        <button onClick={() => setTab('scan')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'scan' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Check-in Terminal</button>
      </div>
      
      {tab === 'list' && (
        <div className="space-y-6">
          {events.length === 0 ? <p className="text-center py-20 text-gray-300 font-black uppercase tracking-widest">No event proposals yet.</p> :
            events.map(e => (
              <div key={e._id} className="bg-white p-10 rounded-[3.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center border border-gray-50 hover:shadow-xl transition duration-500">
                <div className="flex items-center space-x-8 mb-6 md:mb-0">
                   <div className="w-20 h-20 bg-gray-50 rounded-3xl overflow-hidden flex-shrink-0">
                      <img src={e.posterUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                   </div>
                   <div>
                    <h3 className="text-3xl font-black tracking-tighter mb-2">{e.title}</h3>
                    <div className="flex items-center space-x-4">
                      <span className={`text-[10px] font-black uppercase px-4 py-1 rounded-full border ${e.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>{e.status}</span>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest italic">{e.date} • {e.startTime}-{e.endTime}</span>
                    </div>
                  </div>
                </div>
                <button onClick={async () => { if(confirm('Permanently delete this proposal?')) { await DB.deleteEvent(e._id); refresh(); } }} className="text-gray-200 hover:text-red-700 transition p-6 text-3xl"><i className="fas fa-trash-alt"></i></button>
              </div>
            ))
          }
        </div>
      )}
      {tab === 'create' && <CreateEventForm user={user} onDone={() => { setTab('list'); refresh(); }} onBack={() => setTab('list')} />}
      {tab === 'scan' && <CheckInScanner onBack={() => setTab('list')} />}
    </div>
  );
};

const CreateEventForm = ({ user, onDone, onBack }: any) => {
  const [form, setForm] = useState({ title: '', description: '', department: 'ICT', venue: '', date: '', startTime: '', endTime: '', maxParticipants: 50, posterUrl: '' });
  const [busy, setBusy] = useState<'poster' | 'desc' | 'submitting' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const genDesc = async () => {
    if (!form.title) return alert('Enter title first.');
    setBusy('desc');
    const d = await AIService.generateDescription(form.title, form.department);
    setForm({...form, description: d || ''});
    setBusy(null);
  };

  const genPoster = async () => {
    if (!form.title) return alert('Enter title first.');
    setBusy('poster');
    const p = await AIService.generatePoster(form.title, form.department, form.venue);
    setForm({...form, posterUrl: p || ''});
    setBusy(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setForm({ ...form, posterUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const sub = async (e: any) => {
    e.preventDefault();
    setBusy('submitting');
    await DB.createEvent({...form, organizerName: user.name, organizerEmail: user.email, organizerId: user._id});
    onDone();
  };

  return (
    <div className="bg-white p-14 rounded-[5rem] border border-gray-50 shadow-2xl animate-scale-up max-w-5xl mx-auto">
      <button onClick={onBack} className="mb-6 text-[10px] font-black uppercase text-gray-400 hover:text-red-800 transition flex items-center gap-2">
        <i className="fas fa-chevron-left"></i> Cancel & Return
      </button>
      <h3 className="text-4xl font-black mb-12 tracking-tighter">Event Proposal</h3>
      <form onSubmit={sub} className="space-y-10">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-300 tracking-widest ml-4 mb-2 block">Event Title</label>
              <input placeholder="Ex: AI Innovation Summit" required className="w-full bg-gray-50 p-6 rounded-[2rem] font-bold text-xl outline-none focus:ring-2 focus:ring-red-800 transition" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            </div>
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-gray-300 tracking-widest ml-4 mb-2 block">Abstract</label>
              <textarea placeholder="Event Abstract" required className="w-full bg-gray-50 p-8 rounded-[2.5rem] font-bold h-64 outline-none focus:ring-2 focus:ring-red-800 transition" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              <button type="button" onClick={genDesc} disabled={!!busy} className="absolute bottom-6 right-6 bg-red-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-50">
                {busy === 'desc' ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-magic mr-2"></i>} AI Assist
              </button>
            </div>
          </div>
          <div className="space-y-8">
            <div className="aspect-video bg-gray-50 rounded-[3rem] border-4 border-dashed border-gray-200 relative overflow-hidden flex items-center justify-center group">
              {form.posterUrl ? (
                <div className="relative w-full h-full">
                  <img src={form.posterUrl} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-red-950/80 via-red-900/60 to-transparent p-6 pt-12 flex items-end">
                    <h4 className="text-white font-black text-xl tracking-tighter line-clamp-2 drop-shadow-lg leading-none uppercase">{form.title || "Untitled Event"}</h4>
                  </div>
                </div>
              ) : (
                <div className="text-center p-10 opacity-20"><i className="fas fa-image text-6xl mb-4"></i><p className="font-black text-[10px] uppercase tracking-widest">No Visual Branding</p></div>
              )}
              <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white text-red-800 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 transition"><i className="fas fa-upload"></i></button>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
              <button type="button" onClick={genPoster} disabled={!!busy} className="absolute bottom-6 right-6 bg-red-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl disabled:opacity-50">AI Poster</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required className="bg-gray-50 p-5 rounded-[1.5rem] font-bold" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                <input placeholder="Venue" required className="bg-gray-50 p-5 rounded-[1.5rem] font-bold" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="time" required className="bg-gray-50 p-5 rounded-[1.5rem] font-bold" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                <input type="time" required className="bg-gray-50 p-5 rounded-[1.5rem] font-bold" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
        <button type="submit" disabled={!!busy} className="w-full bg-red-800 text-white py-6 rounded-[2.5rem] font-black text-2xl uppercase tracking-widest shadow-2xl disabled:opacity-50">Publish Proposal</button>
      </form>
    </div>
  );
};

const CheckInScanner = ({ onBack }: any) => {
  const [active, setActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const processCode = async (code: string) => {
    if (busy || !code) return;
    setBusy(true);
    try {
      const res = await DB.checkInUser(code);
      setResult(res);
      setActive(false);
    } catch (e) { alert('Check-in failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let rAF: number;
    const scan = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v?.readyState === v?.HAVE_ENOUGH_DATA && c) {
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const raw = ctx.getImageData(0, 0, c.width, c.height);
          const qr = jsQR(raw.data, raw.width, raw.height);
          if (qr && qr.data) { processCode(qr.data); return; }
        }
      }
      rAF = requestAnimationFrame(scan);
    };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      stream = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); rAF = requestAnimationFrame(scan); }
    });
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); cancelAnimationFrame(rAF); };
  }, [active]);

  if (result) return (
    <div className="max-w-md mx-auto text-center p-14 bg-white rounded-[5rem] shadow-2xl animate-scale-up">
      <div className={`w-32 h-32 mx-auto rounded-[3rem] flex items-center justify-center mb-10 text-white ${result.success ? 'bg-green-500 shadow-green-100' : 'bg-red-700 shadow-red-100'} shadow-2xl`}>
        <i className={`fas ${result.success ? 'fa-check' : 'fa-times'} text-5xl`}></i>
      </div>
      <h3 className="text-4xl font-black mb-4 tracking-tighter">{result.success ? 'Verified' : 'Access Denied'}</h3>
      <p className="text-gray-400 font-bold mb-12">{result.registration?.userName || result.message}</p>
      <div className="space-y-4">
        <button onClick={() => { setResult(null); setActive(true); }} className="w-full bg-red-800 text-white py-6 rounded-[2.5rem] font-black uppercase tracking-widest">Scan Next</button>
        <button onClick={onBack} className="w-full text-[10px] font-black uppercase text-gray-400 py-2">Return to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white p-14 rounded-[5rem] shadow-2xl text-center">
      <button onClick={onBack} className="mb-6 text-[10px] font-black uppercase text-gray-400 hover:text-red-800 transition flex items-center gap-2">
        <i className="fas fa-chevron-left"></i> Close Terminal
      </button>
      <h3 className="text-2xl font-black mb-10">Check-in Terminal</h3>
      <div className="aspect-square bg-gray-900 rounded-[4rem] mb-12 overflow-hidden relative">
        {active ? <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline /> : <button onClick={() => setActive(true)} className="bg-white text-red-800 px-14 py-6 rounded-[3rem] font-black shadow-2xl mt-32">Activate Camera</button>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [evs, setEvs] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [view, setView] = useState<'approvals' | 'inventory' | 'participants'>('approvals');
  const [inspectingEvent, setInspectingEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const [allE, allU, allP] = await Promise.all([DB.getEvents(), DB.getPendingUsers(), DB.getAllParticipants()]);
    setEvs(allE); setUsers(allU); setParticipants(allP);
  };

  const loadRegs = async (eventId: string) => {
    setLoading(true);
    const regs = await DB.getRegistrationsByEvent(eventId);
    setRegistrations(regs);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const pendingEvents = evs.filter(e => e.status === 'pending');

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="flex flex-wrap gap-4 bg-white p-2 rounded-3xl border inline-flex shadow-sm">
        <button onClick={() => setView('approvals')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'approvals' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Approvals ({pendingEvents.length + users.length})</button>
        <button onClick={() => setView('inventory')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'inventory' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Events ({evs.length})</button>
        <button onClick={() => setView('participants')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'participants' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Check-ins ({participants.length})</button>
      </div>

      {view === 'approvals' && (
        <div className="grid gap-8">
          <div className="bg-white p-10 rounded-[4rem] shadow-sm border">
            <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest mb-8">Event Queue</h4>
            {pendingEvents.map(e => (
              <div key={e._id} className="flex justify-between items-center border-b py-6 last:border-0">
                <div>
                  <h3 className="font-black text-lg">{e.title}</h3>
                  <p className="text-[10px] font-bold text-gray-400">By {e.organizerName} • {e.date}</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => DB.updateEventStatus(e._id, 'approved').then(refresh)} className="bg-green-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
                  <button onClick={() => DB.updateEventStatus(e._id, 'rejected').then(refresh)} className="bg-red-50 text-red-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white p-10 rounded-[4rem] shadow-sm border">
            <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest mb-8">Staff Verification</h4>
            {users.map(u => (
              <div key={u._id} className="flex justify-between items-center border-b py-6 last:border-0">
                <div>
                  <h3 className="font-black text-lg">{u.name}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.email}</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => DB.updateUserStatus(u._id, 'approved').then(refresh)} className="bg-red-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Verify</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'inventory' && (
        <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-10 py-6">Event & Schedule</th>
                <th className="px-10 py-6">Organizer Info</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {evs.map(e => (
                <tr key={e._id} className="hover:bg-gray-50 transition">
                  <td className="px-10 py-6">
                    <p className="font-black">{e.title}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{e.date} • {e.startTime}-{e.endTime}</p>
                  </td>
                  <td className="px-10 py-6">
                    <p className="font-black text-red-900">{e.organizerName}</p>
                    <p className="text-[10px] font-bold text-gray-400">{e.organizerEmail}</p>
                  </td>
                  <td className="px-10 py-6 text-right space-x-2">
                    <button onClick={() => { setInspectingEvent(e); loadRegs(e._id); }} className="bg-gray-900 text-white p-3 rounded-xl hover:bg-red-800 transition"><i className="fas fa-users"></i></button>
                    <button onClick={() => DB.deleteEvent(e._id).then(refresh)} className="bg-red-50 text-red-800 p-3 rounded-xl hover:bg-red-100 transition"><i className="fas fa-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'participants' && (
        <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden">
          <div className="p-10 border-b">
             <h3 className="text-2xl font-black tracking-tighter">Live Attendance Registry</h3>
             <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Permanent entry logs for faculty audits</p>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-10 py-6">Participant</th>
                <th className="px-10 py-6">Event Window</th>
                <th className="px-10 py-6">Check-in Time</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm font-bold">
              {participants.map(p => (
                <tr key={p.id} className="hover:bg-green-50/30 transition">
                  <td className="px-10 py-6">{p.user_name}</td>
                  <td className="px-10 py-6 uppercase text-xs">{p.event_title}</td>
                  <td className="px-10 py-6 text-red-800">{new Date(p.check_in_time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inspectingEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
            <div className="bg-red-800 p-10 text-white flex justify-between items-center">
              <div>
                <h3 className="text-3xl font-black tracking-tighter mb-2">{inspectingEvent.title}</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Registry Management</p>
              </div>
              <button onClick={() => setInspectingEvent(null)} className="text-4xl">&times;</button>
            </div>
            <div className="flex-grow overflow-y-auto p-10">
              <div className="grid grid-cols-3 gap-6 mb-10 text-center">
                 <div className="bg-gray-50 p-6 rounded-3xl"><p className="text-[8px] font-black uppercase text-gray-400 mb-1">Total</p><p className="text-3xl font-black">{registrations.length}</p></div>
                 <div className="bg-green-50 p-6 rounded-3xl"><p className="text-[8px] font-black uppercase text-green-600 mb-1">Present</p><p className="text-3xl font-black text-green-700">{registrations.filter(r => r.status === 'checked-in').length}</p></div>
                 <div className="bg-red-50 p-6 rounded-3xl"><p className="text-[8px] font-black uppercase text-red-600 mb-1">Absent</p><p className="text-3xl font-black text-red-700">{registrations.filter(r => r.status === 'registered').length}</p></div>
              </div>
              <table className="w-full text-left text-sm">
                <thead><tr className="text-[10px] font-black uppercase text-gray-400"><th className="pb-4">Name</th><th className="pb-4">Status</th></tr></thead>
                <tbody className="divide-y">
                  {registrations.map(r => (
                    <tr key={r._id}><td className="py-4 font-black">{r.userName}</td><td className="py-4"><span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${r.status === 'checked-in' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-800'}`}>{r.status}</span></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AIChatbot = ({ events }: any) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="fixed bottom-10 right-10 bg-red-800 text-white w-20 h-20 rounded-[2rem] shadow-2xl flex items-center justify-center text-3xl hover:scale-110 transition z-50 animate-float"><i className="fas fa-microchip"></i></button>
  );

  return (
    <div className="fixed bottom-10 right-10 w-96 h-[600px] bg-white rounded-[4rem] shadow-2xl flex flex-col border overflow-hidden animate-scale-up z-50">
      <div className="bg-red-800 p-10 text-white flex justify-between items-center">
        <div><span className="font-black text-xl block leading-none">FoT-Bot AI</span><span className="text-[10px] font-black uppercase opacity-60">Faculty Virtual Assistant</span></div>
        <button onClick={() => setOpen(false)} className="text-3xl">&times;</button>
      </div>
      <div className="flex-grow p-8 overflow-y-auto space-y-6 bg-gray-50/50">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-xs p-5 rounded-[2rem] font-bold shadow-sm max-w-[85%] ${m.role === 'user' ? 'bg-red-800 text-white' : 'bg-white text-gray-800 border'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="text-[10px] font-black uppercase text-red-800 animate-pulse">FoT-Bot is thinking...</div>}
      </div>
      <form className="p-8 border-t bg-white flex gap-4" onSubmit={async (e) => {
        e.preventDefault(); if (!q.trim()) return;
        const msg = q; setQ(''); setMsgs(prev => [...prev, {role: 'user', text: msg}]);
        setLoading(true);
        const res = await AIService.askAssistant(msg, events);
        setMsgs(prev => [...prev, {role: 'bot', text: res}]);
        setLoading(false);
      }}>
        <input placeholder="Ask FoT-Bot..." className="flex-grow bg-gray-50 p-5 rounded-2xl text-xs font-bold outline-none" value={q} onChange={e => setQ(e.target.value)} />
        <button className="bg-red-800 text-white w-14 h-14 rounded-2xl flex-shrink-0"><i className="fas fa-paper-plane"></i></button>
      </form>
    </div>
  );
};

const AssistantWrapper = () => {
  const [evs, setEvs] = useState<Event[]>([]);
  useEffect(() => { DB.getEvents().then(all => setEvs(all.filter(e => e.status === 'approved'))); }, []);
  return <AIChatbot events={evs} />;
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
