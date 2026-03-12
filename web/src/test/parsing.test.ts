import { describe, expect, it } from 'vitest'
import { parseSampleLine, statusMessageFromLine } from '../device/parsing.ts'

describe('sample parsing', () => {
  it('parses json and csv variants', () => {
    expect(parseSampleLine('{"t_ms":123,"f":[1,2,3,4]}', 999)).toEqual({
      tMs: 123,
      values: [1, 2, 3, 4],
    })

    expect(parseSampleLine('{"f":[5,6,7,8]}', 321)).toEqual({
      tMs: 321,
      values: [5, 6, 7, 8],
    })

    expect(parseSampleLine('500,10,20,30,40', 111)).toEqual({
      tMs: 500,
      values: [10, 20, 30, 40],
    })

    expect(parseSampleLine('10,20,30,40', 777)).toEqual({
      tMs: 777,
      values: [10, 20, 30, 40],
    })
  })

  it('detects status lines and ignores normal payloads', () => {
    expect(statusMessageFromLine('# boot ok')).toBe('boot ok')
    expect(statusMessageFromLine('ERR usage c <...>')).toBe('ERR usage c <...>')
    expect(statusMessageFromLine('ok 200')).toBe('ok 200')
    expect(statusMessageFromLine('random,data,1,2')).toBeNull()
  })
})
