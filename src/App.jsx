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
    queued: 'badge-info',
    'in-progress': 'badge-warning',
    completed: 'badge-success',
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
  if (seconds === null || seconds === undefined) return '-';
  if (seconds === 0) return '0s';
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

function getCallerPhone(call) {
  return call.customer_phone || call.from_phone || call.caller_phone || '-';
}

function getCallStart(call) {
  return call.started_at || call.metadata?.vapi_call?.createdAt || call.created_at || null;
}

function getCallEnd(call) {
  return call.ended_at || call.metadata?.vapi_call?.updatedAt || call.updated_at || null;
}

function getCallDuration(call) {
  if (typeof call.duration_seconds === 'number') return call.duration_seconds;
  const start = getCallStart(call);
  const end = getCallEnd(call);
  if (!start || !end) return null;
  const duration = new Date(end) - new Date(start);
  if (Number.isNaN(duration) || duration < 0) return null;
  return Math.round(duration / 1000);
}

function formatYesNo(value) {
  if (value === null || value === undefined) return '-';
  return value ? 'Yes' : 'No';
}

function shortId(value) {
  if (!value) return '-';
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatBusinessHours(hours) {
  if (!hours) return '-';
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayLabels = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun'
  };
  return dayOrder
    .filter(day => hours[day])
    .map(day => `${dayLabels[day]} ${hours[day].start}-${hours[day].end}`)
    .join(', ');
}

function getBusinessHoursEntries(hours) {
  if (!hours) return [];
  const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayLabels = {
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    sun: 'Sun'
  };
  return dayOrder
    .filter(day => hours[day])
    .map(day => ({
      label: dayLabels[day],
      start: hours[day].start,
      end: hours[day].end
    }));
}

const BUSINESS_HOUR_DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
];

function getDefaultBusinessHours() {
  return BUSINESS_HOUR_DAYS.reduce((acc, day) => {
    acc[day.key] = { active: false, start: '09:00', end: '17:00' };
    return acc;
  }, {});
}

function normalizeBusinessHours(hours) {
  const normalized = getDefaultBusinessHours();
  if (!hours) return normalized;
  BUSINESS_HOUR_DAYS.forEach(day => {
    if (hours[day.key]) {
      normalized[day.key] = {
        active: true,
        start: hours[day.key].start || '09:00',
        end: hours[day.key].end || '17:00'
      };
    }
  });
  return normalized;
}

function serializeBusinessHours(hours) {
  const output = {};
  BUSINESS_HOUR_DAYS.forEach(day => {
    if (hours[day.key]?.active) {
      output[day.key] = {
        start: hours[day.key].start,
        end: hours[day.key].end
      };
    }
  });
  return Object.keys(output).length ? output : null;
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

function BooleanPill({ value, trueLabel = 'Yes', falseLabel = 'No' }) {
  if (value === null || value === undefined) {
    return <span className="pill pill-neutral">-</span>;
  }
  return (
    <span className={`pill ${value ? 'pill-success' : 'pill-warning'}`}>
      {value ? trueLabel : falseLabel}
    </span>
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
        getCallerPhone(call).toLowerCase().includes(filters.search.toLowerCase()) ||
        call.businesses?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.intent?.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.ended_reason?.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.vapi_call_id?.toLowerCase().includes(filters.search.toLowerCase());
      return matchesStatus && matchesBusiness && matchesSearch;
    });
  }, [calls, filters]);

  const callStats = useMemo(() => {
    const total = filteredCalls.length;
    const completed = filteredCalls.filter(call => call.status === 'completed').length;
    const missed = filteredCalls.filter(call => call.missed).length;
    const escalations = filteredCalls.filter(call => call.escalation_required).length;
    const durations = filteredCalls
      .map(call => call.duration_seconds)
      .filter(value => typeof value === 'number' && value > 0);
    const avgDuration =
      durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return { total, completed, missed, escalations, avgDuration };
  }, [filteredCalls]);

  if (loading) {
    return (
      <div>
        <h1 className="page-title">Recent Calls</h1>
        <div className="card">
          <TableSkeleton rows={8} cols={10} />
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="page-title">Recent Calls</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Calls</div>
          <div className="stat-value">{callStats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{callStats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Missed</div>
          <div className="stat-value">{callStats.missed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Escalations</div>
          <div className="stat-value">{callStats.escalations}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Duration</div>
          <div className="stat-value">{formatDuration(callStats.avgDuration)}</div>
        </div>
      </div>
      
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
              <option value="queued">Queued</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
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
                  <th>Started</th>
                  <th>Business</th>
                  <th>Caller</th>
                  <th>Direction</th>
                  <th>Intent</th>
                  <th>Status</th>
                  <th>AI</th>
                  <th>Escalation</th>
                  <th>Duration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map(call => (
                  <tr key={call.id}>
                    <td>{formatDate(getCallStart(call))}</td>
                    <td>{call.businesses?.name || '-'}</td>
                    <td>{getCallerPhone(call)}</td>
                    <td className="cell-muted">{call.direction || '-'}</td>
                    <td className="cell-muted">{call.intent || '-'}</td>
                    <td>
                      <div className="status-stack">
                        <StatusBadge status={call.status || 'unknown'} />
                        {call.ended_reason && (
                          <span className="cell-subtext">{call.ended_reason}</span>
                        )}
                      </div>
                    </td>
                    <td><BooleanPill value={call.ai_handled} trueLabel="Handled" falseLabel="No" /></td>
                    <td><BooleanPill value={call.escalation_required} trueLabel="Yes" falseLabel="No" /></td>
                    <td>{formatDuration(getCallDuration(call))}</td>
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
            
            <div className="detail-header">
              <div>
                <div className="detail-title">{selectedCall.businesses?.name || '-'}</div>
                <div className="detail-subtitle">{getCallerPhone(selectedCall)}</div>
              </div>
              <div className="detail-chips">
                <StatusBadge status={selectedCall.status || 'unknown'} />
                {selectedCall.ended_reason && (
                  <span className="chip">{selectedCall.ended_reason}</span>
                )}
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Started</span>
                <span className="detail-value">{formatDate(getCallStart(selectedCall))}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Ended</span>
                <span className="detail-value">{formatDate(getCallEnd(selectedCall))}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{formatDuration(getCallDuration(selectedCall))}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Direction</span>
                <span className="detail-value">{selectedCall.direction || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Intent</span>
                <span className="detail-value">{selectedCall.intent || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Sentiment</span>
                <span className="detail-value">{selectedCall.sentiment || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Missed</span>
                <span className="detail-value">{formatYesNo(selectedCall.missed)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">AI Handled</span>
                <span className="detail-value">{formatYesNo(selectedCall.ai_handled)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Escalation Required</span>
                <span className="detail-value">{formatYesNo(selectedCall.escalation_required)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">From</span>
                <span className="detail-value">{selectedCall.from_phone || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">To</span>
                <span className="detail-value">{selectedCall.to_phone || '-'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">VAPI Call ID</span>
                <span className="detail-value" title={selectedCall.vapi_call_id}>
                  {shortId(selectedCall.vapi_call_id)}
                </span>
              </div>
            </div>

            {selectedCall.summary && (
              <div className="detail-section">
                <div className="detail-section-title">Summary</div>
                <div className="detail-text">{selectedCall.summary}</div>
              </div>
            )}

            {(selectedCall.full_transcript || selectedCall.transcript_text) && (
              <div className="detail-section">
                <div className="detail-section-title">Transcript</div>
                <div className="transcript">
                  {selectedCall.full_transcript || selectedCall.transcript_text}
                </div>
              </div>
            )}
            
            {selectedCall.recording_url && (
              <div className="detail-section">
                <div className="detail-section-title">Recording</div>
                <audio controls src={selectedCall.recording_url} style={{ width: '100%' }}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {selectedCall.metadata?.vapi_call && (
              <div className="detail-section">
                <div className="detail-section-title">Call Meta</div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Provider</span>
                    <span className="detail-value">
                      {selectedCall.metadata?.vapi_call?.phoneCallProvider ||
                        selectedCall.metadata?.vapi_call?.transport?.provider ||
                        '-'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Cost</span>
                    <span className="detail-value">
                      {selectedCall.metadata?.vapi_call?.cost ?? '-'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Twilio Call SID</span>
                    <span className="detail-value" title={selectedCall.metadata?.vapi_call?.metadata?.twilioCallSid}>
                      {shortId(selectedCall.metadata?.vapi_call?.metadata?.twilioCallSid)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Twilio Number</span>
                    <span className="detail-value">
                      {selectedCall.metadata?.vapi_call?.metadata?.twilioNumber || '-'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Caller Location</span>
                    <span className="detail-value">
                      {selectedCall.metadata?.vapi_call?.metadata?.callerLocation || '-'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">
                      {formatDate(selectedCall.metadata?.vapi_call?.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {selectedCall.metadata && Object.keys(selectedCall.metadata).length > 0 && (
              <div className="detail-section">
                <div className="detail-section-title">Raw Metadata</div>
                <pre className="debug-payload">
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
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    timezone: '',
    phone_number: '',
    twilio_number: '',
    cal_org_slug: '',
    vapi_assistant_id: '',
    business_hours: getDefaultBusinessHours()
  });
  
  useEffect(() => {
    loadBusinesses();
  }, []);
  
  async function loadBusinesses() {
    try {
      const data = await businessesApi.getAll();
      setBusinesses(data);
      setSelectedBusiness(prev => {
        if (prev) {
          const existing = data.find(item => item.id === prev.id);
          return existing || data[0] || null;
        }
        return data[0] || null;
      });
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
      email: '',
      timezone: '',
      phone_number: '',
      twilio_number: '',
      cal_org_slug: '',
      vapi_assistant_id: '',
      business_hours: getDefaultBusinessHours()
    });
    setShowModal(true);
  }
  
  function openEditModal(business) {
    setEditingBusiness(business);
    setFormData({
      name: business.name,
      email: business.email || '',
      timezone: business.timezone || '',
      phone_number: business.phone_number || '',
      twilio_number: business.twilio_number || '',
      cal_org_slug: business.cal_org_slug || '',
      vapi_assistant_id: business.vapi_assistant_id || '',
      business_hours: normalizeBusinessHours(business.business_hours)
    });
    setShowModal(true);
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const businessHours = serializeBusinessHours(formData.business_hours);
      const invalidDay = BUSINESS_HOUR_DAYS.find(day => {
        const entry = formData.business_hours[day.key];
        if (!entry?.active) return false;
        return !entry.start || !entry.end;
      });
      if (invalidDay) {
        onNotify?.(`Please set start/end for ${invalidDay.label}.`, 'error');
        return;
      }

      const payload = {
        name: formData.name,
        email: formData.email || null,
        timezone: formData.timezone || null,
        phone_number: formData.phone_number || null,
        twilio_number: formData.twilio_number || null,
        cal_org_slug: formData.cal_org_slug || null,
        vapi_assistant_id: formData.vapi_assistant_id || null,
        business_hours: businessHours
      };

      if (editingBusiness) {
        await businessesApi.update(editingBusiness.id, payload);
        onNotify?.('Business updated', 'success');
      } else {
        await businessesApi.create(payload);
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
          <TableSkeleton rows={6} cols={9} />
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="page-title">Businesses</h1>

      {selectedBusiness && (
        <div className="card profile-card">
          <div className="card-header">
            <span className="card-title">Business Profile</span>
            <div className="profile-actions">
              <span className={`pill ${selectedBusiness.active ? 'pill-success' : 'pill-warning'}`}>
                {selectedBusiness.active ? 'Active' : 'Inactive'}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openEditModal(selectedBusiness)}
              >
                Edit Business
              </button>
            </div>
          </div>
          <div className="profile-grid">
            <div>
              <div className="profile-label">Name</div>
              <div className="profile-value">{selectedBusiness.name}</div>
            </div>
            <div>
              <div className="profile-label">Email</div>
              <div className="profile-value">{selectedBusiness.email || '-'}</div>
            </div>
            <div>
              <div className="profile-label">Timezone</div>
              <div className="profile-value">{selectedBusiness.timezone || '-'}</div>
            </div>
            <div>
              <div className="profile-label">Phone Number</div>
              <div className="profile-value">{selectedBusiness.phone_number || '-'}</div>
            </div>
            <div>
              <div className="profile-label">Twilio Number</div>
              <div className="profile-value">{selectedBusiness.twilio_number || '-'}</div>
            </div>
            <div>
              <div className="profile-label">Cal.com Org</div>
              <div className="profile-value">{selectedBusiness.cal_org_slug || '-'}</div>
            </div>
            <div>
              <div className="profile-label">VAPI Assistant</div>
              <div className="profile-value" title={selectedBusiness.vapi_assistant_id || ''}>
                {shortId(selectedBusiness.vapi_assistant_id)}
              </div>
            </div>
            <div>
              <div className="profile-label">VAPI Phone</div>
              <div className="profile-value" title={selectedBusiness.vapi_phone_number_id || ''}>
                {shortId(selectedBusiness.vapi_phone_number_id)}
              </div>
            </div>
            <div>
              <div className="profile-label">Created</div>
              <div className="profile-value">{formatDate(selectedBusiness.created_at)}</div>
            </div>
          </div>
          <div className="profile-hours">
            <div className="profile-label">Business Hours</div>
            <div className="hours-grid">
              {getBusinessHoursEntries(selectedBusiness.business_hours).length === 0 ? (
                <span className="cell-muted">No hours configured</span>
              ) : (
                getBusinessHoursEntries(selectedBusiness.business_hours).map(entry => (
                  <div key={entry.label} className="hours-row">
                    <span className="hours-day">{entry.label}</span>
                    <span className="hours-time">{entry.start} - {entry.end}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
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
                  <th>Email</th>
                  <th>Active</th>
                  <th>Timezone</th>
                  <th>Hours</th>
                  <th>Assistant</th>
                  <th>Phone ID</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBusinesses.map(business => (
                  <tr key={business.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => setSelectedBusiness(business)}
                      >
                        {business.name}
                      </button>
                    </td>
                    <td>{business.email || '-'}</td>
                    <td><BooleanPill value={business.active} trueLabel="Active" falseLabel="Inactive" /></td>
                    <td>{business.timezone || '-'}</td>
                    <td className="cell-muted">{formatBusinessHours(business.business_hours)}</td>
                    <td title={business.vapi_assistant_id || ''}>{shortId(business.vapi_assistant_id)}</td>
                    <td title={business.vapi_phone_number_id || ''}>{shortId(business.vapi_phone_number_id)}</td>
                    <td>{formatDate(business.created_at)}</td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedBusiness(business)}
                        >
                          View
                        </button>
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
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="owner@company.com"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Timezone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.timezone}
                  onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="America/New_York"
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

              <div className="form-group">
                <label className="form-label">Business Hours</label>
                <div className="hours-editor">
                  {BUSINESS_HOUR_DAYS.map(day => (
                    <div key={day.key} className="hours-row-editor">
                      <label className="hours-toggle">
                        <input
                          type="checkbox"
                          checked={formData.business_hours[day.key]?.active}
                          onChange={e =>
                            setFormData({
                              ...formData,
                              business_hours: {
                                ...formData.business_hours,
                                [day.key]: {
                                  ...formData.business_hours[day.key],
                                  active: e.target.checked
                                }
                              }
                            })
                          }
                        />
                        <span>{day.label}</span>
                      </label>
                      <input
                        type="time"
                        className="form-input hours-input"
                        value={formData.business_hours[day.key]?.start}
                        disabled={!formData.business_hours[day.key]?.active}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            business_hours: {
                              ...formData.business_hours,
                              [day.key]: {
                                ...formData.business_hours[day.key],
                                start: e.target.value
                              }
                            }
                          })
                        }
                      />
                      <span className="hours-sep">to</span>
                      <input
                        type="time"
                        className="form-input hours-input"
                        value={formData.business_hours[day.key]?.end}
                        disabled={!formData.business_hours[day.key]?.active}
                        onChange={e =>
                          setFormData({
                            ...formData,
                            business_hours: {
                              ...formData.business_hours,
                              [day.key]: {
                                ...formData.business_hours[day.key],
                                end: e.target.value
                              }
                            }
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
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
  const [stats, setStats] = useState({
    calls: 0,
    businesses: 0,
    today: 0,
    completed: 0,
    missed: 0,
    escalations: 0,
    avgDuration: 0
  });
  const [recentCalls, setRecentCalls] = useState([]);
  
  useEffect(() => {
    async function loadStats() {
      try {
        const [callsData, businessesData] = await Promise.all([
          callsApi.getAll(100),
          businessesApi.getAll()
        ]);
        
        const today = new Date();
        const todayCalls = callsData.filter(call => {
          const start = getCallStart(call);
          if (!start) return false;
          const callDate = new Date(start);
          return callDate.toDateString() === today.toDateString();
        });

        const completedCalls = callsData.filter(call => call.status === 'completed').length;
        const missedCalls = callsData.filter(call => call.missed).length;
        const escalationCalls = callsData.filter(call => call.escalation_required).length;
        const durations = callsData
          .map(call => getCallDuration(call))
          .filter(value => typeof value === 'number' && value > 0);
        const avgDuration =
          durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
        
        setStats({
          calls: callsData.length,
          businesses: businessesData.length,
          today: todayCalls.length,
          completed: completedCalls,
          missed: missedCalls,
          escalations: escalationCalls,
          avgDuration
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
          <div className="stat-label">Completed</div>
          <div className="stat-value">{stats.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Missed</div>
          <div className="stat-value">{stats.missed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Escalations</div>
          <div className="stat-value">{stats.escalations}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Duration</div>
          <div className="stat-value">{formatDuration(stats.avgDuration)}</div>
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
                  <td>{formatDate(getCallStart(call))}</td>
                  <td>{call.businesses?.name || '-'}</td>
                  <td>{getCallerPhone(call)}</td>
                  <td><StatusBadge status={call.status || 'unknown'} /></td>
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
