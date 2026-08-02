import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

vi.mock('../api.js', () => ({
  hasSession: () => Promise.resolve(true),
  getToken: () => Promise.resolve('test-token'),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  subscribeTasks: () => ({ subscribe: vi.fn() }),
  unsubscribeTasks: vi.fn(),
  subscribeRequests: () => ({ subscribe: vi.fn() }),
  unsubscribeRequests: vi.fn(),
  subscribeMessages: () => ({ subscribe: vi.fn() }),
  unsubscribeMessages: vi.fn(),
  api: {
    me: vi.fn(),
    tasks: vi.fn(),
    stats: vi.fn(),
    myRequests: vi.fn(),
    getMessages: vi.fn(),
    markMissed: vi.fn(),
    sendMessage: vi.fn(),
  },
}))

import { api } from '../api.js'

const user = { id: 1, name: 'Аня', avatar: '🙂', bio: '', theme: 'light' }
const couple = {
  id: 1, invite_code: 'ABC123',
  members: [user, { id: 2, name: 'Ваня', avatar: '🐶', bio: '', theme: 'light' }],
}
const task = {
  id: 1,
  couple_id: 1,
  title: 'Ужин в кафе',
  description: '',
  scheduled_at: Date.now() + 3600_000,
  status: 'planned',
  created_by: 1,
  created_at: Date.now(),
  completed_at: null,
  updated_at: Date.now(),
  comments: [],
  checkins: [],
  agreements: [],
  ratings: [],
}

beforeEach(() => {
  api.me.mockResolvedValue({ user, couple })
  api.tasks.mockResolvedValue([task])
  api.stats.mockResolvedValue({ completed: 0, missed: 0, cancelled: 0, avgRating: null, hasActiveStreak: false })
  api.myRequests.mockResolvedValue([])
  api.getMessages.mockResolvedValue([])
})

describe('App', () => {
  it('shows tasks list after boot', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    expect(screen.getByRole('heading', { name: 'Планы' })).toBeInTheDocument()
  })

  it('shows task detail on click', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('Ужин в кафе')[0])
    await waitFor(() => expect(screen.getByText('Комментарии (0)')).toBeInTheDocument())
    expect(screen.getByText('Кто пришёл')).toBeInTheDocument()
  })

  it('has no map tab', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    expect(screen.queryByText('Карта')).not.toBeInTheDocument()
  })

  it('navigates to profile tab', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Аня').length).toBeGreaterThan(0))
  })

  it('shows couple info and chat on the couple tab', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Пара'))
    await waitFor(() => expect(screen.getAllByText('Ваня').length).toBeGreaterThan(0))
    expect(screen.getByText('Чат')).toBeInTheDocument()
  })

  it('sends a message in the couple chat', async () => {
    api.sendMessage.mockResolvedValue({ id: 99, user_id: 1, name: 'Аня', avatar: '🙂', text: 'Привет!', created_at: Date.now() })
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Пара'))
    await waitFor(() => expect(screen.getByText('Чат')).toBeInTheDocument())
    await userEvent.type(screen.getByPlaceholderText('Сообщение...'), 'Привет!')
    await userEvent.click(screen.getByText('➤'))
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith('Привет!'))
  })

  it('marks a plan as missed', async () => {
    api.markMissed.mockResolvedValue({ ...task, status: 'missed' })
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('Ужин в кафе')[0])
    await waitFor(() => expect(screen.getByText('Кто пришёл')).toBeInTheDocument())
    await userEvent.click(screen.getByText(/Не пришёл/))
    await userEvent.click(screen.getByText('Отметить пропущенным'))
    await waitFor(() => expect(api.markMissed).toHaveBeenCalledWith(1))
  })
})
