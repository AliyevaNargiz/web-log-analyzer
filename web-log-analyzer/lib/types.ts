export interface ParsedLogEntry {
  ip: string
  timestamp: string | null
  method: string
  path: string
  protocol: string
  status: number
  size: number
  rawLine: string
}

export interface FilterState {
  dateRange: {
    start: string
    end: string
  }
  ipAddress: string
  urlPattern: string
  statusCodes: number[]
  httpMethods: string[]
  sizeRange: {
    min: string
    max: string
  }
}

export interface AnalysisResult {
  timestamp: string
  totalRecords: number
  filteredRecords: number
  analyses: {
    uniqueIps?: {
      count: number
      topIps: { ip: string; count: number }[]
    }
    topPages?: { path: string; count: number }[]
    hourlyTraffic?: { hour: number; count: number }[]
    statusCodes?: { status: number; count: number }[]
    bandwidth?: {
      totalBytes: number
      avgSize: number
      byPath: { path: string; bytes: number }[]
    }
    httpMethods?: { method: string; count: number }[]
    dailyTraffic?: { day: string; dayOfWeek: number; count: number }[]
    errorRate?: {
      totalRequests: number
      clientErrors: number
      serverErrors: number
      success: number
      redirects: number
      clientErrorRate: number
      serverErrorRate: number
      successRate: number
      topErrors: { status: number; count: number }[]
    }
    responseSize?: {
      min: number
      max: number
      avg: number
      median: number
      p95: number
      p99: number
      distribution: { range: string; count: number }[]
    }
    protocolVersion?: { protocol: string; count: number }[]
    peakTraffic?: {
      peakHours: { hour: number; count: number }[]
      peakDays: { day: string; dayOfWeek: number; count: number }[]
    }
  }
}

export interface HistoryItem {
  id: string
  timestamp: string
  filters: FilterState
  selectedAnalyses: string[]
  results: AnalysisResult
  recordCount: number
}
