/* Нарисованные вручную иконки/эмодзи (SVG в брутал-стиле) — без системных эмодзи. */

const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const SOLID = { fill: 'currentColor', stroke: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
const PAPER = { fill: 'var(--brutal-paper)', stroke: 'none' }

const ANIMALS = { dog: 'Собака', panda: 'Панда', fox: 'Лис', frog: 'Лягушка', rabbit: 'Кролик', lion: 'Лев', tiger: 'Тигр', hamster: 'Хомяк', koala: 'Коала' }
const ANIMAL_CHAR = Object.fromEntries(Object.entries(ANIMALS).map(([k]) => [k, { 'dog': '🐶', 'panda': '🐼', 'fox': '🦊', 'frog': '🐸', 'rabbit': '🐰', 'lion': '🦁', 'tiger': '🐯', 'hamster': '🐹', 'koala': '🐨' }[k]]))

const CHAR_TO_NAME = {
  '🙂': 'smile', '🗺': 'map', '✅': 'check', '✕': 'close', '⭐': 'star', '★': 'star',
  '📷': 'camera', '🗑': 'trash', '🕐': 'clock', '⏰': 'alarm', '📝': 'pencil',
  '✏️': 'pencil', '✏': 'pencil', '⚙️': 'gear', '⚙': 'gear', '🔍': 'search',
  '📦': 'box', '📅': 'calendar', '💬': 'chat', '💛': 'heart', '🐾': 'paw',
  '❤️': 'heart', '❤': 'heart', '❓': 'question', '❌': 'cross', '✨': 'spark',
  '📍': 'pin', '⏳': 'hourglass', '😿': 'cat-sad', '🚫': 'prohibited',
  ...ANIMAL_CHAR,
}

const TOKEN_RE = new RegExp(`(${Object.keys(CHAR_TO_NAME).sort((a, b) => b.length - a.length).join('|')})`, 'gu')

export function emojiName(char) {
  return CHAR_TO_NAME[char] || 'smile'
}

export function avatarName(emoji) {
  if (!emoji) return 'smile'
  return CHAR_TO_NAME[emoji] || (ANIMALS[emoji] ? emoji : 'smile')
}

export function Emoji({ name, size = 18, className }) {
  const glyph = GLYPH(name)
  if (!glyph) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
      aria-hidden="true"
      style={{ verticalAlign: '-0.18em' }}
    >
      {glyph}
    </svg>
  )
}

export function EmojiText({ text, className }) {
  if (!text) return null
  const out = []
  let last = 0
  let m
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const name = CHAR_TO_NAME[m[0]]
    if (name) out.push(<Emoji key={`${m.index}-${name}`} name={name} size={18} className={className} />)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function eyesDots(x1 = 9, x2 = 15, y = 11) {
  return <>{<circle cx={x1} cy={y} r="1" {...SOLID} />}{<circle cx={x2} cy={y} r="1" {...SOLID} />}</>
}

function GLYPH(name) {
  switch (name) {
    case 'smile':
      return <><rect x="3.5" y="3.5" width="17" height="17" rx="5" {...LINE} /><circle cx="9" cy="9" r="1" {...SOLID} /><circle cx="15" cy="9" r="1" {...SOLID} /><path d="M8.8 14q3.2 2.6 6.4 0" {...LINE} /></>
    case 'map':
      return <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" {...LINE} /><path d="M9 4v14M15 6v14" {...LINE} /></>
    case 'check':
      return <><rect x="3" y="3" width="18" height="18" rx="4" {...LINE} /><path d="m7 12 3.5 3.5L17 8.5" {...LINE} /></>
    case 'close':
      return <path d="M6 6l12 12M18 6 6 18" {...LINE} />
    case 'star':
      return <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.2l-5.8 3.2 1.1-6.4L2.6 9.4l6.5-.9Z" {...SOLID} />
    case 'camera':
      return <><rect x="3" y="7" width="18" height="13" rx="3" {...LINE} /><path d="M8 7 9.5 4h5L16 7" {...LINE} /><circle cx="12" cy="13.5" r="3.4" {...LINE} /><circle cx="12" cy="13.5" r="1" {...SOLID} /><path d="M17.6 10.6h.01" {...LINE} /></>
    case 'trash':
      return <><path d="M4 6h16M9 6V4h6v2M6.5 6l1 14h9l1-14" {...LINE} /><path d="M10 10v6M14 10v6" {...LINE} /></>
    case 'clock':
      return <><circle cx="12" cy="12" r="8.5" {...LINE} /><path d="M12 7.5V12l3 2" {...LINE} /></>
    case 'alarm':
      return <><circle cx="12" cy="13" r="7" {...LINE} /><path d="M12 9.5V13l2.5 1.5" {...LINE} /><path d="M8.5 5.5 7 3.5M15.5 5.5 17 3.5M9.5 5.5h5" {...LINE} /></>
    case 'pencil':
      return <><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19Z" {...LINE} /><path d="M14 6.5l3.5 3.5" {...LINE} /></>
    case 'gear':
      return <><circle cx="12" cy="12" r="3" {...LINE} /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h0a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h0a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v0a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" {...LINE} /></>
    case 'search':
      return <><circle cx="10.5" cy="10.5" r="6" {...LINE} /><path d="m15.5 15.5 5 5" {...LINE} /></>
    case 'box':
      return <><path d="M12 3 3 8v8l9 5 9-5V8Z" {...LINE} /><path d="M3 8l9 5 9-5M12 13v8" {...LINE} /></>
    case 'calendar':
      return <><rect x="3" y="5" width="18" height="16" rx="3" {...LINE} /><path d="M16 3v4M8 3v4M3 10h18" {...LINE} /></>
    case 'chat':
      return <><path d="M21 12a8 8 0 0 1-8 8H6l-3 3v-8a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" {...LINE} /><path d="M8 10h8M8 13h5" {...LINE} /></>
    case 'heart':
      return <path d="M12 20.5C7 16.5 3 13 3 8.7 3 6 5.2 4 7.7 4c1.7 0 3.2.9 4.3 2.4C13.1 4.9 14.6 4 16.3 4 18.8 4 21 6 21 8.7c0 4.3-4 7.8-9 11.8Z" {...LINE} />
    case 'paw':
      return <>{<circle cx="6.5" cy="13" r="2" {...SOLID} />}{<circle cx="11.5" cy="9.5" r="2" {...SOLID} />}{<circle cx="17.5" cy="13" r="2" {...SOLID} />}<path d="M8.2 14.6c1-3 2.2-4.1 3.8-4.1s2.8 1.1 3.8 4.1c.7 2-0.1 3.4-1.8 3.4h-4c-1.7 0-2.5-1.4-1.8-3.4Z" {...SOLID} /></>
    case 'question':
      return <><circle cx="12" cy="12" r="9" {...LINE} /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.4 1-1.4 1.9v.5" {...LINE} /><circle cx="12" cy="16.8" r="1" {...SOLID} /></>
    case 'cross':
      return <><rect x="3" y="3" width="18" height="18" rx="4" {...LINE} /><path d="m8 8 8 8M16 8 8 16" {...LINE} /></>
    case 'spark':
      return <><path d="M12 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7Z" {...SOLID} /><path d="M18.5 4.5v3M17 6h3" {...LINE} /></>
    case 'pin':
      return <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" {...LINE} /><circle cx="12" cy="10" r="2.4" {...LINE} /></>
    case 'hourglass':
      return <><path d="M7 3h10v4l-5 5 5 5v4H7v-4l5-5-5-5Z" {...LINE} /><path d="M7 6h10" {...LINE} /></>
    case 'cat-sad':
      return <><path d="M5 10V5l3 2h8l3-2v5a9 9 0 0 1-14 0Z" {...LINE} /><path d="M9 11h.01M15 11h.01" {...LINE} /><path d="M8.5 15q3.5-2 7 0" {...LINE} /><path d="M9 9.8c.6 1 .2 1.7.5 2.2M15 9.8c-.6 1-.2 1.7-.5 2.2M9 17.5V20l1-1.5M9 20l3-.5 3 .5" {...LINE} /></>
    case 'prohibited':
      return <><circle cx="12" cy="12" r="9" {...LINE} /><path d="M6.5 6.5l11 11" {...LINE} /></>

    case 'dog':
      return <><rect x="4" y="7" width="5" height="7" rx="2.5" {...SOLID} /><rect x="15" y="7" width="5" height="7" rx="2.5" {...SOLID} /><rect x="4.5" y="5.5" width="15" height="14" rx="6" {...LINE} /><rect x="4.5" y="5.5" width="6" height="7" rx="3" {...SOLID} /><rect x="13.5" y="5.5" width="6" height="7" rx="3" {...SOLID} /><circle cx="7" cy="4" r="2.6" {...SOLID} /><circle cx="17" cy="4" r="2.6" {...SOLID} />{eyesDots()} <ellipse cx="12" cy="15" rx="1.5" ry="1" {...SOLID} /><path d="M11 15v2M13 15v2" {...LINE} /></>
    case 'panda':
      return <>{<circle cx="7" cy="5.5" r="2.6" {...SOLID} />}{<circle cx="17" cy="5.5" r="2.6" {...SOLID} />}<rect x="4.5" y="6" width="15" height="13" rx="6.5" {...LINE} /><ellipse cx="9" cy="11.5" rx="2.1" ry="2.7" {...SOLID} /><ellipse cx="15" cy="11.5" rx="2.1" ry="2.7" {...SOLID} /><circle cx="9" cy="12" r="0.9" {...PAPER} /><circle cx="15" cy="12" r="0.9" {...PAPER} /><ellipse cx="12" cy="15" rx="1.3" ry="0.9" {...SOLID} /></>
    case 'fox':
      return <><path d="M12 3.5 8.5 7 5.5 6l.8 3-2.3 1v7.5L12 21l8-3.5V10l-2.3-1 .8-3-3 1Z" {...LINE} /><path d="M8.5 12.5h3M12.5 12.5h3M10.6 15h2.8v2h-2.8Z" {...LINE} /></>
    case 'frog':
      return <>{<circle cx="8" cy="6.5" r="2.6" {...LINE} />}{<circle cx="16" cy="6.5" r="2.6" {...LINE} />}<rect x="3" y="7" width="18" height="11" rx="5.5" {...LINE} /><circle cx="8" cy="6.5" r="1" {...SOLID} /><circle cx="16" cy="6.5" r="1" {...SOLID} /><path d="M7 13.5q5 3.5 10 0" {...LINE} /></>
    case 'rabbit':
      return <><ellipse cx="9.5" cy="5" rx="2" ry="4.5" {...LINE} /><ellipse cx="14.5" cy="5" rx="2" ry="4.5" {...LINE} /><rect x="6" y="8" width="12" height="10" rx="5" {...LINE} />{eyesDots(9, 15, 13)}<path d="M11 14.5h2v1.5h-2Z" {...LINE} /><path d="M11 16.2v1h2v-1.4" {...LINE} /></>
    case 'lion':
      return <><circle cx="12" cy="12" r="9" {...LINE} /><circle cx="12" cy="12" r="5.5" {...LINE} /><circle cx="8" cy="7.5" r="1.5" {...LINE} /><circle cx="16" cy="7.5" r="1.5" {...LINE} />{eyesDots(10, 14, 11)}<path d="M10.6 13.5h2.8v2h-2.8Z" {...LINE} /></>
    case 'tiger':
      return <><path d="M6 4.5 8 2l1.5 2M18 4.5 16 2l-1.5 2" {...LINE} /><rect x="4.5" y="4.5" width="15" height="15" rx="5" {...LINE} /><path d="M12 4v2.5M9 5l.8 2.2M15 5l-.8 2.2" {...LINE} />{eyesDots(9.5, 14.5, 11.5)}<path d="M10.6 14h2.8v2h-2.8Z" {...LINE} /></>
    case 'hamster':
      return <>{<circle cx="7" cy="6.5" r="2" {...LINE} />}{<circle cx="17" cy="6.5" r="2" {...LINE} />}<rect x="4.5" y="6.5" width="15" height="12" rx="6" {...LINE} /><ellipse cx="8.5" cy="13.5" rx="2.2" ry="1.6" {...LINE} /><ellipse cx="15.5" cy="13.5" rx="2.2" ry="1.6" {...LINE} /><circle cx="9.5" cy="10" r="0.9" {...SOLID} /><circle cx="14.5" cy="10" r="0.9" {...SOLID} /><path d="M11 13h2v1.5h-2Z" {...LINE} /></>
    case 'koala':
      return <>{<circle cx="7" cy="6" r="3" {...LINE} />}{<circle cx="17" cy="6" r="3" {...LINE} />}<circle cx="7" cy="6" r="1" {...SOLID} /><circle cx="17" cy="6" r="1" {...SOLID} /><rect x="5.5" y="7" width="13" height="11" rx="5.5" {...LINE} />{eyesDots(9, 15, 11)}<ellipse cx="12" cy="13.5" rx="2" ry="2.6" {...SOLID} /></>
    default:
      return null
  }
}