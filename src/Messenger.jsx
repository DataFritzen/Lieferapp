import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

function Messenger({ bestellungId, pseudonym, mitMikrofon = false }) {
  const [nachrichten, setNachrichten] = useState([])
  const [text, setText] = useState('')
  const [hoert, setHoert] = useState(false)
  const endRef = useRef(null)
  const erkennungRef = useRef(null)

  async function ladeNachrichten() {
    const { data } = await supabase
      .from('nachrichten')
      .select('*')
      .eq('bestellung_id', bestellungId)
      .order('erstellt_am', { ascending: true })
    setNachrichten(data || [])
  }

  async function senden(nachrichtText) {
    const t = nachrichtText || text
    if (!t.trim()) return
    await supabase.from('nachrichten').insert([{
      bestellung_id: bestellungId,
      von: pseudonym,
      text: t.trim()
    }])
    setText('')
  }

  function mikrofon() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Spracherkennung wird von diesem Browser nicht unterstützt.')
      return
    }
    if (hoert) {
      erkennungRef.current?.stop()
      setHoert(false)
      return
    }
    const Erkennung = window.SpeechRecognition || window.webkitSpeechRecognition
    const erkennung = new Erkennung()
    erkennung.lang = 'de-DE'
    erkennung.continuous = false
    erkennung.interimResults = false
    erkennung.onresult = (e) => {
      const erkannt = e.results[0][0].transcript
      setText(prev => prev + erkannt)
    }
    erkennung.onend = () => setHoert(false)
    erkennung.onerror = () => setHoert(false)
    erkennungRef.current = erkennung
    erkennung.start()
    setHoert(true)
  }

  useEffect(() => {
    ladeNachrichten()
    const kanal = supabase
      .channel('nachrichten-' + bestellungId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'nachrichten',
        filter: `bestellung_id=eq.${bestellungId}`
      }, () => ladeNachrichten())
      .subscribe()
    return () => supabase.removeChannel(kanal)
  }, [bestellungId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [nachrichten])

  const C = {
    bg: '#0d0d0d',
    border: '#242424',
    accent: '#e63030',
    text: '#d4d4d4',
    textDim: '#555',
    eigene: '#1e3a5f',
    eigeneText: '#90c4ff',
    andere: '#1a1a1a',
    andereText: '#aaa',
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Nachrichten */}
      <div style={{ height: '160px', overflowY: 'auto', padding: '12px', background: C.bg }}>
        {nachrichten.length === 0 && (
          <div style={{ color: C.textDim, fontSize: '13px', textAlign: 'center', marginTop: '50px' }}>
            Noch keine Nachrichten
          </div>
        )}
        {nachrichten.map(n => {
          const ichBin = n.von === pseudonym
          return (
            <div key={n.id} style={{
              display: 'flex',
              justifyContent: ichBin ? 'flex-end' : 'flex-start',
              marginBottom: '8px'
            }}>
              <span style={{
                background: ichBin ? C.eigene : C.andere,
                color: ichBin ? C.eigeneText : C.andereText,
                padding: '8px 12px', borderRadius: '10px',
                fontSize: '14px', maxWidth: '80%',
                border: ichBin ? 'none' : `1px solid ${C.border}`,
              }}>
                {n.text}
              </span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Eingabe */}
      <div style={{ display: 'flex', borderTop: `1px solid ${C.border}`, background: C.bg }}>
        {mitMikrofon && (
          <button onClick={mikrofon} style={{
            padding: '12px 14px', background: hoert ? '#3a0a0a' : 'transparent',
            color: hoert ? C.accent : C.textDim,
            border: 'none', borderRight: `1px solid ${C.border}`,
            cursor: 'pointer', fontSize: '18px',
            animation: hoert ? 'pulse 1s infinite' : 'none'
          }} title="Diktieren">
            🎙
          </button>
        )}
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && senden()}
          placeholder={hoert ? 'Höre zu...' : 'Nachricht...'}
          style={{
            flex: 1, padding: '12px 14px', border: 'none', outline: 'none',
            fontSize: '14px', background: 'transparent', color: C.text,
            fontFamily: 'Share Tech Mono, monospace',
          }}
        />
        <button onClick={() => senden()} style={{
          padding: '12px 16px', background: C.accent, color: 'white',
          border: 'none', cursor: 'pointer', fontSize: '16px',
        }}>
          ➤
        </button>
      </div>
    </div>
  )
}

export default Messenger
