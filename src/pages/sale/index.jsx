import ReactECharts from "echarts-for-react";

export default function Sale() {
  const chartOption = {
    title: {
      text: "Doanh Thu Bán Hàng",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Doanh Thu", "Số Đơn Hàng"],
      bottom: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"],
    },
    yAxis: [
      {
        type: "value",
        name: "Doanh Thu (Triệu đ)",
        axisLabel: {
          formatter: "{value}",
        },
      },
      {
        type: "value",
        name: "Số Đơn Hàng",
        position: "right",
      },
    ],
    series: [
      {
        name: "Doanh Thu",
        type: "bar",
        data: [320, 450, 380, 520, 610, 580, 690, 750, 820, 890, 950, 1020],
        itemStyle: {
          color: "#3b82f6",
        },
      },
      {
        name: "Số Đơn Hàng",
        type: "line",
        yAxisIndex: 1,
        data: [120, 145, 132, 165, 180, 175, 195, 210, 230, 250, 270, 290],
        stroke: "#ef4444",
      },
    ],
  };

  const topProducts = [
    { rank: 1, product: "Sản phẩm A", sales: 2500, revenue: "5.2B" },
    { rank: 2, product: "Sản phẩm B", sales: 1890, revenue: "3.8B" },
    { rank: 3, product: "Sản phẩm C", sales: 1650, revenue: "3.3B" },
    { rank: 4, product: "Sản phẩm D", sales: 1420, revenue: "2.9B" },
    { rank: 5, product: "Sản phẩm E", sales: 1200, revenue: "2.5B" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Quản Lý Bán Hàng</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Doanh Thu Tháng Này</div>
          <div className="text-3xl font-bold text-blue-600">8.9B đ</div>
          <div className="text-xs text-green-600 mt-2">↑ 15% so với tháng trước</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Số Đơn Hàng</div>
          <div className="text-3xl font-bold text-green-600">1,250</div>
          <div className="text-xs text-green-600 mt-2">↑ 18% so với tháng trước</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Giá Trị Trung Bình</div>
          <div className="text-3xl font-bold text-purple-600">7.1M đ</div>
          <div className="text-xs text-green-600 mt-2">↑ 5% so với tháng trước</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Tỷ Lệ Chuyển Đổi</div>
          <div className="text-3xl font-bold text-orange-600">3.2%</div>
          <div className="text-xs text-red-600 mt-2">↓ 2% so với tháng trước</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <ReactECharts option={chartOption} style={{ height: "400px" }} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Sản Phẩm Bán Chạy Nhất</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">Xếp Hạng</th>
              <th className="text-left py-2 px-2">Tên Sản Phẩm</th>
              <th className="text-left py-2 px-2">Số Lượng Bán</th>
              <th className="text-left py-2 px-2">Doanh Thu</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((row) => (
              <tr key={row.rank} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-bold ${
                    row.rank === 1 ? "bg-yellow-500" : row.rank === 2 ? "bg-gray-400" : row.rank === 3 ? "bg-orange-600" : "bg-gray-300"
                  }`}>
                    {row.rank}
                  </span>
                </td>
                <td className="py-2 px-2">{row.product}</td>
                <td className="py-2 px-2">{row.sales.toLocaleString()} cái</td>
                <td className="py-2 px-2 font-semibold text-green-600">{row.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
