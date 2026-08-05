import { useEffect, useState } from 'react';
import { api, getUser } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatTile from '../components/ui/StatTile';
import StatusBadge from '../components/StatusBadge';

export default function ContractorDashboard() {
  const user = getUser();
  const [profile, setProfile] = useState(null);
  const [supervisors, setSupervisors] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Roster form state
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [editId, setEditId] = useState(null);
  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  async function load() {
    try {
      const [me, list, orders] = await Promise.all([
        api.getContractorMe(),
        api.getContractorSupervisors(),
        api.getContractorWorkOrders(),
      ]);
      setProfile(me);
      setSupervisors(list);
      setWorkOrders(orders);
    } catch (err) {
      setError(err.message || 'Unable to load contractor dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleAddClick() {
    setFormMode('add');
    setEditId(null);
    setSupName('');
    setSupPhone('');
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  }

  function handleEditClick(sup) {
    setFormMode('edit');
    setEditId(sup.id);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  }

  async function handleDeactivate(id, name) {
    if (!window.confirm(`Are you sure you want to deactivate supervisor "${name}"? This supervisor will no longer be selectable for new work orders.`)) {
      return;
    }
    try {
      await api.deactivateContractorSupervisor(id);
      load();
    } catch (err) {
      alert(err.message || 'Failed to deactivate supervisor.');
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!supName.trim() || supName.trim().length < 2) {
      setFormError('Name must be at least 2 characters.');
      return;
    }

    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(supPhone)) {
      setFormError('Phone number must be a valid format (e.g. +919876543210).');
      return;
    }

    setFormLoading(true);
    try {
      if (formMode === 'add') {
        await api.createContractorSupervisor({ name: supName, phone: supPhone });
        setFormSuccess('Supervisor added successfully!');
      } else {
        await api.updateContractorSupervisor(editId, { name: supName, phone: supPhone });
        setFormSuccess('Supervisor updated successfully!');
      }
      setTimeout(() => {
        setShowForm(false);
        load();
      }, 800);
    } catch (err) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setFormLoading(false);
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--ink-secondary)', padding: 24 }}>Loading contractor dashboard…</div>;
  }

  if (error) {
    return <div style={{ color: 'var(--status-critical)', padding: 24 }}>{error}</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <Card>
        <div className="mono" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-muted)' }}>
          Contractor overview
        </div>
        <h2 className="display" style={{ margin: '10px 0 6px', fontSize: 30 }}>{profile?.name || user?.name || user?.username}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, color: 'var(--ink-secondary)', fontSize: 14 }}>
          <span>Username: {profile?.username || user?.username || '—'}</span>
          {profile?.sub_contractor_name && (
            <>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Sub-contractor: {profile.sub_contractor_name}</span>
            </>
          )}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        <StatTile label="Supervisors" value={supervisors.length} accentColor="var(--series-4)" />
        <StatTile label="Work orders" value={workOrders.length} accentColor="var(--series-1)" />
        <StatTile label="Active orders" value={workOrders.filter((w) => w.status !== 'completed').length} accentColor="var(--status-good)" />
      </div>

      {showForm && (
        <Card style={{ border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 className="display" style={{ margin: 0, fontSize: 18 }}>
              {formMode === 'add' ? 'Add new supervisor' : 'Edit supervisor'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-muted)', fontSize: 16, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleFormSubmit} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--ink-secondary)' }}>Name</div>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Supervisor name"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--ink-secondary)' }}>Phone number</div>
                <input
                  type="text"
                  required
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="+919999999999"
                  style={inputStyle}
                />
              </label>
            </div>
            {formError && <div style={{ color: 'var(--status-critical)', fontSize: 13, fontWeight: 600 }}>{formError}</div>}
            {formSuccess && <div style={{ color: 'var(--status-good)', fontSize: 13, fontWeight: 600 }}>{formSuccess}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Button type="submit" disabled={formLoading} size="sm">
                {formLoading ? 'Saving…' : formMode === 'add' ? 'Add supervisor' : 'Save changes'}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="display" style={{ margin: 0, fontSize: 18 }}>Supervisor roster</h3>
          {!showForm && (
            <Button size="sm" onClick={handleAddClick}>+ Add supervisor</Button>
          )}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {supervisors.length === 0 ? (
            <div style={{ color: 'var(--ink-muted)', fontSize: 14 }}>No active supervisors rostered yet.</div>
          ) : (
            supervisors.map((sup) => (
              <div
                key={sup.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{sup.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 2 }}>{sup.phone}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--status-good)',
                      background: 'var(--surface-1)',
                      border: '1px solid var(--status-good)',
                      borderRadius: 999,
                      padding: '3px 9px',
                    }}
                  >
                    Active
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => handleEditClick(sup)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeactivate(sup.id, sup.name)}>Deactivate</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <h3 className="display" style={{ margin: '0 0 16px', fontSize: 18 }}>Assigned work orders (read-only)</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {workOrders.length === 0 ? (
            <div style={{ color: 'var(--ink-muted)', fontSize: 14 }}>No work orders assigned yet.</div>
          ) : (
            workOrders.map((job) => (
              <div
                key={job.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>Work order #{job.id}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>Manhole: {job.manhole?.qr_code_id || '—'} (Ward: {job.manhole?.ward})</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 2 }}>Supervisor: {job.supervisor?.name || '—'}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 2 }}>Scheduled: {new Date(job.scheduled_time).toLocaleString()}</div>
                </div>
                <div style={{ alignSelf: 'center' }}>
                  <StatusBadge status={job.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--surface-1)',
  color: 'var(--ink-primary)',
  outline: 'none',
};
