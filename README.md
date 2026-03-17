# 🤝 NGO Inventory Management System

A lightweight, real-time donation tracking and distribution system built for nonprofit organizations. Designed to be simple enough for any volunteer to use — no training required.

![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Cost](https://img.shields.io/badge/Hosting%20Cost-$0%2Fmonth-brightgreen)

---

## 📌 Problem Statement

Most small-to-medium NGOs manage their donation inventory manually — using paper logs, spreadsheets, or memory. This leads to:

- **No real-time visibility** into what's in stock
- **Hours of manual counting** for year-end reports
- **Lost or misplaced donations** between reception and distribution
- **No chain of custody** tracking for accountability
- **Inability to tell donors** exactly how their contributions were used

## 💡 Solution

A **free, web-based inventory management system** that tracks every donation from the moment it arrives at reception to the moment it's distributed to a family in need. Works on any device with a browser — phone, tablet, or computer.

---

## ✨ Features

### 📦 Donation Reception
- Simple form-based entry with dropdown menus (no typing errors)
- 7 broad categories: Clothing, Footwear, Toiletries, Household, Food, Monetary, Miscellaneous
- Auto-generated unique barcode IDs for every entry
- Printable barcode labels for physical tracking
- Urgent/Perishable flagging for time-sensitive items
- Separate flow for monetary donations (Cash, Check, Online Transfer)

### 🏷️ Inventory Management
- Full searchable and filterable inventory table
- Filter by category, status, donor, or barcode ID
- One-click status transitions: Received → In Storage → Distributed
- Auto-assigned storage locations
- Chain of custody tracking (scan at reception, scan at storage)

### 🚚 Distribution Tracking
- Barcode lookup for quick item retrieval
- Supports **partial distribution** (take 10 out of a batch of 200)
- Click-to-select from available inventory list
- Real-time stock decrement

### 📊 Live Dashboard
- Real-time stats: total received, in storage, distributed, monetary total
- Interactive bar chart — inventory breakdown by category
- Pie chart — status distribution (Received / In Storage / Distributed)
- Urgent items alert panel
- All charts update instantly as data changes

### 💰 Monetary Donations
- Dedicated tracking for cash, check, and online transfers
- Running total with transaction history
- Payment type breakdown pie chart
- Purpose/earmark tracking (General Fund, Winter Drive, etc.)

### 📋 Year-End Reports
- Auto-generated executive summary
- Key metrics: items received, distributed, in stock, distribution rate, unique donors
- Category breakdown: Received vs Distributed comparison chart
- Unusable items transparency reporting
- Ready for board presentations and donor reporting

### 🔄 Real-Time Multi-Device Sync
- Powered by Supabase Realtime subscriptions
- Volunteer A adds a donation on the reception tablet → Volunteer B sees it instantly on the basement computer
- No refresh needed — data streams live

---

## 🛠️ Tech Stack

| Technology | Purpose | Cost |
|------------|---------|------|
| **React 18** | Frontend UI framework | Free |
| **Supabase** | PostgreSQL database + Realtime sync | Free tier |
| **Recharts** | Interactive charts and data visualization | Free |
| **Vercel** | Hosting and auto-deployment | Free tier |
| **GitHub** | Version control and code storage | Free |

**Total monthly cost: $0**

---

## 📁 Project Structure

```
ngo-inventory/
├── public/
│   └── index.html
├── src/
│   ├── App.js               # Main application (all components)
│   ├── supabaseClient.js     # Supabase connection configuration
│   └── index.js              # React entry point
├── .env.local                # Environment variables (API keys)
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)
- A free [Supabase](https://supabase.com/) account
- A free [Vercel](https://vercel.com/) account (for deployment)

### 1. Clone the Repository

```bash
git clone https://github.com/singhvansh1203/ngo-inventory.git
cd ngo-inventory
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase Database

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New Query**
3. Run the following SQL:

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL DEFAULT 'New',
  donor TEXT NOT NULL DEFAULT 'Anonymous',
  status TEXT NOT NULL DEFAULT 'Received',
  date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  urgent BOOLEAN DEFAULT FALSE,
  location TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE monetary (
  id TEXT PRIMARY KEY,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL,
  donor TEXT NOT NULL DEFAULT 'Anonymous',
  date TEXT NOT NULL,
  purpose TEXT DEFAULT 'General Fund',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on items" ON items
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on monetary" ON monetary
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE monetary;
```

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Find these values in Supabase: **Settings** → **API**

### 5. Run Locally

```bash
npm start
```

The app will open at `http://localhost:3000`

### 6. Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Add the environment variables (`REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`)
4. Click **Deploy**

Your app will be live in ~2 minutes.

---

## 📊 System Flow

```
Donor arrives at Reception
        ↓
Volunteer fills simple web form (any device)
        ↓
System auto-generates barcode ID
        ↓
Label printed → attached to donation box
        ↓
Item moves to Basement Storage
        ↓
Storage volunteer scans → confirms receipt → assigns shelf location
        ↓
Distribution volunteer scans → marks as "Distributed"
        ↓
All data logged in real-time → Dashboard updates instantly
        ↓
Year-end report auto-generates with full statistics
```

---

## 📦 Donation Categories

| Code | Category      | Subcategories                                    |
|------|---------------|--------------------------------------------------|
| CLO  | Clothing      | Men's, Women's, Children's, Winter Wear          |
| FOO  | Footwear      | Men's, Women's, Children's                       |
| TOI  | Toiletries    | Hygiene Kits, Soap/Shampoo, Dental, Feminine     |
| HOU  | Household     | Bedding, Kitchenware, Cleaning Supplies           |
| FOD  | Food          | Canned, Dry Goods, Perishable                    |
| MON  | Monetary      | Cash, Check, Online Transfer                     |
| MIS  | Miscellaneous | Books, Toys, Electronics, Other                  |

---

## 🔒 Security Notes

- Supabase Row Level Security (RLS) is enabled on all tables
- The `anon` key is designed to be client-facing (safe to expose)
- For production use with sensitive donor data, consider adding authentication via Supabase Auth
- Database is backed up automatically by Supabase

---

## 🔮 Future Enhancements

- [ ] User authentication (volunteer login system)
- [ ] Physical barcode scanner integration via device camera
- [ ] Export reports as PDF
- [ ] Email notifications for low stock / urgent items
- [ ] Donor portal (donors can see how their contribution was used)
- [ ] Multi-language support
- [ ] SMS alerts for distribution teams
- [ ] Analytics dashboard with trends over time

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve this system:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — free to use, modify, and distribute.

---

## 👤 Author

**Vansh Singh**
- Master of Science in Engineering Management — Northeastern University
- Bachelor of Engineering in Mechanical Engineering — VIT

---

## 🙏 Acknowledgments

- Built to support nonprofit organizations in managing their donation operations efficiently
- Inspired by the real operational challenges faced by NGOs handling physical and monetary donations
- Designed with volunteer-friendliness as the #1 priority
