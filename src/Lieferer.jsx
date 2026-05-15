import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Messenger from './Messenger'
import { entschluesseln } from './crypto'

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
  blue: '#3a6080',
  blueDim: '#0a1520',
  text: '#e8e0d0',
  textDim: '#7a7060',
  textMuted: '#3a3530',
}

const inputStyle = {
  width: '100%', padding: '12px 14px', background: C.card,
  border: `1px solid ${C.border}`, borderRadius: '10px',
  color: C.text, fontSize: '14px', fontFamily: 'Share Tech Mono, monospace',
  marginBottom: '8px', boxSizing: 'border-box', outline: 'none',
}

const selectStyle = {
  padding: '12px 14px', background: C.card, border: `1px solid ${C.border}`,
  borderRadius: '10px', color: C.text, fontSize: '14px',
  fontFamily: 'Share Tech Mono, monospace', outline: 'none',
}

function BestellungCard({ b, zeitfenster, paketstationen, produkte, onStatus, onLoeschen, onPaketstation, onStornieren }) {
  const [messengerOffen, setMessengerOffen] = useState(false)
  const [hatNachrichten, setHatNachrichten] = useState(false)

  const slot = zeitfenster.find(z => z.id === b.zeitfenster_id)
  const station = paketstationen.find(p => p.id === b.paketstation_id)
  const daten = b.produkte_verschluesselt ? entschluesseln(b.produkte_verschluesselt) : null
  const bestellProdukte = daten?.produkte || {}
  const tel = daten?.telefon
  const istStorniert = b.status === 'storniert'

  useEffect(() => {
    supabase.from('nachrichten').select('id', { count: 'exact' }).eq('bestellung_id', b.id).then(({ count }) => {
      if (count > 0) setHatNachrichten(true)
    })
  }, [b.id])

  // Original-Status Farbe (ohne Storniert)
  const originalStatus = b.status === 'storniert' ? (b.original_status || 'offen') : b.status
  const statusColor = originalStatus === 'bestätigt' ? C.green : originalStatus === 'ausgestellt' ? C.blue : C.gold
  const statusBg = originalStatus === 'bestätigt' ? C.greenDim : originalStatus === 'ausgestellt' ? C.blueDim : C.goldDim
  const statusText = originalStatus === 'offen' ? 'OFFEN' : originalStatus === 'bestätigt' ? 'BESTÄTIGT' : 'AUSGESTELLT'

  return (
    <div style={{
      background: C.card, borderRadius: '14px',
      border: `1px solid ${istStorniert ? C.red : C.border}`,
      borderLeft: `4px solid ${istStorniert ? C.redBright : statusColor}`,
      padding: '16px', marginBottom: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: C.text, fontWeight: '600' }}>{b.pseudonym}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {istStorniert && (
            <span style={{
              fontSize: '10px', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.1em',
              background: C.redDim, color: C.redBright, border: `1px solid ${C.red}`
            }}>STORNIERT</span>
          )}
          <span style={{
            fontSize: '10px', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.1em',
            background: statusBg, color: statusColor, border: `1px solid ${statusColor}`
          }}>{statusText}</span>
        </div>
      </div>

      {/* Waren */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.1em', marginBottom: '6px' }}>WAREN</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.entries(bestellProdukte).map(([id, menge]) => {
            const prod = produkte.find(p => p.id === id)
            return (
              <span key={id} style={{
                fontSize: '13px', padding: '5px 12px',
                background: C.card2, border: `1px solid ${C.border}`,
                borderRadius: '8px', color: C.text
              }}>
                {prod ? prod.name : id} · {menge}{prod ? (prod.einheit === 'Gramm' ? 'g' : ' Stk') : '×'}
              </span>
            )
          })}
        </div>
      </div>

      {/* Slot */}
      {slot && (
        <div style={{ fontSize: '13px', color: C.textDim, marginBottom: '8px' }}>
          🕐 {slot.datum ? new Date(slot.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' : ''}{slot.uhrzeit}
        </div>
      )}

      {/* Telefon */}
      {tel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', color: C.textDim }}>📞 {tel}</span>
          <button onClick={() => { navigator.clipboard.writeText(tel); alert('Kopiert!') }} style={{
            fontSize: '10px', padding: '2px 8px', background: C.card2, color: C.textDim,
            border: `1px solid ${C.border}`, borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'Share Tech Mono, monospace'
          }}>COPY</button>
        </div>
      )}

      {/* Paketbox — nur wenn nicht storniert */}
      {!istStorniert && (
        <div style={{ marginBottom: '12px' }}>
          <select value={b.paketstation_id || ''} onChange={e => onPaketstation(b.id, e.target.value)}
            style={{ ...selectStyle, width: '100%', fontSize: '13px', padding: '10px 12px' }}>
            <option value="">📦 Paketbox zuweisen...</option>
            {paketstationen.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.adresse}</option>
            ))}
          </select>
          {station && <div style={{ fontSize: '12px', color: C.green, marginTop: '4px' }}>✓ {station.name} — {station.adresse}</div>}
        </div>
      )}

      {/* Messenger Toggle */}
      <button onClick={() => setMessengerOffen(!messengerOffen)} style={{
        width: '100%', padding: '10px', background: C.card2,
        color: hatNachrichten && !messengerOffen ? C.gold : C.textDim,
        border: `1px solid ${hatNachrichten && !messengerOffen ? C.gold : C.border}`,
        borderRadius: '10px', cursor: 'pointer', fontSize: '13px',
        fontFamily: 'Share Tech Mono, monospace', marginBottom: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
      }}>
        {hatNachrichten && !messengerOffen ? '💬 Neue Nachricht — öffnen' : messengerOffen ? '▲ Nachrichten schließen' : '▼ Nachrichten'}
      </button>

      {messengerOffen && (
        <div style={{ marginBottom: '12px' }}>
          <Messenger bestellungId={b.id} pseudonym="Lieferer" mitMikrofon={true} />
        </div>
      )}

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!istStorniert && b.status === 'offen' && (
          <>
            <button onClick={() => onStatus(b.id, 'bestätigt')} style={{
              flex: 1, padding: '12px', background: C.greenDim, color: C.green,
              border: `1px solid ${C.green}`, borderRadius: '10px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '600'
            }}>✓ Bestätigen</button>
            <button onClick={() => onStornieren(b.id)} style={{
              padding: '12px 14px', background: C.redDim, color: C.redBright,
              border: `1px solid ${C.red}`, borderRadius: '10px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Share Tech Mono, monospace'
            }}>Stornieren</button>
          </>
        )}
        {!istStorniert && b.status === 'bestätigt' && (
          <>
            <button onClick={() => onStatus(b.id, 'ausgestellt')} style={{
              flex: 1, padding: '12px', background: C.blueDim, color: C.blue,
              border: `1px solid ${C.blue}`, borderRadius: '10px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '600'
            }}>📦 Ausgestellt</button>
            <button onClick={() => onStornieren(b.id)} style={{
              padding: '12px 14px', background: C.redDim, color: C.redBright,
              border: `1px solid ${C.red}`, borderRadius: '10px', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Share Tech Mono, monospace'
            }}>Stornieren</button>
          </>
        )}
        {!istStorniert && b.status === 'ausgestellt' && (
          <button onClick={() => onLoeschen(b.id)} style={{
            flex: 1, padding: '12px', background: C.redDim, color: C.redBright,
            border: `1px solid ${C.red}`, borderRadius: '10px', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'Share Tech Mono, monospace'
          }}>🗑 Löschen</button>
        )}
        {istStorniert && (
          <button onClick={() => onLoeschen(b.id)} style={{
            flex: 1, padding: '12px', background: C.redDim, color: C.redBright,
            border: `1px solid ${C.red}`, borderRadius: '10px', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'Share Tech Mono, monospace'
          }}>🗑 Endgültig löschen</button>
        )}
      </div>
    </div>
  )
}

function Lieferer() {
  const [bestellungen, setBestellungen] = useState([])
  const [zeitfenster, setZeitfenster] = useState([])
  const [paketstationen, setPaketstationen] = useState([])
  const [tokens, setTokens] = useState([])
  const [produkte, setProdukte] = useState([])
  const [laden, setLaden] = useState(true)
  const [ansicht, setAnsicht] = useState('bestellungen')
  const [bestellFilter, setBestellFilter] = useState('offen')
  const [tokenFilter, setTokenFilter] = useState('alle')
  const [vonUhrzeit, setVonUhrzeit] = useState('')
  const [bisUhrzeit, setBisUhrzeit] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [maxBestellungen, setMaxBestellungen] = useState(5)
  const [neuerName, setNeuerName] = useState('')
  const [neueAdresse, setNeueAdresse] = useState('')
  const [neuerToken, setNeuerToken] = useState(null)
  const [produktName, setProduktName] = useState('')
  const [produktBeschreibung, setProduktBeschreibung] = useState('')
  const [produktEinheit, setProduktEinheit] = useState('Stück')
  const [produktPreis, setProduktPreis] = useState('')
  const [produktMengen, setProduktMengen] = useState('')

  const uhrzeiten = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00'
  ]

  async function ladeProdukte() {
    const { data } = await supabase.from('produkte').select('*').eq('aktiv', true).order('name')
    setProdukte(data || [])
  }

  async function ladeTokens() {
    const { data } = await supabase.from('tokens').select('*').eq('rolle', 'besteller').order('erstellt_am', { ascending: false })
    setTokens(data || [])
  }

  async function ladeAlles() {
    const [{ data: b }, { data: z }, { data: p }] = await Promise.all([
      supabase.from('bestellungen').select('*, zeitfenster(datum, uhrzeit)').order('erstellt_am', { ascending: true }),
      supabase.from('zeitfenster').select('*').order('datum').order('uhrzeit'),
      supabase.from('paketstationen').select('*').order('name')
    ])
    const sortiert = (b || []).sort((a, bb) => {
      const dA = (a.zeitfenster?.datum || '') + ' ' + (a.zeitfenster?.uhrzeit || '')
      const dB = (bb.zeitfenster?.datum || '') + ' ' + (bb.zeitfenster?.uhrzeit || '')
      return dA.localeCompare(dB)
    })
    setBestellungen(sortiert)
    setZeitfenster(z || [])
    setPaketstationen(p || [])
    await ladeTokens()
    await ladeProdukte()
    setLaden(false)
  }

  async function produktHinzufuegen() {
    if (!produktName) { alert('Bitte Name eingeben.'); return }
    const mengenArray = produktMengen ? produktMengen.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m)) : []
    const { error } = await supabase.from('produkte').insert([{
      name: produktName, beschreibung: produktBeschreibung || null,
      einheit: produktEinheit, preis: parseFloat(produktPreis) || 0,
      mengen: mengenArray, aktiv: true
    }])
    if (error) alert('Fehler: ' + error.message)
    else { setProduktName(''); setProduktBeschreibung(''); setProduktPreis(''); setProduktMengen(''); ladeProdukte() }
  }

  async function produktLoeschen(id) {
    await supabase.from('produkte').update({ aktiv: false }).eq('id', id)
    ladeProdukte()
  }

  async function zeitfensterHinzufuegen() {
    if (!vonUhrzeit || !bisUhrzeit) { alert('Bitte Von und Bis auswählen.'); return }
    if (vonUhrzeit >= bisUhrzeit) { alert('Von muss vor Bis liegen.'); return }
    const { error } = await supabase.from('zeitfenster').insert([{
      uhrzeit: `${vonUhrzeit}-${bisUhrzeit}`, datum, max_bestellungen: maxBestellungen, aktiv: true
    }])
    if (error) alert('Fehler: ' + error.message)
    else { setVonUhrzeit(''); setBisUhrzeit(''); ladeAlles() }
  }

  async function letztenTagKopieren() {
    const sortiert = [...zeitfenster].sort((a, b) => b.datum?.localeCompare(a.datum))
    if (sortiert.length === 0) { alert('Keine Slots vorhanden.'); return }
    const letzterTag = sortiert[0].datum
    const slots = zeitfenster.filter(z => z.datum === letzterTag)
    for (const slot of slots) {
      await supabase.from('zeitfenster').insert([{
        uhrzeit: slot.uhrzeit, datum, max_bestellungen: slot.max_bestellungen, aktiv: true
      }])
    }
    ladeAlles()
  }

  async function zeitfensterLoeschen(id) {
    await supabase.from('zeitfenster').delete().eq('id', id)
    ladeAlles()
  }

  async function pakietstationHinzufuegen() {
    if (!neuerName || !neueAdresse) { alert('Bitte Name und Adresse eingeben.'); return }
    const { error } = await supabase.from('paketstationen').insert([{ name: neuerName, adresse: neueAdresse, aktiv: true }])
    if (error) alert('Fehler: ' + error.message)
    else { setNeuerName(''); setNeueAdresse(''); ladeAlles() }
  }

  async function pakietstationLoeschen(id) {
    await supabase.from('paketstationen').delete().eq('id', id)
    ladeAlles()
  }

  async function statusSetzen(id, neuerStatus) {
    await supabase.from('bestellungen').update({ status: neuerStatus }).eq('id', id)
    ladeAlles()
  }

  async function bestellungStornieren(id) {
    const b = bestellungen.find(b => b.id === id)
    const ok = window.confirm('Bestellung stornieren?')
    if (!ok) return
    await supabase.from('bestellungen').update({
      status: 'storniert',
      original_status: b?.status || 'offen',
      storniert_am: new Date().toISOString()
    }).eq('id', id)
    ladeAlles()
  }

  async function bestellungLoeschen(id) {
    await supabase.from('nachrichten').delete().eq('bestellung_id', id)
    await supabase.from('bestellungen').delete().eq('id', id)
    ladeAlles()
  }

  async function pakietstationZuweisen(bestellungId, pakietstationId) {
    await supabase.from('bestellungen').update({ paketstation_id: pakietstationId || null }).eq('id', bestellungId)
    ladeAlles()
  }

  async function tokenErstellen() {
    const { data, error } = await supabase.from('tokens').insert([{ rolle: 'besteller' }]).select()
    if (error) { alert('Fehler: ' + error.message); return }
    setNeuerToken(data[0])
    ladeTokens()
  }

  async function tokenSperren(id) {
    const ok = window.confirm('Token sperren?')
    if (!ok) return
    await supabase.from('tokens').update({ aktiv: false }).eq('id', id)
    ladeTokens()
  }

  function qrUrl(token) { return `${window.location.origin}?t=${token}` }
  function belegungZaehlen(zId) { return bestellungen.filter(b => b.zeitfenster_id === zId).length }

  function gruppiereNachDatum() {
    const gruppen = {}
    zeitfenster.forEach(z => {
      const d = z.datum || 'Kein Datum'
      if (!gruppen[d]) gruppen[d] = []
      gruppen[d].push(z)
    })
    return gruppen
  }

  function datumFormatieren(d) {
    return new Date(d).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function tokenIstInaktiv(t) {
    if (t.aktiv) return false
    if (!t.zuletzt_genutzt) return true
    const zweiMonate = new Date()
    zweiMonate.setMonth(zweiMonate.getMonth() - 2)
    return new Date(t.zuletzt_genutzt) < zweiMonate
  }

  useEffect(() => {
    ladeAlles()
    const kanal = supabase.channel('bestellungen-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bestellungen' }, () => ladeAlles())
      .subscribe()
    return () => supabase.removeChannel(kanal)
  }, [])

  if (laden) return <div style={{ padding: '2rem', color: C.textMuted, background: C.bg, minHeight: '100vh' }}>Laden...</div>

  const datumsGruppen = gruppiereNachDatum()
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)

  const gefilterteBestellungen = bestellungen.filter(b => {
    if (bestellFilter === 'alle') return true
    const anzeigeStatus = b.status === 'storniert' ? (b.original_status || 'offen') : b.status
    return anzeigeStatus === bestellFilter
  })

  const gefilterteTokens = tokens.filter(t => tokenFilter === 'inaktiv' ? tokenIstInaktiv(t) : true)

  const tabs = [
    { key: 'bestellungen', label: `Aufträge (${bestellungen.filter(b => !['ausgestellt'].includes(b.status)).length})` },
    { key: 'produkte', label: `Waren (${produkte.length})` },
    { key: 'zeitfenster', label: `Slots (${zeitfenster.length})` },
    { key: 'paketstationen', label: `Boxen (${paketstationen.length})` },
    { key: 'zugaenge', label: 'Zugänge' },
  ]

  const btnFilter = (aktiv) => ({
    padding: '8px 14px', fontSize: '12px',
    background: aktiv ? C.gold : C.card,
    color: aktiv ? '#0f0f0f' : C.textDim,
    border: `1px solid ${aktiv ? C.gold : C.border}`,
    borderRadius: '8px', cursor: 'pointer',
    fontFamily: 'Share Tech Mono, monospace', fontWeight: aktiv ? '600' : '400'
  })

  return (
    <div style={{ padding: '16px', maxWidth: '680px', margin: '0 auto', minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={C.gold}>
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
          <span style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.15em' }}>SISTEMA DE ENTREGA</span>
        </div>
        <div style={{ fontSize: '12px', color: C.textDim }}>Operator-Zugang</div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setAnsicht(tab.key)} style={{
            padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap',
            background: ansicht === tab.key ? C.gold : C.card,
            color: ansicht === tab.key ? '#0f0f0f' : C.textDim,
            border: `1px solid ${ansicht === tab.key ? C.gold : C.border}`,
            borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'Share Tech Mono, monospace', fontWeight: ansicht === tab.key ? '700' : '400'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* BESTELLUNGEN */}
      {ansicht === 'bestellungen' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { key: 'offen', label: `Offen (${bestellungen.filter(b => (b.status === 'offen') || (b.status === 'storniert' && (b.original_status || 'offen') === 'offen')).length})` },
              { key: 'bestätigt', label: `Bestätigt (${bestellungen.filter(b => (b.status === 'bestätigt') || (b.status === 'storniert' && b.original_status === 'bestätigt')).length})` },
              { key: 'alle', label: `Alle (${bestellungen.length})` },
            ].map(f => (
              <button key={f.key} onClick={() => setBestellFilter(f.key)} style={btnFilter(bestellFilter === f.key)}>{f.label}</button>
            ))}
          </div>
          {gefilterteBestellungen.length === 0 && (
            <div style={{ color: C.textMuted, fontSize: '14px', textAlign: 'center', padding: '40px' }}>Keine Aufträge</div>
          )}
          {gefilterteBestellungen.map(b => (
            <BestellungCard key={b.id} b={b}
              zeitfenster={zeitfenster} paketstationen={paketstationen} produkte={produkte}
              onStatus={statusSetzen} onLoeschen={bestellungLoeschen}
              onPaketstation={pakietstationZuweisen} onStornieren={bestellungStornieren}
            />
          ))}
        </div>
      )}

      {/* PRODUKTE */}
      {ansicht === 'produkte' && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '12px', letterSpacing: '0.1em' }}>NEUE WARE ANLEGEN</div>
            <input type="text" placeholder="Bezeichnung" value={produktName} onChange={e => setProduktName(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Beschreibung (optional)" value={produktBeschreibung} onChange={e => setProduktBeschreibung(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select value={produktEinheit} onChange={e => setProduktEinheit(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="Stück">Stück</option>
                <option value="Gramm">Gramm</option>
              </select>
              <input type="number" placeholder="Preis €" value={produktPreis} onChange={e => setProduktPreis(e.target.value)}
                style={{ ...selectStyle, flex: 1, width: 'auto' }} />
            </div>
            <input type="text"
              placeholder={produktEinheit === 'Gramm' ? 'Einheitsgröße g (z.B. 10)' : 'Einheitsgröße Stk (z.B. 5)'}
              value={produktMengen} onChange={e => setProduktMengen(e.target.value)} style={inputStyle} />
            <button onClick={produktHinzufuegen} style={{
              width: '100%', padding: '12px', background: C.gold, color: '#0f0f0f',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '700'
            }}>+ Hinzufügen</button>
          </div>

          {produkte.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Keine Waren</div>}

          {produkte.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 70px', gap: '8px', padding: '4px 16px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em' }}>WARE</span>
              <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em' }}>EINHEIT</span>
              <span style={{ fontSize: '10px', color: C.textMuted, letterSpacing: '0.08em' }}>PREIS</span>
              <span></span>
            </div>
          )}

          {produkte.map(p => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '1fr 120px 80px 70px', gap: '8px', alignItems: 'center',
              background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '14px 16px', marginBottom: '6px'
            }}>
              <div>
                <span style={{ color: C.text, fontSize: '14px', fontWeight: '600' }}>{p.name}</span>
                {p.beschreibung && <div style={{ fontSize: '11px', color: C.textDim, marginTop: '2px' }}>{p.beschreibung}</div>}
              </div>
              <span style={{ fontSize: '12px', color: C.textDim }}>
                {p.einheit}{p.mengen && p.mengen.length > 0 ? ` · ${p.mengen[0]}${p.einheit === 'Gramm' ? 'g' : ' Stk'}` : ''}
              </span>
              <span style={{ fontSize: '13px', color: C.gold }}>{p.preis > 0 ? `${p.preis.toFixed(2)} €` : '—'}</span>
              <button onClick={() => produktLoeschen(p.id)} style={{
                padding: '6px 10px', background: C.redDim, color: C.redBright,
                border: `1px solid ${C.red}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '11px', fontFamily: 'Share Tech Mono, monospace'
              }}>Löschen</button>
            </div>
          ))}
        </div>
      )}

      {/* ZEITFENSTER */}
      {ansicht === 'zeitfenster' && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '12px', letterSpacing: '0.1em' }}>NEUER SLOT</div>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <select value={vonUhrzeit} onChange={e => setVonUhrzeit(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Von</option>
                {uhrzeiten.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <span style={{ color: C.textDim, alignSelf: 'center' }}>—</span>
              <select value={bisUhrzeit} onChange={e => setBisUhrzeit(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="">Bis</option>
                {uhrzeiten.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '6px', letterSpacing: '0.08em' }}>MAX. BESTELLUNGEN</div>
              <select value={maxBestellungen} onChange={e => setMaxBestellungen(parseInt(e.target.value))}
                style={{ ...selectStyle, width: '100%' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={zeitfensterHinzufuegen} style={{
                flex: 1, padding: '12px', background: C.gold, color: '#0f0f0f',
                border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '700'
              }}>+ Slot anlegen</button>
              <button onClick={letztenTagKopieren} style={{
                flex: 1, padding: '12px', background: C.card2, color: C.textDim,
                border: `1px solid ${C.border}`, borderRadius: '10px', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'Share Tech Mono, monospace'
              }}>📋 Letzten Tag kopieren</button>
            </div>
          </div>

          {Object.keys(datumsGruppen).length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Keine Slots</div>}
          {Object.entries(datumsGruppen)
            .filter(([d]) => new Date(d) >= heute)
            .map(([d, slots]) => (
              <div key={d} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: C.gold, letterSpacing: '0.1em', marginBottom: '8px' }}>
                  📅 {datumFormatieren(d)}
                </div>
                {slots.map(z => {
                  const belegung = belegungZaehlen(z.id)
                  return (
                    <div key={z.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px',
                      padding: '12px 14px', marginBottom: '6px'
                    }}>
                      <div>
                        <span style={{ color: C.text, fontSize: '14px', fontWeight: '600' }}>{z.uhrzeit}</span>
                        <span style={{ marginLeft: '12px', fontSize: '12px', color: belegung >= z.max_bestellungen ? C.redBright : C.green }}>
                          {belegung}/{z.max_bestellungen}
                        </span>
                      </div>
                      <button onClick={() => zeitfensterLoeschen(z.id)} style={{
                        padding: '6px 12px', background: C.redDim, color: C.redBright,
                        border: `1px solid ${C.red}`, borderRadius: '8px', cursor: 'pointer',
                        fontSize: '12px', fontFamily: 'Share Tech Mono, monospace'
                      }}>Löschen</button>
                    </div>
                  )
                })}
              </div>
            ))}
        </div>
      )}

      {/* PAKETSTATIONEN */}
      {ansicht === 'paketstationen' && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: C.textDim, marginBottom: '12px', letterSpacing: '0.1em' }}>NEUE PAKETBOX</div>
            <input type="text" placeholder="Name (z.B. Box A)" value={neuerName} onChange={e => setNeuerName(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Adresse" value={neueAdresse} onChange={e => setNeueAdresse(e.target.value)} style={inputStyle} />
            <button onClick={pakietstationHinzufuegen} style={{
              width: '100%', padding: '12px', background: C.gold, color: '#0f0f0f',
              border: 'none', borderRadius: '10px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '700'
            }}>+ Hinzufügen</button>
          </div>

          {paketstationen.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Keine Boxen</div>}
          {paketstationen.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '14px 16px', marginBottom: '8px'
            }}>
              <div>
                <span style={{ color: C.text, fontSize: '14px', fontWeight: '600' }}>{p.name}</span>
                <span style={{ marginLeft: '8px', fontSize: '13px', color: C.textDim }}>{p.adresse}</span>
              </div>
              <button onClick={() => pakietstationLoeschen(p.id)} style={{
                padding: '6px 12px', background: C.redDim, color: C.redBright,
                border: `1px solid ${C.red}`, borderRadius: '8px', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Share Tech Mono, monospace'
              }}>Löschen</button>
            </div>
          ))}
        </div>
      )}

      {/* ZUGÄNGE */}
      {ansicht === 'zugaenge' && (
        <div>
          <button onClick={tokenErstellen} style={{
            width: '100%', padding: '14px', background: C.gold, color: '#0f0f0f',
            border: 'none', borderRadius: '12px', cursor: 'pointer', marginBottom: '16px',
            fontSize: '14px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '700'
          }}>+ Neuen Zugang erstellen</button>
          <button onClick={() => {
            const zeilen = [['ID', 'Telefon', 'Zuletzt genutzt', 'Status']]
            tokens.forEach(tok => {
              const tel = tok.telefon ? (() => { try { const d = entschluesseln(tok.telefon); return d?.tel || tok.telefon } catch { return tok.telefon } })() : '—'
              zeilen.push([
                tok.pseudonym || '—',
                tel,
                tok.zuletzt_genutzt ? new Date(tok.zuletzt_genutzt).toLocaleString('de-DE') : 'Nie',
                tok.aktiv ? 'Aktiv' : 'Gesperrt'
              ])
            })
            const csv = zeilen.map(z => z.join(',')).join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'zugaenge.csv'
            a.click()
          }} style={{
            width: '100%', padding: '12px', background: C.card2, color: C.textDim,
            border: `1px solid ${C.border}`, borderRadius: '12px', cursor: 'pointer', marginBottom: '16px',
            fontSize: '13px', fontFamily: 'Share Tech Mono, monospace'
          }}>⬇ Zugänge exportieren (CSV)</button>

          {neuerToken && (
            <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: C.green, marginBottom: '8px' }}>✓ Neuer Zugang — Link persönlich weitergeben</div>
              <div style={{ background: C.card, borderRadius: '8px', padding: '10px', fontSize: '12px', wordBreak: 'break-all', marginBottom: '10px', color: C.textDim }}>
                {qrUrl(neuerToken.token)}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { navigator.clipboard.writeText(qrUrl(neuerToken.token)); alert('Kopiert!') }} style={{
                  flex: 1, padding: '10px', background: C.gold, color: '#0f0f0f', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Share Tech Mono, monospace', fontWeight: '700'
                }}>Kopieren</button>
                <button onClick={() => setNeuerToken(null)} style={{
                  padding: '10px 16px', background: C.card2, color: C.textDim,
                  border: `1px solid ${C.border}`, borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontFamily: 'Share Tech Mono, monospace'
                }}>Schließen</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[
              { key: 'alle', label: `Alle (${tokens.length})` },
              { key: 'inaktiv', label: `⚠ Lang inaktiv (${tokens.filter(tok => tokenIstInaktiv(tok)).length})` },
            ].map(f => (
              <button key={f.key} onClick={() => setTokenFilter(f.key)} style={btnFilter(tokenFilter === f.key)}>{f.label}</button>
            ))}
          </div>

          {gefilterteTokens.length === 0 && <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Keine Zugänge</div>}
          {gefilterteTokens.map(tok => {
            const inaktiv = tokenIstInaktiv(tok)
            return (
              <div key={tok.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: '12px', alignItems: 'center',
                background: C.card, border: `1px solid ${inaktiv ? '#7a6020' : C.border}`,
                borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
                opacity: tok.aktiv ? 1 : 0.5
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    {inaktiv && <span>⚠️</span>}
                    <span style={{ fontSize: '14px', color: C.text, fontWeight: '600' }}>{tok.pseudonym || '—'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: C.textDim }}>
                    {tok.zuletzt_genutzt ? 'Zuletzt: ' + new Date(tok.zuletzt_genutzt).toLocaleString('de-DE') : 'Noch nie genutzt'}
                  </div>
                  {!tok.aktiv && <div style={{ fontSize: '11px', color: C.redBright, marginTop: '2px' }}>GESPERRT</div>}
                </div>
                <div style={{ fontSize: '13px', color: C.textDim }}>
                  {tok.telefon ? `📞 ${(() => { try { const d = entschluesseln(tok.telefon); return d?.tel || tok.telefon } catch { return tok.telefon } })()}` : '—'}
                </div>
                <button onClick={() => tokenSperren(tok.id)} disabled={!tok.aktiv} style={{
                  padding: '8px 14px', background: tok.aktiv ? C.redDim : C.card2,
                  color: tok.aktiv ? C.redBright : C.textMuted,
                  border: `1px solid ${tok.aktiv ? C.red : C.border}`,
                  borderRadius: '8px', cursor: tok.aktiv ? 'pointer' : 'default',
                  fontSize: '12px', fontFamily: 'Share Tech Mono, monospace'
                }}>Sperren</button>
              </div>
                background: C.card, border: `1px solid ${inaktiv ? '#7a6020' : C.border}`,
          borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
          opacity: tok.aktiv ? 1 : 0.5
              }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
              {inaktiv && <span>⚠️</span>}
              <span style={{ fontSize: '14px', color: C.text, fontWeight: '600' }}>{tok.pseudonym || '—'}</span>
            </div>
            {tok.telefon && <div style={{ fontSize: '13px', color: C.text, marginBottom: '2px' }}>📞 {tok.telefon}</div>}
            <div style={{ fontSize: '12px', color: C.textDim }}>
              {tok.zuletzt_genutzt ? 'Zuletzt: ' + new Date(tok.zuletzt_genutzt).toLocaleString('de-DE') : 'Noch nie genutzt'}
            </div>
            {!tok.aktiv && <div style={{ fontSize: '11px', color: C.redBright, marginTop: '2px' }}>GESPERRT</div>}
          </div>
          <button onClick={() => tokenSperren(tok.id)} disabled={!tok.aktiv} style={{
            padding: '8px 14px', background: tok.aktiv ? C.redDim : C.card2,
            color: tok.aktiv ? C.redBright : C.textMuted,
            border: `1px solid ${tok.aktiv ? C.red : C.border}`,
            borderRadius: '8px', cursor: tok.aktiv ? 'pointer' : 'default',
            fontSize: '12px', fontFamily: 'Share Tech Mono, monospace'
          }}>Sperren</button>
        </div>
      )
      })}
    </div>
  )
}
    </div >
  )
}

export default Lieferer
