import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuth } from '../api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Login() {
  const [role, setRole] = useState('admin');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (role === 'admin') {
        const res = await api.loginAdmin(username, password);
        setAuth({ token: res.token, role: 'admin', user: res.admin });
        navigate('/admin');
      } else if (role === 'supervisor') {
        const res = await api.loginSupervisor(phone, password);
        setAuth({ token: res.token, role: 'supervisor', user: res.supervisor });
        navigate('/supervisor');
      } else {
        const res = await api.loginContractor(username, password);
        setAuth({ token: res.token, role: 'contractor', user: res.contractor });
        navigate('/contractor');
      }
    } catch (err) {
      setError(
        err.status === 401
          ? "That password doesn't match this account."
          : err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              marginBottom: 18,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)' }} />
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-secondary)' }}>
              Safety system
            </span>
          </div>
          <div className="display" style={{ fontSize: 36, fontWeight: 700 }}>ManholeSafe</div>
        </div>

        <Card padding={24}>
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: 4,
              marginBottom: 20,
              borderRadius: 10,
              background: 'var(--surface-2)',
            }}
          >
            {['admin', 'supervisor', 'contractor'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                style={{
                  flex: 1,
                  padding: '9px 10px',
                  border: 'none',
                  borderRadius: 7,
                  background: role === r ? 'var(--accent)' : 'transparent',
                  color: role === r ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                  textTransform: 'capitalize',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            {role === 'supervisor' ? (
              <Field label="Phone number">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+919999999999"
                  style={inputStyle}
                />
              </Field>
            ) : (
              <Field label={role === 'contractor' ? 'Contractor username' : 'Username'}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={role === 'contractor' ? 'Enter contractor username' : 'Enter admin username'}
                  style={inputStyle}
                />
              </Field>
            )}

            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                style={inputStyle}
              />
            </Field>

            {error && <div style={{ color: 'var(--status-critical)', fontSize: 13, fontWeight: 600 }}>{error}</div>}

            <Button type="submit" disabled={loading} fullWidth size="lg">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7, color: 'var(--ink-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--border-hairline)',
  borderRadius: 8,
  fontSize: 15,
  background: 'var(--surface-2)',
  color: 'var(--ink-primary)',
  outline: 'none',
};
