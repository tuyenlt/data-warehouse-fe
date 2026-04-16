import ReactECharts from "echarts-for-react";

export default function Customer() {
  const chartOption = {
    title: {
      text: "Khách Hàng Theo Khu Vực",
      left: "center",
    },
    tooltip: {
      trigger: "item",
    },
    legend: {
      orient: "vertical",
      left: "left",
    },
    series: [
      {
        name: "Số Lượng Khách Hàng",
        type: "pie",
        radius: "50%",
        data: [
          { value: 1048, name: "Hà Nội" },
          { value: 735, name: "TP. Hồ Chí Minh" },
          { value: 580, name: "Đà Nẵng" },
          { value: 484, name: "Hải Phòng" },
          { value: 300, name: "Các tỉnh khác" },
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  };

  const tableData = [
    { id: 1, name: "Công ty ABC", email: "abc@example.com", phone: "0912345678", region: "Hà Nội" },
    { id: 2, name: "Cửa hàng XYZ", email: "xyz@example.com", phone: "0987654321", region: "TP. Hồ Chí Minh" },
    { id: 3, name: "Doanh nghiệp 123", email: "dn123@example.com", phone: "0911223344", region: "Đà Nẵng" },
    { id: 4, name: "Thương mại DEF", email: "def@example.com", phone: "0922334455", region: "Hải Phòng" },
    { id: 5, name: "Bán buôn GHI", email: "ghi@example.com", phone: "0933445566", region: "Cần Thơ" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Quản Lý Khách Hàng</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Tổng Khách Hàng</div>
          <div className="text-3xl font-bold text-blue-600">3,147</div>
          <div className="text-xs text-green-600 mt-2">↑ 12% so với tháng trước</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Khách Hàng Mới</div>
          <div className="text-3xl font-bold text-green-600">234</div>
          <div className="text-xs text-green-600 mt-2">↑ 8% so với tháng trước</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Khách Hàng Hoạt Động</div>
          <div className="text-3xl font-bold text-orange-600">2,890</div>
          <div className="text-xs text-orange-600 mt-2">↑ 5% so với tháng trước</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <ReactECharts option={chartOption} style={{ height: "400px" }} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Danh Sách Khách Hàng Gần Đây</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2">ID</th>
              <th className="text-left py-2 px-2">Tên Khách Hàng</th>
              <th className="text-left py-2 px-2">Email</th>
              <th className="text-left py-2 px-2">Điện Thoại</th>
              <th className="text-left py-2 px-2">Khu Vực</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-2">{row.id}</td>
                <td className="py-2 px-2">{row.name}</td>
                <td className="py-2 px-2">{row.email}</td>
                <td className="py-2 px-2">{row.phone}</td>
                <td className="py-2 px-2">{row.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
