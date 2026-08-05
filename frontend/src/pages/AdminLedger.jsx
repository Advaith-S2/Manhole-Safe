import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import PermitDetail from './PermitDetail';
import StatusBadge from '../components/StatusBadge';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatTile from '../components/ui/StatTile';
import StatusBreakdownChart from '../components/charts/StatusBreakdownChart';
import GpsRiskMeter from '../components/charts/GpsRiskMeter';
import CloseTimeTrend from '../components/charts/CloseTimeTrend';
import ContractorBreakdownTable from '../components/charts/ContractorBreakdownTable';

const PAGE_SIZE = 8;
const STATUS_OPTIONS = ['pending', 'in_progress', 'pending_confirmation', 'unconfirmed', 'escalated', 'closed'];

export default function AdminLedger() {
  const [workOrders, setWorkOrders] = useState([]);
  const [permits, setPermits] = useState({});
  const [status, setStatus] = useState('');
  const [contractorFilter, setContractorFilter] = useState('');
  const [manholeFilter, setManholeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getWorkOrders(status ? { status } : {});
      setWorkOrders(res);
      const entries = await Promise.all(
        res.map(async (wo) => {
          try {
            const permit = await api.getPermitByWorkOrder(wo.id);
            return [wo.id, permit];
          } catch {
            return [wo.id, null];
          }
        })
      );
      setPermits(Object.fromEntries(entries.filter(([, permit]) => permit)));
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const filtered = useMemo(() => {
    return workOrders.filter((wo) => {
      const permit = permits[wo.id];
      const contractorMatch = contractorFilter ? (wo.contractor?.name || '').toLowerCase().includes(contractorFilter.toLowerCase()) : true;
      const manholeMatch = manholeFilter ? (wo.manhole?.qr_code_id || '').toLowerCase().includes(manholeFilter.toLowerCase()) : true;
      const liveStatus = permit?.status || wo.status;
      const statusMatch = !status || liveStatus === status;
      return contractorMatch && manholeMatch && statusMatch;
    });
  }, [workOrders, permits, contractorFilter, manholeFilter, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalOpen = workOrders.filter((wo) => ['pending', 'in_progress'].includes(wo.status)).length;
  const escalationsNow = workOrders.filter((wo) => ['escalated', 'unconfirmed'].includes(permits[wo.id]?.status || wo.status)).length;

  const closedPermits = workOrders
    .map((wo) => permits[wo.id])
    .filter(Boolean)
    .filter((permit) => permit.status === 'closed' && permit.exit_time && permit.entry_time);

  const averageCloseMinutes = closedPermits.length
    ? Math.round(
        closedPermits.reduce((sum, permit) => {
          const diffMs = new Date(permit.exit_time).getTime() - new Date(permit.entry_time).getTime();
          return sum + diffMs;
        }, 0) / closedPermits.length / 60000
      )
    : 0;

  const unconfirmed = workOrders.filter((wo) => (permits[wo.id]?.status || wo.status) === 'unconfirmed').length;

  // Chart data — derived from the same workOrders/permits already in memory,
  // no extra requests.
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, in_progress: 0, pending_confirmation: 0, unconfirmed: 0, escalated: 0, closed: 0 };
    workOrders.forEach((wo) => {
      const liveStatus = permits[wo.id]?.status || wo.status;
      const key = liveStatus === 'completed' ? 'closed' : liveStatus;
      if (key in counts) counts[key] += 1;
    });
    return counts;
  }, [workOrders, permits]);

  const gpsStats = useMemo(() => {
    const withGps = Object.values(permits).filter((p) => p.entry_lat != null || p.exit_lat != null || p.location_missing);
    const mismatchCount = withGps.filter((p) => p.location_mismatch).length;
    const missingCount = withGps.filter((p) => p.location_missing).length;

    const flaggedPermits = withGps
      .filter((p) => p.location_mismatch || p.location_missing)
      .map((p) => {
        const wo = workOrders.find((w) => w.id === p.work_order_id);
        const distanceMeters = p.exit_distance_meters ?? p.entry_distance_meters;
        return {
          workOrderId: p.work_order_id,
          manholeLabel: wo?.manhole?.qr_code_id || `Work order ${p.work_order_id}`,
          reason: p.location_missing ? 'missing' : 'mismatch',
          distanceMeters,
        };
      });

    return { mismatchCount, missingCount, totalWithGps: withGps.length, flaggedPermits };
  }, [permits, workOrders]);

  const closeTimeTrendPoints = useMemo(() => {
    const byDay = {};
    closedPermits.forEach((permit) => {
      const day = new Date(permit.exit_time).toISOString().slice(0, 10);
      const minutes = (new Date(permit.exit_time).getTime() - new Date(permit.entry_time).getTime()) / 60000;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(minutes);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date: date.slice(5), avgMinutes: values.reduce((a, b) => a + b, 0) / values.length }));
  }, [closedPermits]);

  const contractorRows = useMemo(() => {
    const map = {};
    workOrders.forEach((wo) => {
      const name = wo.contractor?.name || 'Unknown';
      if (!map[name]) map[name] = { name, total: 0, risky: 0 };
      map[name].total += 1;
      const liveStatus = permits[wo.id]?.status || wo.status;
      if (['escalated', 'unconfirmed'].includes(liveStatus)) map[name].risky += 1;
    });
    return Object.values(map);
  }, [workOrders, permits]);

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="mono" style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Admin dashboard</div>
          <div className="display" style={{ fontSize: 32, fontWeight: 700 }}>Control room</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <StatTile label="Permits open now" value={totalOpen} accentColor="var(--series-1)" />
        <StatTile label="Escalations now" value={escalationsNow} accentColor="var(--status-critical)" />
        <StatTile label="Avg close time" value={`${averageCloseMinutes} min`} accentColor="var(--series-4)" />
        <StatTile label="Unconfirmed" value={unconfirmed} accentColor="var(--status-warning)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <StatusBreakdownChart counts={statusCounts} />
        <GpsRiskMeter
          {...gpsStats}
          onSelectPermit={(workOrderId) => {
            const wo = workOrders.find((w) => w.id === workOrderId);
            if (wo) setSelected(wo);
          }}
        />
        <CloseTimeTrend points={closeTimeTrendPoints} />
        <ContractorBreakdownTable rows={contractorRows} />
      </div>

      <Card padding={18}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>Live permit table</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <input
              value={contractorFilter}
              onChange={(e) => setContractorFilter(e.target.value)}
              placeholder="Filter contractor"
              style={inputStyle}
            />
            <input
              value={manholeFilter}
              onChange={(e) => setManholeFilter(e.target.value)}
              placeholder="Filter manhole"
              style={inputStyle}
            />
          </div>
        </div>

        {loading && <div style={{ color: 'var(--ink-secondary)' }}>Loading dashboard…</div>}
        {error && <div style={{ color: 'var(--status-critical)' }}>{error}</div>}

        {!loading && !error && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--ink-muted)', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    <th style={thStyle}>Manhole</th>
                    <th style={thStyle}>Ward</th>
                    <th style={thStyle}>Contractor</th>
                    <th style={thStyle}>Supervisor</th>
                    <th style={thStyle}>Worker</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Live elapsed</th>
                    <th style={thStyle}>Risk</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((wo) => {
                    const permit = permits[wo.id];
                    const liveStatus = permit?.status || wo.status;
                    const workerPhone = permit?.worker_phone ? maskPhone(permit.worker_phone) : '—';
                    const elapsed = permit?.entry_time ? formatElapsed(new Date(permit.entry_time)) : '—';
                    return (
                      <tr key={wo.id} style={{ borderTop: '1px solid var(--border-hairline)', fontSize: 14 }}>
                        <td style={tdStyle}>{wo.manhole?.qr_code_id || wo.manhole_id}</td>
                        <td style={tdStyle}>{wo.manhole?.ward || '—'}</td>
                        <td style={tdStyle}>{wo.contractor?.name || '—'}{wo.contractor?.sub_contractor_name ? ` / ${wo.contractor.sub_contractor_name}` : ''}</td>
                        <td style={tdStyle}>{wo.supervisor?.name || '—'}</td>
                        <td style={tdStyle}>{workerPhone}</td>
                        <td style={tdStyle}><StatusBadge status={liveStatus} /></td>
                        <td style={tdStyle}>{elapsed}</td>
                        <td style={tdStyle}><RiskBadge permit={permit} /></td>
                        <td style={tdStyle}>
                          <Button size="sm" onClick={() => setSelected(wo)}>View more</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-muted)' }}>Showing {pageItems.length} of {filtered.length} rows</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {selected && (
        <PermitDetail
          workOrder={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      <option value="">All statuses</option>
      {options.map((entry) => (
        <option key={entry} value={entry}>{entry.replace('_', ' ')}</option>
      ))}
    </select>
  );
}

function RiskBadge({ permit }) {
  if (!permit) return <span style={{ color: 'var(--ink-muted)' }}>—</span>;
  if (permit.location_missing) {
    return (
      <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--status-critical)', color: 'var(--status-critical)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        No GPS Data
      </span>
    );
  }
  if (permit.location_mismatch) {
    return (
      <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--status-warning)', color: 'var(--status-warning)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        GPS Mismatch
      </span>
    );
  }
  return <span style={{ color: 'var(--ink-muted)' }}>No risk</span>;
}

function maskPhone(value) {
  if (!value) return '—';
  return `${value.slice(0, 2)}${'x'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

function formatElapsed(startDate) {
  const ms = Date.now() - new Date(startDate).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes === 0) return `${totalSeconds}s ago`;
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min ago`;
}

const thStyle = {
  padding: '10px 12px',
  color: 'var(--ink-muted)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '14px 12px',
  verticalAlign: 'middle',
  color: 'var(--ink-primary)',
  whiteSpace: 'nowrap',
};

const inputStyle = {
  background: 'var(--surface-2)',
  color: 'var(--ink-primary)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
};
