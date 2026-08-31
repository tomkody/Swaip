import { describe, it, expect } from 'vitest'
import { accuracyLevel, formatAccuracy, accuracyBucket } from '../geo'

describe('accuracyLevel', () => {
  it('treats a normal GPS fix as good', () => {
    expect(accuracyLevel(12)).toBe('good')
    expect(accuracyLevel(250)).toBe('good')
  })
  it('flags a Wi-Fi-grade fix as rough', () => {
    expect(accuracyLevel(251)).toBe('rough')
    expect(accuracyLevel(1200)).toBe('rough')
  })
  it('flags a cell-tower fix as bad — distances would be meaningless', () => {
    expect(accuracyLevel(1201)).toBe('bad')
    expect(accuracyLevel(3400)).toBe('bad')
  })
})

describe('formatAccuracy', () => {
  it('uses metres below a kilometre and km above', () => {
    expect(formatAccuracy(25)).toBe('±25 m')
    expect(formatAccuracy(3400)).toBe('±3.4 km')
  })
})

describe('accuracyBucket', () => {
  it('buckets fixes for analytics without leaking a position', () => {
    expect(accuracyBucket(20)).toBe('0-50m')
    expect(accuracyBucket(200)).toBe('50-250m')
    expect(accuracyBucket(900)).toBe('250m-1km')
    expect(accuracyBucket(3000)).toBe('1-5km')
    expect(accuracyBucket(20000)).toBe('5km+')
    expect(accuracyBucket(null)).toBe('unknown')
  })
})
