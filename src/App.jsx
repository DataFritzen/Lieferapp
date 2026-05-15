import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Lieferer from './Lieferer'
import Messenger from './Messenger'
import { verschluesseln } from './crypto'
import { texte } from './i18n'

// PWA Install Event
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    window.deferredPrompt = e
  })
}

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

function getGespeichertesDaten(token) {
  const key = 'profil_' + token
  const gespeichert = localStorage.getItem(key)
  return gespeichert ? JSON.parse(gespeichert) : null
}

function speichereProfil(token, id, telefon) {
  const key = 'profil_' + token
  localStorage.setItem(key, JSON.stringify({ id, telefon }))
  localStorage.setItem('pseudonym_' + token, id)
}

function getSprache() {
  return localStorage.getItem('sprache') || 'de'
}

function setSprache(lang) {
  localStorage.setItem('sprache', lang)
}

// Revolucion Palette
const C = {
  bg: '#0f0f0f',
  card: '#161616',
  card2: '#1e1e1e',
  border: '#2a2520',
  gold: '#c8a96e',
  goldDim: '#1a1508',
  red: '#8b0000',
  redBright: '#cc2200',
  redDim: '#1a0500',
  green: '#4a7c59',
  greenDim: '#0a1a0f',
  text: '#e8e0d0',
  textDim: '#7a7060',
  textMuted: '#3a3530',
}

const inputStyle = {
  width: '100%', padding: '14px 16px',
  background: C.card, border: `1px solid ${C.border}`,
  borderRadius: '10px', color: C.text, fontSize: '15px',
  fontFamily: 'Share Tech Mono, monospace',
  marginBottom: '10px', boxSizing: 'border-box', outline: 'none',
}

function StarIcon({ size = 16, color = '#c8a96e' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  )
}

function SprachWaehler({ sprache, onChange }) {
  const sprachen = [
    { code: 'de', flag: '🇩🇪', label: 'DE' },
    { code: 'en', flag: '🇬🇧', label: 'EN' },
    { code: 'uk', flag: '🇺🇦', label: 'UA' },
  ]
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
      {sprachen.map(s => (
        <button key={s.code} onClick={() => onChange(s.code)} style={{
          padding: '6px 12px', fontSize: '13px',
          background: sprache === s.code ? C.goldDim : 'transparent',
          color: sprache === s.code ? C.gold : C.textDim,
          border: `1px solid ${sprache === s.code ? C.gold : C.border}`,
          borderRadius: '8px', cursor: 'pointer',
          fontFamily: 'Share Tech Mono, monospace',
        }}>
          {s.flag} {s.label}
        </button>
      ))}
    </div>
  )
}

function PosterStatus({ status }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '16px', padding: '24px', marginBottom: '20px',
      textAlign: 'center'
    }}>
      <div style={{ marginBottom: '8px', display: 'inline-block' }}>
        <img src="/Ich_liefere.webp" alt="El Comandante" style={{
          width: '180px', height: '180px',
          objectFit: 'cover', objectPosition: 'top',
          borderRadius: '50%', border: '2px solid #8b0000',
          boxShadow: '0 0 0 6px #8b0000, 0 0 0 8px #3a0a0a',
          background: '#8b0000',
          display: 'block', margin: '0 auto'
        }} />
      </div>
      <div style={{
        background: '#8b0000', borderRadius: '12px', padding: '14px 16px',
        marginTop: '16px', position: 'relative'
      }}>
        <div style={{
          position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderBottom: '8px solid #8b0000'
        }} />
        <div style={{ fontSize: '13px', color: '#e8e0d0', fontStyle: 'italic', marginBottom: '4px' }}>
          "La revolución no espera."
        </div>
        <div style={{ fontSize: '12px', color: '#c8a96e' }}>Der Comandante kümmert sich.</div>
        <div style={{ fontSize: '11px', color: '#9a8a70', marginTop: '2px' }}>Bestätigung folgt in Kürze.</div>
      </div>
    </div>
  )
}

function Anmeldemaske({ token, onAnmelden }) {
  const [sprache, setSpracheState] = useState(getSprache())
  const vorhandenes = getGespeichertesDaten(token)
  const [id, setId] = useState(vorhandenes?.id || getPseudonym(token))
  const [telefon, setTelefon] = useState(vorhandenes?.telefon || '')
  const [fehler, setFehler] = useState('')
  const t = texte[sprache]

  function sprachWechsel(lang) {
    setSprache(lang)
    setSpracheState(lang)
  }

  function anmelden() {
    if (!id.trim()) { setFehler('Bitte eine ID eingeben.'); return }
    if (!telefon.trim()) { setFehler('Telefonnummer ist Pflicht.'); return }
    speichereProfil(token, id.trim(), telefon.trim())
    onAnmelden(id.trim(), telefon.trim(), sprache)
  }

  async function appInstallieren() {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt()
      await window.deferredPrompt.userChoice
      window.deferredPrompt = null
    } else {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
      if (isIOS) {
        alert('iPhone: Tippe auf das Teilen-Symbol (□↑) in Safari und wähle "Zum Home-Bildschirm".')
      } else {
        alert('Android: Tippe auf das Menü (⋮) in Chrome und wähle "Zum Startbildschirm hinzufügen".')
      }
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

      {/* Sprachauswahl */}
      <div style={{ marginBottom: '24px' }}>
        <SprachWaehler sprache={sprache} onChange={sprachWechsel} />
      </div>

      {/* Poster Bild */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <img src="/Ich_liefere.webp" alt="Lieferapp" style={{
          width: '120px', height: '120px', borderRadius: '24px',
          border: `2px solid ${C.red}`, display: 'block', margin: '0 auto 16px',
          objectFit: 'cover'
        }} />
        <div style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.2em', marginBottom: '4px' }}>{t.titel}</div>
        <div style={{ fontSize: '12px', color: C.textDim }}>{t.untertitel}</div>
      </div>

      {/* Formular */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.1em', marginBottom: '8px' }}>{t.deineId}</div>
          <input type="text" value={id} onChange={e => setId(e.target.value)}
            placeholder="z.B. Kühn-Adler-46" style={{ ...inputStyle, marginBottom: '4px' }} />
          <div style={{ fontSize: '11px', color: C.textMuted }}>{t.idHinweis}</div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.1em', marginBottom: '8px' }}>
            {t.telefon} <span style={{ color: C.red }}>*</span>
          </div>
          <input type="tel" value={telefon} onChange={e => setTelefon(e.target.value)}
            placeholder="+49 123 456789" style={{ ...inputStyle, marginBottom: 0 }} />
        </div>

        {fehler && <div style={{ fontSize: '13px', color: C.redBright, marginBottom: '12px' }}>{fehler}</div>}

        <button onClick={anmelden} style={{
          width: '100%', padding: '16px', background: C.red, color: C.text,
          border: 'none', borderRadius: '12px', fontSize: '15px',
          cursor: 'pointer', letterSpacing: '0.1em',
          fontFamily: 'Share Tech Mono, monospace', fontWeight: '600',
        }}>{t.weiter}</button>
      </div>

      {/* App Install */}
      <button onClick={appInstallieren} style={{
        width: '100%', padding: '14px', background: C.goldDim, color: C.gold,
        border: `1px solid ${C.gold}`, borderRadius: '12px', fontSize: '13px',
        cursor: 'pointer', letterSpacing: '0.08em',
        fontFamily: 'Share Tech Mono, monospace',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
      }}>
        📲 {t.appInstall}
      </button>
    </div>
  )
}

function Besteller({ token, pseudonym, telefon: telefonVorgabe, sprache: spracheVorgabe }) {
  const [sprache, setSpracheState] = useState(spracheVorgabe || getSprache())
  const t = texte[sprache]
  const [auswahl, setAuswahl] = useState({})
  const [telefon, setTelefon] = useState(telefonVorgabe || '')
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
      supabase.from('bestellungen').select('id, status, paketstation_id, zeitfenster_id')
        .eq('id', bestellungId).single()
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
        const { data } = await supabase.from('bestellungen')
          .select('id, status, paketstation_id, zeitfenster_id')
          .eq('id', bestellungId).single()

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
          setBestellungId(null); setGesendet(false)
          setAuswahl({}); setGewaehlterSlot(null)
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
    if (Object.keys(ausgewaehlt).length === 0) { alert(t.bitteProjektWaehlen); return }
    if (!gewaehlterSlot) { alert(t.bitteZeitWaehlen); return }
    const { data: aktuelle } = await supabase.from('bestellungen').select('id').eq('zeitfenster_id', gewaehlterSlot.id)
    if (aktuelle.length >= gewaehlterSlot.max_bestellungen) { alert(t.slotVoll); return }
    setLaden(true)
    const verschluesselteDaten = verschluesseln({ produkte: ausgewaehlt, telefon: telefon || null })
    const { data: neu, error } = await supabase.from('bestellungen').insert([{
      pseudonym, produkte_verschluesselt: verschluesselteDaten, status: 'offen', zeitfenster_id: gewaehlterSlot.id
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
    const ok = window.confirm(t.storniernFrage)
    if (!ok) return
    await supabase.from('bestellungen').update({
      status: 'storniert',
      original_status: bestellStatus,
      storniert_am: new Date().toISOString()
    }).eq('id', bestellungId)
    localStorage.removeItem('aktive_bestellung')
    setBestellungId(null); setGesendet(false)
    setAuswahl({}); setGewaehlterSlot(null)
  }

  if (gesendet) return (
    <div style={{ padding: '20px', maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: C.bg }}>
      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StarIcon color={C.red} size={14} />
          <span style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.15em' }}>{t.bestellungEingegangen}</span>
        </div>
        <SprachWaehler sprache={sprache} onChange={s => setSpracheState(s)} />
      </div>
      <div style={{ fontSize: '12px', color: C.textDim, marginBottom: '20px' }}>ID: {pseudonym}</div>

      {bestellStatus !== 'bestätigt' && <PosterStatus status={bestellStatus} />}

      {bestellStatus === 'bestätigt' && (
        <div style={{
          background: C.goldDim, border: `1px solid ${C.gold}`,
          borderRadius: '14px', padding: '20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <StarIcon color={C.red} size={14} />
            <span style={{ fontSize: '12px', color: C.gold, letterSpacing: '0.1em' }}>{t.bestaetigt}</span>
          </div>
          {bestaetigterSlot && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '4px' }}>{t.zeitfenster}</div>
              <div style={{ fontSize: '16px', color: C.text, fontWeight: '600' }}>
                {bestaetigterSlot.datum ? new Date(bestaetigterSlot.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '  ·  ' : ''}
                {bestaetigterSlot.uhrzeit}
              </div>
            </div>
          )}
          {paketstation && (
            <div>
              <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '4px' }}>{t.abholpunkt}</div>
              <div style={{ fontSize: '15px', color: C.text, fontWeight: '600' }}>📦 {paketstation.name}</div>
              <div style={{ fontSize: '13px', color: C.gold }}>{paketstation.adresse}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.08em', marginBottom: '10px' }}>{t.kommunikation}</div>
        <Messenger bestellungId={bestellungId} pseudonym={pseudonym} />
      </div>

      <button onClick={stornieren} style={{
        width: '100%', padding: '14px', background: C.redDim, color: C.redBright,
        border: `1px solid ${C.red}`, borderRadius: '10px', cursor: 'pointer',
        fontSize: '13px', fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.05em'
      }}>{t.stornieren}</button>
    </div>
  )

  return (
    <div style={{ padding: '20px', maxWidth: '440px', margin: '0 auto', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StarIcon color={C.red} size={14} />
            <span style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.15em' }}>{t.titel}</span>
          </div>
          <SprachWaehler sprache={sprache} onChange={s => setSpracheState(s)} />
        </div>
        <div style={{ fontSize: '12px', color: C.textDim }}>ID: {pseudonym}</div>
      </div>

      {/* Produkte */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.1em', marginBottom: '12px' }}>{t.warenAuswaehlen}</div>
        {produkte.length === 0 && <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px', textAlign: 'center' }}>{t.keinProdukte}</div>}

        {produkte.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 130px', gap: '8px', padding: '4px 16px', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em' }}>{t.ware}</span>
            <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em', textAlign: 'right' }}>{t.preis}</span>
            <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em', textAlign: 'center' }}>{t.menge}</span>
          </div>
        )}

        {produkte.map(p => (
          <div key={p.id} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
            padding: '14px 16px', marginBottom: '6px',
            display: 'grid', gridTemplateColumns: '1fr 80px 130px', gap: '8px', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '15px', color: C.text, fontWeight: '600' }}>{p.name}</div>
              {p.beschreibung && <div style={{ fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{p.beschreibung}</div>}
            </div>
            <div style={{ fontSize: '13px', color: C.gold, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {p.preis > 0 ? `${p.preis.toFixed(2)} €` : '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
              <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) - 1)} style={{
                width: '32px', height: '32px', background: C.card2, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>−</button>
              <span style={{ minWidth: '48px', textAlign: 'center', fontSize: '12px', color: auswahl[p.id] > 0 ? C.text : C.textMuted, fontWeight: '600' }}>
                {p.mengen && p.mengen.length > 0
                  ? `${auswahl[p.id] || 0}× ${p.mengen[0]}${p.einheit === 'Gramm' ? 'g' : ' Stk'}`
                  : `${auswahl[p.id] || 0} ${p.einheit === 'Gramm' ? 'g' : 'Stk'}`
                }
              </span>
              <button onClick={() => mengeAendern(p.id, (auswahl[p.id] || 0) + 1)} style={{
                width: '32px', height: '32px', background: C.card2, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Zeitfenster */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.1em', marginBottom: '12px' }}>{t.zeitfensterWaehlen}</div>
        {zeitfenster.length === 0 && <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px', textAlign: 'center' }}>{t.keineZeitfenster}</div>}
        {zeitfenster.filter(z => {
          const jetzt = new Date()
          if (z.datum && z.uhrzeit) {
            const bis = z.uhrzeit.split('-')[1]?.trim()
            if (bis) {
              const [h, m] = bis.split(':').map(Number)
              const ende = new Date(z.datum)
              ende.setHours(h, m, 0)
              if (ende < jetzt) return false
            }
          }
          return belegung(z.id) < z.max_bestellungen
        }).map(z => {
          const gewaehlt = gewaehlterSlot?.id === z.id
          return (
            <button key={z.id} onClick={() => setGewaehlterSlot(z)} style={{
              display: 'block', width: '100%', padding: '14px 16px', marginBottom: '6px',
              border: `1px solid ${gewaehlt ? C.gold : C.border}`,
              borderRadius: '10px', background: gewaehlt ? C.goldDim : C.card,
              color: gewaehlt ? C.gold : C.text,
              cursor: 'pointer', textAlign: 'left', fontSize: '14px',
              fontFamily: 'Share Tech Mono, monospace', fontWeight: gewaehlt ? '600' : '400',
            }}>
              {z.datum ? new Date(z.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + '  ·  ' : ''}
              {z.uhrzeit}
              {gewaehlt && <span style={{ float: 'right' }}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Telefon */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', color: C.textDim, letterSpacing: '0.1em', marginBottom: '10px' }}>{t.telefonOptional}</div>
        <input type="tel" placeholder="+49 123 456789" value={telefon}
          onChange={e => setTelefon(e.target.value)} style={inputStyle} />
      </div>

      <button onClick={bestellenKlick} disabled={laden} style={{
        width: '100%', padding: '16px', background: laden ? C.redDim : C.red,
        color: C.text, border: 'none', borderRadius: '12px',
        fontSize: '15px', cursor: laden ? 'not-allowed' : 'pointer',
        letterSpacing: '0.1em', fontFamily: 'Share Tech Mono, monospace', fontWeight: '600',
        opacity: laden ? 0.6 : 1,
      }}>
        {laden ? t.uebertragung : t.bestellungAbsenden}
      </button>
    </div>
  )
}

function App() {
  const [tokenData, setTokenData] = useState(null)
  const [tokenGeprueft, setTokenGeprueft] = useState(false)
  const [profil, setProfil] = useState(null)

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

  if (!tokenGeprueft) return <div style={{ background: C.bg, minHeight: '100vh' }} />
  if (!tokenData) return <div style={{ background: C.bg, minHeight: '100vh' }} />
  if (tokenData.rolle === 'lieferer') return <Lieferer />
  if (tokenData.rolle === 'besteller') {
    const token = getTokenAusURL()
    const gespeichert = getGespeichertesDaten(token)
    if (!profil && (!gespeichert || !gespeichert.telefon)) {
      return <Anmeldemaske token={token} onAnmelden={(id, tel, lang) => setProfil({ id, telefon: tel, sprache: lang })} />
    }
    const aktivProfil = profil || gespeichert
    return <Besteller token={token} pseudonym={aktivProfil.id} telefon={aktivProfil.telefon} sprache={aktivProfil.sprache} />
  }
  return <div style={{ padding: '2rem', color: C.gold, background: C.bg, minHeight: '100vh' }}>Admin — in Entwicklung</div>
}

export default App
