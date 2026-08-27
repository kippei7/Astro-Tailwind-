"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeekPointRow = {
  week: string;
  [userId: string]: string | number;
};

export function PointsChart({
  data,
  users,
}: {
  data: WeekPointRow[];
  users: { id: string; name: string; color: string }[];
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6}>
          <CartesianGrid stroke="rgba(26,46,36,0.08)" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "#5c6b63", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#5c6b63", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(26,46,36,0.04)" }}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e6dfd2",
              background: "#fffaf3",
            }}
          />
          <Legend />
          {users.map((user) => (
            <Bar
              key={user.id}
              dataKey={user.id}
              name={user.name}
              fill={user.color}
              radius={[8, 8, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
