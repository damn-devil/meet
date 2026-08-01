import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { catMood, CAT_EMOJI, CAT_FOOD_EMOJI } from '../lib/catmood.js'
import walkImg from '../assets/cat/walk.png'
import standImg from '../assets/cat/stand.png'
import sleepImg from '../assets/cat/sleep.png'
import scaredImg from '../assets/cat/scared.png'
import frightenImg from '../assets/cat/frighten.png'
import setImg from '../assets/cat/set.png'

const SPRITES = {
  walk: { img: walkImg, frames: 8, w: 150, h: 130, dur: 0.5 },
  stand: { img: standImg, frames: 4, w: 150, h: 120, dur: 1.4 },
  sleep: { img: sleepImg, frames: 5, w: 140, h: 130, dur: 2.2 },
  scared: { img: scaredImg, frames: 8, w: 130, h: 100, dur: 0.7 },
  frighten: { img: frightenImg, frames: 3, w: 150, h: 140, dur: 0.9 },
  set: { img: setImg, frames: 5, w: 140, h: 150, dur: 0.4 },
}

const CAT_W = 52
let bubbleId = 0

export function CatMascot() {
  const { state } = useStore()
  const mood = catMood(state.stats)
  const [sprite, setSprite] = useState('walk')
  const [bubbles, setBubbles] = useState([])
  const [flip, setFlip] = useState(true)
  const walkerRef = useRef(null)
  const moodRef = useRef(mood)
  const xRef = useRef(0)
  const dirRef = useRef(1)
  const prevCompleted = useRef(state.stats?.completed || 0)
  moodRef.current = mood

  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const spawnBubbles = (emojis) => {
    setBubbles((prev) => [
      ...prev,
      ...emojis.map((e, i) => ({ id: ++bubbleId, e, dx: (i - emojis.length / 2) * 22 })),
    ])
  }

  useEffect(() => {
    const completed = state.stats?.completed || 0
    if (completed > prevCompleted.current) {
      prevCompleted.current = completed
      spawnBubbles([CAT_FOOD_EMOJI[Math.floor(Math.random() * 3)], '💖'])
      setSprite('set')
      const t = setTimeout(() => setSprite('walk'), 900)
      return () => clearTimeout(t)
    }
    prevCompleted.current = completed
  }, [state.stats])

  useEffect(() => {
    const prev = moodRef.current
    if (prev !== mood) {
      if (mood === 'happy') spawnBubbles(['💖', '✨'])
      if (mood === 'sad') spawnBubbles(['🥺'])
      if (mood === 'angry') spawnBubbles(['😾', '💢'])
    }
    setSprite(mood === 'happy' ? 'stand' : mood === 'sad' ? 'scared' : mood === 'angry' ? 'frighten' : 'walk')
  }, [mood])

  useEffect(() => {
    if (reduced) return
    let raf
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const max = Math.max(40, window.innerWidth - CAT_W - 24)
      xRef.current += dirRef.current * 55 * dt
      if (xRef.current <= 0) {
        xRef.current = 0
        dirRef.current = 1
        setFlip(true)
      } else if (xRef.current >= max) {
        xRef.current = max
        dirRef.current = -1
        setFlip(false)
      }
      if (walkerRef.current) walkerRef.current.style.transform = `translateX(${xRef.current}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  const pet = (e) => {
    e.stopPropagation()
    spawnBubbles(['💛', '❤️'])
    setSprite('set')
    setTimeout(() => setSprite(moodRef.current === 'happy' ? 'stand' : 'walk'), 800)
  }

  const sp = SPRITES[sprite]
  return (
    <div className="cat-mascot" ref={walkerRef}>
      <div className="cat-bubbles" aria-hidden="true">
        {bubbles.map((b) => (
          <span
            key={b.id}
            className="cat-bubble"
            style={{ left: `calc(50% + ${b.dx}px)` }}
            onAnimationEnd={() => setBubbles((prev) => prev.filter((x) => x.id !== b.id))}
          >
            {b.e}
          </span>
        ))}
      </div>
      <div
        className={`cat-spr ${sprite} ${flip ? 'flip' : ''}`}
        style={{ width: CAT_W }}
        onClick={pet}
        role="button"
        aria-label="Погладить котика"
        title="Погладить котика"
      >
        <img
          src={sp.img}
          alt=""
          draggable={false}
          style={{
            width: CAT_W * sp.frames,
            animation: `catFrame ${sp.dur}s steps(${sp.frames}) infinite`,
            animationPlayState: reduced ? 'paused' : 'running',
          }}
        />
      </div>
      <span className="cat-mood" aria-hidden="true">{CAT_EMOJI[mood]}</span>
    </div>
  )
}
