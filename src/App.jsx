import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Lieferer from './Lieferer'
import Messenger from './Messenger'
import { verschluesseln } from './crypto'

function getTokenAusURL() {
  const params = new URLSearchParams(window.location.search)
  return params.get('t')
}

function getPseudonym(token) {
  const key = 'pseudonym_' + token
  let p = localStorage.getItem(key)
  if (!p) {
    const adj = ['Schnell', 'Ruhig', 'Stark', 'Weise', 'Kühn']
    const tier = ['Falke', 'Wolf', 'Bär', 'Luchs', 'Adler']
    const z = Math.floor(Math.random() * 90) + 10
    p = `${adj[Math.floor(Math.random() * adj.length)]}-${tier[Math.floor(Math.random() * tier.length)]}-${z}`
    localStorage.setItem(key, p)
  }
  return p
}

const C = {
  bg: '#080808',
  card: '#141414',
  card2: '#1a1a1a',
  border: '#242424',
  accent: '#e63030',
  accentDim: '#3a0a0a',
  green: '#22c55e',
  greenDim: '#052010',
  blue: '#3b82f6',
  blueDim: '#0a1535',
  text: '#d4d4d4',
  textDim: '#666',
  textMuted: '#3a3a3a',
}

const btn = (color = C.accent, bg = C.accentDim) => ({
  padding: '14px 20px',
  background: bg,
  color: color,
  border: `1px solid ${color}`,
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '14px',
  fontFamily: 'Share Tech Mono, monospace',
  letterSpacing: '0.05em',
  width: '100%',
  fontWeight: '600',
})

const inputStyle = {
  width: '100%',
  padding: '14px',
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  color: C.text,
  fontSize: '15px',
  fontFamily: 'Share Tech Mono, monospace',
  marginBottom: '10px',
  boxSizing: 'border-box',
  outline: 'none',
}

function Besteller({ token }) {
  const pseudonym = getPseudonym(token)

  const [auswahl, setAuswahl] = useState({})
  const [telefon, setTelefon] = useState('')
  const [laden, setLaden] = useState(false)
  const [zeitfenster, setZeitfenster] = useState([])
  const [bestellungen, setBestellungen] = useState([])
  const [gewaehlterSlot, setGewaehlterSlot] = useState(null)
  const [bestellungId, setBestellungId] = useState(localStorage.getItem('aktive_bestellung'))
  const [bestellStatus, setBestellStatus] = useState('offen')
  const [paketstation, setPaketstation] = useState(null)
  const [bestaetigterSlot, setBestaetigterSlot] = useState(null)
  const [gesendet, setGesendet] = useState(!!localStorage.getItem('aktive_bestellung'))
  const [produkte, setProdukte] = useState([])

  useEffect(() => {
    async function ladeSlots() {
      const [{ data: z }, { data: b }] = await Promise.all([
        supabase.from('zeitfenster').select('*').eq('aktiv', true).order('datum').order('uhrzeit'),
        supabase.from('bestellungen').select('zeitfenster_id')
      ])
      setZeitfenster(z || [])
      setBestellungen(b || [])
    }
    ladeSlots()
    supabase.from('produkte').select('*').eq('aktiv', true).order('name').then(({ data }) => setProdukte(data || []))

    if (bestellungId) {
      supabase
        .from('bestellungen')
        .select('id, status, paketstation_id, zeitfenster_id')
        .eq('id', bestellungId)
        .single()
        .then(async ({ data }) => {
          if (data) {
            setBestellStatus(data.status)
            if (data.paketstation_id) {
              const { data: ps } = await supabase.from('paketstationen').select('*').eq('id', data.paketstation_id).single()
              setPaketstation(ps)
            }
            if (data.zeitfenster_id) {
              const { data: slot } = await supabase.from('zeitfenster').select('*').eq('id', data.zeitfenster_id).single()
              setBestaetigterSlot(slot)
            }
          }
        })

      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('bestellungen')
          .select('id, status, paketstation_id, zeitfenster_id')
          .eq('id', bestellungId)
          .single()

        if (data) {
          setBestellStatus(data.status)
          if (data.paketstation_id) {
            const { data: ps } = await supabase.from('paketstationen').select('*').eq('id', data.paketstation_id).single()
            setPaketstation(ps)
          }
          if (data.zeitfenster_id) {
            const { data: slot } = await supabase.from('zeitfenster').select('*').eq('id', data.zeitfenster_id).single()
            setBestaetigterSlot(slot)
          }
        }

        if (!data || data.status === 'ausgestellt') {
          localStorage.removeItem('aktive_bestellung')
          setBestellungId(null)
          setGesendet(false)
          setAuswahl({})
          setTelefon('')
          setGewaehlterSlot(null)
          clearInterval(interval)
        }
      }, 3000)

      return () => clearInterval(interval)
    }
  }, [bestellungId])

  function belegung(slotId) {
    return bestellungen.filter(b => b.zeitfenster_id === slotId).length
  }

  function mengeAendern(id, wert) {
    setAuswahl(prev => ({ ...prev, [id]: Math.max(0, wert) }))
  }

  async function bestellenKlick() {
    const ausgewaehlt = Object.fromEntries(Object.entries(auswahl).filter(([_, m]) => m > 0))
    if (Object.keys(ausgewaehlt).length === 0) { alert('Bitte mindestens ein Produkt auswählen.'); return }
    if (!gewaehlterSlot) { alert('Bitte ein Zeitfenster auswählen.'); return }

    const { data: aktuelle } = await supabase.from('bestellungen').select('id').eq('zeitfenster_id', gewaehlterSlot.id)
    if (aktuelle.length >= gewaehlterSlot.max_bestellungen) { alert('Dieser Slot ist leider voll.'); return }

    setLaden(true)
    const verschluesselteDaten = verschluesseln({ produkte: ausgewaehlt, telefon: telefon || null })
    const { data: neu, error } = await supabase.from('bestellungen').insert([{
      pseudonym,
      produkte_verschluesselt: verschluesselteDaten,
      status: 'offen',
      zeitfenster_id: gewaehlterSlot.id
    }]).select()
    setLaden(false)

    if (error) { alert('Fehler: ' + error.message); return }
    if (neu && neu.length > 0) {
      setBestellungId(neu[0].id)
      localStorage.setItem('aktive_bestellung', neu[0].id)
    }
    setGesendet(true)
  }

  async function stornieren() {
    const ok = window.confirm('Bestellung wirklich stornieren?')
    if (!ok) return
    // Storniert markieren statt löschen — Lieferer sieht es noch
    await supabase.from('bestellungen').update({
      status: 'storniert',
      storniert_am: new Date().toISOString()
    }).eq('id', bestellungId)
    localStorage.removeItem('aktive_bestellung')
    setBestellungId(null)
    setGesendet(false)
    setAuswahl({})
    setTelefon('')
    setGewaehlterSlot(null)
  }

  const statusFarbe = bestellStatus === 'bestätigt' ? C.green : bestellStatus === 'storniert' ? '#ff4444' : C.textDim

  if (gesendet) return (
    <div style={{ padding: '20px', maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: C.accent, letterSpacing: '0.12em', marginBottom: '4px' }}>BESTELLSYSTEM</div>
        <div style={{ fontSize: '12px', color: C.textDim }}>ID: {pseudonym}</div>
      </div>

      {/* Status Card */}
      {bestellStatus === 'offen' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '8px', letterSpacing: '0.08em' }}>STATUS</div>
          <div style={{ color: C.textDim, fontSize: '15px' }}>⏳ Warte auf Bestätigung...</div>
        </div>
      )}

      {bestellStatus === 'bestätigt' && (
        <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: C.green, marginBottom: '12px', letterSpacing: '0.08em' }}>✓ BESTÄTIGT</div>
          {bestaetigterSlot && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '3px' }}>ZEITFENSTER</div>
              <div style={{ color: C.text, fontSize: '16px', fontWeight: '600' }}>
                {bestaetigterSlot.datum ? new Date(bestaetigterSlot.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' : ''}
                {bestaetigterSlot.uhrzeit}
              </div>
            </div>
          )}
          {paketstation && (
            <div>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '3px' }}>ABHOLPUNKT</div>
              <div style={{ color: C.text, fontSize: '15px' }}>📦 {paketstation.name}</div>
              <div style={{ color: C.textDim, fontSize: '13px' }}>{paketstation.adresse}</div>
            </div>
          )}
        </div>
      )}

      {/* Messenger */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>NACHRICHTEN</div>
        <Messenger bestellungId={bestellungId} pseudonym={pseudonym} />
      </div>

      {/* Stornieren */}
      <button onClick={stornieren} style={{
        ...btn('#ff4444', '#1a0000'),
        fontSize: '13px',
      }}>
        Bestellung stornieren
      </button>
    </div>
  )

  return (
    <div style={{ padding: '20px', maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '11px', color: C.accent, letterSpacing: '0.12em', marginBottom: '4px' }}>BESTELLSYSTEM</div>
        <div style={{ fontSize: '12px', color: C.textDim }}>ID: {pseudonym}</div>
      </div>

      {/* Produkte */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: C.textDim, letterSpacing: '0.08em', marginBottom: '12px' }}>WAREN AUSWÄHLEN</div>
        {produkte.length === 0 && <div style={{ color: C.textMuted, fontSize: '14px', textAlign: 'center', padding: '20px' }}>Keine Produkte verfügbar</div>}
        {produkte.map(p => (
          <div key={p.id} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
            padding: '16px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', color: C.text, fontWeight: '600' }}>{p.name}</div>
              {p.beschreibung && <div style={{ fontSize: '12px', color: C.textDim, marginTop: '2px' }}>{p.beschreibung}</div>}
              {p.preis > 0 && <div style={{ fontSize: '13px', color: C.accent, marginTop: '3px' }}>{p.preis.toFixed(2)} €</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) - 1)} style={{
                width: '36px', height: '36px', background: C.card2, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '18px', fontFamily: 'Share Tech Mono, monospace',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>−</button>
              <span style={{ minWidth: '52px', textAlign: 'center', fontSize: '14px', color: auswahl[p.id] > 0 ? C.text : C.textMuted, fontWeight: '600' }}>
                {p.einheit === 'Stück'
                  ? `${auswahl[p.id] || 0} Stk`
                  : `${auswahl[p.id] || 0}x ${p.mengen && p.mengen.length > 0 ? p.mengen[0] : '?'}g`
                }
              </span>
              <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) + 1)} style={{
                width: '36px', height: '36px', background: C.card2, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '18px', fontFamily: 'Share Tech Mono, monospace',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Zeitfenster */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: C.textDim, letterSpacing: '0.08em', marginBottom: '12px' }}>
          WÄHLE DEIN ZEITFENSTER AUS
        </div>
        {zeitfenster.length === 0 && <div style={{ color: C.textMuted, fontSize: '14px', textAlign: 'center', padding: '20px' }}>Keine Zeitfenster verfügbar</div>}
        {zeitfenster.filter(z => {
          const jetzt = new Date()
          if (z.datum && z.uhrzeit) {
            const bisUhrzeit = z.uhrzeit.split('-')[1]?.trim()
            if (bisUhrzeit) {
              const [stunden, minuten] = bisUhrzeit.split(':').map(Number)
              const slotEnde = new Date(z.datum)
              slotEnde.setHours(stunden, minuten, 0)
              if (slotEnde < jetzt) return false
            }
          }
          return belegung(z.id) < z.max_bestellungen
        }).map(z => {
          const gewaehlt = gewaehlterSlot?.id === z.id
          return (
            <button key={z.id} onClick={() => setGewaehlterSlot(z)} style={{
              display: 'block', width: '100%', padding: '16px', marginBottom: '8px',
              border: `1px solid ${gewaehlt ? C.accent : C.border}`,
              borderRadius: '12px',
              background: gewaehlt ? C.accentDim : C.card,
              color: gewaehlt ? C.accent : C.text,
              cursor: 'pointer', textAlign: 'left', fontSize: '15px',
              fontFamily: 'Share Tech Mono, monospace',
              fontWeight: gewaehlt ? '600' : '400',
              transition: 'all 0.15s'
            }}>
              {z.datum ? new Date(z.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '  ·  ' : ''}
              {z.uhrzeit}
              {gewaehlt && <span style={{ float: 'right', fontSize: '16px' }}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Telefon */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: C.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>TELEFON (OPTIONAL)</div>
        <input type="tel" placeholder="Deine Nummer" value={telefon}
          onChange={e => setTelefon(e.target.value)} style={inputStyle} />
      </div>

      {/* Bestellen */}
      <button onClick={bestellenKlick} disabled={laden} style={{
        ...btn('white', laden ? '#2a0000' : C.accent),
        border: 'none',
        fontSize: '15px',
        padding: '16px',
        opacity: laden ? 0.6 : 1,
      }}>
        {laden ? 'Wird übertragen...' : 'Bestellung absenden'}
      </button>
    </div>
  )
}

function App() {
  const [tokenData, setTokenData] = useState(null)
  const [tokenGeprueft, setTokenGeprueft] = useState(false)

  useEffect(() => {
    async function init() {
      const token = getTokenAusURL()
      if (!token) { setTokenGeprueft(true); return }
      const { data } = await supabase.from('tokens').select('*').eq('token', token).eq('aktiv', true).single()
      if (data) {
        const pseudonym = getPseudonym(token)
        await supabase.from('tokens').update({ zuletzt_genutzt: new Date(), pseudonym }).eq('token', token)
        setTokenData(data)
      }
      setTokenGeprueft(true)
    }
    init()
  }, [])

  if (!tokenGeprueft) return (
    <div style={{ padding: '2rem', color: '#333', fontSize: '12px', background: '#080808', minHeight: '100vh' }}>
      Laden...
    </div>
  )
  if (!tokenData) return <div style={{ background: '#080808', minHeight: '100vh' }}></div>
  if (tokenData.rolle === 'lieferer') return <Lieferer />
  if (tokenData.rolle === 'besteller') return <Besteller token={getTokenAusURL()} />

  return <div style={{ padding: '2rem', color: '#e63030', background: '#080808', minHeight: '100vh' }}>Admin — in Entwicklung</div>
}

export default App
