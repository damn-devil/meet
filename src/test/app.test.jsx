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
  api: {
    me: vi.fn(),
    tasks: vi.fn(),
    stats: vi.fn(),
    myRequests: vi.fn(),
  },
}))

import { api } from '../api.js'

const user = { id: 1, name: 'Аня', avatar: '🙂', bio: '', theme: 'light' }
const couple = {
  id: 1, invite_code: 'ABC123', radius_m: 150, window_min: 30, grace_min: 15,
  members: [user, { id: 2, name: 'Ваня', avatar: '🐶', bio: '', theme: 'light' }],
}
const task = {
  id: 1,
  couple_id: 1,
  title: 'Ужин в кафе',
  description: '',
  place_name: 'Кафе Москва',
  address: '',
  lat: 55.7558,
  lng: 37.6173,
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
})

describe('App', () => {
  it('shows tasks list after boot', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    expect(screen.getByRole('heading', { name: 'Планы' })).toBeInTheDocument()
  })

  it('shows task detail with map placeholder on click', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('Ужин в кафе')[0])
    await waitFor(() => expect(screen.getByText('Комментарии (0)')).toBeInTheDocument())
    expect(screen.getAllByText('Кафе Москва').length).toBeGreaterThan(0)
    expect(screen.getByText('Кто пришёл')).toBeInTheDocument()
  })

  it('navigates to map tab', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Карта'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Карта' })).toBeInTheDocument())
  })

  it('navigates to profile tab and shows couple info', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Аня').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Ваня').length).toBeGreaterThan(0)
  })
})
