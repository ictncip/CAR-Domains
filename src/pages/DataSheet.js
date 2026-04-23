import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES } from '../constants';
import RecordFormModal from '../components/RecordFormModal';
import excelExportIcon from '../photos/excel_export.png';
import excelImportIcon from '../photos/excel_import.png';
import filterDataIcon from '../photos/filter_data.png';
import filterLetterIcon from '../photos/filter_letter.png';
import './DataSheet.css';

const IconView = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
// Map Excel header text (normalized) to our record keys
const HEADER_TO_KEY = {
  'no': 'number',
  'number': 'number',
  'province': 'province',
  'ancestral domain': 'ancestralDomain',
  'coverage': 'coverage',
  'ancestral i coverage': 'coverage',
  'location per cadt': 'locationPerCadt',
  'location p': 'locationPerCadt',
  'area (has)': 'areaHas',
  'area (in has)': 'areaHas',
  'area (in hectares)': 'areaHas',
  'area': 'areaHas',
  'name of iccs/ips': 'nameIccsIps',
  'name of ic': 'nameIccsIps',
  'no. of beneficiaries': 'noBeneficiaries',
  'no of beneficiaries': 'noBeneficiaries',
  'no of beneficiaries / rights holders': 'noBeneficiaries',
  'no of bene': 'noBeneficiaries',
  'number of beneficiaries / rights holders': 'noBeneficiaries',
  'ad representative': 'adRepresentative',
  'ad repres': 'adRepresentative',
  'contact person': 'contactPerson',
  'contact pe': 'contactPerson',
  'contact number': 'contactNumber',
  'contact num': 'contactNumber',
  'date of receipt of application': 'dateReceiptApplication',
  'date of receipt': 'dateReceiptApplication',
  'petition no / docket no. of application': 'petitionDocketNo',
  'petition no / docket no of application': 'petitionDocketNo',
  'petition no / docket no': 'petitionDocketNo',
  'petition n': 'petitionDocketNo',
  'petition no': 'petitionDocketNo',
  'docket no': 'petitionDocketNo',
  'cadc/calc no. (if any)': 'cadcCalcNo',
  'cadc/calc no (if any)': 'cadcCalcNo',
  'cadc/calc no.(if any)': 'cadcCalcNo',
  'cadc/calc no': 'cadcCalcNo',
  'cadt no': 'cadtNo',
  'cadt no. (if approved)': 'cadtNo',
  'cadt no (if approved)': 'cadtNo',
  'cadt no. if approved': 'cadtNo',
  'cadt no if approved': 'cadtNo',
  'cadt no (': 'cadtNo',
  'date approved by ceb': 'dateApprovedCeb',
  '(date approv': 'dateApprovedCeb',
  'year issued': 'yearIssued',
  'year issue': 'yearIssued',
  'ceb resolution no.': 'cebResolutionNo',
  'ceb resolution no': 'cebResolutionNo',
  'ceb resolution number': 'cebResolutionNo',
  'ceb resol': 'cebResolutionNo',
  'with adsdpp': 'withAdsdpp',
  'edition': 'adsdppEdition',
  'adsdpp edition': 'adsdppEdition',
  'adsdpp year formulated': 'adsdppYearFormulated',
  'date of community validation': 'dateCommunityValidation',
  'date adopted by lgu': 'dateAdoptedLgu',
  'more than 5 years': 'adsdppMoreThanFiveYears',
  'adsdpp 5-year plan in the plan': 'adsdppFiveYearPlan',
  'adsdpp funding source and year': 'adsdppFundingSourceYear',
  'adsdpp remarks': 'adsdppRemarks',
  'funding agency / project cost': 'foundingAgencyProjectCost',
  'founding agency | project cost': 'foundingAgencyProjectCost',
  'founding agency': 'foundingAgencyProjectCost',
  'funding agency': 'foundingAgencyProjectCost',
  'funding ag': 'foundingAgencyProjectCost',
  'category': 'category',
  'remarks': 'remarks',
  'ado list': 'adoList',
  'with indicative map': 'withIndicativeMap',
  'indicative map': 'withIndicativeMap',
  'with indica': 'withIndicativeMap',
  'shapefile id': 'location',
  'location': 'location',
};

function excelDateToYMD(n) {
  if (typeof n !== 'number' || n < 1) return '';
  try {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function parseNumericCell(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') return Number.isFinite(val) ? val : '';

  let text = String(val).trim();
  if (!text) return '';

  text = text.replace(/\s+/g, '');
  text = text.replace(/[^\d.,-]/g, '');
  if (!text || text === '-' || text === '.' || text === ',') return '';

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
    if (decimalSep === ',') text = text.replace(',', '.');
  } else if (lastComma !== -1) {
    const commaCount = (text.match(/,/g) || []).length;
    if (commaCount > 1) {
      text = text.replace(/,/g, '');
    } else {
      const [left, right = ''] = text.split(',');
      text = right.length === 3 ? `${left}${right}` : `${left}.${right}`;
    }
  } else if (lastDot !== -1) {
    const dotCount = (text.match(/\./g) || []).length;
    if (dotCount > 1) {
      const parts = text.split('.');
      const last = parts.pop();
      text = `${parts.join('')}.${last}`;
    }
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : String(val).trim();
}

function toTwoDecimals(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return Math.round(num * 100) / 100;
}

function formatAdsdppEdition(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  if (!normalized) return '';
  if (normalized.startsWith('1') || normalized.includes('first')) return '1st Edition';
  if (normalized.startsWith('2') || normalized.includes('second')) return '2nd Edition';

  return '';
}

function formatDateYMD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseSlashDate(text) {
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return '';

  let [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  let year = Number(yearText);

  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return '';
  }
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return '';
  }

  return formatDateYMD(parsed);
}

function parseDateCell(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    return formatDateYMD(val);
  }
  if (typeof val === 'number') {
    const excel = excelDateToYMD(val);
    return excel || String(val);
  }

  const text = String(val).trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashDate = parseSlashDate(text);
  if (slashDate) return slashDate;
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return formatDateYMD(new Date(parsed));
  return text;
}

function parseBooleanCell(val) {
  if (val === undefined || val === null || val === '') return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;

  const text = String(val).trim();
  if (!text) return false;
  if (/^(yes|true|1|x|✓|check|checked)$/i.test(text)) return true;
  if (/^(no|false|0|none|n\/a)$/i.test(text)) return false;
  return true;
}

function parseTextCell(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '';
  return String(val).trim();
}

function hasValidNumbering(val) {
  const text = parseTextCell(val);
  return text !== '' && /\d/.test(text);
}

function isBlankCellValue(val) {
  return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
}

const BOOLEAN_UPLOAD_KEYS = new Set([
  'withIndicativeMap',
  'withAdsdpp',
  'adsdppMoreThanFiveYears',
]);

const NUMERIC_UPLOAD_KEYS = new Set([
  'areaHas',
  'noBeneficiaries',
]);

const DATE_UPLOAD_KEYS = new Set([
  'dateReceiptApplication',
  'dateApprovedCeb',
  'dateCommunityValidation',
  'dateAdoptedLgu',
]);

function getColumnValue(row, col) {
  if (!col) return '';
  if (col.key === 'number') return row?.number ?? '';
  const value = col.getValue ? col.getValue(row, 0) : row?.[col.key];
  return value ?? '';
}

function compareCellValues(a, b) {
  return String(a ?? '').trim().localeCompare(String(b ?? '').trim(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function normalizeSignatureValue(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '';
  }
  return String(val).trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildRecordSignature(record) {
  return UPLOAD_RECORD_KEYS
    .map((key) => `${key}:${normalizeSignatureValue(record?.[key])}`)
    .join('|');
}

const COLUMNS = [
  { key: 'number', label: 'No', width: '56px', getValue: (r) => r.number ?? '' },
    { key: 'province', label: 'Province' },
  { key: 'ancestralDomain', label: 'Ancestral Domain' },
  { key: 'nameIccsIps', label: 'Name of ICCs/IPs' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'locationPerCadt', label: 'Location Per CADT' },
  {
    key: 'areaHas',
    label: 'Area (in Has)',
    getValue: (r) => {
      const v = Number(r.areaHas);
      return Number.isFinite(v) ? v.toFixed(2) : (r.areaHas ?? '');
    },
  },
  { key: 'dateReceiptApplication', label: 'Date of Receipt of Application' },
  { key: 'petitionDocketNo', label: 'Petition No / Docket No' },
  { key: 'cadcCalcNo', label: 'CADC/CALC No (if any)' },
  { key: 'noBeneficiaries', label: 'No of Beneficiaries / Rights Holders' },
  { key: 'cadtNo', label: 'CADT No. (if approved)' },
  { key: 'dateApprovedCeb', label: 'Date Approved by CEB' },
  { key: 'yearIssued', label: 'Year Issued' },
  { key: 'cebResolutionNo', label: 'CEB Resolution No.' },
  { key: 'adRepresentative', label: 'AD Representative' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'foundingAgencyProjectCost', label: 'Funding Agency | Project Cost' },
  { key: 'category', label: 'Category' },
  { key: 'withIndicativeMap', label: 'Indicative Map', getValue: (r) => r.withIndicativeMap ? 'Yes' : 'No' },
  { key: 'location', label: 'Shapefile ID' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'withAdsdpp', label: 'WITH ADSDPP', getValue: (r) => r.withAdsdpp ? 'Yes' : 'No' },
  { key: 'adsdppEdition', label: 'Edition', getValue: (r) => formatAdsdppEdition(r.adsdppEdition) },
  { key: 'adsdppYearFormulated', label: 'ADSDPP Year Formulated' },
  { key: 'dateCommunityValidation', label: 'Date of Community Validation' },
  { key: 'dateAdoptedLgu', label: 'Date Adopted by LGU' },
  { key: 'adsdppMoreThanFiveYears', label: 'More than 5 Years', getValue: (r) => r.adsdppMoreThanFiveYears ? 'Yes' : 'No' },
  { key: 'adsdppFiveYearPlan', label: 'ADSDPP 5 Year Plan in the Plan' },
  { key: 'adsdppFundingSourceYear', label: 'ADSDPP Funding Source and Year' },
  { key: 'adsdppRemarks', label: 'ADSDPP Remarks' },
];

const defaultVisible = COLUMNS.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.key === 'remarks' ? false : true }),
  {}
);
defaultVisible.number = true;

const BASIC_INFO_KEYS = new Set([
  'number',
  'province',
  'ancestralDomain',
  'nameIccsIps',
  'coverage',
  'locationPerCadt',
  'areaHas',
]);
const BENEFICIARY_KEYS = new Set([
  'noBeneficiaries',
]);
const CONTACT_INFO_KEYS = new Set([
  'adRepresentative',
  'contactPerson',
  'contactNumber',
]);
const APPLICATION_INFO_KEYS = new Set([
  'dateReceiptApplication',
  'petitionDocketNo',
  'cadcCalcNo',
]);
const CADT_APPROVAL_KEYS = new Set([
  'cadtNo',
  'dateApprovedCeb',
  'yearIssued',
  'cebResolutionNo',
]);
const ADSDPP_INFO_KEYS = new Set([
  'withAdsdpp',
  'adsdppEdition',
  'adsdppYearFormulated',
  'dateCommunityValidation',
  'dateAdoptedLgu',
  'adsdppMoreThanFiveYears',
  'adsdppFiveYearPlan',
  'adsdppFundingSourceYear',
  'adsdppRemarks',
]);
const FUNDING_INFO_KEYS = new Set([
  'foundingAgencyProjectCost',
  'category',
]);
const MAPPING_INFO_KEYS = new Set([
  'withIndicativeMap',
  'location',
]);
const REMARKS_INFO_KEYS = new Set([
  'remarks',
]);

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeHeaderLoose(h) {
  return normalizeHeader(h).replace(/[^a-z0-9]/g, '');
}

const EXPECTED_UPLOAD_KEYS_BY_INDEX = [
  'number', // No
  'province',
  'ancestralDomain',
  'coverage',
  'locationPerCadt',
  'areaHas',
  'nameIccsIps',
  'noBeneficiaries',
  'adRepresentative',
  'contactPerson',
  'contactNumber',
  'dateReceiptApplication',
  'petitionDocketNo',
  'cadcCalcNo', // CADC/CALC No. (if any)
  'cadtNo',
  'dateApprovedCeb',
  'yearIssued',
  'cebResolutionNo',
  'withAdsdpp',
  'adsdppEdition',
  'adsdppYearFormulated',
  'dateCommunityValidation',
  'dateAdoptedLgu',
  'adsdppMoreThanFiveYears',
  'adsdppFiveYearPlan',
  'adsdppFundingSourceYear',
  'adsdppRemarks',
  'foundingAgencyProjectCost',
  'category',
  'remarks',
  'adoList',
  'withIndicativeMap',
  'location',
];

const UPLOAD_RECORD_KEYS = Array.from(
  new Set(EXPECTED_UPLOAD_KEYS_BY_INDEX.filter(Boolean))
);

const LOOSE_HEADER_TO_KEY = Object.entries(HEADER_TO_KEY).reduce((acc, [header, key]) => {
  acc[normalizeHeaderLoose(header)] = key;
  return acc;
}, {});

function resolveUploadKey(header, index) {
  const strictHeader = normalizeHeader(header);
  const strictMatch = HEADER_TO_KEY[strictHeader];
  if (strictMatch !== undefined) return strictMatch;

  const looseHeader = normalizeHeaderLoose(header);
  const looseMatch = LOOSE_HEADER_TO_KEY[looseHeader];
  if (looseMatch !== undefined) return looseMatch;

  return EXPECTED_UPLOAD_KEYS_BY_INDEX[index] ?? null;
}

function getUploadKeysForRow(row) {
  return (row || []).map((h, i) => resolveUploadKey(h, i));
}

function detectHeaderRowIndex(rows) {
  const maxRowsToScan = Math.min(rows.length, 10);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxRowsToScan; i++) {
    const keys = getUploadKeysForRow(rows[i]);
    const mappedCount = keys.filter((k) => !!k).length;
    const hasAreaColumn = keys.includes('areaHas');
    const score = mappedCount + (hasAreaColumn ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export default function DataSheet() {
  const { records, dataLoading, dataError, addRecords, deleteRecords } = useData();
  const fileInputRef = useRef(null);
  const sortPickerRef = useRef(null);
  const filterPickerRef = useRef(null);
  const columnPickerRef = useRef(null);
  const columnPickerMenuRef = useRef(null);
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDirection, setSortDirection] = useState('');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [valueFilterKey, setValueFilterKey] = useState('');
  const [valueFilter, setValueFilter] = useState([]);
  const [draftValueFilterKey, setDraftValueFilterKey] = useState('');
  const [draftValueFilter, setDraftValueFilter] = useState([]);
  const [valueFilterSearch, setValueFilterSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState(defaultVisible);
  const [showColPicker, setShowColPicker] = useState(false);
  const [columnPickerPos, setColumnPickerPos] = useState({ top: 0, left: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [modalRecord, setModalRecord] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filterableColumns = useMemo(
    () => COLUMNS.filter((col) => col.key !== 'number'),
    []
  );

  const filteredByProvince = useMemo(() => {
    if (provinceFilter === 'all') return records;
    return records.filter((r) => r.province === provinceFilter);
  }, [records, provinceFilter]);

  const valueFilterOptions = useMemo(() => {
    if (!draftValueFilterKey) return [];
    const col = COLUMNS.find((item) => item.key === draftValueFilterKey);
    if (!col) return [];
    const values = Array.from(
      new Set(
        filteredByProvince
          .map((row) => String(getColumnValue(row, col)).trim())
          .filter((value) => value !== '')
      )
    );
    return values.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [draftValueFilterKey, filteredByProvince]);

  const visibleValueFilterOptions = useMemo(() => {
    if (!valueFilterSearch.trim()) return valueFilterOptions;
    const query = valueFilterSearch.trim().toLowerCase();
    return valueFilterOptions.filter((option) =>
      option.toLowerCase().includes(query)
    );
  }, [valueFilterOptions, valueFilterSearch]);

  const filteredByValue = useMemo(() => {
    if (!valueFilterKey || valueFilter.length === 0) return filteredByProvince;
    const col = COLUMNS.find((item) => item.key === valueFilterKey);
    if (!col) return filteredByProvince;
    return filteredByProvince.filter((row) =>
      valueFilter.includes(String(getColumnValue(row, col)).trim())
    );
  }, [filteredByProvince, valueFilter, valueFilterKey]);

  const searched = useMemo(() => {
    if (!search.trim()) return filteredByValue;
    const q = search.toLowerCase();
    return filteredByValue.filter((r) =>
      COLUMNS.some((col) => {
        const val = getColumnValue(r, col);
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [filteredByValue, search]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return [...searched].sort((a, b) => {
        const provinceCompare = compareCellValues(a.province, b.province);
        if (provinceCompare !== 0) return provinceCompare;
        return compareCellValues(a.number, b.number);
      });
    }
    const col = COLUMNS.find((item) => item.key === sortKey);
    if (!col) return searched;
    const direction = sortDirection === 'desc' ? -1 : 1;

    return [...searched].sort((a, b) => {
      const aValue = String(getColumnValue(a, col)).trim();
      const bValue = String(getColumnValue(b, col)).trim();
      return compareCellValues(aValue, bValue) * direction;
    });
  }, [searched, sortDirection, sortKey]);

  const filtered = useMemo(
    () => sorted.map((r, i) => ({ ...r, _rowNo: i + 1 })),
    [sorted]
  );

  const existingRecordSignatures = useMemo(
    () => new Set(records.map((record) => buildRecordSignature(record))),
    [records]
  );

  const toggleCol = (key) => {
    if (key === 'number') return;
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (visibleCols.number) return;
    setVisibleCols((prev) => ({ ...prev, number: true }));
  }, [visibleCols]);

  const visibleColumns = COLUMNS.filter((c) => visibleCols[c.key]);
  const basicCount = visibleColumns.filter((c) => BASIC_INFO_KEYS.has(c.key)).length;
  const beneficiaryCount = visibleColumns.filter((c) => BENEFICIARY_KEYS.has(c.key)).length;
  const contactCount = visibleColumns.filter((c) => CONTACT_INFO_KEYS.has(c.key)).length;
  const applicationCount = visibleColumns.filter((c) => APPLICATION_INFO_KEYS.has(c.key)).length;
  const approvalCount = visibleColumns.filter((c) => CADT_APPROVAL_KEYS.has(c.key)).length;
  const adsdppCount = visibleColumns.filter((c) => ADSDPP_INFO_KEYS.has(c.key)).length;
  const fundingCount = visibleColumns.filter((c) => FUNDING_INFO_KEYS.has(c.key)).length;
  const mappingCount = visibleColumns.filter((c) => MAPPING_INFO_KEYS.has(c.key)).length;
  const remarksCount = visibleColumns.filter((c) => REMARKS_INFO_KEYS.has(c.key)).length;
  const otherCount = Math.max(
    0,
    visibleColumns.length -
      (basicCount +
        beneficiaryCount +
        contactCount +
        applicationCount +
        approvalCount +
        fundingCount +
        mappingCount +
        remarksCount +
        adsdppCount)
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const selectedCount = selectedIds.size;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleView = (row) => {
    setModalRecord(row);
    setModalMode('view');
  };

  const handleEdit = (row) => {
    setModalRecord(row);
    setModalMode('edit');
  };

  const handleBulkDeleteClick = () => {
    if (selectedCount === 0) {
      setUploadResult({ ok: false, message: 'Select at least one record to delete.' });
      return;
    }
    setDeleteConfirm({ ids: Array.from(selectedIds), count: selectedCount });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteRecords(deleteConfirm.ids);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleteConfirm.ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteConfirm(null);
    } catch (err) {
      setUploadResult({ ok: false, message: err?.message ?? 'Delete failed.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const exportData = filtered.map((row) => {
      const obj = {};
      COLUMNS.forEach((col) => {
        const label = col.label;
        const val = col.getValue ? col.getValue(row, row._rowNo - 1) : row[col.key];
        obj[label] = val ?? '';
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ancestral Domains');
    XLSX.writeFile(wb, `cordillera-ancestral-domains-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleUpload = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setUploadResult(null);
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: '',
        raw: false,
        dateNF: 'yyyy-mm-dd',
      });
      if (rows.length < 2) {
        setUploadResult({ ok: false, message: 'File has no data rows.' });
        return;
      }
      const headerRowIndex = detectHeaderRowIndex(rows);
      const uploadKeys = getUploadKeysForRow(rows[headerRowIndex]);
      const recordsToAdd = [];
      const invalidNumberRows = [];
      const duplicateRows = [];
      const seenUploadSignatures = new Set();
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const hasAnyContent = row.some((cell) => !isBlankCellValue(cell));
        if (!hasAnyContent) continue;

        const numberColumnIndex = uploadKeys.findIndex((key) => key === 'number');
        const rawNumberValue = numberColumnIndex >= 0 ? row[numberColumnIndex] : '';
        if (!hasValidNumbering(rawNumberValue)) {
          invalidNumberRows.push(i + 1);
          continue;
        }

        const record = {};
        uploadKeys.forEach((key, j) => {
          if (!key) return;
          let val = row[j];
          if (val === undefined || val === null) val = '';
          const existing = record[key];
          const hasExisting = existing !== undefined && existing !== null && String(existing).trim() !== '';
          let nextValue;
          if (BOOLEAN_UPLOAD_KEYS.has(key)) {
            nextValue = parseBooleanCell(val);
          } else if (key === 'areaHas') {
            const parsed = parseNumericCell(val);
            nextValue = typeof parsed === 'number' ? toTwoDecimals(parsed) : parsed;
          } else if (NUMERIC_UPLOAD_KEYS.has(key)) {
            nextValue = parseNumericCell(val);
          } else if (DATE_UPLOAD_KEYS.has(key)) {
            nextValue = parseDateCell(val);
          } else if (key === 'petitionDocketNo') {
            const text = parseTextCell(val);
            if (!text) return;
            if (hasExisting && existing !== text) {
              record[key] = `${existing} | ${text}`;
            } else if (!hasExisting) {
              record[key] = text;
            }
            return;
          } else {
            nextValue = parseTextCell(val);
          }

          if (hasExisting && isBlankCellValue(nextValue)) return;
          record[key] = nextValue;
        });
        if (Object.keys(record).length > 0) {
          const signature = buildRecordSignature(record);
          if (existingRecordSignatures.has(signature) || seenUploadSignatures.has(signature)) {
            duplicateRows.push(i + 1);
            continue;
          }
          seenUploadSignatures.add(signature);
          recordsToAdd.push(record);
        }
      }
      if (duplicateRows.length > 0) {
        const previewRows = duplicateRows.slice(0, 5).join(', ');
        const suffix = duplicateRows.length > 5 ? ', ...' : '';
        const shouldContinue = window.confirm(
          `Duplicate row(s) found in the Excel file or existing records: ${previewRows}${suffix}.\n\nPress OK to import only the non-duplicate rows, or Cancel to stop this upload.`
        );
        if (!shouldContinue) {
          setUploadResult({
            ok: false,
            message: `Upload canceled. Duplicate row(s) found: ${previewRows}${suffix}.`,
          });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }
      if (recordsToAdd.length === 0) {
        if (duplicateRows.length > 0) {
          const previewRows = duplicateRows.slice(0, 5).join(', ');
          const suffix = duplicateRows.length > 5 ? ', ...' : '';
          setUploadResult({
            ok: false,
            message: `No rows were imported. All detected rows were duplicates: ${previewRows}${suffix}.`,
          });
          return;
        }
        if (invalidNumberRows.length > 0) {
          const previewRows = invalidNumberRows.slice(0, 5).join(', ');
          const suffix = invalidNumberRows.length > 5 ? ', ...' : '';
          setUploadResult({
            ok: false,
            message: `No rows were imported. The skipped row(s) have no number in the "No" column: ${previewRows}${suffix}.`,
          });
          return;
        }
        setUploadResult({ ok: false, message: 'No valid rows found in the uploaded file.' });
        return;
      }
      await addRecords(recordsToAdd);
      if (duplicateRows.length > 0 || invalidNumberRows.length > 0) {
        const details = [];
        if (duplicateRows.length > 0) {
          const duplicatePreview = duplicateRows.slice(0, 5).join(', ');
          const duplicateSuffix = duplicateRows.length > 5 ? ', ...' : '';
          details.push(
            `Skipped ${duplicateRows.length} duplicate row(s): ${duplicatePreview}${duplicateSuffix}.`
          );
        }
        const previewRows = invalidNumberRows.slice(0, 5).join(', ');
        const suffix = invalidNumberRows.length > 5 ? ', ...' : '';
        if (invalidNumberRows.length > 0) {
          details.push(
            `Skipped ${invalidNumberRows.length} row(s) with no number in the "No" column: ${previewRows}${suffix}.`
          );
        }
        setUploadResult({
          ok: true,
          count: recordsToAdd.length,
          message: `Uploaded ${recordsToAdd.length} record(s). ${details.join(' ')}`,
        });
      } else {
        setUploadResult({ ok: true, count: recordsToAdd.length });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadResult({ ok: false, message: err?.message ?? 'Upload failed.' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();
  const allVisibleFilterValuesSelected =
    visibleValueFilterOptions.length > 0 &&
    visibleValueFilterOptions.every((option) => draftValueFilter.includes(option));

  const openFilterPicker = () => {
    const nextOpen = !showFilterPicker;
    if (nextOpen) {
      setDraftValueFilterKey(valueFilterKey);
      setDraftValueFilter(valueFilter);
      setValueFilterSearch('');
    }
    setShowFilterPicker(nextOpen);
    setShowSortPicker(false);
    setShowColPicker(false);
  };

  const cancelFilterPicker = useCallback(() => {
    setDraftValueFilterKey(valueFilterKey);
    setDraftValueFilter(valueFilter);
    setValueFilterSearch('');
    setShowFilterPicker(false);
  }, [valueFilter, valueFilterKey]);

  const applyFilterPicker = () => {
    setValueFilterKey(draftValueFilterKey);
    setValueFilter(draftValueFilter);
    setShowFilterPicker(false);
  };

  const toggleAllVisibleFilterValues = () => {
    if (allVisibleFilterValuesSelected) {
      setDraftValueFilter((prev) =>
        prev.filter((value) => !visibleValueFilterOptions.includes(value))
      );
      return;
    }

    setDraftValueFilter((prev) => {
      const next = new Set(prev);
      visibleValueFilterOptions.forEach((value) => next.add(value));
      return Array.from(next);
    });
  };

  const updateColumnPickerPosition = useCallback(() => {
    if (!columnPickerRef.current) return;

    const rect = columnPickerRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const viewportPadding = 12;
    const left = Math.max(
      viewportPadding,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportPadding)
    );

    setColumnPickerPos({
      top: rect.bottom + 8,
      left,
    });
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;

      if (showSortPicker && sortPickerRef.current && !sortPickerRef.current.contains(target)) {
        setShowSortPicker(false);
      }

      if (showFilterPicker && filterPickerRef.current && !filterPickerRef.current.contains(target)) {
        cancelFilterPicker();
      }

      const insideColumnTrigger = columnPickerRef.current?.contains(target);
      const insideColumnMenu = columnPickerMenuRef.current?.contains(target);
      if (showColPicker && !insideColumnTrigger && !insideColumnMenu) {
        setShowColPicker(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [cancelFilterPicker, showColPicker, showFilterPicker, showSortPicker]);

  useEffect(() => {
    if (!showColPicker) return undefined;

    updateColumnPickerPosition();
    const handlePositionChange = () => updateColumnPickerPosition();

    window.addEventListener('resize', handlePositionChange);
    window.addEventListener('scroll', handlePositionChange, true);
    return () => {
      window.removeEventListener('resize', handlePositionChange);
      window.removeEventListener('scroll', handlePositionChange, true);
    };
  }, [showColPicker, updateColumnPickerPosition]);

  useEffect(() => {
    if (!uploadResult) return undefined;

    const timeoutId = window.setTimeout(() => {
      setUploadResult(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [uploadResult]);

  return (
    <div className="data-sheet-page">
      {dataError && (
        <div className="data-sheet-error">{dataError}</div>
      )}
      {dataLoading && records.length === 0 && (
        <p className="data-sheet-loading">Loading records…</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />

      <div className="data-sheet-toolbar-scroll">
      <div className="data-sheet-toolbar">
        <div className="toolbar-group">
          <label>Province</label>
          <div className="province-buttons">
            <button
              type="button"
              className={provinceFilter === 'all' ? 'active' : ''}
              onClick={() => setProvinceFilter('all')}
            >
              Show all
            </button>
            {CAR_PROVINCES.map((p) => (
              <button
                key={p}
                type="button"
                className={provinceFilter === p ? 'active' : ''}
                onClick={() => setProvinceFilter(p)}
              >
                {p === 'Mountain Province' ? 'Mt. Province' : p}
              </button>
            ))}
          </div>
          <div className="toolbar-group search-group has-delete-action">
            <div className="delete-action-wrap">
              {uploadResult && (
                <div className={`upload-toast${uploadResult.ok ? ' success' : ' error'}`} role="status" aria-live="polite">
                  {uploadResult.message ?? (uploadResult.ok ? `Uploaded ${uploadResult.count} record(s).` : 'Upload failed.')}
                </div>
              )}
            <button
              type="button"
              className={`btn btn-delete btn-delete-inline${selectedCount === 0 ? ' is-inactive' : ''}`}
              onClick={handleBulkDeleteClick}
              aria-disabled={selectedCount === 0}
            >
              Delete selected ({selectedCount})
            </button>
            </div>
            <input
              type="text"
              placeholder="Search across all columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sheet-search"
            />
          </div>
        </div>
        <div className="toolbar-right">
        <div className="toolbar-group sheet-actions-group">
          <div className="sheet-actions">
            <div className="toolbar-spreadsheet-group">
              <button
                type="button"
                className="toolbar-menu-trigger import-trigger"
                onClick={triggerFileInput}
                disabled={uploading}
                aria-label={uploading ? 'Importing from Excel' : 'Import from Excel'}
                title={uploading ? 'Importing from Excel' : 'Import from Excel'}
              >
                <img src={excelImportIcon} alt="" className="toolbar-label-icon" />
                <span className="menu-trigger-label">
                  <span className="menu-trigger-text">{uploading ? 'Importing...' : 'Import'}</span>
                </span>
              </button>
              <button
                type="button"
                className="toolbar-menu-trigger export-trigger"
                onClick={handleExport}
                disabled={filtered.length === 0}
                aria-label="Export to Excel"
                title="Export to Excel"
              >
                <img src={excelExportIcon} alt="" className="toolbar-label-icon" />
                <span className="menu-trigger-label">
                  <span className="menu-trigger-text">Export</span>
                </span>
              </button>
              <div className="toolbar-spreadsheet-title">Spreadsheet</div>
            </div>
          </div>
        </div>
        <div className="toolbar-editing-group">
        <div className="toolbar-group sort-group" ref={sortPickerRef}>
          <button
            type="button"
            className={`toolbar-menu-trigger sort-trigger${showSortPicker ? ' active' : ''}`}
            onClick={() => {
              setShowSortPicker((prev) => !prev);
              setShowFilterPicker(false);
              setShowColPicker(false);
            }}
            aria-label="Open sort options"
            title="Open sort options"
          >
            <img src={filterLetterIcon} alt="" className="toolbar-label-icon" />
            <span className="menu-trigger-label">
              <span className="menu-trigger-text">Sort</span>
              <span className="menu-trigger-caret" aria-hidden="true"></span>
            </span>
          </button>
          {showSortPicker && (
            <div className="sort-picker">
              <button
                type="button"
                className="menu-action"
                onClick={() => {
                  setSortDirection('asc');
                  setShowSortPicker(false);
                }}
              >
                <span className="menu-action-glyph">A-Z</span>
                <span>Sort A to Z</span>
              </button>
              <button
                type="button"
                className="menu-action"
                onClick={() => {
                  setSortDirection('desc');
                  setShowSortPicker(false);
                }}
              >
                <span className="menu-action-glyph">Z-A</span>
                <span>Sort Z to A</span>
              </button>
              <button
                type="button"
                className="menu-action"
                onClick={() => {
                  setSortDirection('');
                  setSortKey('');
                  setShowSortPicker(false);
                }}
              >
                <span className="menu-action-glyph">x</span>
                <span>Remove sorting</span>
              </button>
              <p className="menu-note">
                Choose a sort option, then click a sheet header.
              </p>
            {/* 
            <select
              value={sortDirection}
              onChange={(e) => {
                const nextDirection = e.target.value;
                setSortDirection(nextDirection);
                if (!nextDirection) {
                  setSortKey('');
                }
                setShowSortPicker(false);
              }}
              className="sheet-select"
            >
              <option value="">Remove sorting</option>
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>
            */}
            </div>
          )}
        </div>
        <div className="toolbar-group value-filter-group" ref={filterPickerRef}>
          <button
            type="button"
            className={`toolbar-menu-trigger filter-trigger${showFilterPicker ? ' active' : ''}`}
            onClick={openFilterPicker}
            aria-label="Open filter options"
            title="Open filter options"
          >
            <img src={filterDataIcon} alt="" className="toolbar-label-icon" />
            <span className="menu-trigger-label">
              <span className="menu-trigger-text">Filter</span>
              <span className="menu-trigger-caret" aria-hidden="true"></span>
            </span>
          </button>
          {showFilterPicker && (
            <div className="filter-picker">
              <div className="menu-field">
                <label htmlFor="filter-column-select">Column</label>
                <select
                  id="filter-column-select"
                  value={draftValueFilterKey}
                  onChange={(e) => {
                    setDraftValueFilterKey(e.target.value);
                    setDraftValueFilter([]);
                    setValueFilterSearch('');
                  }}
                  className="sheet-select"
                >
                  <option value="">Select column</option>
                  {filterableColumns.map((col) => (
                    <option key={col.key} value={col.key}>{col.label}</option>
                  ))}
                </select>
              </div>
              <div className="menu-field">
                <label htmlFor="filter-value-search">Value</label>
                <input
                  id="filter-value-search"
                  type="text"
                  value={valueFilterSearch}
                  onChange={(e) => setValueFilterSearch(e.target.value)}
                  className="sheet-search filter-value-search"
                  placeholder="Search"
                  disabled={!draftValueFilterKey}
                />
                <div
                  className={`value-checkbox-list${!draftValueFilterKey ? ' disabled' : ''}`}
                  aria-label="Filter values"
                >
                  {draftValueFilterKey && (
                    <label className="value-checkbox-item value-checkbox-select-all">
                      <input
                        type="checkbox"
                        checked={allVisibleFilterValuesSelected}
                        disabled={visibleValueFilterOptions.length === 0}
                        onChange={toggleAllVisibleFilterValues}
                      />
                      <span>(Select All)</span>
                    </label>
                  )}
                  {visibleValueFilterOptions.length === 0 ? (
                    <div className="value-checkbox-empty">
                      {draftValueFilterKey ? 'No matching values found' : 'Select a column first.'}
                    </div>
                  ) : (
                    visibleValueFilterOptions.map((option) => (
                      <label key={option} className="value-checkbox-item">
                        <input
                          type="checkbox"
                          checked={draftValueFilter.includes(option)}
                          disabled={!draftValueFilterKey}
                          onChange={() => {
                            setDraftValueFilter((prev) =>
                              prev.includes(option)
                                ? prev.filter((item) => item !== option)
                                : [...prev, option]
                            );
                          }}
                        />
                        <span>{option}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="menu-actions-row">
                <button
                  type="button"
                  className="menu-secondary"
                  onClick={cancelFilterPicker}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="menu-primary"
                  onClick={applyFilterPicker}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="toolbar-group col-picker-wrap" ref={columnPickerRef}>
          <button
            type="button"
            className={`toolbar-menu-trigger btn-icon-toggle${showColPicker ? ' active' : ''}`}
            onClick={() => {
              setShowColPicker((prev) => !prev);
              setShowSortPicker(false);
              setShowFilterPicker(false);
            }}
            aria-label={showColPicker ? 'Hide columns' : 'Show or hide columns'}
            title={showColPicker ? 'Hide columns' : 'Show or hide columns'}
          >
            <span className="menu-trigger-label">
              <span className="menu-trigger-text">Column</span>
              <span className="menu-trigger-caret" aria-hidden="true"></span>
            </span>
          </button>
        </div>
        <div className="toolbar-editing-title">Editing</div>
        </div>
        </div>
      </div>
      </div>
      {showColPicker && (
        <div
          ref={columnPickerMenuRef}
          className="column-picker column-picker-floating"
          style={{ top: `${columnPickerPos.top}px`, left: `${columnPickerPos.left}px` }}
        >
          {COLUMNS.map((c) => (
            <label key={c.key} className="col-picker-item">
              <input
                type="checkbox"
                checked={!!visibleCols[c.key]}
                onChange={() => toggleCol(c.key)}
                disabled={c.key === 'number'}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-group-spacer" colSpan={2} aria-hidden="true"></th>
              {basicCount > 0 && (
                <th className="col-group-header" colSpan={basicCount}>1. Core Identification</th>
              )}
              {applicationCount > 0 && (
                <th className="col-group-header" colSpan={applicationCount}>2. Application Details</th>
              )}
              {beneficiaryCount > 0 && (
                <th className="col-group-header" colSpan={beneficiaryCount}>3. Beneficiaries</th>
              )}
              {approvalCount > 0 && (
                <th className="col-group-header" colSpan={approvalCount}>4. CADT Approval / Status</th>
              )}
              {contactCount > 0 && (
                <th className="col-group-header" colSpan={contactCount}>5. Contacts</th>
              )}
              {fundingCount > 0 && (
                <th className="col-group-header" colSpan={fundingCount}>6. Funding &amp; Classification</th>
              )}
              {mappingCount > 0 && (
                <th className="col-group-header" colSpan={mappingCount}>7. Mapping</th>
              )}
              {remarksCount > 0 && (
                <th className="col-group-header" colSpan={remarksCount}>8. General Remarks</th>
              )}
              {adsdppCount > 0 && (
                <th className="col-group-header" colSpan={adsdppCount}>9. ADSDPP</th>
              )}
              {otherCount > 0 && (
                <th className="col-group-spacer" colSpan={otherCount} aria-hidden="true"></th>
              )}
            </tr>
            <tr>
              <th className="col-select">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filtered.length === 0}
                  aria-label="Select all"
                />
              </th>
              <th className="col-actions">Actions</th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                  className={sortDirection ? `sortable-header${sortKey === col.key ? ' active' : ''}` : undefined}
                  onClick={sortDirection ? () => setSortKey(col.key) : undefined}
                  title={sortDirection ? `Sort by ${col.label}` : undefined}
                >
                  <span className="header-label">
                    {col.label}
                    {sortKey === col.key && sortDirection === 'asc' && ' ^'}
                    {sortKey === col.key && sortDirection === 'desc' && ' v'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="empty-cell">
                  No records match. Try changing province or search.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td className="col-select">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      aria-label={`Select row ${row._rowNo}`}
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon btn-icon-view"
                      onClick={() => handleView(row)}
                      title="View"
                      aria-label="View"
                    >
                      <IconView />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-edit"
                      onClick={() => handleEdit(row)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <IconEdit />
                    </button>
                  </td>
                  {visibleColumns.map((col) => (
                    <td key={col.key}>
                      {col.getValue
                        ? col.getValue(row, row._rowNo - 1)
                        : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalRecord && (
        <RecordFormModal
          record={modalRecord}
          mode={modalMode}
          onClose={() => setModalRecord(null)}
        />
      )}

      {deleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
            <p>Delete {deleteConfirm.count} record(s)? This cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button
                type="button"
                className="btn btn-delete"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="record-count">
        Showing {filtered.length} of {records.length} record(s)
        {provinceFilter !== 'all' && ` (filtered by ${provinceFilter})`}
      </p>
    </div>
  );
}








