# Data Warehouse Analytics UI

Frontend BI/OLAP demo built with React + Vite, using local dimension/fact JSON data.

## Tech Stack

- React 19
- Vite 8
- ECharts (`echarts-for-react`)
- React Router
- Local star-schema-like data (`src/data`)

## Run

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

## Routes

- `/` or `/dashboard`: Dashboard page
- `/sale`: Sales analytics page
- `/customer`: Not Found page (placeholder)
- `/inventory`: Not Found page (placeholder)

## Dashboard

- KPI cards: Revenue, Order Quantity, Inventory Quantity
- Time trend chart
- Product top chart
- Filters by time and location
- Uses `SoTienBanRa` as revenue measure

## Sales Analytics

- 3 charts:
  - Revenue by Time
  - Quantity by Time
  - Revenue by Product
- Context menu (right click):
  - Roll up / Drill down (time hierarchy)
  - Pivot / Unpivot
  - Open Slice & Dice panel
- Time hierarchy: Month -> Quarter -> Year
- Sales detail table keeps customer name (`TenKH`) and fact measures only
- Fact measures:
  - `SoLuong`
  - `SoTienBanRa`
  - `SoTienLai`
  - `SoLaiTrungBinh`

## Data Files

Main files currently used by pages:

- `src/data/dim_thoi_gian.json`
- `src/data/dim_dia_diem.json`
- `src/data/dim_cua_hang.json`
- `src/data/dim_khach_hang.json`
- `src/data/dim_mat_hang.json`
- `src/data/fact_ban_hang.json`
- `src/data/fact_ton_kho.json`

Additional dataset available:

- `src/data/fact_hanh_vi.json`
