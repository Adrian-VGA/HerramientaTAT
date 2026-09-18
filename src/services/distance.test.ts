import { describe, expect, it } from 'vitest'
import { distanceInMeters, formatDistance } from './distance'

describe('distanceInMeters', () => {
  it('returns zero for equal coordinates', () => {
    expect(distanceInMeters({ latitude: 7.9, longitude: -72.5 }, { latitude: 7.9, longitude: -72.5 })).toBe(0)
  })

  it('calculates a known short distance', () => {
    const value = distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 })
    expect(value).toBeGreaterThan(110)
    expect(value).toBeLessThan(112)
  })

  it('formats short and long distances', () => {
    expect(formatDistance(180)).toBe('180 m')
    expect(formatDistance(1520)).toBe('1.5 km')
  })
})
