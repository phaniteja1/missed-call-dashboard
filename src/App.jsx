import { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { supabase, callsApi, businessesApi, webhookEventsApi } from './lib/supabase';
import './index.css';

// Toasts
function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type || 'info'}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => onDismiss(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// Header Component
function Header({ session, onSignOut }) {
  const location = useLocation();
  const user = session?.user;
  const email = user?.email || user?.user_metadata?.email;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
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
      <div className="auth-status">
        {user ? (
          <div className="user-menu" ref={menuRef}>
            <button className="user-trigger" onClick={() => setMenuOpen(!menuOpen)}>
              <span className="user-avatar">{(email || user.id).slice(0, 1).toUpperCase()}</span>
              <span className="user-email">{email || user.id}</span>
            </button>
            {menuOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-avatar lg">{(email || user.id).slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="user-label">Signed in as</div>
                    <div className="user-value">{email || user.id}</div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm full" onClick={onSignOut}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="auth-label">Not signed in</span>
        )}
      </div>
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

function EmptyState({ icon, title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-message">{message}</div>
    </div>
  );
}

function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="table-skeleton">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="skeleton-row"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div key={colIndex} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Calls Page
function CallsPage({ onNotify }) {
  const [calls, setCalls] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    businessId: 'all',
    search: ''
  });
  
  useEffect(() => {
    loadCalls();
  }, []);
  
  async function loadCalls() {
    try {
      const [callsData, businessesData] = await Promise.all([
        callsApi.getAll(100),
        businessesApi.getAll()
      ]);
      setCalls(callsData);
      setBusinesses(businessesData);
    } catch (error) {
      console.error('Error loading calls:', error);
      onNotify?.('Error loading calls', 'error');
    } finally {
      setLoading(false);
    }
  }
  
  const filteredCalls = useMemo(() => {
    return calls.filter(call => {
      const matchesStatus = filters.status === 'all' || call.status === filters.status;
      const matchesBusiness =
        filters.businessId === 'all' || call.business_id === filters.businessId;
      const matchesSearch =
        filters.search.trim() === '' ||
        call.caller_phone?.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.businesses?.name?.toLowerCase().includes(filters.search.toLowerCase());
      return matchesStatus && matchesBusiness && matchesSearch;
    });
  }, [calls, filters]);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Recent Calls</h1>
        <div className="card">
          <TableSkeleton rows={8} cols={6} />
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="page-title">Recent Calls</h1>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Call History ({filteredCalls.length})</span>
          <button className="btn btn-secondary btn-sm" onClick={loadCalls}>
            Refresh
          </button>
        </div>

        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label">Status</label>
            <select
              className="form-input"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">All</option>
              <option value="answered">Answered</option>
              <option value="voicemail">Voicemail</option>
              <option value="failed">Failed</option>
              <option value="busy">Busy</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">Business</label>
            <select
              className="form-input"
              value={filters.businessId}
              onChange={e => setFilters({ ...filters, businessId: e.target.value })}
            >
              <option value="all">All</option>
              {businesses.map(business => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group grow">
            <label className="filter-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by caller or business..."
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
        </div>
        
        {filteredCalls.length === 0 ? (
          <EmptyState
            icon="📞"
            title="No calls yet"
            message="Once calls start coming in, you’ll see them here."
          />
        ) : (
          <div className="table-wrap">
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
                {filteredCalls.map(call => (
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
          </div>
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
function BusinessesPage({ onNotify }) {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [search, setSearch] = useState('');
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
      onNotify?.('Error loading businesses', 'error');
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
        onNotify?.('Business updated', 'success');
      } else {
        await businessesApi.create(formData);
        onNotify?.('Business created', 'success');
      }
      setShowModal(false);
      loadBusinesses();
    } catch (error) {
      console.error('Error saving business:', error);
      onNotify?.(`Error saving business: ${error.message}`, 'error');
    }
  }
  
  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this business?')) return;
    try {
      await businessesApi.delete(id);
      onNotify?.('Business deleted', 'success');
      loadBusinesses();
    } catch (error) {
      console.error('Error deleting business:', error);
      onNotify?.(`Error deleting business: ${error.message}`, 'error');
    }
  }
  
  const filteredBusinesses = useMemo(() => {
    if (!search.trim()) return businesses;
    return businesses.filter(business =>
      business.name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [businesses, search]);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Businesses</h1>
        <div className="card">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="page-title">Businesses</h1>
      
      <div className="card">
        <div className="card-header">
          <span className="card-title">Manage Businesses ({filteredBusinesses.length})</span>
          <button className="btn btn-primary" onClick={openAddModal}>
            + Add Business
          </button>
        </div>

        <div className="filter-bar">
          <div className="filter-group grow">
            <label className="filter-label">Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search businesses..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        {filteredBusinesses.length === 0 ? (
          <EmptyState
            icon="🏢"
            title="No businesses yet"
            message="Add your first business to start tracking calls."
          />
        ) : (
          <div className="table-wrap">
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
                {filteredBusinesses.map(business => (
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
          </div>
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
  
  if (loading) {
    return (
      <div>
        <h1 className="page-title">Debug Panel</h1>
        <div className="card">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    );
  }
  
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
            <EmptyState
              icon="🧩"
              title="No webhook events"
              message="Webhook activity will show here when events start firing."
            />
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
          <EmptyState
            icon="✨"
            title="No recent activity"
            message="When calls come in, they’ll show up here."
          />
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

// Auth Page
function AuthPage() {
  const [mode, setMode] = useState('password');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  async function handlePasswordAuth(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setMessage('Magic link sent. Check your email to finish signing in.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin }
      });
      if (error) throw error;
      setMessage('Check your email to confirm your account.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Sign in to Missed Call Admin</h1>
          <p className="auth-subtitle">Use email/password or a magic link.</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => setMode('password')}
          >
            Email + Password
          </button>
          <button
            className={`auth-tab ${mode === 'magic' ? 'active' : ''}`}
            onClick={() => setMode('magic')}
          >
            Magic Link
          </button>
        </div>

        <form onSubmit={mode === 'magic' ? handleMagicLink : handlePasswordAuth}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              required
            />
          </div>

          {mode === 'password' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {message && <div className="auth-message">{message}</div>}

          <div className="auth-actions">
            {mode === 'password' ? (
              <>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button className="btn btn-secondary" onClick={handleSignUp} disabled={loading}>
                  {loading ? 'Working...' : 'Create Account'}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// App Component
function App() {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
      setSessionReady(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  function notify(message, type = 'info') {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }

  function dismissToast(id) {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }

  if (!sessionReady) {
    return <div className="loading">Loading session...</div>;
  }

  if (!session) {
    return (
      <div className="app">
        <AuthPage />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="app">
        <Header session={session} onSignOut={handleSignOut} />
        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/calls" element={<CallsPage onNotify={notify} />} />
            <Route path="/businesses" element={<BusinessesPage onNotify={notify} />} />
            <Route path="/debug" element={<DebugPage />} />
          </Routes>
        </main>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </BrowserRouter>
  );
}

export default App;
