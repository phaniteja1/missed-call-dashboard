import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase, callsApi, businessesApi, webhookEventsApi } from './lib/supabase';
import './index.css';

// Header Component
function Header() {
  const location = useLocation();
  
  return (
    <header className="header">
      <Link to="/" className="logo">📞 Missed Call Admin</Link>
      <nav className="nav">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          Calls
        </Link>
        <Link to="/businesses" className={`nav-link ${location.pathname === '/businesses' ? 'active' : ''}`}>
          Businesses
        </Link>
        <Link to="/debug" className={`nav-link ${location.pathname === '/debug' ? 'active' : ''}`}>
          Debug
        </Link>
      </nav>
    </header>
  );
}

// Status Badge Component
function StatusBadge({ status }) {
  const badges = {
    answered: 'badge-success',
    voicemail: 'badge-warning',
    failed: 'badge-error',
    busy: 'badge-error',
    pending: 'badge-info',
    confirmed: 'badge-success',
    cancelled: 'badge-error'
  };
  
  return (
    <span className={`badge ${badges[status] || 'badge-info'}`}>
      {status}
    </span>
  );
}

// Format Duration
function formatDuration(seconds) {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Calls Page
function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  
  useEffect(() => {
    loadCalls();
  }, []);
  
  async function loadCalls() {
    try {
      const data = await callsApi.getAll(100);
      setCalls(data);
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) return <div className="loading">Loading calls...</div>;
  
  return (
    <div>
      <h1 className="page-title">Recent Calls</h1>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Call History ({calls.length})</span>
          <button className="btn btn-secondary btn-sm" onClick={loadCalls}>
            Refresh
          </button>
        </div>
        
        {calls.length === 0 ? (
          <div className="empty-state">No calls yet</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Business</th>
                <th>Caller</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id}>
                  <td>{formatDate(call.started_at)}</td>
                  <td>{call.businesses?.name || '-'}</td>
                  <td>{call.caller_phone}</td>
                  <td>{formatDuration(call.duration_seconds)}</td>
                  <td><StatusBadge status={call.status} /></td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedCall(call)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Call Detail Modal */}
      {selectedCall && (
        <div className="modal-overlay" onClick={() => setSelectedCall(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Call Details</h2>
              <button className="modal-close" onClick={() => setSelectedCall(null)}>×</button>
            </div>
            
            <div className="grid-2" style={{ marginBottom: '1rem' }}>
              <div>
                <strong>Business:</strong> {selectedCall.businesses?.name || '-'}
              </div>
              <div>
                <strong>Caller:</strong> {selectedCall.caller_phone}
              </div>
              <div>
                <strong>Started:</strong> {formatDate(selectedCall.started_at)}
              </div>
              <div>
                <strong>Duration:</strong> {formatDuration(selectedCall.duration_seconds)}
              </div>
              <div>
                <strong>Status:</strong> <StatusBadge status={selectedCall.status} />
              </div>
              <div>
                <strong>Direction:</strong> {selectedCall.direction}
              </div>
            </div>
            
            {selectedCall.transcript_text && (
              <div>
                <strong>Transcript:</strong>
                <div className="transcript" style={{ marginTop: '0.5rem' }}>
                  {selectedCall.transcript_text}
                </div>
              </div>
            )}
            
            {selectedCall.recording_url && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Recording:</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  <audio controls src={selectedCall.recording_url} style={{ width: '100%' }}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
            )}
            
            {selectedCall.metadata && Object.keys(selectedCall.metadata).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Metadata:</strong>
                <pre className="debug-payload" style={{ marginTop: '0.5rem' }}>
                  {JSON.stringify(selectedCall.metadata, null, 2)}
                </pre>
              </div>
            )}
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedCall(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Businesses Page
function BusinessesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    twilio_number: '',
    cal_org_slug: '',
    vapi_assistant_id: ''
  });
  
  useEffect(() => {
    loadBusinesses();
  }, []);
  
  async function loadBusinesses() {
    try {
      const data = await businessesApi.getAll();
      setBusinesses(data);
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function openAddModal() {
    setEditingBusiness(null);
    setFormData({
      name: '',
      phone_number: '',
      twilio_number: '',
      cal_org_slug: '',
      vapi_assistant_id: ''
    });
    setShowModal(true);
  }
  
  function openEditModal(business) {
    setEditingBusiness(business);
    setFormData({
      name: business.name,
      phone_number: business.phone_number || '',
      twilio_number: business.twilio_number || '',
      cal_org_slug: business.cal_org_slug || '',
      vapi_assistant_id: business.vapi_assistant_id || ''
    });
    setShowModal(true);
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingBusiness) {
        await businessesApi.update(editingBusiness.id, formData);
      } else {
        await businessesApi.create(formData);
      }
      setShowModal(false);
      loadBusinesses();
    } catch (error) {
      console.error('Error saving business:', error);
      alert('Error saving business: ' + error.message);
    }
  }
  
  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this business?')) return;
    try {
      await businessesApi.delete(id);
      loadBusinesses();
    } catch (error) {
      console.error('Error deleting business:', error);
      alert('Error deleting business: ' + error.message);
    }
  }
  
  if (loading) return <div className="loading">Loading businesses...</div>;
  
  return (
    <div>
      <h1 className="page-title">Businesses</h1>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Manage Businesses ({businesses.length})</span>
          <button className="btn btn-primary" onClick={openAddModal}>
            + Add Business
          </button>
        </div>
        
        {businesses.length === 0 ? (
          <div className="empty-state">
            No businesses yet. Add your first business to get started.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone Number</th>
                <th>Twilio Number</th>
                <th>Cal.com Org</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map(business => (
                <tr key={business.id}>
                  <td><strong>{business.name}</strong></td>
                  <td>{business.phone_number || '-'}</td>
                  <td>{business.twilio_number || '-'}</td>
                  <td>{business.cal_org_slug || '-'}</td>
                  <td>{formatDate(business.created_at)}</td>
                  <td>
                    <div className="actions">
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(business)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(business.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingBusiness ? 'Edit Business' : 'Add Business'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Business Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Phone Number (Forwarding)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone_number}
                  onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="+1XXX XXX XXXX"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Twilio Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.twilio_number}
                  onChange={e => setFormData({ ...formData, twilio_number: e.target.value })}
                  placeholder="+1XXX XXX XXXX"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Cal.com Organization</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.cal_org_slug}
                  onChange={e => setFormData({ ...formData, cal_org_slug: e.target.value })}
                  placeholder="your-org"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">VAPI Assistant ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.vapi_assistant_id}
                  onChange={e => setFormData({ ...formData, vapi_assistant_id: e.target.value })}
                  placeholder="uuid"
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBusiness ? 'Save Changes' : 'Add Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Debug Page
function DebugPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  useEffect(() => {
    loadEvents();
    // Poll for new events every 10 seconds
    const interval = setInterval(loadEvents, 10000);
    return () => clearInterval(interval);
  }, []);
  
  async function loadEvents() {
    try {
      const data = await webhookEventsApi.getAll(50);
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function toggleProcessed(event) {
    setEvents(prev => prev.map(e => 
      e.id === event.id ? { ...e, processed: !e.processed } : e
    ));
  }
  
  if (loading) return <div className="loading">Loading debug events...</div>;
  
  return (
    <div>
      <h1 className="page-title">Debug Panel</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{events.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Processed</div>
          <div className="stat-value">{events.filter(e => e.processed).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value">{events.filter(e => !e.processed).length}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Webhook Events</span>
          <button className="btn btn-secondary btn-sm" onClick={loadEvents}>
            Refresh
          </button>
        </div>
        
        <div className="debug-panel">
          {events.length === 0 ? (
            <div className="empty-state" style={{ color: '#888' }}>No webhook events yet</div>
          ) : (
            events.map(event => (
              <div key={event.id} className="debug-event">
                <div className="debug-meta">
                  <span className="debug-source">{event.source}</span>
                  <span className="debug-type">{event.event_type}</span>
                  <span className="debug-time">{formatDate(event.created_at)}</span>
                  <span className={`badge ${event.processed ? 'badge-success' : 'badge-warning'}`}>
                    {event.processed ? 'processed' : 'pending'}
                  </span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                  >
                    {selectedEvent?.id === event.id ? 'Hide' : 'Show'} Payload
                  </button>
                  <button 
                    className="btn btn-sm btn-secondary"
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => toggleProcessed(event)}
                  >
                    {event.processed ? 'Mark Pending' : 'Mark Processed'}
                  </button>
                </div>
                {selectedEvent?.id === event.id && (
                  <pre className="debug-payload">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                )}
                {event.error_message && (
                  <div style={{ color: '#ef4444', marginTop: '0.5rem' }}>
                    Error: {event.error_message}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Dashboard Stats Component
function DashboardStats() {
  const [stats, setStats] = useState({ calls: 0, businesses: 0, bookings: 0 });
  const [recentCalls, setRecentCalls] = useState([]);
  
  useEffect(() => {
    async function loadStats() {
      try {
        const [callsData, businessesData] = await Promise.all([
          callsApi.getAll(100),
          businessesApi.getAll()
        ]);
        
        const today = new Date();
        const todayCalls = callsData.filter(c => {
          const callDate = new Date(c.started_at);
          return callDate.toDateString() === today.toDateString();
        });
        
        setStats({
          calls: callsData.length,
          businesses: businessesData.length,
          today: todayCalls.length
        });
        setRecentCalls(callsData.slice(0, 5));
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    }
    
    loadStats();
  }, []);
  
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Calls</div>
          <div className="stat-value">{stats.calls}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Calls</div>
          <div className="stat-value">{stats.today}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Businesses</div>
          <div className="stat-value">{stats.businesses}</div>
        </div>
      </div>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
          <Link to="/" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        {recentCalls.length === 0 ? (
          <div className="empty-state">No recent activity</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Business</th>
                <th>Caller</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.map(call => (
                <tr key={call.id}>
                  <td>{formatDate(call.started_at)}</td>
                  <td>{call.businesses?.name || '-'}</td>
                  <td>{call.caller_phone}</td>
                  <td><StatusBadge status={call.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

// Home Page (Dashboard)
function HomePage() {
  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>
      <DashboardStats />
    </div>
  );
}

// App Component
function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
