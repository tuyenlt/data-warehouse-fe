import ReactECharts from "echarts-for-react";

export default function Inventory() {
  const chartOption = {
    title: {
      text: "Tồn Kho Theo Danh Mục",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
    },
    legend: {
      data: ["Tồn Kho Hiện Tại", "Mức Tối Thiểu"],
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
      data: ["Điện Tử", "Quần Áo", "Thực Phẩm", "Mỹ Phẩm", "Sách", "Đồ Chơi"],
    },
    yAxis: {
      type: "value",
      name: "Số Lượng (cái)",
    },
    series: [
      {
        name: "Tồn Kho Hiện Tại",
        type: "bar",
        data: [2500, 3200, 4100, 2800, 1900, 2200],
        itemStyle: {
          color: "#10b981",
        },
      },
      {
        name: "Mức Tối Thiểu",
        type: "bar",
        data: [1500, 1800, 2000, 1500, 1200, 1400],
        itemStyle: {
          color: "#f97316",
        },
      },
    ],
  };

  const inventoryData = [
    { id: 1, product: "Laptop Dell", quantity: 45, minLevel: 20, status: "Bình Thường" },
    { id: 2, product: "Chuột Logitech", quantity: 180, minLevel: 100, status: "Bình Thường" },
    { id: 3, product: "Bàn Phím Cơ", quantity: 25, minLevel: 50, status: "Cảnh Báo" },
    { id: 4, product: "Monitor LG", quantity: 8, minLevel: 15, status: "Nguy Hiểm" },
    { id: 5, product: "Headphone Sony", quantity: 120, minLevel: 50, status: "Bình Thường" },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "Bình Thường":
        return "bg-green-100 text-green-800";
      case "Cảnh Báo":
        return "bg-orange-100 text-orange-800";
      case "Nguy Hiểm":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Quản Lý Tồn Kho</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Tổng Tồn Kho</div>
          <div className="text-3xl font-bold text-blue-600">16,808</div>
          <div className="text-xs text-gray-600 mt-2">Tất cả danh mục</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Hàng Sắp Hết</div>
          <div className="text-3xl font-bold text-orange-600">3</div>
          <div className="text-xs text-orange-600 mt-2">Cần nhập hàng</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Hàng Nguy Hiểm</div>
          <div className="text-3xl font-bold text-red-600">1</div>
          <div className="text-xs text-red-600 mt-2">Nhập gấp</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Giá Trị Tồn Kho</div>
          <div className="text-3xl font-bold text-purple-600">2.5B đ</div>
          <div className="text-xs text-gray-600 mt-2">Theo giá gốc</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <ReactECharts option={chartOption} style={{ height: "400px" }} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Chi Tiết Tồn Kho Sản Phẩm</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">ID</th>
              <th className="text-left py-2 px-2">Tên Sản Phẩm</th>
              <th className="text-left py-2 px-2">Tồn Kho Hiện Tại</th>
              <th className="text-left py-2 px-2">Mức Tối Thiểu</th>
              <th className="text-left py-2 px-2">Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            {inventoryData.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-2">{row.id}</td>
                <td className="py-2 px-2">{row.product}</td>
                <td className="py-2 px-2 font-semibold">{row.quantity}</td>
                <td className="py-2 px-2">{row.minLevel}</td>
                <td className="py-2 px-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(row.status)}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
