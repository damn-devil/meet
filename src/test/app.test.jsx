import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'

vi.mock('../api.js', () => ({
  hasSession: () => Promise.resolve(true),
  getToken: () => Promise.resolve('test-token'),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  isRecoverySession: () => false,
  clearRecoverySession: vi.fn(),
  subscribeTasks: () => ({ subscribe: vi.fn() }),
  unsubscribeTasks: vi.fn(),
  subscribeRequests: () => ({ subscribe: vi.fn() }),
  unsubscribeRequests: vi.fn(),
  subscribeFreeDays: () => ({ subscribe: vi.fn() }),
  unsubscribeFreeDays: vi.fn(),
  api: {
    me: vi.fn(),
    tasks: vi.fn(),
    stats: vi.fn(),
    myRequests: vi.fn(),
    freeDays: vi.fn(() => Promise.resolve([])),
  },
}))

import { api } from '../api.js'

const user = { id: 1, name: 'Аня', avatar: '🙂', bio: '', accent: '' }
const couple = {
  id: 1, invite_code: 'ABC123',
  members: [user, { id: 2, name: 'Ваня', avatar: '🐶', bio: '', accent: '' }],
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
    expect(screen.getByRole('heading', { name: 'События' })).toBeInTheDocument()
  })

  it('shows task detail on click', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('Ужин в кафе')[0])
    await waitFor(() => expect(screen.getByText(/Выполнить/)).toBeInTheDocument())
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

  it('shows couple info on the profile tab', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Ваня').length).toBeGreaterThan(0))
  })

  it('has no chat and no comments in task detail', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getAllByText('Ужин в кафе')[0])
    await waitFor(() => expect(screen.getByText(/Выполнить/)).toBeInTheDocument())
    expect(screen.queryByText('Комментарии')).not.toBeInTheDocument()
    expect(screen.queryByText(/Не пришёл/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('‹'))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Ваня').length).toBeGreaterThan(0))
    expect(screen.queryByText('Чат')).not.toBeInTheDocument()
  })

  it('shows only auto/light/dark theme options in settings', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Аня').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Основные настройки'))
    await waitFor(() => expect(screen.getByText('Тема')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Авто' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Светлая' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Тёмная' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Полночь' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Роза' })).not.toBeInTheDocument()
  })

  it('shows username field in profile editing', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getAllByText('Ужин в кафе').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Профиль'))
    await waitFor(() => expect(screen.getAllByText('Аня').length).toBeGreaterThan(0))
    await userEvent.click(screen.getByText('Редактировать'))
    await waitFor(() => expect(screen.getByText('Юзернейм')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('@логин')).toBeInTheDocument()
  })
})
