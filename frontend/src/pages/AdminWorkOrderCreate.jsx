import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function AdminWorkOrderCreate() {
  const [manholes, setManholes] = useState([]);
  const [wards, setWards] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedManholeId, setSelectedManholeId] = useState('');
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [subContractor, setSubContractor] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [estimatedEndTime, setEstimatedEndTime] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadRefs() {
      try {
        const [contractorList, allManholes] = await Promise.all([
          api.getReferenceContractors(),
          api.getReferenceManholes(),
        ]);
        setContractors(contractorList);
        setWards([...new Set(allManholes.map((m) => m.ward))].sort());
      } catch (err) {
        setError(err.message || 'Unable to load reference data.');
      } finally {
        setLoadingRefs(false);
      }
    }

    loadRefs();
  }, []);

  // Manholes are (re)loaded scoped to the selected ward, so a flat dropdown
  // of hundreds of manholes is never rendered at once.
  useEffect(() => {
    if (!selectedWard) {
      setManholes([]);
      setSelectedManholeId('');
      return;
    }

    async function loadManholes() {
      try {
        const rows = await api.getReferenceManholes(selectedWard);
        setManholes(rows);
        setSelectedManholeId('');
      } catch (err) {
        setManholes([]);
        setSelectedManholeId('');
        setError(err.message || 'Unable to load manholes for that ward.');
      }
    }
    loadManholes();
  }, [selectedWard]);

  useEffect(() => {
    if (!selectedContractorId) {
      setSupervisors([]);
      setSelectedSupervisorId('');
      return;
    }

    async function loadSupervisors() {
      try {
        const rows = await api.getReferenceSupervisors(selectedContractorId);
        setSupervisors(rows);
        setSelectedSupervisorId('');
      } catch (err) {
        setSupervisors([]);
        setSelectedSupervisorId('');
        setError(err.message || 'Unable to load supervisors for that contractor.');
      }
    }

    loadSupervisors();
  }, [selectedContractorId]);

  const selectedContractor = useMemo(
    () => contractors.find((c) => String(c.id) === String(selectedContractorId)) || null,
    [contractors, selectedContractorId]
  );

  useEffect(() => {
    if (selectedContractor) {
      setSubContractor(selectedContractor.sub_contractor_name || '');
    } else {
      setSubContractor('');
    }
  }, [selectedContractor]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedManholeId || !selectedContractorId || !selectedSupervisorId || !scheduledTime) {
      setError('Please complete all required fields before creating the work order.');
      return;
    }

    setLoading(true);
    try {
      await api.createWorkOrder({
        manhole_id: Number(selectedManholeId),
        contractor_id: Number(selectedContractorId),
        supervisor_id: Number(selectedSupervisorId),
        scheduled_time: new Date(scheduledTime).toISOString(),
        estimated_end_time: estimatedEndTime ? new Date(estimatedEndTime).toISOString() : null,
      });
      setSuccess('Work order created.');
      setTimeout(() => navigate('/admin'), 700);
    } catch (err) {
      const msg = err?.message || 'Unable to create the work order.';
      setError(msg.includes('active work order already exists') ? 'This manhole already has an active work order. Choose another manhole or close the existing permit first.' : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <div className="display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 18 }}>
        Create Work Order
      </div>

      <Card padding={24}>
        <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Ward">
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              required
              disabled={loadingRefs}
              style={inputStyle}
            >
              <option value="">Select a ward</option>
              {wards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Manhole">
            <select
              value={selectedManholeId}
              onChange={(e) => setSelectedManholeId(e.target.value)}
              required
              disabled={!selectedWard || manholes.length === 0}
              style={inputStyle}
            >
              <option value="">Select a manhole</option>
              {manholes.map((manhole) => (
                <option key={manhole.id} value={manhole.id}>
                  {manhole.qr_code_id} · {manhole.ward}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Contractor">
            <select
              value={selectedContractorId}
              onChange={(e) => setSelectedContractorId(e.target.value)}
              required
              disabled={loadingRefs}
              style={inputStyle}
            >
              <option value="">Select contractor</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sub-contractor (optional)">
            <input
              value={subContractor}
              onChange={(e) => setSubContractor(e.target.value)}
              placeholder="Enter sub-contractor name"
              style={inputStyle}
            />
          </Field>

          <Field label="Supervisor">
            <select
              value={selectedSupervisorId}
              onChange={(e) => setSelectedSupervisorId(e.target.value)}
              required
              disabled={!selectedContractorId || supervisors.length === 0}
              style={inputStyle}
            >
              <option value="">Select supervisor</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name} · {supervisor.phone}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Scheduled date & time">
            <input
              required
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Estimated end time">
            <input
              type="datetime-local"
              value={estimatedEndTime}
              onChange={(e) => setEstimatedEndTime(e.target.value)}
              style={inputStyle}
            />
          </Field>
        </div>

        {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, margin: '14px 0 0' }}>{error}</div>}
        {success && <div style={{ color: 'var(--status-good)', fontSize: 13, margin: '14px 0 0' }}>{success}</div>}

        <Button type="submit" disabled={loading || loadingRefs} fullWidth size="lg" style={{ marginTop: 18 }}>
          {loading ? 'Creating…' : 'Create work order'}
        </Button>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8, color: 'var(--ink-muted)' }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 8,
  fontSize: 14,
  background: 'var(--surface-2)',
  color: 'var(--ink-primary)',
};
