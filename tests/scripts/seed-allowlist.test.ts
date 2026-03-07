/** @file
 * QA-05: seed-allowlist スクリプトの dry-run 検証テスト。
 * parseArgs のフラグ解析と、サンプル CSV の dry-run パース（DB 不要）を検証。
 */

import fs from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

import { parseAllowlistCsv } from '../../src/shared/lib/allowlist'
import { parseArgs } from '../../scripts/seed-allowlist'

// ── parseArgs ──

describe('parseArgs', () => {
  it('detects --dry-run flag', () => {
    const result = parseArgs(['node', 'script.ts', '--dry-run'])
    expect(result.dryRun).toBe(true)
  })

  it('defaults dryRun to false when flag is absent', () => {
    const result = parseArgs(['node', 'script.ts'])
    expect(result.dryRun).toBe(false)
  })

  it('extracts CSV path from args', () => {
    const result = parseArgs(['node', 'script.ts', '/tmp/data.csv'])
    expect(result.dryRun).toBe(false)
    expect(result.csvPath).toBe('/tmp/data.csv')
  })

  it('extracts CSV path alongside --dry-run', () => {
    const result = parseArgs(['node', 'script.ts', '--dry-run', '/tmp/data.csv'])
    expect(result.dryRun).toBe(true)
    expect(result.csvPath).toBe('/tmp/data.csv')
  })

  it('extracts CSV path when --dry-run comes after path', () => {
    const result = parseArgs(['node', 'script.ts', '/tmp/data.csv', '--dry-run'])
    expect(result.dryRun).toBe(true)
    expect(result.csvPath).toBe('/tmp/data.csv')
  })

  it('uses default CSV path when no path specified', () => {
    const result = parseArgs(['node', 'script.ts', '--dry-run'])
    expect(result.csvPath).toContain('allowlist.sample.csv')
  })
})

// ── dry-run パース（サンプル CSV） ──

describe('dry-run: sample CSV parsing', () => {
  const sampleCsvPath = path.join(__dirname, '..', '..', 'scripts', 'data', 'allowlist.sample.csv')

  it('sample CSV file exists', () => {
    expect(fs.existsSync(sampleCsvPath)).toBe(true)
  })

  it('parses sample CSV without errors', () => {
    const csvContent = fs.readFileSync(sampleCsvPath, 'utf-8')
    const records = parseAllowlistCsv(csvContent)
    expect(records.length).toBeGreaterThan(0)
  })

  it('parses all rows with correct fields', () => {
    const csvContent = fs.readFileSync(sampleCsvPath, 'utf-8')
    const records = parseAllowlistCsv(csvContent)

    // サンプル CSV は 3 行（student1, student2, revoked）
    expect(records).toHaveLength(3)

    // 各レコードに email が存在
    records.forEach((r) => {
      expect(r.email).toBeTruthy()
      expect(r.email).toContain('@')
    })

    // status の検証
    expect(records[0].status).toBe('active')
    expect(records[1].status).toBe('pending')
    expect(records[2].status).toBe('revoked')
  })

  it('normalizes emails to lowercase', () => {
    const csv = 'email,status\nTEST@EXAMPLE.COM,active\n'
    const records = parseAllowlistCsv(csv)
    expect(records[0].email).toBe('test@example.com')
  })

  it('rejects CSV with missing email column', () => {
    const csv = 'name,status\nAlice,active\n'
    expect(() => parseAllowlistCsv(csv)).toThrow('email')
  })

  it('rejects CSV with duplicate emails', () => {
    const csv = 'email,status\na@b.com,active\na@b.com,pending\n'
    expect(() => parseAllowlistCsv(csv)).toThrow('同じメール')
  })

  it('rejects empty CSV', () => {
    expect(() => parseAllowlistCsv('')).toThrow()
  })
})
