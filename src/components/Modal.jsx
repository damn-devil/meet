import { createPortal } from 'react-dom'
import { Emoji } from './Emoji.jsx'

// Модалка, отрендеренная в портал на document.body. Так вложенные модалки
// (админ-панель, «О приложении» и т.п. внутри настроек) не «прилипают»
// к родительской модалке из-за backdrop-filter и не накладываются друг на друга.
export function Modal({ title, onClose, onBack, children }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {onBack ? (
            <button className="icon-btn" onClick={onBack} aria-label="Назад">
              <Emoji name="chevron-left" size={18} />
            </button>
          ) : (
            <span />
          )}
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <Emoji name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
