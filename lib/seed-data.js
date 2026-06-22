// Seed data for ONEMISSION HQ
import { v4 as uuid } from 'uuid';

export const SEED_USERS = [
  { id: uuid(), email: 'admin@onemission.id', password: 'admin', name: 'Yusuf Akbar', role: 'Super Admin', avatar: 'YA' },
  { id: uuid(), email: 'finance@onemission.id', password: 'finance', name: 'Aisyah Rahmadani', role: 'Finance', avatar: 'AR' },
  { id: uuid(), email: 'content@onemission.id', password: 'content', name: 'Bilal Hakim', role: 'Content Team', avatar: 'BH' },
  { id: uuid(), email: 'ops@onemission.id', password: 'ops', name: 'Hafidz Maulana', role: 'Operations', avatar: 'HM' },
  { id: uuid(), email: 'manager@onemission.id', password: 'manager', name: 'Khadijah Salsabila', role: 'Admin', avatar: 'KS' },
];

export const SEED_PRODUCTS = [
  { id: uuid(), name: 'OneClaw Two-In-One Shorts', sku: 'OM-2N1-001', category: 'Two-In-One Shorts', brand: 'OneClaw', status: 'Active', costPrice: 95000, sellingPrice: 249000, description: 'Premium dual-layer training shorts with built-in compression liner. Designed for Muslim athletes.', tags: ['training','muslim','athletic'], colors: ['Black','Dark Grey','Navy'], sizes: ['S','M','L','XL','XXL'], notes: 'Best seller Q1 2026.' },
  { id: uuid(), name: 'OneClaw Compression Pants Pro', sku: 'OM-CP-002', category: 'Compression Pants', brand: 'OneClaw', status: 'Active', costPrice: 110000, sellingPrice: 289000, description: 'Full-length compression pants engineered for performance and modesty.', tags: ['compression','full-length'], colors: ['Black','Dark Grey'], sizes: ['S','M','L','XL','XXL'], notes: '' },
  { id: uuid(), name: 'ONEMISSION Athletic Jersey', sku: 'OM-JS-003', category: 'Jerseys', brand: 'ONEMISSION', status: 'Active', costPrice: 75000, sellingPrice: 199000, description: 'Lightweight breathable jersey with the ONEMISSION crest.', tags: ['jersey','breathable'], colors: ['Black','White','Olive'], sizes: ['S','M','L','XL','XXL'], notes: '' },
  { id: uuid(), name: 'OneGoal Training Jacket', sku: 'OM-JK-004', category: 'Jackets', brand: 'ONEMISSION', status: 'Active', costPrice: 165000, sellingPrice: 399000, description: 'Premium training jacket with thumb holes and reflective trim.', tags: ['outerwear','training'], colors: ['Black','Dark Grey'], sizes: ['S','M','L','XL','XXL'], notes: '' },
  { id: uuid(), name: 'ONEMISSION Performance Cap', sku: 'OM-AC-005', category: 'Accessories', brand: 'ONEMISSION', status: 'Active', costPrice: 35000, sellingPrice: 99000, description: 'Lightweight performance cap.', tags: ['cap','accessory'], colors: ['Black','White'], sizes: ['One Size'], notes: '' },
  { id: uuid(), name: 'OneClaw Two-In-One Shorts V2', sku: 'OM-2N1-006', category: 'Two-In-One Shorts', brand: 'OneClaw', status: 'Draft', costPrice: 105000, sellingPrice: 279000, description: 'V2 with improved liner and 4-way stretch.', tags: ['v2','training'], colors: ['Black','Olive','Burgundy'], sizes: ['S','M','L','XL','XXL'], notes: 'Launching Q2 2026.' },
];

export const SEED_INVENTORY = (productIds) => {
  const rows = [];
  const colors = ['Black','Dark Grey','Navy','White','Olive','Burgundy'];
  const sizes = ['S','M','L','XL','XXL'];
  productIds.forEach(pid => {
    colors.slice(0, 3).forEach(c => {
      sizes.forEach(s => {
        rows.push({ id: uuid(), productId: pid, color: c, size: s, quantity: Math.floor(Math.random()*120)+5, threshold: 15, incoming: Math.floor(Math.random()*30) });
      });
    });
  });
  return rows;
};

export const SEED_PLANS = [
  { id: uuid(), level: 'Quarterly', title: 'Q1 2026 — Launch OneClaw V2 Globally', objective: 'Position OneClaw as the #1 Muslim athletic brand in SEA', progress: 65, status: 'In Progress', owner: 'Yusuf Akbar', dueDate: '2026-03-31', notes: '', keyResults: ['Sell 5,000 V2 units','Onboard 25 creators','Reach 100K IG followers'], actionItems: ['Finalize prototype','Photoshoot with creators','Launch campaign'] },
  { id: uuid(), level: 'Monthly', title: 'June 2026 — Content Engine Ramp', objective: 'Triple weekly content output', progress: 40, status: 'In Progress', owner: 'Bilal Hakim', dueDate: '2026-06-30', notes: '', keyResults: ['20 reels/week','5 long-form/week','3 creator collabs'], actionItems: ['Hire 1 editor','Build content calendar','Brief 10 creators'] },
  { id: uuid(), level: 'Annual', title: '2026 — Foundation Year', objective: 'Build the operational backbone of ONEMISSION', progress: 30, status: 'In Progress', owner: 'Yusuf Akbar', dueDate: '2026-12-31', notes: '', keyResults: ['IDR 5B revenue','100 schools partnered','Warehouse operational'], actionItems: ['Hire ops lead','Setup HQ','Run One Goal Regional'] },
  { id: uuid(), level: 'Six-Month', title: 'H2 2026 — Regional Expansion', objective: 'Expand beyond Jabodetabek', progress: 15, status: 'Planned', owner: 'Khadijah Salsabila', dueDate: '2026-12-31', notes: '', keyResults: ['Open 3 regional events','Partner 50 schools outside Jakarta'], actionItems: ['Market research','Local ambassadors'] },
];

export const SEED_CONTENT = [
  { id: uuid(), title: 'OneClaw V2 Teaser Reel', platform: 'Instagram', format: 'Reel', caption: 'Built for the modest athlete. Drop coming soon. 🏋️', objective: 'Awareness', cta: 'Follow', owner: 'Bilal Hakim', deadline: '2026-06-12', status: 'Editing' },
  { id: uuid(), title: 'Behind the Scenes — Photoshoot', platform: 'TikTok', format: 'Short Video', caption: 'BTS of our latest shoot with Brother Yusuf.', objective: 'Engagement', cta: 'Like & Share', owner: 'Bilal Hakim', deadline: '2026-06-15', status: 'Shooting' },
  { id: uuid(), title: 'Founder Story — Why ONEMISSION', platform: 'YouTube', format: 'Long Form', caption: 'The full story behind ONEMISSION.', objective: 'Brand', cta: 'Subscribe', owner: 'Yusuf Akbar', deadline: '2026-06-22', status: 'Draft' },
  { id: uuid(), title: 'Quick Tip: Halal Training Wear', platform: 'Threads', format: 'Thread', caption: '3 things to look for in modest athletic wear...', objective: 'Education', cta: 'Reply', owner: 'Bilal Hakim', deadline: '2026-06-10', status: 'Scheduled' },
  { id: uuid(), title: 'One Goal Highlights — Bandung', platform: 'Instagram', format: 'Carousel', caption: 'Top moments from One Goal Bandung 2026.', objective: 'Community', cta: 'Save', owner: 'Khadijah Salsabila', deadline: '2026-06-08', status: 'Published' },
  { id: uuid(), title: 'V2 Drop Announcement', platform: 'Instagram', format: 'Post', caption: 'The wait is over. OneClaw V2 drops July 1.', objective: 'Sales', cta: 'Shop Now', owner: 'Bilal Hakim', deadline: '2026-06-28', status: 'Idea' },
];

export const SEED_CREATORS = [
  { id: uuid(), name: 'Ahmad Fauzan', username: '@ahmadfauzan', platform: 'Instagram', followers: 245000, engagement: 4.8, niche: 'Athletic & Lifestyle', audienceFit: 92, valuesScore: 95, contact: 'ahmad@email.com', fee: 12000000, status: 'Negotiation', notes: 'Strong Islamic values, fits brand DNA.' },
  { id: uuid(), name: 'Sister Hana Athlete', username: '@hana.runs', platform: 'TikTok', followers: 180000, engagement: 6.2, niche: 'Female Athletics (Modest)', audienceFit: 98, valuesScore: 99, contact: 'hana@email.com', fee: 8000000, status: 'Deal', notes: 'Ideal partner for women line.' },
  { id: uuid(), name: 'Bilal Coach', username: '@coach.bilal', platform: 'YouTube', followers: 95000, engagement: 5.1, niche: 'Strength Training', audienceFit: 88, valuesScore: 90, contact: 'bilal.coach@email.com', fee: 15000000, status: 'DM Sent', notes: '' },
  { id: uuid(), name: 'Umar Performance', username: '@umar.perf', platform: 'Instagram', followers: 410000, engagement: 3.2, niche: 'Football', audienceFit: 75, valuesScore: 82, contact: 'umar@email.com', fee: 25000000, status: 'Not Contacted', notes: '' },
  { id: uuid(), name: 'Aisha Yoga', username: '@aisha.flow', platform: 'Instagram', followers: 62000, engagement: 7.4, niche: 'Modest Wellness', audienceFit: 90, valuesScore: 96, contact: 'aisha@email.com', fee: 5000000, status: 'Completed', notes: 'Past collab very successful.' },
];

export const SEED_SCHOOLS = [
  { id: uuid(), name: 'SMA Al-Azhar Jakarta', city: 'Jakarta', province: 'DKI Jakarta', contactPerson: 'Ustaz Hamzah', phone: '+62 812 3456 7890', email: 'hamzah@alazhar.sch.id', segment: 'Premium Islamic School', value: 75000000, status: 'Negotiation', notes: '500 students, sport program active.' },
  { id: uuid(), name: 'Pesantren Daarul Hikmah', city: 'Bogor', province: 'Jawa Barat', contactPerson: 'KH. Abdullah', phone: '+62 813 1111 2222', email: 'abdullah@daarulhikmah.id', segment: 'Pesantren', value: 45000000, status: 'Meeting', notes: '' },
  { id: uuid(), name: 'SMP Insan Cendekia', city: 'Tangerang', province: 'Banten', contactPerson: 'Ibu Fatimah', phone: '+62 815 9999 0000', email: 'fatimah@ic.sch.id', segment: 'Modern Islamic', value: 30000000, status: 'Deal', notes: 'Signed pilot.' },
  { id: uuid(), name: 'SMA Islam Al-Hikmah', city: 'Bandung', province: 'Jawa Barat', contactPerson: 'Pak Yusuf', phone: '+62 811 5555 1234', email: 'yusuf@alhikmah.id', segment: 'Premium Islamic School', value: 50000000, status: 'Contacted', notes: '' },
  { id: uuid(), name: 'Pondok Modern Gontor 2', city: 'Ponorogo', province: 'Jawa Timur', contactPerson: 'Ustaz Hasan', phone: '+62 817 8888 7777', email: 'hasan@gontor.ac.id', segment: 'Pondok Modern', value: 120000000, status: 'Prospect', notes: 'High potential.' },
];

export const SEED_TIMELINE = [
  { id: uuid(), year: 2026, name: 'Finalize ONEMISSION Website', description: 'Launch revamped main site with full e-commerce.', startDate: '2026-01-15', endDate: '2026-03-30', owner: 'Yusuf Akbar', status: 'In Progress', priority: 'Critical', budget: 150000000 },
  { id: uuid(), year: 2026, name: 'Launch OneClaw V2', description: 'Global launch of the V2 product line.', startDate: '2026-04-01', endDate: '2026-07-31', owner: 'Khadijah Salsabila', status: 'Planned', priority: 'High', budget: 500000000 },
  { id: uuid(), year: 2026, name: 'One Goal Regional', description: 'Regional sport-da\'wah events.', startDate: '2026-06-01', endDate: '2026-11-30', owner: 'Hafidz Maulana', status: 'Planned', priority: 'High', budget: 350000000 },
  { id: uuid(), year: 2026, name: 'Reach 100 Schools', description: 'Partnership pipeline with 100 Islamic schools.', startDate: '2026-02-01', endDate: '2026-12-31', owner: 'Khadijah Salsabila', status: 'In Progress', priority: 'Medium', budget: 200000000 },
  { id: uuid(), year: 2027, name: 'National Expansion', description: 'Expand to 10 major Indonesian cities.', startDate: '2027-01-01', endDate: '2027-12-31', owner: 'Yusuf Akbar', status: 'Planned', priority: 'Critical', budget: 1200000000 },
  { id: uuid(), year: 2027, name: 'Build Warehouse', description: 'Operational HQ + fulfillment.', startDate: '2027-03-01', endDate: '2027-08-31', owner: 'Hafidz Maulana', status: 'Planned', priority: 'High', budget: 800000000 },
  { id: uuid(), year: 2027, name: 'Expand Team', description: 'Hire 25 team members.', startDate: '2027-01-01', endDate: '2027-09-30', owner: 'Aisyah Rahmadani', status: 'Planned', priority: 'Medium', budget: 400000000 },
  { id: uuid(), year: 2028, name: 'Southeast Asia Expansion', description: 'Malaysia, Brunei, Singapore.', startDate: '2028-01-01', endDate: '2028-12-31', owner: 'Yusuf Akbar', status: 'Planned', priority: 'Critical', budget: 2500000000 },
  { id: uuid(), year: 2028, name: 'Global Muslim Athlete Partnerships', description: 'Top-tier Muslim athletes worldwide.', startDate: '2028-02-01', endDate: '2028-11-30', owner: 'Bilal Hakim', status: 'Planned', priority: 'High', budget: 1500000000 },
  { id: uuid(), year: 2028, name: 'International Campaign Preparation', description: 'Build international media engine.', startDate: '2028-06-01', endDate: '2028-12-31', owner: 'Bilal Hakim', status: 'Planned', priority: 'Medium', budget: 800000000 },
];

export const SEED_FINANCE = (() => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months.map((m, i) => {
    const base = 250 + i * 35 + Math.random()*40;
    const rev = Math.round(base * 1_000_000);
    const exp = Math.round(rev * (0.55 + Math.random()*0.1));
    return { id: uuid(), month: m, year: 2026, revenue: rev, expenses: exp, profit: rev - exp, cashflow: rev - exp + Math.round(Math.random()*50_000_000), categoryBreakdown: { Production: Math.round(exp*0.35), Marketing: Math.round(exp*0.2), Payroll: Math.round(exp*0.25), Events: Math.round(exp*0.08), Operations: Math.round(exp*0.05), Inventory: Math.round(exp*0.05), Miscellaneous: Math.round(exp*0.02) } };
  });
})();

export const SEED_EVENTS = [
  { id: uuid(), name: 'One Goal Jakarta 2026', venue: 'GBK Senayan', date: '2026-08-15', budget: 250000000, sponsors: ['OneClaw','Halal Eats','Kopi Kenangan'], participants: 500, status: 'Planning', checklist: [{ task: 'Book venue', done: true },{ task: 'Confirm sponsors', done: true },{ task: 'Print merchandise', done: false },{ task: 'Marketing campaign', done: false }] },
  { id: uuid(), name: 'One Goal Bandung 2026', venue: 'Sport Jabar Arcamanik', date: '2026-09-20', budget: 180000000, sponsors: ['OneClaw','Sayurbox'], participants: 300, status: 'Planning', checklist: [{ task: 'Book venue', done: true },{ task: 'Recruit volunteers', done: false }] },
  { id: uuid(), name: 'One Goal Surabaya 2026', venue: 'GOR ITS', date: '2026-10-12', budget: 200000000, sponsors: ['OneClaw'], participants: 350, status: 'Planning', checklist: [{ task: 'Site visit', done: false }] },
];

export const SEED_NOTIFICATIONS = [
  { id: uuid(), type: 'Low Stock', title: 'Critical stock: OneClaw V2 Black / M', message: 'Only 4 units remaining (threshold 15).', createdAt: new Date().toISOString(), read: false, severity: 'critical' },
  { id: uuid(), type: 'Deadline', title: 'Content deadline tomorrow', message: '\'V2 Drop Announcement\' is due 2026-06-28.', createdAt: new Date().toISOString(), read: false, severity: 'warning' },
  { id: uuid(), type: 'Creator', title: 'New deal closed', message: 'Sister Hana Athlete moved to Deal stage.', createdAt: new Date().toISOString(), read: false, severity: 'info' },
  { id: uuid(), type: 'School', title: 'New school in negotiation', message: 'SMA Al-Azhar Jakarta moved to Negotiation.', createdAt: new Date().toISOString(), read: true, severity: 'info' },
  { id: uuid(), type: 'Finance', title: 'Monthly revenue exceeded target', message: 'May 2026 revenue is 112% of target.', createdAt: new Date().toISOString(), read: true, severity: 'success' },
];

// ── Financial Account seed data ──────────────────────────────────────────────
export const SEED_FINANCIAL_ACCOUNTS = [
  { id: uuid(), name: 'Cash',         type: 'Cash', isActive: true },
  { id: uuid(), name: 'Bank BCA',     type: 'Bank', isActive: true },
  { id: uuid(), name: 'Bank Mandiri', type: 'Bank', isActive: true },
];

// ── Chart of Accounts seed data ──────────────────────────────────────────────
export const SEED_COA = (() => {
  const parentIds = {
    asset:     uuid(),
    liability: uuid(),
    equity:    uuid(),
    revenue:   uuid(),
    cogs:      uuid(),
    expense:   uuid(),
  };
  return [
    // --- Asset ---
    { id: parentIds.asset,     accountCode: '1000', accountName: 'Asset',                      accountType: 'Asset',     normalBalance: 'Debit',  description: 'All asset accounts',                 isActive: true, allowTransaction: false, parentId: null },
    { id: uuid(),              accountCode: '1100', accountName: 'Cash',                        accountType: 'Asset',     normalBalance: 'Debit',  description: 'Cash on hand',                        isActive: true, allowTransaction: true,  parentId: parentIds.asset },
    { id: uuid(),              accountCode: '1200', accountName: 'Bank',                        accountType: 'Asset',     normalBalance: 'Debit',  description: 'Bank account balance',                isActive: true, allowTransaction: true,  parentId: parentIds.asset },
    { id: uuid(),              accountCode: '1300', accountName: 'Accounts Receivable',         accountType: 'Asset',     normalBalance: 'Debit',  description: 'Amounts owed by customers',           isActive: true, allowTransaction: true,  parentId: parentIds.asset },
    { id: uuid(),              accountCode: '1400', accountName: 'Raw Material Inventory',      accountType: 'Asset',     normalBalance: 'Debit',  description: 'Raw materials for production',        isActive: true, allowTransaction: true,  parentId: parentIds.asset },
    { id: uuid(),              accountCode: '1500', accountName: 'Finished Goods Inventory',    accountType: 'Asset',     normalBalance: 'Debit',  description: 'Finished products ready for sale',    isActive: true, allowTransaction: true,  parentId: parentIds.asset },
    // --- Liability ---
    { id: parentIds.liability, accountCode: '2000', accountName: 'Liability',                   accountType: 'Liability', normalBalance: 'Credit', description: 'All liability accounts',              isActive: true, allowTransaction: false, parentId: null },
    { id: uuid(),              accountCode: '2100', accountName: 'Accounts Payable',             accountType: 'Liability', normalBalance: 'Credit', description: 'Amounts owed to suppliers',           isActive: true, allowTransaction: true,  parentId: parentIds.liability },
    // --- Equity ---
    { id: parentIds.equity,    accountCode: '3000', accountName: 'Equity',                      accountType: 'Equity',    normalBalance: 'Credit', description: 'All equity accounts',                isActive: true, allowTransaction: false, parentId: null },
    { id: uuid(),              accountCode: '3100', accountName: 'Owner Capital',                accountType: 'Equity',    normalBalance: 'Credit', description: "Owner's capital contribution",        isActive: true, allowTransaction: true,  parentId: parentIds.equity },
    // --- Revenue ---
    { id: parentIds.revenue,   accountCode: '4000', accountName: 'Revenue',                     accountType: 'Revenue',   normalBalance: 'Credit', description: 'All revenue accounts',               isActive: true, allowTransaction: false, parentId: null },
    { id: uuid(),              accountCode: '4100', accountName: 'Product Sales',                accountType: 'Revenue',   normalBalance: 'Credit', description: 'Revenue from product sales',         isActive: true, allowTransaction: true,  parentId: parentIds.revenue },
    // --- Cost of Goods Sold ---
    { id: parentIds.cogs,      accountCode: '5000', accountName: 'Cost of Goods Sold',          accountType: 'Expense',   normalBalance: 'Debit',  description: 'Direct cost of goods sold',           isActive: true, allowTransaction: true,  parentId: null },
    // --- Expenses ---
    { id: parentIds.expense,   accountCode: '6000', accountName: 'Expenses',                    accountType: 'Expense',   normalBalance: 'Debit',  description: 'All operational expense accounts',    isActive: true, allowTransaction: false, parentId: null },
    { id: uuid(),              accountCode: '6100', accountName: 'Salary Expense',               accountType: 'Expense',   normalBalance: 'Debit',  description: 'Employee salary and wages',           isActive: true, allowTransaction: true,  parentId: parentIds.expense },
    { id: uuid(),              accountCode: '6200', accountName: 'Operational Expense',          accountType: 'Expense',   normalBalance: 'Debit',  description: 'General operational costs',          isActive: true, allowTransaction: true,  parentId: parentIds.expense },
    { id: uuid(),              accountCode: '6300', accountName: 'Marketing Expense',            accountType: 'Expense',   normalBalance: 'Debit',  description: 'Marketing and advertising costs',    isActive: true, allowTransaction: true,  parentId: parentIds.expense },
  ].map(row => ({ ...row, id: row.id }));
})();
