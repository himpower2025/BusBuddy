
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
// 전세계적으로 통용되는 노란색 스쿨 버스 3D 이모지 스타일 이미지
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
            scaledSize: new (window as any).google.maps.Size(50, 50),
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
      <div class="map-placeholder" style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f0f0f0;">
        <div class="placeholder-content" style="text-align: center;">
          <div class="pulse-icon" style="font-size: 3rem;">📍</div>
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
            <button class="tag-btn" style="white-space: nowrap; padding: 6px 12px; border: 1px solid #ddd; border-radius: 20px; background: #f9f9f9; font-size: 0.85rem;" onClick=${() => onSendMessage(m, true)}>${m}</button>
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
      <div class="centered-view">
        <div class="splash-screen anim-fade-in">
          <div class="brand-container" style="margin-bottom: 30px;">
            <img src=${BUS_ICON_URL} alt="BusBuddy Logo" style="width: 140px; height: 140px; margin-bottom: 20px; object-fit: contain;" />
            <h1>BusBuddy <span>PRO</span></h1>
            <p style="color: #666;">SafetyFirst Transportation</p>
          </div>
          <div class="role-selection-area" style="display: flex; flex-direction: column; gap: 15px;">
            <button class="action-btn" onClick=${() => setRole('driver')}>🧢 Teacher / Driver</button>
            <button class="action-btn" onClick=${() => setRole('parent')}>🏠 Parent</button>
            <button class="action-btn" style="background: #5f6368;" onClick=${() => setRole('admin')}>🏢 School Admin</button>
          </div>
        </div>
      </div>
    `;
  }

  if (!selectedSchool) {
    return html`
      <div class="centered-view">
        <div class="auth-box anim-fade-in">
          <button class="icon-btn" style="float: left; background: none; border: none; font-size: 1.5rem; cursor: pointer;" onClick=${() => setRole(null)}>←</button>
          <div style="font-size: 3rem; margin-bottom: 20px;">🔐</div>
          <h2>School Verification</h2>
          <p style="margin: 15px 0; color: #666;">Enter your access code to continue.</p>
          <div class="code-input-group" style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input 
              style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px;"
              type="text" placeholder="SEL999" maxlength="6"
              value=${schoolCode} onInput=${(e: any) => setSchoolCode(e.target.value)}
            />
            <button class="action-btn" onClick=${handleVerifyCode}>Join</button>
          </div>
          ${codeError && html`<p style="color: red; font-size: 0.9rem;">⚠️ ${codeError}</p>`}
          <small style="color: #999;">Try: SEL999 or PAE101</small>
        </div>
      </div>
    `;
  }

  if (role === 'admin') {
    return html`
      <div class="app-container anim-fade-in">
        <header class="tracker-header">
          <button style="background:none; border:none; font-size: 1.2rem; cursor:pointer;" onClick=${() => setSelectedSchool(null)}>←</button>
          <div style="text-align: center;">
            <small>Admin Hub</small>
            <h3>${selectedSchool.name}</h3>
          </div>
          <div style="width: 24px;"></div>
        </header>
        <div style="padding: 20px;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; display: flex; justify-content: space-around; margin-bottom: 20px;">
            <div style="text-align:center;"><strong>${selectedSchool.code ? schools[selectedSchool.code].routes.length : 0}</strong><br/>Routes</div>
            <div style="text-align:center;"><strong style="color: green;">Online</strong><br/>Fleet</div>
          </div>
          <h4>Route Management</h4>
          <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
            ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: white; border: 1px solid #eee; border-radius: 10px;">
                <span>${r}</span>
                <button style="color: red; border: none; background: none; cursor: pointer;" onClick=${() => {
                  if (!selectedSchool.code) return;
                  const updated = {...schools};
                  updated[selectedSchool.code].routes = updated[selectedSchool.code].routes.filter((item: string) => item !== r);
                  setSchools(updated);
                }}>Delete</button>
              </div>
            `)}
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <input style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px;" type="text" placeholder="New Route Name" value=${newRouteName} onInput=${(e: any) => setNewRouteName(e.target.value)} />
              <button class="action-btn" onClick=${() => {
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
            <small>${selectedSchool.name}</small>
            <h3>Select Route</h3>
          </div>
          <div style="width: 24px;"></div>
        </header>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 15px;">
          ${selectedSchool.code && schools[selectedSchool.code].routes.map((r: string) => html`
            <div style="padding: 20px; background: white; border: 1px solid #eee; border-radius: 15px; display: flex; align-items: center; cursor: pointer; transition: 0.2s;" onClick=${() => setRoute(r)}>
              <div style="width: 40px; height: 40px; background: #e8f0fe; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; font-weight: bold; color: var(--primary);">${r.charAt(0)}</div>
              <div style="flex: 1;">
                <h4 style="margin-bottom: 4px;">${r}</h4>
                <p style="font-size: 0.85rem; color: #666;">Driver: ${selectedSchool.driverName}</p>
              </div>
              <div style="color: #ccc;">→</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  return html`
    <div class="app-container app-shell anim-fade-in">
      <header class="tracker-header">
        <div style="display: flex; align-items: center; gap: 10px;">
           <div style="width: 10px; height: 10px; border-radius: 50%; background: ${isLive ? '#34a853' : '#dadce0'};"></div>
           <div>
             <h3 style="font-size: 1.1rem;">${activeTab === 'chat' ? 'Comm. Channel' : route}</h3>
             <small style="color: #666;">${selectedSchool.name}</small>
           </div>
        </div>
        ${role === 'driver' 
          ? html`<button style="background: #D93025; color: white; border: none; padding: 8px 16px; border-radius: 20px; font-weight: bold; cursor: pointer;" onClick=${triggerSOS}>SOS</button>`
          : html`<div style="background: #e8f0fe; padding: 8px 15px; border-radius: 20px; font-size: 0.9rem;">ETA: <strong>${isLive ? '12 min' : '--'}</strong></div>`
        }
      </header>

      <main class="map-container">
        ${activeTab === 'map' ? html`
          <${GoogleMap} location=${location} isLive=${isLive} />
          <div class="control-overlay">
            <div class="panel-card">
              ${role === 'driver' ? html`
                <button class="main-cta ${isLive ? 'stop' : 'start'}" onClick=${isLive ? stopTracking : startTracking}>
                  ${isLive ? '🛑 Stop Broadcasting' : '🚀 Start Shift'}
                </button>
                <div style="display: flex; justify-content: space-around; text-align: center;">
                   <div><small style="color: #666;">Passengers</small><br/><strong>18</strong></div>
                   <div><small style="color: #666;">Speed</small><br/><strong>${isLive ? '32' : '0'} km/h</strong></div>
                </div>
              ` : html`
                <div style="display: flex; align-items: center; gap: 15px;">
                   <div style="font-size: 2rem;">🧒</div>
                   <div style="flex: 1;">
                     <h4 style="margin-bottom: 2px;">Emily's Boarding</h4>
                     <span style="font-size: 0.85rem; color: #1E8E3E; background: #e6f4ea; padding: 2px 8px; border-radius: 4px;">${studentStatus}</span>
                   </div>
                   <button style="background: none; border: 1px solid #ddd; padding: 8px; border-radius: 8px; cursor: pointer;" onClick=${() => {
                      const next = studentStatus === 'Wait' ? 'Boarded' : (studentStatus === 'Boarded' ? 'Arrived' : 'Wait');
                      setStudentStatus(next);
                   }}>↺</button>
                </div>
              `}
            </div>
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
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
