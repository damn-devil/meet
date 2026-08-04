import { useEffect, useRef, useState } from 'react'
import { Emoji } from './Emoji.jsx'

const BOX = 280
const OUT = 512

export function CropAvatar({ src, onCancel, onSave }) {
  const [img, setImg] = useState(null)
  const [base, setBase] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const imgElRef = useRef(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      setImg(image)
      const fit = Math.max(BOX / image.naturalWidth, BOX / image.naturalHeight)
      setBase({ w: image.naturalWidth * fit, h: image.naturalHeight * fit })
    }
    image.src = src
    return () => {
      image.onload = null
    }
  }, [src])

  const clampPos = (p) => {
    if (!base) return p
    const maxX = Math.max(0, (base.w * zoom - BOX) / 2)
    const maxY = Math.max(0, (base.h * zoom - BOX) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, p.x)), y: Math.max(-maxY, Math.min(maxY, p.y)) }
  }

  const onZoom = (e) => {
    const z = parseFloat(e.target.value)
    setZoom(z)
    if (!base) return
    const maxX = Math.max(0, (base.w * z - BOX) / 2)
    const maxY = Math.max(0, (base.h * z - BOX) / 2)
    setPos({ x: Math.max(-maxX, Math.min(maxX, pos.x)), y: Math.max(-maxY, Math.min(maxY, pos.y)) })
  }

  const onDown = (e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, px: pos.x, py: pos.y }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    const d = dragRef.current
    if (!d || !base) return
    setPos(clampPos({ x: d.px + (e.clientX - d.startX), y: d.py + (e.clientY - d.startY) }))
  }
  const onUp = () => {
    dragRef.current = null
  }

  const save = () => {
    if (!img || !base) return
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    const dispW = base.w * zoom
    const dispH = base.h * zoom
    const topLeftX = dispW / 2 - pos.x - BOX / 2
    const topLeftY = dispH / 2 - pos.y - BOX / 2
    const s = OUT / BOX
    ctx.drawImage(img, -topLeftX * s, -topLeftY * s, dispW * s, dispH * s)
    onSave(canvas.toDataURL('image/jpeg', 0.88))
  }

  return (
    <div className="modal-overlay crop-overlay" onClick={onCancel}>
      <div className="crop-modal glass" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Обрежьте фото</h2>
          <button className="icon-btn" onClick={onCancel}><Emoji name="close" size={18} /></button>
        </div>

        {base ? (
          <>
            <div
              className="crop-box"
              style={{ width: BOX, height: BOX }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <img
                ref={imgElRef}
                src={src}
                alt=""
                draggable="false"
                style={{
                  left: BOX / 2 - base.w / 2,
                  top: BOX / 2 - base.h / 2,
                  width: base.w,
                  height: base.h,
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
                }}
              />
            </div>

            <div className="crop-zoom">
              <span>−</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={onZoom}
                aria-label="Масштаб фото"
              />
              <span>+</span>
            </div>
          </>
        ) : (
          <div className="crop-loading">Загрузка фото…</div>
        )}

        <div className="crop-actions">
          <button className="btn btn-soft" onClick={onCancel}>Отмена</button>
          <button className="btn btn-primary" onClick={save} disabled={!base}>Обрезать</button>
        </div>
      </div>
    </div>
  )
}
