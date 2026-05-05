import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Messenger from './Messenger'
import { entschluesseln } from './crypto'
import { t } from './theme'

function Lieferer() {
  const [bestellungen, setBestellungen] = useState([])
  const [zeitfenster, setZeitfenster] = useState([])
  const [paketstationen, setPaketstationen] = useState([])
  const [tokens, setTokens] = useState([])
  const [produkte, setProdukte] = useState([])
  const [laden, setLaden] = useState(true)
  const [ansicht, setAnsicht] = useState('bestellungen')
  const [bestellFilter, setBestellFilter] = useState('offen')
  const [vonUhrzeit, setVonUhrzeit] = useState('')
  const [bisUhrzeit, setBisUhrzeit] = useState('')
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0])
  const [neuerName, setNeuerName] = useState('')
  const [neueAdresse, setNeueAdresse] = useState('')
  const [neuerToken, setNeuerToken] = useState(null)
  const [produktName, setProduktName] = useState('')
  const [produktBeschreibung, setProduktBeschreibung] = useState('')
  const [produktEinheit, setProduktEinheit] = useState('Stück')
  const [produktPreis, setProduktPreis] = useState('')
  const [produktMengen, setProduktMengen] = useState('')

  const uhrzeiten = [
    '07:00','07:30','08:00','08:30','09:00','09:30',
    '10:00','10:30','11:00','11:30','12:00','12:30',
    '13:00','13:30','14:00','14:30','15:00','15:30',
    '16:00','16:30','17:00','17:30','18:00','18:30',
    '19:00','19:30','20:00','20:30','21:00'
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
    const sortiert = (b || []).sort((a, b) => {
      const datumA = a.zeitfenster?.datum + ' ' + a.zeitfenster?.uhrzeit || ''
      const datumB = b.zeitfenster?.datum + ' ' + b.zeitfenster?.uhrzeit || ''
      return datumA.localeCompare(datumB)
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
    const { error } = await supabase.from('zeitfenster').insert([{ uhrzeit: `${vonUhrzeit}-${bisUhrzeit}`, datum, max_bestellungen: 3, aktiv: true }])
    if (error) alert('Fehler: ' + error.message)
    else { setVonUhrzeit(''); setBisUhrzeit(''); ladeAlles() }
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
    const ok = window.confirm('Token sperren? Zugang wird sofort entzogen.')
    if (!ok) return
    await supabase.from('tokens').update({ aktiv: false }).eq('id', id)
    ladeTokens()
  }

  function qrUrl(token) {
    return `${window.location.origin}?t=${token}`
  }

  function belegungZaehlen(zeitfensterId) {
    return bestellungen.filter(b => b.zeitfenster_id === zeitfensterId).length
  }

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

  useEffect(() => {
    ladeAlles()
    const kanal = supabase
      .channel('bestellungen-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bestellungen' }, () => ladeAlles())
      .subscribe()
    return () => supabase.removeChannel(kanal)
  }, [])

  if (laden) return (
    <div style={{ padding: '2rem', color: '#333', fontSize: '12px', letterSpacing: '0.1em' }}>
      LADE DATEN...
    </div>
  )

  const datumsGruppen = gruppiereNachDatum()

  const inputStyle = {
    width: '100%', padding: '10px', background: '#111', border: '1px solid #2a2a2a',
    borderRadius: '4px', color: '#e0e0e0', fontSize: '13px', marginBottom: '8px',
    boxSizing: 'border-box', fontFamily: 'Share Tech Mono, monospace'
  }

  const selectStyle = {
    padding: '10px', background: '#111', border: '1px solid #2a2a2a',
    borderRadius: '4px', color: '#e0e0e0', fontSize: '13px',
    fontFamily: 'Share Tech Mono, monospace'
  }

  const tabs = ['bestellungen', 'produkte', 'zeitfenster', 'paketstationen', 'zugaenge']
  const tabLabels = {
    bestellungen: `AUFTRÄGE (${bestellungen.length})`,
    produkte: `WAREN (${produkte.length})`,
    zeitfenster: `SLOTS (${zeitfenster.length})`,
    paketstationen: `BOXEN (${paketstationen.length})`,
    zugaenge: 'ZUGÄNGE'
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '680px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #cc0000', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '10px', color: '#cc0000', letterSpacing: '0.15em', marginBottom: '4px' }}>LIEFERSYSTEM // OPERATOR</div>
        <div style={{ fontSize: '11px', color: '#555' }}>ZUGANG AUTORISIERT</div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(a => (
          <button key={a} onClick={() => setAnsicht(a)} style={{
            padding: '6px 12px', fontSize: '11px', letterSpacing: '0.08em',
            background: ansicht === a ? '#cc0000' : 'transparent',
            color: ansicht === a ? 'white' : '#555',
            border: ansicht === a ? '1px solid #cc0000' : '1px solid #2a2a2a',
            borderRadius: '4px', cursor: 'pointer',
            fontFamily: 'Share Tech Mono, monospace'
          }}>
            {tabLabels[a]}
          </button>
        ))}
      </div>

      {/* Bestellungen */}
      {ansicht === 'bestellungen' && (
        <div>
{/* Filter */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem' }}>
            {['offen', 'bestätigt', 'alle'].map(f => {
              const count = f === 'alle' ? bestellungen.length : bestellungen.filter(b => b.status === f).length
              return (
                <button key={f} onClick={() => setBestellFilter(f)} style={{
                  padding: '6px 12px', fontSize: '11px', letterSpacing: '0.08em',
                  background: bestellFilter === f ? '#cc0000' : 'transparent',
                  color: bestellFilter === f ? 'white' : '#555',
                  border: bestellFilter === f ? '1px solid #cc0000' : '1px solid #2a2a2a',
                  borderRadius: '4px', cursor: 'pointer',
                  fontFamily: 'Share Tech Mono, monospace'
                }}>
                  {f.toUpperCase()} ({count})
                </button>
              )
            })}
          </div>

          {bestellungen.filter(b => bestellFilter === 'alle' || b.status === bestellFilter).length === 0 && (
            <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center', padding: '2rem' }}>
              — KEINE AUFTRÄGE —
            </div>
          )}
          {bestellungen.filter(b => bestellFilter === 'alle' || b.status === bestellFilter).map(b => {
            const slot = zeitfenster.find(z => z.id === b.zeitfenster_id)
            const station = paketstationen.find(p => p.id === b.paketstation_id)
            const daten = b.produkte_verschluesselt ? entschluesseln(b.produkte_verschluesselt) : null
            const bestellProdukte = daten?.produkte || {}
            const tel = daten?.telefon

            return (
              <div key={b.id} style={{
                border: `1px solid ${b.status === 'bestätigt' ? '#1e3a1e' : b.status === 'ausgestellt' ? '#1e1e3a' : '#2a2a2a'}`,
                borderLeft: `3px solid ${b.status === 'bestätigt' ? '#00aa44' : b.status === 'ausgestellt' ? '#4444cc' : '#cc0000'}`,
                borderRadius: '4px', padding: '1rem', marginBottom: '10px',
                background: '#0d0d0d'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', color: '#e0e0e0', letterSpacing: '0.05em' }}>{b.pseudonym}</span>
                  <span style={{
                    fontSize: '10px', padding: '2px 8px', borderRadius: '2px', letterSpacing: '0.1em',
                    background: b.status === 'offen' ? '#2a1500' : b.status === 'bestätigt' ? '#001a0d' : '#0a0a2a',
                    color: b.status === 'offen' ? '#cc6600' : b.status === 'bestätigt' ? '#00aa44' : '#4444cc',
                    border: `1px solid ${b.status === 'offen' ? '#cc6600' : b.status === 'bestätigt' ? '#00aa44' : '#4444cc'}`
                  }}>
                    {b.status.toUpperCase()}
                  </span>
                </div>

                {/* Produkte */}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '4px' }}>WAREN</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {Object.entries(bestellProdukte).map(([id, menge]) => {
                      const prod = produkte.find(p => p.id === id)
                      return (
                        <span key={id} style={{
                          fontSize: '12px', padding: '3px 8px',
                          background: '#1a1a1a', border: '1px solid #2a2a2a',
                          borderRadius: '4px', color: '#cc0000'
                        }}>
                          {prod ? prod.name : id} · {menge}{prod ? (prod.einheit === 'Gramm' ? 'g' : 'x') : 'x'}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Slot */}
                {slot && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '2px' }}>ZEITFENSTER</div>
                    <div style={{ fontSize: '13px', color: '#888' }}>
                      {slot.datum ? datumFormatieren(slot.datum) + ' · ' : ''}{slot.uhrzeit}
                    </div>
                  </div>
                )}

                {/* Telefon */}
                {tel && (
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em' }}>TEL</div>
                    <span style={{ fontSize: '13px', color: '#888' }}>{tel}</span>
                    <button onClick={() => { navigator.clipboard.writeText(tel); alert('Kopiert!') }} style={{
                      fontSize: '10px', padding: '2px 6px', background: 'transparent',
                      color: '#555', border: '1px solid #2a2a2a', borderRadius: '4px',
                      cursor: 'pointer', fontFamily: 'Share Tech Mono, monospace'
                    }}>COPY</button>
                  </div>
                )}

                {/* Paketbox zuweisen */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '4px' }}>PAKETBOX</div>
                  <select value={b.paketstation_id || ''} onChange={e => pakietstationZuweisen(b.id, e.target.value)}
                    style={{ ...selectStyle, width: '100%' }}>
                    <option value="">— zuweisen —</option>
                    {paketstationen.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.adresse}</option>
                    ))}
                  </select>
                  {station && <div style={{ fontSize: '12px', color: '#00aa44', marginTop: '4px' }}>✓ {station.name} — {station.adresse}</div>}
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '11px', color: '#333', marginBottom: '10px' }}>
                  {new Date(b.erstellt_am).toLocaleString('de-DE')}
                </div>

                <Messenger bestellungId={b.id} pseudonym="Lieferer" />

                {/* Aktionen */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {b.status === 'offen' && (
                    <button onClick={() => statusSetzen(b.id, 'bestätigt')} style={{
                      padding: '8px 16px', background: '#001a0d', color: '#00aa44',
                      border: '1px solid #00aa44', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '11px', letterSpacing: '0.1em', fontFamily: 'Share Tech Mono, monospace'
                    }}>
                      [ BESTÄTIGEN ]
                    </button>
                  )}
                  {b.status === 'bestätigt' && (
                    <button onClick={() => statusSetzen(b.id, 'ausgestellt')} style={{
                      padding: '8px 16px', background: '#0a0a2a', color: '#4488ff',
                      border: '1px solid #4488ff', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '11px', letterSpacing: '0.1em', fontFamily: 'Share Tech Mono, monospace'
                    }}>
                      [ AUSGESTELLT ]
                    </button>
                  )}
                  {b.status === 'ausgestellt' && (
                    <button onClick={() => bestellungLoeschen(b.id)} style={{
                      padding: '8px 16px', background: '#1a0000', color: '#cc0000',
                      border: '1px solid #cc0000', borderRadius: '4px', cursor: 'pointer',
                      fontSize: '11px', letterSpacing: '0.1em', fontFamily: 'Share Tech Mono, monospace'
                    }}>
                      [ LÖSCHEN ]
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Produkte */}
      {ansicht === 'produkte' && (
        <div>
          <div style={{ border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem', background: '#0d0d0d' }}>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '12px' }}>NEUE WARE ANLEGEN</div>
            <input type="text" placeholder="Bezeichnung" value={produktName} onChange={e => setProduktName(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Beschreibung (optional)" value={produktBeschreibung} onChange={e => setProduktBeschreibung(e.target.value)} style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <select value={produktEinheit} onChange={e => setProduktEinheit(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                <option value="Stück">Stück</option>
                <option value="Gramm">Gramm</option>
              </select>
              <input type="number" placeholder="Preis (€)" value={produktPreis} onChange={e => setProduktPreis(e.target.value)}
                style={{ ...selectStyle, flex: 1, border: '1px solid #2a2a2a' }} />
            </div>
            <input type="text"
              placeholder={produktEinheit === 'Gramm' ? 'Basis-Menge in g (z.B. 10)' : 'Max. Stückzahl (z.B. 5)'}
              value={produktMengen} onChange={e => setProduktMengen(e.target.value)} style={inputStyle} />
            <button onClick={produktHinzufuegen} style={{ ...t.btnPrimary, width: '100%' }}>
              + HINZUFÜGEN
            </button>
          </div>

          {produkte.length === 0 && <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center', padding: '2rem' }}>— KEINE WAREN —</div>}
          {produkte.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '12px 16px', marginBottom: '6px', background: '#0d0d0d' }}>
              <div>
                <span style={{ color: '#e0e0e0', fontSize: '13px' }}>{p.name}</span>
                {p.beschreibung && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#555' }}>{p.beschreibung}</span>}
                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#333' }}>{p.einheit}</span>
                {p.preis > 0 && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#cc0000' }}>{p.preis.toFixed(2)} €</span>}
              </div>
              <button onClick={() => produktLoeschen(p.id)} style={t.btnDanger}>LÖSCHEN</button>
            </div>
          ))}
        </div>
      )}

      {/* Zeitfenster */}
      {ansicht === 'zeitfenster' && (
        <div>
          <div style={{ border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem', background: '#0d0d0d' }}>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '12px' }}>NEUEN SLOT ANLEGEN</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ ...selectStyle }} />
              <select value={vonUhrzeit} onChange={e => setVonUhrzeit(e.target.value)} style={selectStyle}>
                <option value="">Von</option>
                {uhrzeiten.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <span style={{ color: '#555' }}>—</span>
              <select value={bisUhrzeit} onChange={e => setBisUhrzeit(e.target.value)} style={selectStyle}>
                <option value="">Bis</option>
                {uhrzeiten.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={zeitfensterHinzufuegen} style={t.btnPrimary}>+ SLOT</button>
            </div>
          </div>

          {Object.keys(datumsGruppen).length === 0 && <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center', padding: '2rem' }}>— KEINE SLOTS —</div>}
          {Object.entries(datumsGruppen).map(([d, slots]) => (
            <div key={d} style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '8px' }}>
                📅 {datumFormatieren(d)}
              </div>
              {slots.map(z => {
                const belegung = belegungZaehlen(z.id)
                return (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '10px 14px', marginBottom: '4px', background: '#0d0d0d' }}>
                    <div>
                      <span style={{ color: '#e0e0e0', fontSize: '13px' }}>{z.uhrzeit}</span>
                      <span style={{ marginLeft: '12px', fontSize: '11px', color: belegung >= z.max_bestellungen ? '#cc0000' : '#00aa44' }}>
                        {belegung}/{z.max_bestellungen}
                      </span>
                    </div>
                    <button onClick={() => zeitfensterLoeschen(z.id)} style={t.btnDanger}>LÖSCHEN</button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Paketstationen */}
      {ansicht === 'paketstationen' && (
        <div>
          <div style={{ border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem', background: '#0d0d0d' }}>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.1em', marginBottom: '12px' }}>NEUE PAKETBOX</div>
            <input type="text" placeholder="Name (z.B. Box A)" value={neuerName} onChange={e => setNeuerName(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="Adresse" value={neueAdresse} onChange={e => setNeueAdresse(e.target.value)} style={inputStyle} />
            <button onClick={pakietstationHinzufuegen} style={{ ...t.btnPrimary, width: '100%' }}>+ HINZUFÜGEN</button>
          </div>

          {paketstationen.length === 0 && <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center', padding: '2rem' }}>— KEINE BOXEN —</div>}
          {paketstationen.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '12px 16px', marginBottom: '6px', background: '#0d0d0d' }}>
              <div>
                <span style={{ color: '#e0e0e0', fontSize: '13px' }}>{p.name}</span>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#555' }}>{p.adresse}</span>
              </div>
              <button onClick={() => pakietstationLoeschen(p.id)} style={t.btnDanger}>LÖSCHEN</button>
            </div>
          ))}
        </div>
      )}

      {/* Zugänge */}
      {ansicht === 'zugaenge' && (
        <div>
          <button onClick={tokenErstellen} style={{ ...t.btnPrimary, marginBottom: '1.5rem' }}>
            + NEUEN ZUGANG ERSTELLEN
          </button>

          {neuerToken && (
            <div style={{ border: '1px solid #00aa44', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem', background: '#001a0d' }}>
              <div style={{ fontSize: '10px', color: '#00aa44', letterSpacing: '0.1em', marginBottom: '8px' }}>✓ NEUER ZUGANG — LINK WEITERGEBEN</div>
              <div style={{ background: '#0d0d0d', borderRadius: '4px', padding: '10px', fontSize: '11px', wordBreak: 'break-all', marginBottom: '8px', color: '#555', border: '1px solid #2a2a2a' }}>
                {qrUrl(neuerToken.token)}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { navigator.clipboard.writeText(qrUrl(neuerToken.token)); alert('Kopiert!') }} style={t.btnPrimary}>
                  KOPIEREN
                </button>
                <button onClick={() => setNeuerToken(null)} style={t.btnGhost}>SCHLIESSEN</button>
              </div>
            </div>
          )}

          {tokens.length === 0 && <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em', textAlign: 'center', padding: '2rem' }}>— KEINE ZUGÄNGE —</div>}
          {tokens.map(t2 => (
            <div key={t2.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: '1px solid #2a2a2a', borderRadius: '4px', padding: '12px 16px',
              marginBottom: '6px', background: '#0d0d0d', opacity: t2.aktiv ? 1 : 0.4
            }}>
              <div>
                {t2.pseudonym && <div style={{ fontSize: '13px', color: '#e0e0e0', marginBottom: '2px' }}>{t2.pseudonym}</div>}
                <div style={{ fontSize: '11px', color: '#555' }}>
                  {t2.zuletzt_genutzt ? 'Zuletzt: ' + new Date(t2.zuletzt_genutzt).toLocaleString('de-DE') : 'Noch nie genutzt'}
                </div>
                {!t2.aktiv && <div style={{ fontSize: '10px', color: '#cc0000', letterSpacing: '0.1em', marginTop: '2px' }}>GESPERRT</div>}
              </div>
              <button onClick={() => tokenSperren(t2.id)} disabled={!t2.aktiv} style={{
                ...t.btnDanger, opacity: t2.aktiv ? 1 : 0.3, cursor: t2.aktiv ? 'pointer' : 'default'
              }}>
                SPERREN
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Lieferer
