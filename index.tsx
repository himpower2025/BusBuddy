
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
            url: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
            scaledSize: new (window as any).google.maps.Size(40, 40),
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
      <div class="map-placeholder">
        <div class="map-grid-overlay"></div>
        <div class="placeholder-content">
          <div class="pulse-icon">📍</div>
          <p>Connecting Satellite...</p>
          <small>${isLive ? 'Live GPS Active' : 'Waiting for Signal'}</small>
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
            <div class="msg-sender">${msg.isBroadcast ? '📢 Announcement' : msg.sender}</div>
            <div class="msg-text">${msg.text}</div>
            <div class="msg-time">${msg.time}</div>
          </div>
        `)}
        <div ref=${chatEndRef}></div>
      </div>
      
      <div class="chat-controls">
        <div class="quick-tags">
          ${quickMsgs.map((m: string) => html`
            <button class="tag-btn" onClick=${() => onSendMessage(m, true)}>${m}</button>
          `)}
        </div>
        <div class="chat-input-area">
          <input type="text" placeholder="Type a message..." value=${input} onInput=${(e: any) => setInput(e.target.value)} />
          <button class="send-btn" onClick=${() => { if(input) { onSendMessage(input, false); setInput(''); } }}>
             <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
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

  return html`
    <div class="mobile-wrapper">
      <div class="mobile-content">
        ${!role ? html`
          <div class="splash-screen anim-fade-in">
            <div class="brand-container">
              <div class="app-icon-main">🚌</div>
              <div class="brand-text">
                <h1>BusBuddy <span>PRO</span></h1>
                <p>SafetyFirst Transportation</p>
              </div>
            </div>
            <div class="role-selection-area">
              <button class="role-card driver" onClick=${() => setRole('driver')}>
                <div class="r-icon">🧢</div>
                <div class="r-info"><h3>Teacher/Driver</h3><p>Manage Route</p></div>
              </button>
              <button class="role-card parent" onClick=${() => setRole('parent')}>
                <div class="r-icon">🏠</div>
                <div class="r-info"><h3>Parent</h3><p>Track Child</p></div>
              </button>
              <button class="role-card admin" onClick=${() => setRole('admin')}>
                <div class="r-icon">🏢</div>
                <div class="r-info"><h3>School Admin</h3><p>Control Fleet</p></div>
              </button>
            </div>
            <footer class="splash-footer">Powered by Seoul Global School</footer>
          </div>
        ` : !selectedSchool ? html`
          <div class="full-page anim-fade-in">
            <header class="page-nav">
              <button class="icon-btn" onClick=${() => setRole(null)}>←</button>
              <span>School Access</span>
            </header>
            <div class="auth-box">
              <div class="school-avatar">🔐</div>
              <h2>School Verification</h2>
              <p>Please enter your access code.</p>
              <div class="code-input-group">
                <input 
                  type="text" 
                  placeholder="SEL999" 
                  maxlength="6"
                  value=${schoolCode}
                  onInput=${(e: any) => setSchoolCode(e.target.value)}
                />
                <button class="action-btn" onClick=${handleVerifyCode}>Join</button>
              </div>
              ${codeError && html`<p class="error-text">⚠️ ${codeError}</p>`}
              <div class="hint-text">Test Code: SEL999</div>
            </div>
          </div>
        ` : role === 'admin' ? html`
          <div class="app-shell admin-view anim-fade-in">
            <header class="main-header">
              <button class="icon-btn" onClick=${() => setSelectedSchool(null)}>←</button>
              <div class="header-title">
                 <small>Control Center</small>
                 <h3>${selectedSchool.name}</h3>
              </div>
            </header>
            <div class="dashboard-body">
              <div class="stats-card">
                <div class="stat-item"><strong>${selectedSchool.code ? schools[selectedSchool.code].routes.length : 0}</strong><span>Routes</span></div>
                <div class="stat-item"><strong style="color:var(--success)">Online</strong><span>Hub</span></div>
              </div>
              <div class="section-card">
                <div class="section-header"><h3>Fleet Management</h3></div>
                <div class="route-manager">
                  ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
                    <div class="manager-item">
                      <div class="m-info"><strong>${r}</strong><small>Active</small></div>
                      <button class="del-btn" onClick=${() => {
                        if (!selectedSchool.code) return;
                        const updated = {...schools};
                        updated[selectedSchool.code].routes = updated[selectedSchool.code].routes.filter((item: string) => item !== r);
                        setSchools(updated);
                      }}>Delete</button>
                    </div>
                  `)}
                  <div class="add-route-input">
                    <input type="text" placeholder="Add route..." value=${newRouteName} onInput=${(e: any) => setNewRouteName(e.target.value)} />
                    <button class="add-action-btn" onClick=${() => {
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
          </div>
        ` : !route ? html`
          <div class="full-page anim-fade-in">
            <header class="page-nav">
              <button class="icon-btn" onClick=${() => setSelectedSchool(null)}>←</button>
              <div class="nav-title">
                <small>${selectedSchool.name}</small>
                <span>Select Your Route</span>
              </div>
            </header>
            <div class="route-list">
              ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
                <div class="route-select-card" onClick=${() => setRoute(r)}>
                  <div class="r-badge">${r.charAt(0)}</div>
                  <div class="r-details">
                    <h4>${r}</h4>
                    <p>Driver: ${selectedSchool.driverName}</p>
                  </div>
                  <div class="r-arrow">→</div>
                </div>
              `)}
            </div>
          </div>
        ` : html`
          <div class="app-shell tracker-view anim-fade-in">
            <header class="tracker-header">
              <div class="tracker-info">
                 <div class="live-dot ${isLive ? 'on' : ''}"></div>
                 <div class="text">
                   <h3>${activeTab === 'chat' ? 'Comm. Channel' : route}</h3>
                   <small>${selectedSchool.name}</small>
                 </div>
              </div>
              ${role === 'driver' ? html`
                <button class="sos-action" onClick=${triggerSOS}>SOS</button>
              ` : html`
                <div class="eta-pill">
                   <span>ETA</span>
                   <strong>${isLive ? '12 min' : '--'}</strong>
                </div>
              `}
            </header>

            <main class="map-container">
              ${activeTab === 'map' ? html`
                <${GoogleMap} location=${location} isLive=${isLive} />
                <div class="control-overlay">
                  ${role === 'driver' ? html`
                    <div class="panel-card driver-card">
                      <button class="main-cta ${isLive ? 'stop' : 'start'}" onClick=${isLive ? stopTracking : startTracking}>
                        ${isLive ? '🛑 Stop Broadcasting' : '🚀 Start Shift'}
                      </button>
                      <div class="driver-info-grid">
                         <div class="grid-cell"><span>Passengers</span><strong>18</strong></div>
                         <div class="grid-cell"><span>Speed</span><strong>${isLive ? '32 km/h' : '0'}</strong></div>
                      </div>
                    </div>
                  ` : html`
                    <div class="panel-card parent-card">
                       <div class="student-status-box">
                          <div class="student-profile">🧒</div>
                          <div class="student-text">
                            <h4>Emily's Boarding</h4>
                            <span class="status-label ${studentStatus.toLowerCase()}">${studentStatus}</span>
                          </div>
                          <button class="update-btn" onClick=${() => {
                            const next = studentStatus === 'Wait' ? 'Boarded' : (studentStatus === 'Boarded' ? 'Arrived' : 'Wait');
                            setStudentStatus(next);
                          }}>↺</button>
                       </div>
                    </div>
                  `}
                </div>
              ` : html`
                <${ChatView} role=${role} messages=${messages} onSendMessage=${handleSendMessage} />
              `}
            </main>

            ${sosActive && html`<div class="sos-fullscreen">🚨 EMERGENCY SOS 🚨</div>`}

            <nav class="main-tabs">
               <button class=${activeTab === 'map' ? 'active' : ''} onClick=${() => setActiveTab('map')}><i>📍</i>Map</button>
               <button class=${activeTab === 'chat' ? 'active' : ''} onClick=${() => setActiveTab('chat')}><i>💬</i>Chat</button>
               <button onClick=${() => setRoute(null)}><i>🔄</i>Routes</button>
            </nav>
          </div>
        `}
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
