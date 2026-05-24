'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Reservation = {
  id: string
  quantity: number
  status: 'PENDING' | 'CONFIRMED' | 'RELEASED'
  expiresAt: string
  product: { name: string; price: number; description: string }
  warehouse: { name: string; location: string }
}

function CountdownTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const expiry = new Date(expiresAt).getTime()

    const update = () => {
      const diff = Math.floor((expiry - Date.now()) / 1000)
      if (diff <= 0) {
        setSecondsLeft(0)
        setExpired(true)
        onExpire()
        return
      }
      setSecondsLeft(diff)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const progress = (secondsLeft / 600) * 100 // 600 = 10 min total

  const color = expired
    ? 'var(--red)'
    : secondsLeft < 60
      ? 'var(--red)'
      : secondsLeft < 180
        ? 'var(--amber)'
        : 'var(--green)'

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px'
      }}>
        Reservation expires in
      </p>

      {/* Circular progress */}
      <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface2)" strokeWidth="6" />
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {expired ? (
            <span style={{ fontSize: '28px' }}>⌛</span>
          ) : (
            <>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '26px', fontWeight: 800, color,
                animation: secondsLeft < 10 ? 'countdown-tick 1s ease infinite' : 'none',
                lineHeight: 1,
              }}>
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                MM:SS
              </span>
            </>
          )}
        </div>
      </div>

      {expired && (
        <p style={{ color: 'var(--red)', fontSize: '14px', fontWeight: 500 }}>
          This reservation has expired
        </p>
      )}
    </div>
  )
}

export default function ReservationPage({ params }: { params: { id: string } }) {
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'confirm' | 'cancel' | null>(null)
  const [status, setStatus] = useState<'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'>('PENDING')
  const [error, setError] = useState<string>('')
  const router = useRouter()

  const fetchReservation = useCallback(async () => {
    try {
      // We store the reservation data in localStorage when navigating here
      // If not, we redirect to home
      const stored = sessionStorage.getItem(`reservation:${params.id}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setReservation(parsed)
        setStatus(parsed.status)
        setLoading(false)
      } else {
        // Try fetching from API (we'll add a GET endpoint below)
        router.push('/')
      }
    } catch {
      router.push('/')
    }
  }, [params.id, router])

  useEffect(() => {
    fetchReservation()
  }, [fetchReservation])

  const handleConfirm = async () => {
    setActionLoading('confirm')
    setError('')

    try {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.status === 410) {
        setStatus('EXPIRED')
        setError('Your reservation expired before we could confirm it. Please try again.')
        return
      }

      if (!res.ok) {
        setError(data.error || 'Failed to confirm')
        return
      }

      setStatus('CONFIRMED')
      sessionStorage.removeItem(`reservation:${params.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async () => {
    setActionLoading('cancel')
    setError('')

    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to cancel')
        return
      }

      sessionStorage.removeItem(`reservation:${params.id}`)
      router.push('/')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleExpire = useCallback(() => {
    if (status === 'PENDING') setStatus('EXPIRED')
  }, [status])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!reservation) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', gap: '12px',
        background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', width: '32px', height: '32px',
            borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px' }}>
          {status === 'CONFIRMED' ? 'Order Confirmed' : 'Complete Purchase'}
        </span>
      </header>

      <main style={{
        maxWidth: '480px', margin: '0 auto',
        padding: '48px 24px',
      }}>

        {/* ── SUCCESS STATE ── */}
        {status === 'CONFIRMED' && (
          <div className="fade-up" style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px', height: '80px',
              background: 'var(--green-dim)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px', margin: '0 auto 24px',
              border: '2px solid var(--green)',
            }}>
              ✓
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '28px',
              fontWeight: 800, marginBottom: '8px', color: 'var(--green)'
            }}>
              Order Confirmed!
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              Your order for {reservation.product.name} has been placed successfully.
            </p>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: '10px',
                padding: '12px 32px', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              Back to Products
            </button>
          </div>
        )}

        {/* ── EXPIRED STATE ── */}
        {status === 'EXPIRED' && (
          <div className="fade-up" style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px', height: '80px',
              background: 'var(--red-dim)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px', margin: '0 auto 24px',
            }}>
              ⌛
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '28px',
              fontWeight: 800, marginBottom: '8px', color: 'var(--red)'
            }}>
              Reservation Expired
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              Your hold on this product expired. The units have been released back to stock.
            </p>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'var(--accent)', color: 'white',
                border: 'none', borderRadius: '10px',
                padding: '12px 32px', fontSize: '15px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
            >
              Browse Products
            </button>
          </div>
        )}

        {/* ── PENDING STATE ── */}
        {status === 'PENDING' && (
          <div className="fade-up">
            {/* Timer */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '28px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <CountdownTimer expiresAt={reservation.expiresAt} onExpire={handleExpire} />
            </div>

            {/* Product summary */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '20px',
            }}>
              <p style={{
                fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px'
              }}>
                Order Summary
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Product</span>
                <span style={{ fontWeight: 500, fontSize: '14px' }}>{reservation.product.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Warehouse</span>
                <span style={{ fontWeight: 500, fontSize: '14px' }}>{reservation.warehouse.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Quantity</span>
                <span style={{ fontWeight: 500, fontSize: '14px' }}>{reservation.quantity}</span>
              </div>
              <div style={{
                borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 600 }}>Total</span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '18px', color: 'var(--accent)'
                }}>
                  ₹{(reservation.product.price * reservation.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Reservation ID */}
            <div style={{
              background: 'var(--surface2)', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Reservation ID</span>
              <span style={{
                fontFamily: 'monospace', fontSize: '12px',
                color: 'var(--text-muted)',
              }}>{reservation.id.slice(0, 20)}…</span>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--red-dim)', border: '1px solid rgba(255,90,110,0.25)',
                borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
                color: 'var(--red)', fontSize: '14px',
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleConfirm}
                disabled={actionLoading !== null}
                style={{
                  background: actionLoading === 'confirm' ? 'var(--accent-dim)' : 'var(--accent)',
                  color: 'white', border: 'none', borderRadius: '12px',
                  padding: '14px', fontSize: '16px', fontWeight: 700,
                  cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'background 0.15s',
                }}
              >
                {actionLoading === 'confirm' ? (
                  <>
                    <div style={{
                      width: '16px', height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Confirming...
                  </>
                ) : (
                  '✓ Confirm Purchase'
                )}
              </button>

              <button
                onClick={handleCancel}
                disabled={actionLoading !== null}
                style={{
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px', padding: '12px',
                  fontSize: '14px', fontWeight: 500,
                  cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-body)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--red)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--red)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                }}
              >
                {actionLoading === 'cancel' ? (
                  <>
                    <div style={{
                      width: '14px', height: '14px',
                      border: '2px solid var(--border)',
                      borderTopColor: 'var(--text-muted)', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    Cancelling...
                  </>
                ) : (
                  '× Cancel Reservation'
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
