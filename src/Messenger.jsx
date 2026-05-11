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
      .from('nachrichten').select('*')
      .eq('bestellung_id', bestellungId)
      .order('erstellt_am', { ascending: true })
    setNachrichten(data || [])
  }

  async function senden() {
    if (!text.trim()) return
    await supabase.from('nachrichten').insert([{
      bestellung_id: bestellungId, von: pseudonym, text: text.trim()
    }])
    setText('')
  }

  function mikrofon() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Spracherkennung nicht unterstützt.')
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
    erkennung.onresult = (e) => setText(prev => prev + e.results[0][0].transcript)
    erkennung.onend = () => setHoert(false)
    erkennung.onerror = () => setHoert(false)
    erkennungRef.current = erkennung
    erkennung.start()
    setHoert(true)
  }

  useEffect(() => {
    ladeNachrichten()
    const kanal = supabase.channel('nachrichten-' + bestellungId)
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

  return (
    <div style={{ border: '1px solid #2a2520', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ height: '160px', overflowY: 'auto', padding: '12px', background: '#0c0c0c' }}>
        {nachrichten.length === 0 && (
          <div style={{ color: '#3a3530', fontSize: '13px', textAlign: 'center', marginTop: '50px' }}>
            Noch keine Nachrichten
          </div>
        )}
        {nachrichten.map(n => {
          const ichBin = n.von === pseudonym
          return (
            <div key={n.id} style={{ display: 'flex', justifyContent: ichBin ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
              <span style={{
                background: ichBin ? '#1e3040' : '#1e1e1e',
                color: ichBin ? '#8ab4d4' : '#9a9080',
                padding: '8px 12px', borderRadius: '10px', fontSize: '14px', maxWidth: '80%',
                border: ichBin ? 'none' : '1px solid #2a2520',
              }}>
                {n.text}
              </span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #2a2520', background: '#0c0c0c' }}>
        {mitMikrofon && (
          <button onClick={mikrofon} style={{
            padding: '12px 14px', background: hoert ? '#1a0500' : 'transparent',
            color: hoert ? '#cc2200' : '#5a5040',
            border: 'none', borderRight: '1px solid #2a2520',
            cursor: 'pointer', fontSize: '18px',
          }} title="Diktieren">
            🎙
          </button>
        )}
        <input type="text" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && senden()}
          placeholder={hoert ? 'Höre zu...' : 'Nachricht...'}
          style={{
            flex: 1, padding: '12px 14px', border: 'none', outline: 'none',
            fontSize: '14px', background: 'transparent', color: '#e8e0d0',
            fontFamily: 'Share Tech Mono, monospace',
          }}
        />
        <button onClick={senden} style={{
          padding: '12px 16px', background: '#8b0000', color: '#e8e0d0',
          border: 'none', cursor: 'pointer', fontSize: '16px',
        }}>➤</button>
      </div>
    </div>
  )
}

export default Messenger
