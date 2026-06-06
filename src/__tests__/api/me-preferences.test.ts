jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userRole: {
      findUnique: jest.fn(),
    },
    userPreference: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { GET, PATCH } from '@/app/api/me/preferences/route'

const mockCreateClient = createClient as jest.Mock

const FULL_SELECT = {
  showActualsAsNegative: true,
  reportBvaProjectId: true,
  reportBvaShowDetail: true,
  reportFsProjectId: true,
  reportFsFundingSourceId: true,
}

const DEFAULT_PREF = {
  showActualsAsNegative: true,
  reportBvaProjectId: null,
  reportBvaShowDetail: false,
  reportFsProjectId: null,
  reportFsFundingSourceId: null,
}

function mockSession(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // Default role mock to avoid auth failures
  ;(prisma.userRole.findUnique as jest.Mock).mockResolvedValue({ role: 'editor' })
})

describe('GET /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('upserts default row and returns the full preference object on first call', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(DEFAULT_PREF)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(DEFAULT_PREF)
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: true },
      update: {},
      select: FULL_SELECT,
    })
  })

  it('returns existing preference (all fields) when row already exists', async () => {
    mockSession({ id: 'user-2' })
    const existing = {
      showActualsAsNegative: false,
      reportBvaProjectId: 'proj-1',
      reportBvaShowDetail: true,
      reportFsProjectId: 'proj-2',
      reportFsFundingSourceId: 'fs-9',
    }
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(existing)
    const res = await GET()
    const body = await res.json()
    expect(body).toEqual(existing)
  })
})

describe('PATCH /api/me/preferences', () => {
  it('returns 401 when unauthenticated', async () => {
    mockSession(null)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 on unparseable JSON body', async () => {
    mockSession({ id: 'user-1' })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: 'not json',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    expect(prisma.userPreference.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when body is not an object', async () => {
    mockSession({ id: 'user-1' })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify(null),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    expect(prisma.userPreference.upsert).not.toHaveBeenCalled()
  })

  it('persists showActualsAsNegative: false and returns the full object', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      ...DEFAULT_PREF,
      showActualsAsNegative: false,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ...DEFAULT_PREF, showActualsAsNegative: false })
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', showActualsAsNegative: false },
      update: { showActualsAsNegative: false },
      select: FULL_SELECT,
    })
  })

  it('persists showActualsAsNegative: true', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(DEFAULT_PREF)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ showActualsAsNegative: true }),
    })
    const res = await PATCH(req)
    const body = await res.json()
    expect(body).toEqual(DEFAULT_PREF)
  })

  it('persists budget-vs-actual report selections (partial update)', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      ...DEFAULT_PREF,
      reportBvaProjectId: 'proj-1',
      reportBvaShowDetail: true,
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ reportBvaProjectId: 'proj-1', reportBvaShowDetail: true }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reportBvaProjectId).toBe('proj-1')
    expect(body.reportBvaShowDetail).toBe(true)
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', reportBvaProjectId: 'proj-1', reportBvaShowDetail: true },
      update: { reportBvaProjectId: 'proj-1', reportBvaShowDetail: true },
      select: FULL_SELECT,
    })
  })

  it('persists funding-source report selections (partial update)', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue({
      ...DEFAULT_PREF,
      reportFsProjectId: 'proj-2',
      reportFsFundingSourceId: 'fs-7',
    })
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ reportFsProjectId: 'proj-2', reportFsFundingSourceId: 'fs-7' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reportFsProjectId).toBe('proj-2')
    expect(body.reportFsFundingSourceId).toBe('fs-7')
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', reportFsProjectId: 'proj-2', reportFsFundingSourceId: 'fs-7' },
      update: { reportFsProjectId: 'proj-2', reportFsFundingSourceId: 'fs-7' },
      select: FULL_SELECT,
    })
  })

  it('only updates the keys provided in the body', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(DEFAULT_PREF)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ reportFsFundingSourceId: 'fs-1' }),
    })
    await PATCH(req)
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', reportFsFundingSourceId: 'fs-1' },
      update: { reportFsFundingSourceId: 'fs-1' },
      select: FULL_SELECT,
    })
  })

  it('accepts null to clear a saved selection', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(DEFAULT_PREF)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ reportBvaProjectId: null }),
    })
    await PATCH(req)
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', reportBvaProjectId: null },
      update: { reportBvaProjectId: null },
      select: FULL_SELECT,
    })
  })

  it('ignores unknown and wrongly-typed keys', async () => {
    mockSession({ id: 'user-1' })
    ;(prisma.userPreference.upsert as jest.Mock).mockResolvedValue(DEFAULT_PREF)
    const req = new Request('http://localhost/api/me/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        bogus: 'nope',
        showActualsAsNegative: 'not-a-boolean',
        reportBvaShowDetail: 123,
        reportBvaProjectId: 'proj-keep',
      }),
    })
    await PATCH(req)
    expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', reportBvaProjectId: 'proj-keep' },
      update: { reportBvaProjectId: 'proj-keep' },
      select: FULL_SELECT,
    })
  })
})
