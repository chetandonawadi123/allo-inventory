'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type StockLevel = {
  id: string
  warehouseId: string
  total: number
  reserved: number
  available: number
  warehouse: { id: string; name: string; location: string }
}

type Product = {
  id: string
  name: string
  description: string
  price: number
  stockLevels: StockLevel[]
}

function StockBadge({ available, total }: { available: number; total: number }) {
  if (available === 0)
    return (
      <span style={{
        background: 'var(--red-dim)', color: 'var(--red)',
        fontSize: '11px', fontWeight: 600, padding: '2px 8px',
        borderRadius: '20px', letterSpacing: '0.04em', textTransform: 'uppercase'
      }}>Out of stock</span>
    )

  if (available <= 3)
    return (
      <span style={{
        background: 'var(--amber-dim)', color: 'var(--amber)',
        fontSize: '11px', fontWeight: 600, padding: '2px 8px',
        borderRadius: '20px', letterSpacing: '0.04em', textTransform: 'uppercase'
      }}>Only {available} left</span>
    )

  return (
    <span style={{
      background: 'var(--green-dim)', color: 'var(--green)',
      fontSize: '11px', fontWeight: 600, padding: '2px 8px',
      borderRadius: '20px', letterSpacing: '0.04em', textTransform: 'uppercase'
    }}>{available} in stock</span>
  )
}

const PRODUCT_ICONS: Record<string, string> = {
  default: '💊',
  'Vitamin': '☀️',
  'Zinc': '⚡',
  'Omega': '🐟',
  'Ashwagandha': '🌿',
  'CoQ10': '🔋',
}

function getIcon(name: string) {
  for (const [key, icon] of Object.entries(PRODUCT_ICONS)) {
    if (name.includes(key)) return icon
  }
  return PRODUCT_ICONS.default
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [reserving, setReserving] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const router = useRouter()

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } catch {
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleReserve = async (productId: string, warehouseId: string) => {
    const key = `${productId}:${warehouseId}`
    setReserving(key)
    setError('')

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      })

      const data = await res.json()

      if (res.status === 409) {
        setError(`Not enough stock: ${data.error}`)
        setReserving(null)
        return
      }

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setReserving(null)
        return
      }

      // Store reservation data so the checkout page can display it
      sessionStorage.setItem(`reservation:${data.id}`, JSON.stringify(data))
      router.push(`/reservation/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
      setReserving(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', background: 'var(--accent)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px'
          }}>A</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px' }}>
            Allo Health
          </span>
        </div>
        <button
          onClick={fetchProducts}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', padding: '6px 14px', borderRadius: '8px',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-body)',
          }}
        >
          ↺ Refresh
        </button>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>
        {/* Hero */}
        <div className="fade-up" style={{ marginBottom: '48px' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '12px',
          }}>
            Product Inventory
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>
            Reserve products across warehouses. Holds expire in 10 minutes.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid rgba(255,90,110,0.25)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '24px',
            color: 'var(--red)', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>⚠ {error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '18px' }}>×</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div className="spinner" />
          </div>
        )}

        {/* Product Grid */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {products.map((product, i) => (
              <div
                key={product.id}
                className="fade-up"
                style={{
                  animationDelay: `${i * 60}ms`,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                }}
              >
                {/* Product header */}
                <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '48px', height: '48px', background: 'var(--surface2)',
                      borderRadius: '12px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '22px', flexShrink: 0,
                    }}>
                      {getIcon(product.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: '16px',
                        marginBottom: '4px',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{product.name}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.4 }}>
                        {product.description}
                      </p>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '22px', fontWeight: 700, color: 'var(--text)',
                    }}>
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Warehouse stock levels */}
                <div style={{ padding: '16px 24px' }}>
                  <p style={{
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px'
                  }}>
                    Warehouse Availability
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {product.stockLevels.map((stock) => {
                      const key = `${product.id}:${stock.warehouseId}`
                      const isReserving = reserving === key

                      return (
                        <div key={stock.id} style={{
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: '10px',
                          background: 'var(--surface2)',
                          borderRadius: '10px', padding: '10px 14px',
                        }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '2px' }}>
                              {stock.warehouse.name}
                            </p>
                            <StockBadge available={stock.available} total={stock.total} />
                          </div>
                          <button
                            onClick={() => handleReserve(product.id, stock.warehouseId)}
                            disabled={stock.available === 0 || isReserving}
                            style={{
                              background: stock.available === 0
                                ? 'var(--surface)'
                                : isReserving
                                  ? 'var(--accent-dim)'
                                  : 'var(--accent)',
                              color: stock.available === 0
                                ? 'var(--text-muted)'
                                : 'white',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: stock.available === 0 ? 'not-allowed' : 'pointer',
                              fontFamily: 'var(--font-body)',
                              minWidth: '80px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                              transition: 'background 0.15s',
                              flexShrink: 0,
                            }}
                          >
                            {isReserving ? (
                              <>
                                <div style={{
                                  width: '12px', height: '12px',
                                  border: '2px solid rgba(255,255,255,0.3)',
                                  borderTopColor: 'white',
                                  borderRadius: '50%',
                                  animation: 'spin 0.7s linear infinite',
                                }} />
                                Holding...
                              </>
                            ) : stock.available === 0 ? 'Sold out' : 'Reserve'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
