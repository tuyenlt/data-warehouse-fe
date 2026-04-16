# 🎨 Frontend Specification – BI Dashboard (React)

## 🧠 Overview

This document defines the **Frontend (FE)** requirements for building a **Business Intelligence (BI) Web Application**.

* The FE will consume APIs (to be implemented later)
* Focus is on:

  * UI structure
  * Components
  * State & interaction
  * OLAP visualization

---


## 📚 Additional Context

If more understanding about the system is needed, refer to:

* `docs/idb-schema.md` → describes the **Integrated Database (source system)**
* `docs/dw-schema.md` → describes the **Data Warehouse (analytics system)**

👉 These files provide:

* Data structure
* Relationships
* Business meaning of data

---


## 🏗️ Tech Stack

* React (Vite + JavaScripts)
* TailwindCSS
* ECharts


## 🧩 Core UI Components

### 1. Layout

* Sidebar (navigation)
* Header (title + filters)
* Main content (dashboard/reports)

---

### 2. Chart Components

Reusable components using ECharts:

* `BarChart`
* `LineChart`
* `PieChart`

Props:

```ts
{
  data: any
  loading?: boolean
  onClick?: (params) => void
}
```

---

### 3. Table Component

Reusable table:

* Display report data
* Support:

  * pagination (optional)
  * sorting (optional)
  * loading state

---

### 4. Filter Components

Use shadcn:

* Select (City, Product, Customer)
* Date picker (Time dimension)
* Input (threshold values)

---

## 📊 Pages

---

### 🏠 1. Dashboard Page

#### Purpose

High-level overview (aggregated data)

#### UI

* Cards (grid layout)
* Charts:

  * Sales over time (Line)
  * Inventory by store (Bar)
  * Customer distribution (Pie)

#### Features

* Global filters:

  * Time (Year / Month)
  * City
  * Product
* Chart click → drill-down

---

## 📋 2. Report Pages

Each requirement = 1 report page (or tab)

---

### 📌 Report 1: Store Inventory Detail

**UI:**

* Table

**Columns:**

* Store
* City
* State
* Phone
* Product
* Size
* Weight
* Price

**Filters:**

* City
* Store

---

### 📌 Report 2: Customer Orders

**UI:**

* Table

**Columns:**

* Customer Name
* Order Date

**Filters:**

* Customer
* Time

---

### 📌 Report 3: Stores by Customer

**UI:**

* Table

**Columns:**

* Store
* City
* Phone

**Filters:**

* Customer (required)

---

### 📌 Report 4: Offices with High Inventory

**UI:**

* Table

**Columns:**

* City
* State

**Filters:**

* Product
* Min Quantity (input)

---

### 📌 Report 5: Order Details + Store Info

**UI:**

* Table

**Columns:**

* Order ID
* Product
* Description
* Store
* City

---

### 📌 Report 6: Customer Location

**UI:**

* Card / Table

**Columns:**

* Customer
* City
* State

---

### 📌 Report 7: Inventory by City

**UI:**

* Bar Chart + Table

**Columns:**

* Store
* Quantity

**Filters:**

* Product
* City

---

### 📌 Report 8: Full Order Info

**UI:**

* Table

**Columns:**

* Product
* Quantity
* Customer
* Store
* City

---

### 📌 Report 9: Customer Types

**UI:**

* Pie Chart + Table

**Groups:**

* Tourist
* Postal
* Both

---

## 🔄 OLAP Interaction (Frontend)

### Drill-down

* Click chart → change level (Year → Month)

### Roll-up

* Back button / reset filter

### Slice

* Filter by 1 dimension

### Dice

* Filter by multiple dimensions

---

## ⚡ State Management

Use:

* React state (useState)
* Custom hooks:

  * `useFilters`
  * `useChartData`

---

## ⏳ Loading & UX

* Show skeleton when loading
* Disable UI when fetching
* Show empty state if no data

---

## 🎨 UI Guidelines

* Use Card (shadcn) for all blocks
* Grid layout (responsive)
* Consistent spacing
* Minimal colors (focus on data)

---

## 🚀 Expected Behavior

* UI must be **dynamic**
* Data-driven rendering
* Ready to integrate API later
* Components must be reusable

---

## 🎯 Goal

Build a **clean, modular BI frontend** that:

* Visualizes DW data
* Supports OLAP interaction
* Easy to extend when backend is ready

---
