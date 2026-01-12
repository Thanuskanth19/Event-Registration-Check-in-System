
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import jsQR from "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm";
import { User, Event, Registration } from './types';
import { DB } from './db';

// --- CONSTANTS ---
const UNIVERSITY_LOGO = "/logo.png";
const LOGO_FALLBACK = "https://upload.wikimedia.org/wikipedia/en/thumb/0/07/University_of_Colombo_crest.png/512px-University_of_Colombo_crest.png";
const BACKGROUND_IMAGE = "/background.jpeg";
const ADMIN_PHOTO = "/admin.png";

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
    const prompt = `A professional university event poster for "${title}". Faculty of Technology style. Modern tech theme. High resolution university graphic.`;
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

// --- REUSABLE COMPONENTS ---

const NavigationLink = ({ onClick, children, className = "" }: { onClick: () => void, children?: React.ReactNode, className?: string }) => (
  <button onClick={onClick} className={`text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-800 transition-all flex items-center gap-2 group ${className}`}>
    <i className="fas fa-chevron-left transition-transform group-hover:-translate-x-1"></i>
    {children}
  </button>
);

const UserAvatar = ({ user, className = "w-10 h-10" }: { user: User, className?: string }) => {
  const photo = user.profilePhoto || (user.role === 'admin' ? ADMIN_PHOTO : null);
  return (
    <div className={`${className} rounded-full overflow-hidden border-2 border-red-800/20 bg-gray-100 flex items-center justify-center shadow-sm`}>
      {photo ? (
        <img src={photo} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        <i className="fas fa-user text-gray-300"></i>
      )}
    </div>
  );
};

// --- MAIN APPLICATION COMPONENT ---

const App = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register' | 'dashboard'>('landing');
  const [dbReady, setDbReady] = useState(false);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('unievents_current_user');
    setView('landing');
  };

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
      <Navbar currentUser={currentUser} onLogout={handleLogout} setView={setView} />
      <main className={`flex-grow ${view === 'landing' ? '' : 'container mx-auto px-4 py-8'}`}>
        {view === 'landing' && <LandingPage setView={setView} />}
        {view === 'login' && <LoginForm onLogin={(u: User) => { setCurrentUser(u); localStorage.setItem('unievents_current_user', JSON.stringify(u)); setView('dashboard'); }} setView={setView} />}
        {view === 'register' && <RegisterForm onLogin={(u: User) => { setCurrentUser(u); localStorage.setItem('unievents_current_user', JSON.stringify(u)); setView('dashboard'); }} setView={setView} />}
        {view === 'dashboard' && currentUser && <Dashboard user={currentUser} onReturnToLanding={() => setView('landing')} />}
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
            <div className="hidden md:flex items-center gap-3 text-right">
              <div className="flex flex-col">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Institutional Profile</p>
                <p className="text-xs font-black text-red-900">{currentUser.name}</p>
                <p className="text-[8px] font-bold text-gray-400">{currentUser.uniId}</p>
              </div>
              <UserAvatar user={currentUser} className="w-9 h-9" />
            </div>
            <button onClick={onLogout} title="Logout" className="text-gray-300 hover:text-red-800 transition p-2"><i className="fas fa-power-off text-xl"></i></button>
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
      <NavigationLink onClick={() => setView('landing')} className="mb-6">Back to Landing</NavigationLink>
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
        <button type="submit" disabled={loading} className="w-full bg-red-800 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-red-100 disabled:opacity-50 text-xs">Sign In</button>
        <p className="text-center text-xs text-gray-400 font-bold cursor-pointer hover:text-red-800 transition" onClick={() => setView('register')}>Don't have an account? Register</p>
      </form>
    </div>
  );
};

const RegisterForm = ({ onLogin, setView }: any) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', uniId: '', role: 'student' as any, profilePhoto: '' });
  const [load, setLoad] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, profilePhoto: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const sub = async (e: any) => {
    e.preventDefault();
    if (!form.uniId) return alert('University ID is required.');
    if (!form.profilePhoto) return alert('Profile photo is required for institutional verification.');
    setLoad(true);
    try {
      const u = await DB.createUser(form);
      if (u.role === 'organizer') { alert('Staff account creation successful. Awaiting Faculty Admin verification.'); setView('login'); }
      else onLogin(u);
    } catch (e) { alert('Registration failed. Email or Uni ID might already exist.'); }
    finally { setLoad(false); }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-14 rounded-[4rem] shadow-2xl mt-10 border border-gray-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-900 to-red-600"></div>
      <NavigationLink onClick={() => setView('landing')} className="mb-6">Back to Landing</NavigationLink>
      <h2 className="text-3xl font-black mb-8 text-center tracking-tighter leading-none">Institutional Enrollment</h2>
      
      <div className="flex justify-center mb-8">
        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-gray-50 shadow-inner flex items-center justify-center bg-gray-100 transition group-hover:bg-gray-200">
            {form.profilePhoto ? (
              <img src={form.profilePhoto} className="w-full h-full object-cover" alt="Profile Preview" />
            ) : (
              <i className="fas fa-camera text-2xl text-gray-300"></i>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-red-800 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg border-2 border-white">
            <i className="fas fa-plus text-[10px]"></i>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
        </div>
      </div>

      <form onSubmit={sub} className="space-y-4">
        <input type="text" placeholder="Full Institutional Name" required className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-sm" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input type="text" placeholder="University ID (e.g. 2021/ICT/001)" required className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-sm" value={form.uniId} onChange={e => setForm({...form, uniId: e.target.value})} />
        <input type="email" placeholder="Institutional Email" required className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-sm" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
        <div className="bg-gray-50 rounded-2xl p-2 flex">
          <button type="button" onClick={() => setForm({...form, role: 'student'})} className={`flex-grow py-3 rounded-xl font-black text-[10px] uppercase transition ${form.role === 'student' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Student</button>
          <button type="button" onClick={() => setForm({...form, role: 'organizer'})} className={`flex-grow py-3 rounded-xl font-black text-[10px] uppercase transition ${form.role === 'organizer' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Staff</button>
        </div>
        <input type="password" placeholder="Password" required className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-sm" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        <button type="submit" disabled={load} className="w-full bg-red-800 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest mt-4 shadow-2xl shadow-red-100 text-xs">Enroll Now</button>
        <p className="text-center text-[10px] text-gray-400 font-bold cursor-pointer hover:text-red-800 transition" onClick={() => setView('login')}>Already have an account? Portal Login</p>
      </form>
    </div>
  );
};

// --- DASHBOARD WRAPPER ---

const Dashboard = ({ user, onReturnToLanding }: { user: User, onReturnToLanding: () => void }) => {
  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-2 h-12 bg-red-800 rounded-full"></div>
          <div>
            <h2 className="text-3xl font-black tracking-tighter leading-none mb-1">Command Center</h2>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Faculty Management Interface</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onReturnToLanding}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-800 hover:border-red-100 transition shadow-sm group"
          >
            <i className="fas fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
            Exit Dashboard
          </button>
        </div>
      </div>
      
      <div className="bg-white/40 backdrop-blur-sm rounded-[3rem] p-1 border border-white/50 shadow-inner min-h-[600px]">
        {user.role === 'admin' && <AdminDashboard />}
        {user.role === 'organizer' && <OrganizerDashboard user={user} />}
        {user.role === 'student' && <StudentDashboard user={user} />}
      </div>
    </div>
  );
};

// --- SUB-DASHBOARDS ---

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
    <div className="container mx-auto px-4 py-8">
      <div className="flex space-x-4 bg-white p-2 rounded-2xl border inline-flex mb-12 shadow-sm">
        <button onClick={() => setTab('browse')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'browse' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Explore Workshops</button>
        <button onClick={() => setTab('my')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'my' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>My Admission Passes</button>
      </div>
      
      {load ? <div className="text-center py-32 text-red-800"><i className="fas fa-circle-notch fa-spin fa-4x"></i></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {tab === 'browse' ? (
            events.length === 0 ? <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-widest">No active sessions scheduled.</div> : 
            events.map(e => (
              <div key={e._id} className="bg-white rounded-[3rem] overflow-hidden shadow-sm border border-gray-100 flex flex-col hover:shadow-2xl transition duration-500 transform hover:-translate-y-2 group cursor-pointer" onClick={async () => {
                if (regs.some(r => r.eventId === e._id)) return alert('You already hold a pass for this workshop.');
                await DB.registerForEvent(user._id, user.name, e._id, e.title);
                refresh();
              }}>
                <div className="h-48 bg-gray-50 relative overflow-hidden">
                  <img src={e.posterUrl || 'https://via.placeholder.com/800x450?text=Institutional+Syllabus'} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" alt={e.title} />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg border border-white">
                    <span className="text-[10px] font-black text-red-800 uppercase tracking-widest">{e.department}</span>
                  </div>
                </div>
                <div className="p-8 flex flex-col flex-grow">
                  <h3 className="text-2xl font-black mb-4 tracking-tighter group-hover:text-red-800 transition">{e.title}</h3>
                  <div className="flex flex-col space-y-3 mt-auto">
                    <div className="flex items-center text-xs font-bold text-gray-400"><i className="far fa-calendar-alt w-6 text-red-800"></i> {e.date}</div>
                    <div className="flex items-center text-xs font-bold text-gray-400"><i className="far fa-clock w-6 text-red-800"></i> {e.startTime} - {e.endTime}</div>
                    <div className="flex items-center text-xs font-bold text-gray-400"><i className="fas fa-map-pin w-6 text-red-800"></i> {e.venue}</div>
                  </div>
                  <button className="mt-8 w-full bg-red-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-50 hover:bg-red-900 transition">Acquire Admission Pass</button>
                </div>
              </div>
            ))
          ) : (
            regs.length === 0 ? <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-widest">No active passes.</div> :
            regs.map(r => (
              <div key={r._id} className="bg-white rounded-[3.5rem] border border-gray-100 p-10 flex flex-col items-center text-center shadow-sm hover:shadow-xl transition duration-500">
                <span className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-6 ${r.status === 'checked-in' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>{r.status}</span>
                <h3 className="text-2xl font-black mb-6 tracking-tighter leading-tight">{r.eventTitle}</h3>
                <div className="bg-gray-50 p-6 rounded-[2.5rem] border border-gray-100 mb-8 shadow-inner">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${r.qrPayload}`} className="w-40 h-40 rounded-3xl shadow-2xl" alt="Admission QR" />
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Faculty Identification Pass</p>
                   <p className="text-xs font-bold text-red-800">{user.uniId}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const OrganizerDashboard = ({ user }: { user: User }) => {
  const [tab, setTab] = useState<'list' | 'create' | 'scan' | 'attendance'>('list');
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);

  const refresh = async () => {
    const [allE, allP] = await Promise.all([DB.getEvents(), DB.getAllParticipants()]);
    const myEvents = allE.filter(e => e.organizerId === user._id);
    const myEventIds = myEvents.map(e => e._id);
    setEvents(myEvents);
    setAttendance(allP.filter(p => myEventIds.includes(p.event_id)));
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap gap-4 bg-white p-2 rounded-2xl border inline-flex mb-12 shadow-sm">
        <button onClick={() => setTab('list')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'list' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>My Sessions</button>
        <button onClick={() => setTab('create')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'create' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Host Workshop</button>
        <button onClick={() => setTab('scan')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'scan' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Entry Terminal</button>
        <button onClick={() => setTab('attendance')} className={`px-10 py-3 rounded-xl font-black text-[10px] uppercase transition ${tab === 'attendance' ? 'bg-red-800 text-white shadow-lg shadow-red-100' : 'text-gray-400'}`}>Attendance Log ({attendance.length})</button>
      </div>
      
      {tab === 'list' && (
        <div className="space-y-6">
          {events.length === 0 ? <p className="text-center py-20 text-gray-300 font-black uppercase tracking-widest">No active sessions proposed.</p> :
            events.map(e => (
              <div key={e._id} className="bg-white p-10 rounded-[3.5rem] shadow-sm flex flex-col md:flex-row justify-between items-center border border-gray-50 hover:shadow-xl transition duration-500">
                <div className="flex items-center space-x-8 mb-6 md:mb-0">
                   <div className="w-20 h-20 bg-gray-50 rounded-3xl overflow-hidden flex-shrink-0">
                      <img src={e.posterUrl || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" alt={e.title} />
                   </div>
                   <div>
                    <h3 className="text-3xl font-black tracking-tighter mb-2">{e.title}</h3>
                    <div className="flex items-center space-x-4">
                      <span className={`text-[10px] font-black uppercase px-4 py-1 rounded-full border ${e.status === 'approved' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>{e.status}</span>
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest italic">{e.date} • {e.startTime}-{e.endTime}</span>
                    </div>
                  </div>
                </div>
                <button onClick={async () => { if(confirm('Delete this session proposal?')) { await DB.deleteEvent(e._id); refresh(); } }} className="text-gray-200 hover:text-red-700 transition p-6 text-3xl"><i className="fas fa-trash-alt"></i></button>
              </div>
            ))
          }
        </div>
      )}
      
      {tab === 'attendance' && (
        <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden animate-scale-up">
          <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="text-2xl font-black tracking-tighter">My Workshop Attendance</h3>
            <button onClick={refresh} className="bg-red-50 text-red-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition"><i className="fas fa-sync-alt mr-2"></i> Sync Attendance</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-10 py-6">Attendee</th>
                <th className="px-10 py-6">Workshop</th>
                <th className="px-10 py-6">Check-in Time</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm font-bold">
              {attendance.length === 0 ? <tr><td colSpan={3} className="px-10 py-20 text-center text-gray-300 font-black uppercase tracking-widest">No check-ins recorded yet.</td></tr> : 
                attendance.map(p => (
                  <tr key={p.id} className="hover:bg-green-50/20 transition">
                    <td className="px-10 py-6 text-red-900">{p.user_name}</td>
                    <td className="px-10 py-6 text-gray-500 text-xs uppercase tracking-tight">{p.event_title}</td>
                    <td className="px-10 py-6 text-gray-400">{new Date(p.check_in_time).toLocaleString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
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
      <div className="flex justify-between items-center mb-12">
        <h3 className="text-4xl font-black tracking-tighter">Event Proposal</h3>
        <button onClick={onBack} className="px-6 py-2 bg-gray-50 text-gray-400 hover:text-red-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition">Cancel & Back</button>
      </div>
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
                  <img src={form.posterUrl} className="w-full h-full object-cover" alt="Poster Preview" />
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
        <button onClick={() => { setResult(null); setActive(true); }} className="w-full bg-red-800 text-white py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-xs">Next Admission</button>
        <button onClick={onBack} className="w-full text-[10px] font-black uppercase text-gray-400 py-2 hover:text-red-800 transition">Return to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white p-14 rounded-[5rem] shadow-2xl text-center">
      <div className="flex justify-between items-center mb-10">
        <h3 className="text-2xl font-black">Scanning Terminal</h3>
        <button onClick={onBack} className="px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
      </div>
      <div className="aspect-square bg-gray-900 rounded-[4rem] mb-12 overflow-hidden relative">
        {active ? <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline /> : <button onClick={() => setActive(true)} className="bg-white text-red-800 px-14 py-6 rounded-[3rem] font-black shadow-2xl mt-32 text-xs">Activate Camera</button>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [evs, setEvs] = useState<Event[]>([]);
  const [pendingStaff, setPendingStaff] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [view, setView] = useState<'approvals' | 'inventory' | 'participants' | 'users'>('approvals');
  const [userCategory, setUserCategory] = useState<'all' | 'student' | 'organizer' | 'admin'>('all');
  const [inspectingUser, setInspectingUser] = useState<User | null>(null);
  const [inspectingUserRegs, setInspectingUserRegs] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [allE, allPendingU, allP, allUsersList] = await Promise.all([
      DB.getEvents(), 
      DB.getPendingUsers(), 
      DB.getAllParticipants(), 
      DB.getAllUsers()
    ]);
    setEvs(allE); 
    setPendingStaff(allPendingU); 
    setParticipants(allP); 
    setAllUsers(allUsersList);
    setLoading(false);
  };

  const loadUserInsight = async (user: User) => {
    setInspectingUser(user);
    const regs = await DB.getRegistrationsByUser(user._id);
    setInspectingUserRegs(regs);
  };

  useEffect(() => { refresh(); }, []);

  const pendingEvents = evs.filter(e => e.status === 'pending');
  const filteredUsers = userCategory === 'all' ? allUsers : allUsers.filter(u => u.role === userCategory);

  return (
    <div className="space-y-12 animate-fade-in p-8">
      {/* Intelligence Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Enrolled Students', count: allUsers.filter(u => u.role === 'student').length, icon: 'fa-user-graduate', color: 'text-red-800' },
          { label: 'Staff Proposals', count: pendingEvents.length, icon: 'fa-file-invoice', color: 'text-orange-600' },
          { label: 'Live Workshops', count: evs.filter(e => e.status === 'approved').length, icon: 'fa-broadcast-tower', color: 'text-green-600' },
          { label: 'Total Check-ins', count: participants.length, icon: 'fa-id-card-alt', color: 'text-blue-600' }
        ].map((stat, i) => (
          <div key={i} className="bg-white/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.count}</p>
            </div>
            <div className={`w-12 h-12 ${stat.color} bg-gray-50 rounded-2xl flex items-center justify-center text-xl`}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 bg-white p-2 rounded-3xl border inline-flex shadow-sm">
        <button onClick={() => setView('approvals')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'approvals' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Requests ({pendingEvents.length + pendingStaff.length})</button>
        <button onClick={() => setView('inventory')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'inventory' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Workshops ({evs.length})</button>
        <button onClick={() => setView('users')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'users' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Registry ({allUsers.length})</button>
        <button onClick={() => setView('participants')} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase transition ${view === 'participants' ? 'bg-red-800 text-white shadow-xl' : 'text-gray-400'}`}>Activity Log ({participants.length})</button>
      </div>

      {view === 'participants' && (
        <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden animate-scale-up">
          <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="text-2xl font-black tracking-tighter">Institutional Activity Log</h3>
            <button onClick={refresh} className="bg-red-50 text-red-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition"><i className="fas fa-sync-alt mr-2"></i> Sync Log</button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-10 py-6">Institutional Member</th>
                <th className="px-10 py-6">Event Context</th>
                <th className="px-10 py-6">Check-in Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm font-bold">
              {loading ? (
                <tr><td colSpan={3} className="px-10 py-20 text-center"><i className="fas fa-circle-notch fa-spin text-red-800 text-2xl"></i></td></tr>
              ) : participants.length === 0 ? (
                <tr><td colSpan={3} className="px-10 py-20 text-center text-gray-300 font-black uppercase tracking-widest">No activity recorded.</td></tr>
              ) : participants.map(p => (
                <tr key={p.id} className="hover:bg-green-50/20 transition">
                  <td className="px-10 py-6 text-red-900">{p.user_name}</td>
                  <td className="px-10 py-6 text-gray-500 text-xs uppercase tracking-tight">{p.event_title}</td>
                  <td className="px-10 py-6 text-gray-400 font-mono text-[10px]">{new Date(p.check_in_time).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'approvals' && (
        <div className="grid lg:grid-cols-2 gap-8 animate-scale-up">
          <div className="bg-white p-10 rounded-[4rem] shadow-sm border">
            <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest mb-8">Event Queue</h4>
            {pendingEvents.length === 0 ? <p className="text-center py-10 text-gray-300 font-bold uppercase tracking-widest text-xs">Queue Clear</p> : pendingEvents.map(e => (
              <div key={e._id} className="flex justify-between items-center border-b py-6 last:border-0 hover:bg-gray-50/50 px-4 rounded-2xl transition group">
                <div>
                  <h3 className="font-black text-lg group-hover:text-red-800 transition">{e.title}</h3>
                  <p className="text-[10px] font-bold text-gray-400">Proposed by {e.organizerName}</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => DB.updateEventStatus(e._id, 'approved').then(refresh)} className="bg-green-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Approve</button>
                  <button onClick={() => DB.updateEventStatus(e._id, 'rejected').then(refresh)} className="bg-red-50 text-red-800 px-6 py-2 rounded-xl text-[10px] font-black uppercase">Reject</button>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white p-10 rounded-[4rem] shadow-sm border">
            <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest mb-8">Staff Credential Queue</h4>
            {pendingStaff.length === 0 ? <p className="text-center py-10 text-gray-300 font-bold uppercase tracking-widest text-xs">All Staff Verified</p> : pendingStaff.map(u => (
              <div key={u._id} className="flex justify-between items-center border-b py-6 last:border-0 hover:bg-gray-50/50 px-4 rounded-2xl transition">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => loadUserInsight(u)}>
                  <UserAvatar user={u} className="w-12 h-12" />
                  <div>
                    <h3 className="font-black text-lg">{u.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.uniId}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => DB.updateUserStatus(u._id, 'approved').then(refresh)} className="bg-red-800 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Verify</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'users' && (
        <div className="animate-scale-up space-y-6">
          <div className="flex flex-wrap gap-4 bg-gray-100/50 p-2 rounded-2xl border inline-flex">
            <button onClick={() => setUserCategory('all')} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition ${userCategory === 'all' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>All Members ({allUsers.length})</button>
            <button onClick={() => setUserCategory('student')} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition ${userCategory === 'student' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Students ({allUsers.filter(u => u.role === 'student').length})</button>
            <button onClick={() => setUserCategory('organizer')} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition ${userCategory === 'organizer' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Staff ({allUsers.filter(u => u.role === 'organizer').length})</button>
            <button onClick={() => setUserCategory('admin')} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase transition ${userCategory === 'admin' ? 'bg-white shadow-sm text-red-800' : 'text-gray-400'}`}>Admins ({allUsers.filter(u => u.role === 'admin').length})</button>
          </div>
          
          <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                <tr>
                  <th className="px-10 py-6">Institutional Member</th>
                  <th className="px-10 py-6">Affiliation</th>
                  <th className="px-10 py-6">Contact</th>
                  <th className="px-10 py-6 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={4} className="px-10 py-20 text-center text-gray-300 font-black uppercase tracking-widest">No members found in this category.</td></tr>
                ) : filteredUsers.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50/50 transition cursor-pointer group" onClick={() => loadUserInsight(u)}>
                    <td className="px-10 py-6 flex items-center gap-4">
                      <UserAvatar user={u} className="w-10 h-10" />
                      <div>
                        <p className="font-black text-red-900 group-hover:underline leading-none mb-1">{u.name}</p>
                        <p className="text-[10px] font-bold text-gray-400">{u.uniId}</p>
                      </div>
                    </td>
                    <td className="px-10 py-6 uppercase font-black text-[10px] tracking-widest">
                      <span className={`px-3 py-1 rounded-lg ${u.role === 'admin' ? 'bg-red-900 text-white' : u.role === 'organizer' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-10 py-6 font-bold text-gray-500">{u.email}</td>
                    <td className="px-10 py-6 text-right">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-800'}`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {view === 'inventory' && (
        <div className="bg-white rounded-[4rem] border shadow-sm overflow-hidden animate-scale-up">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
              <tr>
                <th className="px-10 py-6">Workshop Syllabus</th>
                <th className="px-10 py-6">Lead</th>
                <th className="px-10 py-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {evs.map(e => (
                <tr key={e._id} className="hover:bg-gray-50 transition">
                  <td className="px-10 py-6">
                    <p className="font-black text-red-900">{e.title}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{e.date}</p>
                  </td>
                  <td className="px-10 py-6 font-bold text-gray-600">{e.organizerName}</td>
                  <td className="px-10 py-6 text-right">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${e.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Insight Modal */}
      {inspectingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-scale-up">
            <div className="bg-red-800 p-10 text-white flex flex-col items-center text-center shrink-0">
              <div className="w-full flex justify-end mb-4">
                 <button onClick={() => setInspectingUser(null)} className="text-2xl hover:opacity-50 transition">&times;</button>
              </div>
              <UserAvatar user={inspectingUser} className="w-32 h-32 mb-6 border-4 border-white/20" />
              <h3 className="text-3xl font-black tracking-tighter leading-none mb-2">{inspectingUser.name}</h3>
              <p className="text-xs font-black uppercase tracking-widest opacity-60">Registry Details</p>
            </div>
            
            <div className="flex-grow overflow-y-auto p-10 space-y-10">
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                     <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Institutional ID</p>
                     <p className="text-lg font-black text-red-900">{inspectingUser.uniId}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                     <p className="text-[9px] font-black uppercase text-gray-400 mb-1">System Status</p>
                     <p className="text-lg font-black uppercase">{inspectingUser.status}</p>
                  </div>
               </div>
               
               <div className="bg-white border rounded-[3rem] overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-8 py-5 border-b flex justify-between items-center">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Participation History</h4>
                    <span className="text-[10px] font-black text-red-800">{inspectingUserRegs.length} Records</span>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-white border-b"><tr className="text-[9px] font-black uppercase text-gray-300"><th className="px-8 py-4">Event Title</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Timestamp</th></tr></thead>
                      <tbody className="divide-y">
                        {inspectingUserRegs.length === 0 ? <tr><td colSpan={3} className="p-10 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">No Participation History</td></tr> : 
                          inspectingUserRegs.map(r => (
                            <tr key={r._id} className="hover:bg-gray-50 transition">
                              <td className="px-8 py-4 font-black text-red-900">{r.eventTitle}</td>
                              <td className="px-8 py-4">
                                <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${r.status === 'checked-in' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-800'}`}>
                                  {r.status === 'checked-in' ? 'Present' : 'Registered'}
                                </span>
                              </td>
                              <td className="px-8 py-4 text-xs text-gray-400 font-bold">{new Date(r.timestamp).toLocaleDateString()}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- AI ASSISTANT ---

const AIChatbot = ({ events }: any) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="fixed bottom-10 right-10 bg-red-800 text-white w-20 h-20 rounded-[2rem] shadow-2xl flex items-center justify-center text-3xl hover:scale-110 transition z-50 animate-float shadow-red-200"><i className="fas fa-microchip"></i></button>
  );

  return (
    <div className="fixed bottom-10 right-10 w-96 h-[600px] bg-white rounded-[4rem] shadow-2xl flex flex-col border overflow-hidden animate-scale-up z-50">
      <div className="bg-red-800 p-10 text-white flex justify-between items-center shrink-0">
        <div><span className="font-black text-xl block leading-none">FoT-Bot AI</span><span className="text-[10px] font-black uppercase opacity-60">Virtual Assistant</span></div>
        <button onClick={() => setOpen(false)} className="text-3xl hover:opacity-50 transition">&times;</button>
      </div>
      <div className="flex-grow p-8 overflow-y-auto space-y-6 bg-gray-50/50">
        {msgs.length === 0 && <p className="text-center text-gray-300 font-black uppercase text-[10px] mt-20">Ask about faculty events...</p>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`text-xs p-5 rounded-[2rem] font-bold shadow-sm max-w-[85%] ${m.role === 'user' ? 'bg-red-800 text-white' : 'bg-white text-gray-800 border'}`}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="text-[10px] font-black uppercase text-red-800 animate-pulse">FoT-Bot is thinking...</div>}
      </div>
      <form className="p-8 border-t bg-white flex gap-4 shrink-0" onSubmit={async (e) => {
        e.preventDefault(); if (!q.trim()) return;
        const msg = q; setQ(''); setMsgs(prev => [...prev, {role: 'user', text: msg}]);
        setLoading(true);
        const res = await AIService.askAssistant(msg, events);
        setMsgs(prev => [...prev, {role: 'bot', text: res}]);
        setLoading(false);
      }}>
        <input placeholder="Ask FoT-Bot..." className="flex-grow bg-gray-50 p-5 rounded-2xl text-xs font-bold outline-none" value={q} onChange={e => setQ(e.target.value)} />
        <button type="submit" className="bg-red-800 text-white w-14 h-14 rounded-2xl flex-shrink-0 shadow-lg shadow-red-100 flex items-center justify-center"><i className="fas fa-paper-plane"></i></button>
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
