
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

/**
 * BusLogoSVG: 디테일이 살아있는 귀여운 스쿨버스
 */
const BusLogoSVG = ({ size = 200 }: { size?: number }) => html`
  <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" class="bus-emoticon-anim">
    <ellipse cx="256" cy="460" rx="80" ry="12" fill="rgba(0,0,0,0.12)" class="shadow-anim" />
    <g transform="translate(256, 290)">
      <!-- Wheels -->
      <g class="wheels-group">
        <rect x="-135" y="145" width="55" height="50" rx="20" fill="#263238" />
        <rect x="80" y="145" width="55" height="50" rx="20" fill="#263238" />
      </g>
      
      <!-- Body -->
      <rect x="-140" y="-180" width="280" height="340" rx="65" fill="#FFD600" stroke="#FBC02D" stroke-width="6" />
      
      <!-- Red Safety Lights (Top) -->
      <circle cx="-80" cy="-195" r="16" fill="#F44336" stroke="white" stroke-width="4" />
      <circle cx="80" cy="-195" r="16" fill="#F44336" stroke="white" stroke-width="4" />
      
      <!-- Side Mirrors -->
      <circle cx="-165" cy="-30" r="22" fill="#546E7A" stroke="white" stroke-width="3" />
      <circle cx="165" cy="-30" r="22" fill="#546E7A" stroke="white" stroke-width="3" />
      
      <!-- Windshield (Beige/Warm Glass) -->
      <rect x="-115" y="-135" width="230" height="145" rx="35" fill="#FFF9E1" stroke="#F0E68C" stroke-width="5" />
      <circle cx="-80" cy="-100" r="12" fill="white" opacity="0.4" />
      
      <!-- Headlights/Eyes (Center Focus) -->
      <g>
        <circle cx="-90" cy="95" r="35" fill="white" stroke="#FFF9C4" stroke-width="5" />
        <circle cx="-90" cy="95" r="12" fill="#212121" />
        <circle cx="-90" cy="92" r="4" fill="white" />
        
        <circle cx="90" cy="95" r="35" fill="white" stroke="#FFF9C4" stroke-width="5" />
        <circle cx="90" cy="95" r="12" fill="#212121" />
        <circle cx="90" cy="92" r="4" fill="white" />
      </g>
      
      <!-- STOP Sign on the side window area -->
      <g transform="translate(-145, 10)" class="stop-sign-shake">
        <circle r="25" fill="#D32F2F" stroke="white" stroke-width="2" />
        <text y="5" font-family="Arial" font-size="10" font-weight="900" fill="white" text-anchor="middle">STOP</text>
      </g>
      
      <!-- Grille/Mouth -->
      <rect x="-45" y="85" width="90" height="35" rx="12" fill="#455A64" />
    </g>
  </svg>
`;

const getBusMarkerURI = () => {
  const svg = `
    <svg width="60" height="60" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(256, 250) scale(0.8)">
        <rect x="-140" y="-180" width="280" height="340" rx="65" fill="#FFD600" stroke="#FBC02D" stroke-width="6" />
        <rect x="-115" y="-135" width="230" height="145" rx="35" fill="#FFF9E1" stroke="#F0E68C" stroke-width="5" />
        <circle cx="-90" cy="95" r="35" fill="white" />
        <circle cx="90" cy="95" r="35" fill="white" />
        <circle cx="-90" cy="95" r="12" fill="#212121" />
        <circle cx="90" cy="95" r="12" fill="#212121" />
      </g>
    </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const INITIAL_SCHOOLS: Schools = {
  'SEL999': { id: 'S4', name: 'Seoul Global School', logo: '🌏', routes: ['Gangnam Line', 'Hannam Shuttle', 'Mapo Express'], driverName: 'Kim Bus' },
  'PAE101': { id: 'S1', name: 'Palo Alto Elementary', logo: '🏫', routes: ['Route Gold', 'Route Silver'], driverName: 'John Doe' },
};

const INITIAL_MESSAGES: Message[] = [
  { id: 1, sender: 'Teacher', text: 'Good morning! Bus is departing on time.', time: '08:00 AM', isBroadcast: true },
  { id: 2, sender: 'Parent (Emily)', text: 'Emily will be at the stop 2 mins late.', time: '08:15 AM', isBroadcast: false },
];

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
            url: getBusMarkerURI(),
            scaledSize: new (window as any).google.maps.Size(60, 60),
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
        <div class="placeholder-content">
          <div class="pulse-icon">📍</div>
          <p>Connecting Satellite...</p>
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
          <button class="send-btn" onClick=${() => { if(input) { onSendMessage(input, false); setInput(''); } }}>🚀</button>
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
      <div class="app-viewport splash-bg anim-fade-in">
        <div class="splash-card">
          <div class="brand-container">
            <div class="logo-box-gradient">
              <${BusLogoSVG} size=${170} />
            </div>
            <h1 class="brand-title">BusBuddy <span class="brand-pro">PRO</span></h1>
            <p class="brand-subtitle">Smart School Transportation</p>
          </div>
          <div class="role-selection-area">
            <button class="role-btn driver" onClick=${() => setRole('driver')}>🧢 Teacher / Driver</button>
            <button class="role-btn parent" onClick=${() => setRole('parent')}>🏠 Parent</button>
            <button class="role-btn admin" onClick=${() => setRole('admin')}>🏢 School Admin</button>
          </div>
        </div>
      </div>
    `;
  }

  if (!selectedSchool) {
    return html`
      <div class="app-viewport splash-bg anim-fade-in">
        <div class="auth-box">
          <button class="back-btn" onClick=${() => setRole(null)}>←</button>
          <div class="auth-icon">🏫</div>
          <h2 class="auth-title">School Login</h2>
          <p class="auth-desc">Enter your school access code.</p>
          <input 
            class="code-input"
            type="text" placeholder="SEL999" maxlength="6"
            value=${schoolCode} onInput=${(e: any) => setSchoolCode(e.target.value)}
          />
          <button class="action-btn" onClick=${handleVerifyCode}>Connect School</button>
          ${codeError && html`<p class="error-text">⚠️ ${codeError}</p>`}
        </div>
      </div>
    `;
  }

  return html`
    <div class="app-container splash-bg anim-fade-in">
      <header class="tracker-header">
        <div class="header-left">
           <div class="status-dot ${isLive ? 'online' : ''}"></div>
           <div class="header-info">
             <h3 class="header-title">${activeTab === 'chat' ? 'Comm. Channel' : (route || 'Select Route')}</h3>
             <small class="header-school">${selectedSchool.name}</small>
           </div>
        </div>
        ${role === 'driver' 
          ? html`<button class="sos-btn" onClick=${triggerSOS}>SOS</button>`
          : html`<div class="eta-badge">ETA: <span>${isLive ? '12 min' : '--'}</span></div>`
        }
      </header>

      <main class="map-container">
        ${activeTab === 'map' ? html`
          <${GoogleMap} location=${location} isLive=${isLive} />
          <div class="control-overlay">
            <div class="panel-card">
              ${role === 'driver' ? html`
                <button class="main-cta ${isLive ? 'stop' : 'start'}" onClick=${isLive ? stopTracking : startTracking}>
                  ${isLive ? html`🛑 Stop Shift` : html`🚀 Start Shift`}
                </button>
              ` : html`
                <div class="student-info">
                   <div class="avatar">🧒</div>
                   <div class="student-meta">
                     <h4 class="student-name">Emily Boarding</h4>
                     <span class="status-tag ${studentStatus}">${studentStatus}</span>
                   </div>
                   <button class="update-btn" onClick=${() => {
                      const next = studentStatus === 'Wait' ? 'Boarded' : (studentStatus === 'Boarded' ? 'Arrived' : 'Wait');
                      setStudentStatus(next);
                   }}>Status Update</button>
                </div>
              `}
            </div>
          </div>
        ` : html`
          <${ChatView} role=${role} messages=${messages} onSendMessage=${handleSendMessage} />
        `}
      </main>

      <nav class="main-tabs">
         <button class=${activeTab === 'map' ? 'active' : ''} onClick=${() => setActiveTab('map')}><i>📍</i>Map</button>
         <button class=${activeTab === 'chat' ? 'active' : ''} onClick=${() => setActiveTab('chat')}><i>💬</i>Chat</button>
         <button onClick=${() => setRoute(null)}><i>🔄</i>Switch</button>
      </nav>
      
      ${sosActive && html`<div class="sos-fullscreen">⚠️ EMERGENCY SIGNAL SENT</div>`}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
