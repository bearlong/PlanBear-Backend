const mockApplyItem = {
  id: "1",
  Factory: { display: "(PB00) Mock Factory", code: "PB00" },
  Vendor: { display: "(0003456A) Mock Vendor", code: "0003456A" },
  Brand: { display: "(MT0011) mango electronics", code: "MT0011" },
  Parts: "part0001-RA1",
  Description: "MANUAL KU12EA-R 80g ART PAPER",
  OrderSharerate: "10",
  LastPutPrice: "0",
  CurrencyOld: "USD",
  UnitPrice: "10",
  CurrencyNew: "RMB",
  Rate: "7.14",
  EffectiveDate: "2025-03-20",
  EffectiveRemark: "Mock quotation",
  CostDown: "0",
  Moq: "10",
  Mpq: "10",
  LeadTime: "10",
  LME: "0",
  QuotaDate: "2025-03-20",
  AnnulmentDate: null,
  ControlQuantity: "10",
  VendorQuotationNo: "MOCK-001",
  Buyer: { username: "3376", name: "大強", code: "A01" },
  AttachFile: [],
  IsSpotPrice: "Y",
  IsUnpaidOrderEffective: "Y",
  PlaceOfOrigin: '["TW"]',
  type: "AP",
};

export const mockCompareStore = {
  applications: [
    {
      compare_data: {
        sign_number: "SG2",
        apply_no: "2025020002",
        buyer: { username: "8892", name: "Bear Shen" },
        apply_date: "2025-02-27",
        sap_sourcer: {
          code: "T04",
          name: "Mock Sourcer",
          username: "60340",
        },
        status: "Sign",
        version: 1,
        company_code: "TPE",
        memo: "This is a mock apply for testing purposes.",
        activeid: "2025020002",
        updated_at: "2025-02-27T00:00:00Z",
      },
      compare_apply: [{ ...mockApplyItem }],
      comments: [],
    },
  ],
  drafts: [
    {
      compare_data_draft: {
        draft_no: "DRAFT123",
        buyer: { username: "admin", name: "Admin User" },
        sap_sourcer: {
          code: "T04",
          name: "Mock Sourcer",
          username: "60340",
        },
        memo: "This is a mock draft for testing purposes.",
        status: "draft",
        updated_at: "2025-02-27T00:00:00Z",
      },
      compare_apply_draft: [{ ...mockApplyItem }],
    },
  ],
};

function normalizeMockPlaceOfOrigin(value) {
  if (Array.isArray(value)) return JSON.stringify(value);
  return value;
}

function normalizeMockCompareData(value) {
  if (Array.isArray(value)) return value.map(normalizeMockCompareData);
  if (!value || typeof value !== "object") return value;

  Object.keys(value).forEach((key) => {
    if (key === "PlaceOfOrigin" || key === "place_of_origin") {
      value[key] = normalizeMockPlaceOfOrigin(value[key]);
      return;
    }
    value[key] = normalizeMockCompareData(value[key]);
  });

  return value;
}

export function cloneMockCompareData(data) {
  const cloned = JSON.parse(JSON.stringify(data));
  return normalizeMockCompareData(cloned);
}

export function nextMockDraftNo() {
  return `DRAFT_${Date.now()}`;
}

export function nextMockApplyNo() {
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "");
  const currentMax = mockCompareStore.applications.reduce((max, item) => {
    const applyNo = item.compare_data.apply_no;
    if (!applyNo?.startsWith(yearMonth)) return max;
    return Math.max(max, Number(applyNo.slice(-4)) || 0);
  }, 0);
  return `${yearMonth}${String(currentMax + 1).padStart(4, "0")}`;
}
