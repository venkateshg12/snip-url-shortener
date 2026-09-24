"use client";

import type { UrlStatsDto } from "@repo/types";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount } from "@/lib/format";

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
// byDay dates are calendar days (YYYY-MM-DD); format them as such, without shifting time zones
const label = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

/** Straight segments: smoothing would invent clicks between days. Clicks (area, chart-1) and unique visitors (dashed line, chart-2): colour is never the only cue. */
export default function ClicksChart({ byDay }: { byDay: UrlStatsDto["byDay"] }) {
    return (
        <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                    <linearGradient id="clicksFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.22} />
                        <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                    dataKey="date"
                    tickFormatter={label}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
                />
                <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickCount={4}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 13 }}
                />
                <Tooltip
                    labelFormatter={(value) => label(String(value))}
                    formatter={(value, name) => [
                        formatCount(Number(value)),
                        name === "clicks" ? "Clicks" : "Unique visitors",
                    ]}
                    contentStyle={{
                        background: "var(--popover)",
                        border: "none",
                        borderRadius: 16,
                        boxShadow: "var(--elevation-popover)",
                        color: "var(--popover-foreground)",
                    }}
                    cursor={{ stroke: "var(--border)" }}
                />
                <Area
                    type="linear"
                    dataKey="clicks"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#clicksFill)"
                    isAnimationActive={false}
                />
                <Line
                    type="linear"
                    dataKey="uniques"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
