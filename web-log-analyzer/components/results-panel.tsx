"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Download, Users, FileText, Clock, AlertTriangle, HardDrive, Network, Calendar, XCircle, BarChart3, Globe, TrendingUp } from "lucide-react"
import type { AnalysisResult } from "@/lib/types"

interface ResultsPanelProps {
  results: AnalysisResult
}

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM"
  if (hour === 12) return "12 PM"
  if (hour < 12) return `${hour} AM`
  return `${hour - 12} PM`
}

function formatHourShort(hour: number): string {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  if (hour < 12) return `${hour}a`
  return `${hour - 12}p`
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  const [isClient, setIsClient] = useState(false)
  const [formattedDate, setFormattedDate] = useState<string>("")

  useEffect(() => {
    setIsClient(true)
    setFormattedDate(new Date(results.timestamp).toLocaleString())
  }, [results.timestamp])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [headers.join(","), ...data.map((row) => headers.map((h) => `"${row[h]}"`).join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getPeakHour = () => {
    if (!results.analyses.hourlyTraffic) return null
    const sorted = [...results.analyses.hourlyTraffic].sort((a, b) => b.count - a.count)
    return sorted[0]
  }

  if (!isClient) {
    return (
      <div className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading results...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analysis Results</h2>
            <p className="text-sm text-muted-foreground">
              Processed {results.filteredRecords.toLocaleString()} records
              {formattedDate && ` at ${formattedDate}`}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Unique IPs */}
        {results.analyses.uniqueIps && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Unique IP Addresses</h3>
                  <p className="text-2xl font-bold text-primary">{results.analyses.uniqueIps.count.toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.uniqueIps!.topIps, "unique_ips")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-3">Top 10 IP Addresses</p>
              <div className="space-y-2">
                {results.analyses.uniqueIps.topIps.map(({ ip, count }, i) => (
                  <div key={ip} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <span className="font-mono text-sm text-foreground flex-1">{ip}</span>
                    <span className="text-sm text-muted-foreground">{count.toLocaleString()} requests</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top Pages */}
        {results.analyses.topPages && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <FileText className="w-4 h-4 text-success" />
                </div>
                <h3 className="font-semibold text-foreground">Top Pages</h3>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.topPages!, "top_pages")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">#</th>
                    <th className="px-4 py-2 text-left text-muted-foreground font-medium">Path</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-medium">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.analyses.topPages.slice(0, 10).map(({ path, count }, i) => (
                    <tr key={path} className="hover:bg-secondary/30">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{path}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Hourly Traffic */}
        {results.analyses.hourlyTraffic && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Hourly Traffic Distribution</h3>
                  <p className="text-sm text-muted-foreground">
                    Shows how many requests occurred during each hour of the day
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  downloadCSV(
                    results.analyses.hourlyTraffic!.map((h) => ({
                      hour: h.hour,
                      time: formatHour(h.hour),
                      requests: h.count,
                    })),
                    "hourly_traffic",
                  )
                }
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              {results.analyses.hourlyTraffic.reduce((sum, h) => sum + h.count, 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No valid timestamps found in the data.</p>
                  <p className="text-sm">Timestamps may not be in a recognized format.</p>
                </div>
              ) : (
                <React.Fragment>
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Requests</p>
                      <p className="text-xl font-bold text-foreground">
                        {results.analyses.hourlyTraffic.reduce((sum, h) => sum + h.count, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Peak Hour</p>
                      <p className="text-xl font-bold text-warning">
                        {getPeakHour() ? formatHour(getPeakHour()!.hour) : "-"}
                      </p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Peak Traffic</p>
                      <p className="text-xl font-bold text-foreground">
                        {getPeakHour() ? getPeakHour()!.count.toLocaleString() : "-"}
                      </p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg/Hour</p>
                      <p className="text-xl font-bold text-foreground">
                        {Math.round(
                          results.analyses.hourlyTraffic.reduce((sum, h) => sum + h.count, 0) / 24,
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Chart */}
                  <p className="text-xs text-muted-foreground mb-4">Traffic by hour (hover over bars for details)</p>
                  <div className="relative h-48 mb-2">
                    <div className="absolute inset-0 flex items-end gap-1">
                      {results.analyses.hourlyTraffic.map(({ hour, count }) => {
                        const maxCount = Math.max(...results.analyses.hourlyTraffic!.map((h) => h.count))
                        const chartHeight = 192
                        const barHeight =
                          maxCount > 0 ? Math.max((count / maxCount) * chartHeight, count > 0 ? 4 : 0) : 0
                        const isPeak = getPeakHour()?.hour === hour

                        return (
                          <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full group">
                            <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                              {count.toLocaleString()}
                            </span>
                            <div
                              className={`w-full rounded-t transition-all cursor-pointer ${
                                isPeak ? "bg-warning hover:bg-warning/80" : "bg-primary/60 hover:bg-primary"
                              }`}
                              style={{ height: `${barHeight}px` }}
                              title={`${formatHour(hour)}: ${count.toLocaleString()} requests`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {results.analyses.hourlyTraffic.map(({ hour }) => (
                      <div key={hour} className="flex-1 text-center">
                        <span className="text-xs text-muted-foreground">{formatHourShort(hour)}</span>
                      </div>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-primary/60" />
                      <span className="text-xs text-muted-foreground">Regular hours</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-warning" />
                      <span className="text-xs text-muted-foreground">Peak hour</span>
                    </div>
                  </div>
                </React.Fragment>
              )}
            </div>
          </div>
        )}

        {/* Status Codes */}
        {results.analyses.statusCodes && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <h3 className="font-semibold text-foreground">Status Code Distribution</h3>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.statusCodes!, "status_codes")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.analyses.statusCodes.map(({ status, count }) => {
                  const total = results.analyses.statusCodes!.reduce((sum, s) => sum + s.count, 0)
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0"
                  const colorClass =
                    status >= 200 && status < 300
                      ? "text-success"
                      : status >= 300 && status < 400
                        ? "text-primary"
                        : status >= 400 && status < 500
                          ? "text-warning"
                          : "text-destructive"

                  return (
                    <div key={status} className="p-3 bg-secondary/30 rounded-lg">
                      <p className={`text-2xl font-bold font-mono ${colorClass}`}>{status}</p>
                      <p className="text-sm text-muted-foreground">
                        {count.toLocaleString()} ({percentage}%)
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bandwidth */}
        {results.analyses.bandwidth && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <HardDrive className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Bandwidth Usage</h3>
                  <div className="flex gap-4 mt-1">
                    <p className="text-sm text-muted-foreground">
                      Total:{" "}
                      <span className="text-foreground font-medium">
                        {formatBytes(results.analyses.bandwidth.totalBytes)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Avg:{" "}
                      <span className="text-foreground font-medium">
                        {formatBytes(results.analyses.bandwidth.avgSize)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.bandwidth!.byPath, "bandwidth")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-3">Top 10 Paths by Bandwidth</p>
              <div className="space-y-2">
                {results.analyses.bandwidth.byPath.map(({ path, bytes }, i) => (
                  <div key={path} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                    <span className="font-mono text-sm text-foreground flex-1 truncate">{path}</span>
                    <span className="text-sm text-muted-foreground">{formatBytes(bytes)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HTTP Methods */}
        {results.analyses.httpMethods && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Network className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">HTTP Method Distribution</h3>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.httpMethods!, "http_methods")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {results.analyses.httpMethods.map(({ method, count }) => {
                  const total = results.analyses.httpMethods!.reduce((sum, m) => sum + m.count, 0)
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0"
                  return (
                    <div key={method} className="p-3 bg-secondary/30 rounded-lg">
                      <p className="text-xl font-bold font-mono text-foreground">{method}</p>
                      <p className="text-sm text-muted-foreground">
                        {count.toLocaleString()} ({percentage}%)
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Daily Traffic */}
        {results.analyses.dailyTraffic && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Calendar className="w-4 h-4 text-warning" />
                </div>
                <h3 className="font-semibold text-foreground">Daily Traffic Distribution</h3>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.dailyTraffic!, "daily_traffic")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {results.analyses.dailyTraffic.map(({ day, count }) => {
                  const maxCount = Math.max(...results.analyses.dailyTraffic!.map((d) => d.count))
                  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-24">{day}</span>
                      <div className="flex-1 bg-secondary/30 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-foreground w-20 text-right">{count.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Error Rate */}
        {results.analyses.errorRate && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Error Rate Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Client errors (4xx): {results.analyses.errorRate.clientErrorRate.toFixed(2)}% | Server errors (5xx): {results.analyses.errorRate.serverErrorRate.toFixed(2)}%
                  </p>
                </div>
              </div>
              <button
                onClick={() => downloadCSV(
                  [
                    { metric: 'Total Requests', value: results.analyses.errorRate!.totalRequests },
                    { metric: 'Client Errors', value: results.analyses.errorRate!.clientErrors },
                    { metric: 'Server Errors', value: results.analyses.errorRate!.serverErrors },
                    { metric: 'Success', value: results.analyses.errorRate!.success },
                    { metric: 'Redirects', value: results.analyses.errorRate!.redirects },
                    { metric: 'Client Error Rate (%)', value: results.analyses.errorRate!.clientErrorRate.toFixed(2) },
                    { metric: 'Server Error Rate (%)', value: results.analyses.errorRate!.serverErrorRate.toFixed(2) },
                    { metric: 'Success Rate (%)', value: results.analyses.errorRate!.successRate.toFixed(2) },
                  ],
                  "error_rate"
                )}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Total Requests</p>
                  <p className="text-xl font-bold text-foreground">{results.analyses.errorRate.totalRequests.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Client Errors (4xx)</p>
                  <p className="text-xl font-bold text-warning">{results.analyses.errorRate.clientErrors.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{results.analyses.errorRate.clientErrorRate.toFixed(2)}%</p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Server Errors (5xx)</p>
                  <p className="text-xl font-bold text-destructive">{results.analyses.errorRate.serverErrors.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{results.analyses.errorRate.serverErrorRate.toFixed(2)}%</p>
                </div>
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Success (2xx)</p>
                  <p className="text-xl font-bold text-success">{results.analyses.errorRate.success.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{results.analyses.errorRate.successRate.toFixed(2)}%</p>
                </div>
              </div>
              {results.analyses.errorRate.topErrors.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Top Error Status Codes</p>
                  <div className="space-y-2">
                    {results.analyses.errorRate.topErrors.map(({ status, count }, i) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                        <span className="font-mono text-sm text-destructive font-medium">{status}</span>
                        <span className="text-sm text-muted-foreground flex-1">{count.toLocaleString()} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Response Size */}
        {results.analyses.responseSize && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Response Size Distribution</h3>
              </div>
              <button
                onClick={() => downloadCSV(
                  [
                    { metric: 'Min', value: results.analyses.responseSize!.min },
                    { metric: 'Max', value: results.analyses.responseSize!.max },
                    { metric: 'Average', value: results.analyses.responseSize!.avg.toFixed(2) },
                    { metric: 'Median', value: results.analyses.responseSize!.median.toFixed(2) },
                    { metric: '95th Percentile', value: results.analyses.responseSize!.p95.toFixed(2) },
                    { metric: '99th Percentile', value: results.analyses.responseSize!.p99.toFixed(2) },
                  ],
                  "response_size_stats"
                )}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Min Size</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.min)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Max Size</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.max)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Average</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.avg)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Median</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.median)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">95th Percentile</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.p95)}</p>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">99th Percentile</p>
                  <p className="text-lg font-bold text-foreground">{formatBytes(results.analyses.responseSize.p99)}</p>
                </div>
              </div>
              {results.analyses.responseSize.distribution && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Size Distribution</p>
                  <div className="space-y-2">
                    {results.analyses.responseSize.distribution.map(({ range, count }) => {
                      const total = results.analyses.responseSize!.distribution.reduce((sum, d) => sum + d.count, 0)
                      const percentage = total > 0 ? (count / total) * 100 : 0
                      return (
                        <div key={range} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-24">{range}</span>
                          <div className="flex-1 bg-secondary/30 rounded-full h-6 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-foreground w-20 text-right">{count.toLocaleString()}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Protocol Version */}
        {results.analyses.protocolVersion && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">Protocol Version Analysis</h3>
              </div>
              <button
                onClick={() => downloadCSV(results.analyses.protocolVersion!, "protocol_version")}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {results.analyses.protocolVersion.map(({ protocol, count }) => {
                  const total = results.analyses.protocolVersion!.reduce((sum, p) => sum + p.count, 0)
                  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : "0"
                  return (
                    <div key={protocol} className="p-3 bg-secondary/30 rounded-lg">
                      <p className="text-lg font-bold font-mono text-foreground">{protocol}</p>
                      <p className="text-sm text-muted-foreground">
                        {count.toLocaleString()} ({percentage}%)
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Peak Traffic */}
        {results.analyses.peakTraffic && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <TrendingUp className="w-4 h-4 text-warning" />
                </div>
                <h3 className="font-semibold text-foreground">Peak Traffic Analysis</h3>
              </div>
              <button
                onClick={() => downloadCSV(
                  [
                    ...results.analyses.peakTraffic!.peakHours.map(h => ({ type: 'hour', value: h.hour, count: h.count })),
                    ...results.analyses.peakTraffic!.peakDays.map(d => ({ type: 'day', value: d.day, count: d.count })),
                  ],
                  "peak_traffic"
                )}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
            <div className="p-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Peak Hours</p>
                  <div className="space-y-2">
                    {results.analyses.peakTraffic.peakHours.map(({ hour, count }, i) => (
                      <div key={hour} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                        <span className="text-sm text-foreground">{formatHour(hour)}</span>
                        <span className="text-sm text-muted-foreground flex-1 text-right">{count.toLocaleString()} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Peak Days</p>
                  <div className="space-y-2">
                    {results.analyses.peakTraffic.peakDays.map(({ day, count }, i) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                        <span className="text-sm text-foreground">{day}</span>
                        <span className="text-sm text-muted-foreground flex-1 text-right">{count.toLocaleString()} requests</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
