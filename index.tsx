
import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';

// --- Types ---
interface School {
  id: string;
  name: string;
  logo: string;
  routes: string[];
  driverName: string;
  code?: string;
}

interface Schools {
  [key: string]: School;
}

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isBroadcast: boolean;
}

interface Location {
  latitude: number;
  longitude: number;
}

// --- Constants ---
const BUS_ICON_URL = 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f68c/512.png';

const INITIAL_SCHOOLS: Schools = {
  'SEL999': { id: 'S4', name: 'Seoul Global School', logo: '🌏', routes: ['Gangnam Line', 'Hannam Shuttle', 'Mapo Express'], driverName: 'Kim Bus' },
  'PAE101': { id: 'S1', name: 'Palo Alto Elementary', logo: '🏫', routes: ['Route Gold', 'Route Silver'], driverName: 'John Doe' },
};

const INITIAL_MESSAGES: Message[] = [
  { id: 1, sender: 'Teacher', text: 'Good morning! Bus is departing on time.', time: '08:00 AM', isBroadcast: true },
  { id: 2, sender: 'Parent (Emily)', text: 'Emily will be at the stop 2 mins late.', time: '08:15 AM', isBroadcast: false },
];

// --- Components ---

function GoogleMap({ location, isLive }: { location: Location | null, isLive: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstance = useRef<any>(null);
  const busMarker = useRef<any>(null);

  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if ((window as any).google && (window as any).google.maps) {
        setMapLoaded(true);
        clearInterval(checkGoogle);
        if (mapRef.current && !mapInstance.current) {
          mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 37.5665, lng: 126.9780 },
            zoom: 15,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
            disableDefaultUI: true,
          });
        }
      }
    }, 1000);
    return () => clearInterval(checkGoogle);
  }, []);

  useEffect(() => {
    if (mapInstance.current && location) {
      const pos = { lat: location.latitude, lng: location.longitude };
      if (!busMarker.current) {
        busMarker.current = new (window as any).google.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: "School Bus",
          icon: {
            url: BUS_ICON_URL,
            scaledSize: new (window as any).google.maps.Size(55, 55),
          }
        });
      } else {
        busMarker.current.setPosition(pos);
      }
      mapInstance.current.panTo(pos);
    }
  }, [location]);

  if (!mapLoaded) {
    return html`
      <div class="map-placeholder" style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
        <div class="placeholder-content" style="text-align: center;">
          <div class="pulse-icon" style="font-size: 3rem; animation: bounce 2s infinite;">📍</div>
          <p style="margin-top: 10px; font-weight: 500; color: #64748b;">Connecting Satellite...</p>
        </div>
      </div>
    `;
  }
  return html`<div ref=${mapRef} class="map-view"></div>`;
}

function ChatView({ role, messages, onSendMessage }: { role: string, messages: Message[], onSendMessage: (t: string, q: boolean) => void }) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickMsgs = role === 'driver' 
    ? ['Traffic jam - 10m delay 🚦', 'Arrival in 5 mins! 🚌', 'Route changed 🚧']
    : ['My child is sick 🤒', 'Running late! 🏃', 'Thank you! 🙏'];

  return html`
    <div class="chat-container anim-fade-in">
      <div class="chat-messages">
        ${messages.map((msg: Message) => html`
          <div class="msg-bubble ${msg.isBroadcast ? 'broadcast' : ''} ${msg.sender.includes(role === 'driver' ? 'Teacher' : 'Parent') ? 'mine' : 'theirs'}">
            <div class="msg-sender" style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 4px;">${msg.isBroadcast ? '📢 Announcement' : msg.sender}</div>
            <div class="msg-text">${msg.text}</div>
            <div class="msg-time" style="font-size: 0.7rem; text-align: right; margin-top: 4px;">${msg.time}</div>
          </div>
        `)}
        <div ref=${chatEndRef}></div>
      </div>
      
      <div class="chat-controls">
        <div class="quick-tags" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 10px;">
          ${quickMsgs.map((m: string) => html`
            <button class="tag-btn" style="white-space: nowrap; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 20px; background: #f8fafc; font-size: 0.85rem;" onClick=${() => onSendMessage(m, true)}>${m}</button>
          `)}
        </div>
        <div class="chat-input-area">
          <input type="text" placeholder="Type a message..." value=${input} onInput=${(e: any) => setInput(e.target.value)} />
          <button class="send-btn" onClick=${() => { if(input) { onSendMessage(input, false); setInput(''); } }}>
             🚀
          </button>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [role, setRole] = useState<string | null>(null);
  const [schools, setSchools] = useState<Schools>(() => {
    const saved = localStorage.getItem('busbuddy_v4_schools');
    return saved ? JSON.parse(saved) : INITIAL_SCHOOLS;
  });
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [route, setRoute] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [location, setLocation] = useState<Location | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [sosActive, setSosActive] = useState(false);
  const [studentStatus, setStudentStatus] = useState('Wait');
  
  const simId = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('busbuddy_v4_schools', JSON.stringify(schools));
  }, [schools]);

  const handleVerifyCode = () => {
    const formattedCode = schoolCode.trim().toUpperCase();
    const school = schools[formattedCode];
    if (school) {
      setSelectedSchool({ ...school, code: formattedCode });
      setCodeError('');
    } else {
      setCodeError('Invalid code. Try "SEL999"');
    }
  };

  const handleSendMessage = (text: string, _isQuick: boolean) => {
    const newMsg: Message = {
      id: Date.now(),
      sender: role === 'driver' ? 'Teacher' : 'Parent (Emily)',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isBroadcast: role === 'driver'
    };
    setMessages([...messages, newMsg]);
  };

  const startTracking = () => {
    setIsLive(true);
    let lat = 37.5665; let lng = 126.9780;
    simId.current = setInterval(() => {
      lat += 0.0001; lng += 0.0001;
      setLocation({ latitude: lat, longitude: lng });
    }, 2000);
  };

  const stopTracking = () => {
    clearInterval(simId.current);
    setIsLive(false);
    setLocation(null);
  };

  const triggerSOS = () => {
    setSosActive(true);
    setTimeout(() => setSosActive(false), 5000);
  };

  if (!role) {
    return html`
      <div class="centered-view" style="background: #F8F9FA;">
        <div class="splash-screen anim-fade-in" style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); border-radius: 40px; border: none; padding: 60px 40px; box-shadow: 0 25px 50px rgba(0,0,0,0.12);">
          <div class="brand-container" style="margin-bottom: 40px; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 175px; height: 175px; background: linear-gradient(135deg, #FFF9C4 0%, #FFD600 100%); border-radius: 48px; display: flex; align-items: center; justify-content: center; margin-bottom: 30px; box-shadow: 0 15px 35px rgba(255,193,7,0.4); border: 5px solid white;">
              <!-- translateY(-24px)로 시각적 정중앙 정밀 보정 -->
              <img src=${BUS_ICON_URL} alt="Cute School Bus" style="width: 135px; height: 135px; object-fit: contain; transform: translateY(-24px); filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));" />
            </div>
            <h1 style="font-size: 2.8rem; letter-spacing: -1.8px; margin-bottom: 8px; color: #1A73E8; font-weight: 900;">BusBuddy <span style="color: #FFB300;">PRO</span></h1>
            <p style="color: #1A73E8; font-weight: 700; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 1.2px; opacity: 0.85;">Smart School Transportation</p>
          </div>
          <div class="role-selection-area" style="display: flex; flex-direction: column; gap: 18px; width: 100%;">
            <button class="action-btn" style="background: #1A73E8; height: 62px; border-radius: 18px; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(26,115,232,0.2);" onClick=${() => setRole('driver')}>🧢 Teacher / Driver</button>
            <button class="action-btn" style="background: #34A853; height: 62px; border-radius: 18px; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(52,168,83,0.2);" onClick=${() => setRole('parent')}>🏠 Parent</button>
            <button class="action-btn" style="background: #5F6368; height: 62px; border-radius: 18px; font-size: 1.1rem; box-shadow: 0 10px 20px rgba(0,0,0,0.1);" onClick=${() => setRole('admin')}>🏢 School Admin</button>
          </div>
        </div>
      </div>
    `;
  }

  if (!selectedSchool) {
    return html`
      <div class="centered-view" style="background: #F8F9FA;">
        <div class="auth-box anim-fade-in" style="background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%); border-radius: 40px; padding: 50px 30px; border: none; box-shadow: 0 25px 50px rgba(0,0,0,0.12);">
          <button class="icon-btn" style="float: left; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #1A73E8;" onClick=${() => setRole(null)}>←</button>
          <div style="font-size: 5rem; margin-bottom: 25px;">🏫</div>
          <h2 style="font-size: 1.9rem; font-weight: 900; color: #1A73E8;">School Login</h2>
          <p style="margin: 15px 0 35px; color: #1A73E8; font-weight: 500; font-size: 1.1rem;">Enter your 6-digit access code.</p>
          <input 
            style="width: 100%; padding: 22px; border: 3px solid white; background: rgba(255,255,255,0.8); border-radius: 22px; font-size: 1.8rem; text-align: center; letter-spacing: 10px; font-weight: 900; color: #1A73E8; margin-bottom: 30px; outline: none; box-shadow: inset 0 2px 5px rgba(0,0,0,0.05);"
            type="text" placeholder="SEL999" maxlength="6"
            value=${schoolCode} onInput=${(e: any) => setSchoolCode(e.target.value)}
          />
          <button class="action-btn" style="width: 100%; height: 68px; font-size: 1.3rem; border-radius: 22px; background: #1A73E8;" onClick=${handleVerifyCode}>Connect</button>
          ${codeError && html`<p style="color: #D93025; font-size: 1.05rem; margin-top: 20px; font-weight: 800;">⚠️ ${codeError}</p>`}
          <div style="margin-top: 35px; padding: 18px; background: rgba(255,255,255,0.5); border-radius: 18px; border: 1px dashed #1A73E8;">
            <small style="color: #1A73E8; font-weight: 800; font-size: 0.95rem;">Demo: SEL999 / PAE101</small>
          </div>
        </div>
      </div>
    `;
  }

  // --- (나머지 렌더링 코드 유지) ---
  if (role === 'admin') {
    return html`
      <div class="app-container anim-fade-in" style="background: white; min-height: 100vh;">
        <header class="tracker-header">
          <button style="background:none; border:none; font-size: 1.2rem; cursor:pointer;" onClick=${() => setSelectedSchool(null)}>←</button>
          <div style="text-align: center;">
            <small style="font-weight: 800; color: #1A73E8; text-transform: uppercase;">Admin Hub</small>
            <h3 style="font-size: 1.1rem;">${selectedSchool.name}</h3>
          </div>
          <div style="width: 24px;"></div>
        </header>
        <div style="padding: 20px;">
          <div style="background: #F8F9FA; padding: 25px; border-radius: 25px; display: flex; justify-content: space-around; margin-bottom: 30px; border: 1px solid #E0E0E0;">
            <div style="text-align:center;"><strong>${selectedSchool.code ? schools[selectedSchool.code].routes.length : 0}</strong><br/><small>Routes</small></div>
            <div style="width: 1px; background: #E0E0E0;"></div>
            <div style="text-align:center;"><strong style="color: #34A853;">Active</strong><br/><small>Fleet</small></div>
          </div>
          <h4 style="margin-bottom: 20px; font-weight: 900; color: #202124;">Route Management</h4>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: white; border: 1px solid #F1F3F4; border-radius: 20px;">
                <span style="font-weight: 700;">${r}</span>
                <button style="color: #D93025; border: none; background: #FCE8E6; padding: 10px 18px; border-radius: 12px; font-weight: 800; cursor: pointer;" onClick=${() => {
                  if (!selectedSchool.code) return;
                  const updated = {...schools};
                  updated[selectedSchool.code].routes = updated[selectedSchool.code].routes.filter((item: string) => item !== r);
                  setSchools(updated);
                }}>Delete</button>
              </div>
            `)}
            <div style="display: flex; gap: 12px; margin-top: 20px;">
              <input style="flex: 1; padding: 18px; border: 2px solid #F1F3F4; border-radius: 18px; font-weight: 600;" type="text" placeholder="Route Name" value=${newRouteName} onInput=${(e: any) => setNewRouteName(e.target.value)} />
              <button class="action-btn" style="width: 60px; height: 60px; font-size: 1.8rem; border-radius: 18px; background: #1A73E8;" onClick=${() => {
                if(!newRouteName || !selectedSchool.code) return;
                const updated = {...schools};
                updated[selectedSchool.code].routes.push(newRouteName);
                setSchools(updated);
                setNewRouteName('');
              }}>+</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (!route) {
    return html`
      <div class="app-container anim-fade-in">
        <header class="tracker-header">
          <button style="background:none; border:none; font-size: 1.2rem; cursor:pointer;" onClick=${() => setSelectedSchool(null)}>←</button>
          <div style="text-align: center;">
            <small style="color: #5F6368; font-weight: bold;">${selectedSchool.name}</small>
            <h3 style="font-weight: 900; font-size: 1.3rem;">Select Route</h3>
          </div>
          <div style="width: 24px;"></div>
        </header>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
          ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
            <div style="padding: 25px; background: white; border: 1px solid #F1F3F4; border-radius: 25px; display: flex; align-items: center; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.05);" onClick=${() => setRoute(r)}>
              <div style="width: 70px; height: 70px; background: #FFF9C4; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-right: 25px; border: 3px solid #FFC107;">
                <img src=${BUS_ICON_URL} style="width: 50px; height: 50px; object-fit: contain;" />
              </div>
              <div style="flex: 1;">
                <h4 style="margin-bottom: 5px; font-size: 1.2rem; color: #202124; font-weight: 800;">${r}</h4>
                <p style="font-size: 0.95rem; color: #5F6368;">Driver: ${selectedSchool.driverName}</p>
              </div>
              <div style="color: #1A73E8; font-size: 1.8rem; font-weight: 900;">→</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  return html`
    <div class="app-container app-shell anim-fade-in">
      <header class="tracker-header">
        <div style="display: flex; align-items: center; gap: 12px;">
           <div style="width: 14px; height: 14px; border-radius: 50%; background: ${isLive ? '#34A853' : '#DADCE0'};"></div>
           <div>
             <h3 style="font-size: 1.15rem; font-weight: 900; color: #1A73E8;">${activeTab === 'chat' ? 'Comm. Channel' : route}</h3>
             <small style="color: #5F6368; font-weight: 700;">${selectedSchool.name}</small>
           </div>
        </div>
        ${role === 'driver' 
          ? html`<button style="background: #D93025; color: white; border: none; padding: 12px 28px; border-radius: 18px; font-weight: 900; cursor: pointer;" onClick=${triggerSOS}>SOS</button>`
          : html`<div style="background: #E8F0FE; padding: 12px 20px; border-radius: 25px; font-size: 0.95rem; color: #1A73E8; font-weight: 800;">ETA: <span style="font-size: 1.15rem;">${isLive ? '12 min' : '--'}</span></div>`
        }
      </header>

      <main class="map-container">
        ${activeTab === 'map' ? html`
          <${GoogleMap} location=${location} isLive=${isLive} />
          <div class="control-overlay">
            <div class="panel-card" style="border-top: 8px solid #FFC107; border-radius: 30px;">
              ${role === 'driver' ? html`
                <button class="main-cta ${isLive ? 'stop' : 'start'}" style="height: 70px; font-size: 1.4rem; border-radius: 22px; font-weight: 900;" onClick=${isLive ? stopTracking : startTracking}>
                  ${isLive ? html`🛑 Stop Broadcasting` : html`🚀 Start Shift`}
                </button>
                <div style="display: flex; justify-content: space-around; text-align: center; background: #F8F9FA; padding: 20px; border-radius: 20px; border: 1px solid #E0E0E0;">
                   <div><small style="font-weight: 800; color: #5F6368;">STUDENTS</small><br/><strong style="font-size: 1.5rem; color: #202124;">18</strong></div>
                   <div style="width: 1px; background: #E0E0E0;"></div>
                   <div><small style="font-weight: 800; color: #5F6368;">SPEED</small><br/><strong style="font-size: 1.5rem; color: #1A73E8;">${isLive ? '32' : '0'} km/h</strong></div>
                </div>
              ` : html`
                <div style="display: flex; align-items: center; gap: 20px; padding: 5px;">
                   <div style="width: 65px; height: 65px; background: #FFF9C4; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; border: 4px solid #FFC107;">🧒</div>
                   <div style="flex: 1;">
                     <h4 style="margin-bottom: 5px; font-weight: 900; color: #202124;">Emily Boarding</h4>
                     <span style="font-size: 1.1rem; font-weight: 800; color: ${studentStatus === 'Arrived' ? '#1E8E3E' : '#1A73E8'}; background: ${studentStatus === 'Arrived' ? '#E6F4EA' : '#E8F0FE'}; padding: 6px 15px; border-radius: 10px;">${studentStatus}</span>
                   </div>
                   <button style="background: white; border: 3px solid #1A73E8; color: #1A73E8; padding: 15px 22px; border-radius: 20px; font-weight: 900; cursor: pointer;" onClick=${() => {
                      const next = studentStatus === 'Wait' ? 'Boarded' : (studentStatus === 'Boarded' ? 'Arrived' : 'Wait');
                      setStudentStatus(next);
                   }}>Update</button>
                </div>
              `}
            </div>
          </div>
        ` : html`
          <${ChatView} role=${role} messages=${messages} onSendMessage=${handleSendMessage} />
        `}
      </main>

      ${sosActive && html`<div class="sos-fullscreen">🚨 EMERGENCY SOS 🚨<br/><span style="font-size: 1.8rem; margin-top: 20px;">Support Notified</span></div>`}

      <nav class="main-tabs" style="height: 90px; border-top: 1px solid #E0E0E0;">
         <button class=${activeTab === 'map' ? 'active' : ''} onClick=${() => setActiveTab('map')} style="font-weight: 900;"><i>📍</i>Map</button>
         <button class=${activeTab === 'chat' ? 'active' : ''} onClick=${() => setActiveTab('chat')} style="font-weight: 900;"><i>💬</i>Chat</button>
         <button onClick=${() => setRoute(null)} style="font-weight: 900;"><i>🔄</i>Change</button>
      </nav>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
