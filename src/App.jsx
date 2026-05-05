import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Lieferer from './Lieferer'
import Messenger from './Messenger'
import { verschluesseln } from './crypto'
import { t } from './theme'

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
    await supabase.from('nachrichten').delete().eq('bestellung_id', bestellungId)
    await supabase.from('bestellungen').delete().eq('id', bestellungId)
    localStorage.removeItem('aktive_bestellung')
    setBestellungId(null)
    setGesendet(false)
    setAuswahl({})
    setTelefon('')
    setGewaehlterSlot(null)
  }

  const btnMenge = {
    width: '28px', height: '28px', background: '#1a1a1a', color: '#cc0000',
    border: '1px solid #333', borderRadius: '4px', cursor: 'pointer', fontSize: '16px',
    fontFamily: 'Share Tech Mono, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center'
  }

  if (gesendet) return (
    <div style={{ padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ borderBottom: '1px solid #cc0000', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#cc0000', letterSpacing: '0.15em', marginBottom: '4px' }}>BESTELLSYSTEM // AKTIV</div>
        <div style={{ fontSize: '11px', color: '#555' }}>ID: {pseudonym}</div>
      </div>

      {bestellStatus === 'offen' && (
        <div style={{ ...t.card, borderColor: '#333' }}>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>STATUS</div>
          <div style={{ color: '#888', fontSize: '13px' }}>⏳ Warte auf Bestätigung...</div>
        </div>
      )}

      {bestellStatus === 'bestätigt' && (
        <div style={{ ...t.card, borderColor: '#00aa44', background: '#001a0d' }}>
          <div style={{ fontSize: '11px', color: '#00aa44', letterSpacing: '0.1em', marginBottom: '12px' }}>✓ BESTÄTIGT</div>
          {bestaetigterSlot && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em' }}>ZEITFENSTER</div>
              <div style={{ color: '#e0e0e0', fontSize: '14px', marginTop: '2px' }}>
                {bestaetigterSlot.datum ? new Date(bestaetigterSlot.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' : ''}
                {bestaetigterSlot.uhrzeit}
              </div>
            </div>
          )}
          {paketstation && (
            <div>
              <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em' }}>ABHOLPUNKT</div>
              <div style={{ color: '#e0e0e0', fontSize: '14px', marginTop: '2px' }}>📦 {paketstation.name}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>{paketstation.adresse}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>KOMMUNIKATION</div>
        <Messenger bestellungId={bestellungId} pseudonym={pseudonym} />
      </div>

      <button onClick={stornieren} style={{
        marginTop: '1.5rem', width: '100%', padding: '10px',
        background: 'transparent', color: '#cc0000',
        border: '1px solid #440000', borderRadius: '4px',
        cursor: 'pointer', fontSize: '12px', letterSpacing: '0.1em',
        fontFamily: 'Share Tech Mono, monospace'
      }}>
        [ BESTELLUNG STORNIEREN ]
      </button>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem', maxWidth: '420px', margin: '0 auto' }}>

      <div style={{ borderBottom: '1px solid #cc0000', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#cc0000', letterSpacing: '0.15em', marginBottom: '4px' }}>BESTELLSYSTEM // ZUGANG GEWÄHRT</div>
        <div style={{ fontSize: '11px', color: '#555' }}>ID: {pseudonym}</div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '12px' }}>VERFÜGBARE WAREN</div>
        {produkte.length === 0 && <div style={{ color: '#555', fontSize: '13px' }}>Keine Produkte verfügbar.</div>}
        {produkte.map(p => (
          <div key={p.id} style={{ ...t.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '500', fontSize: '14px', color: '#e0e0e0', letterSpacing: '0.05em' }}>{p.name}</div>
              {p.beschreibung && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{p.beschreibung}</div>}
              {p.preis > 0 && <div style={{ fontSize: '12px', color: '#cc0000', marginTop: '2px' }}>{p.preis.toFixed(2)} €</div>}
            </div>
            {p.einheit === 'Stück' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) - 1)} style={btnMenge}>−</button>
                <span style={{ minWidth: '55px', textAlign: 'center', fontSize: '13px', color: auswahl[p.id] > 0 ? '#e0e0e0' : '#444' }}>
                  {auswahl[p.id] || 0} Stk
                </span>
                <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) + 1)} style={btnMenge}>+</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) - 1)} style={btnMenge}>−</button>
                <span style={{ minWidth: '55px', textAlign: 'center', fontSize: '13px', color: auswahl[p.id] > 0 ? '#e0e0e0' : '#444' }}>
                  {auswahl[p.id] || 0}x {p.mengen && p.mengen.length > 0 ? p.mengen[0] : '?'}g
                </span>
                <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) + 1)} style={btnMenge}>+</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '12px' }}>ZEITFENSTER WÄHLEN</div>
        {zeitfenster.length === 0 && <div style={{ color: '#555', fontSize: '13px' }}>Keine Zeitfenster verfügbar.</div>}
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
              display: 'block', width: '100%', padding: '12px 14px', marginBottom: '6px',
              border: gewaehlt ? '1px solid #cc0000' : '1px solid #2a2a2a',
              borderRadius: '4px',
              background: gewaehlt ? '#1a0000' : '#111',
              color: gewaehlt ? '#ff3333' : '#888',
              cursor: 'pointer', textAlign: 'left', fontSize: '13px',
              fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.05em'
            }}>
              {z.datum ? new Date(z.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' : ''}
              {z.uhrzeit}
              {gewaehlt && <span style={{ float: 'right', fontSize: '11px' }}>◄ GEWÄHLT</span>}
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>KONTAKT // OPTIONAL</div>
        <input type="tel" placeholder="Telefonnummer" value={telefon}
          onChange={e => setTelefon(e.target.value)}
          style={{ ...t.input }} />
      </div>

      <button onClick={bestellenKlick} disabled={laden} style={{
        width: '100%', padding: '14px',
        background: laden ? '#330000' : '#cc0000',
        color: 'white', border: 'none', borderRadius: '4px',
        fontSize: '13px', cursor: laden ? 'not-allowed' : 'pointer',
        letterSpacing: '0.15em', fontFamily: 'Share Tech Mono, monospace'
      }}>
        {laden ? '[ ÜBERTRAGUNG LÄUFT... ]' : '[ BESTELLUNG ABSENDEN ]'}
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
    <div style={{ padding: '2rem', color: '#333', fontSize: '12px', letterSpacing: '0.1em' }}>
      INITIALISIERUNG...
    </div>
  )
  if (!tokenData) return <div style={{ background: '#0a0a0a', minHeight: '100vh' }}></div>
  if (tokenData.rolle === 'lieferer') return <Lieferer />
  if (tokenData.rolle === 'besteller') return <Besteller token={getTokenAusURL()} />

  return <div style={{ padding: '2rem', color: '#cc0000' }}>ADMIN // IN ENTWICKLUNG</div>
}

export default App
