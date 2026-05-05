import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

function Messenger({ bestellungId, pseudonym }) {
  const [nachrichten, setNachrichten] = useState([])
  const [text, setText] = useState('')
  const endRef = useRef(null)

  async function ladeNachrichten() {
    const { data } = await supabase
      .from('nachrichten')
      .select('*')
      .eq('bestellung_id', bestellungId)
      .order('erstellt_am', { ascending: true })
    setNachrichten(data || [])
  }

  async function senden() {
    if (!text.trim()) return
    await supabase.from('nachrichten').insert([{
      bestellung_id: bestellungId,
      von: pseudonym,
      text: text.trim()
    }])
    setText('')
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

  return (
    <div style={{ border: '1px solid #2a2a2a', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ height: '160px', overflowY: 'auto', padding: '12px', background: '#0d0d0d' }}>
        {nachrichten.length === 0 && (
          <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', letterSpacing: '0.1em', marginTop: '50px' }}>
            — KEINE NACHRICHTEN —
          </p>
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
                background: ichBin ? '#1e3a5f' : '#1a1a1a',
                color: ichBin ? '#90c4ff' : '#aaa',
                padding: '6px 10px',
                borderRadius: '4px',
                fontSize: '13px',
                maxWidth: '80%',
                border: ichBin ? 'none' : '1px solid #2a2a2a',
                letterSpacing: '0.03em'
              }}>
                {n.text}
              </span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid #2a2a2a', background: '#0d0d0d' }}>
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && senden()}
          placeholder="Nachricht..."
          style={{
            flex: 1, padding: '10px 12px', border: 'none', outline: 'none',
            fontSize: '13px', background: 'transparent', color: '#e0e0e0',
            fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.03em'
          }}
        />
        <button onClick={senden} style={{
          padding: '10px 16px', background: '#cc0000', color: 'white',
          border: 'none', cursor: 'pointer', fontSize: '14px',
          fontFamily: 'Share Tech Mono, monospace'
        }}>
          ►
        </button>
      </div>
    </div>
  )
}

export default Messenger