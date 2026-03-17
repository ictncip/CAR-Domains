import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES } from '../constants';
import RecordFormModal from '../components/RecordFormModal';
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
  'no': null,
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
  'cadt no (': 'cadtNo',
  'date approved by ceb': 'dateApprovedCeb',
  '(date approv': 'dateApprovedCeb',
  'year issued': 'yearIssued',
  'year issue': 'yearIssued',
  'ceb resolution number': 'cebResolutionNo',
  'ceb resol': 'cebResolutionNo',
  'with adsdpp': 'withAdsdpp',
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
  'with indica': 'withIndicativeMap',
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

function parseDateCell(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') {
    const excel = excelDateToYMD(val);
    return excel || String(val);
  }

  const text = String(val).trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
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

const COLUMNS = [
  { key: 'no', label: 'No', width: '50px', getValue: (r) => r._rowNo ?? '—' },
  { key: 'province', label: 'Province' },
  { key: 'ancestralDomain', label: 'Ancestral Domain' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'locationPerCadt', label: 'Location per CADT' },
  {
    key: 'areaHas',
    label: 'Area (in Hectares)',
    getValue: (r) => {
      const v = Number(r.areaHas);
      return Number.isFinite(v) ? v.toFixed(2) : (r.areaHas ?? '');
    },
  },
  { key: 'nameIccsIps', label: 'Name of ICCs/IPs' },
  { key: 'noBeneficiaries', label: 'Number of Beneficiaries / Rights Holders' },
  { key: 'adRepresentative', label: 'AD Representative' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'dateReceiptApplication', label: 'Date of Receipt of Application' },
  { key: 'petitionDocketNo', label: 'Petition No. / Docket No. of Application' },
  { key: 'cadcCalcNo', label: 'CADC/CALC No. (if any)' },
  { key: 'cadtNo', label: 'CADT No. (if approved)' },
  { key: 'dateApprovedCeb', label: 'Date approved by CEB' },
  { key: 'yearIssued', label: 'Year Issued' },
  { key: 'cebResolutionNo', label: 'CEB Resolution No.' },
  { key: 'withAdsdpp', label: 'With ADSDPP', getValue: (r) => r.withAdsdpp ? 'Yes' : 'No' },
  { key: 'adsdppEdition', label: 'ADSDPP Edition' },
  { key: 'adsdppYearFormulated', label: 'ADSDPP Year Formulated' },
  { key: 'dateCommunityValidation', label: 'Date of Community Validation' },
  { key: 'dateAdoptedLgu', label: 'Date Adopted by LGU' },
  { key: 'adsdppMoreThanFiveYears', label: 'More than 5 Years', getValue: (r) => r.adsdppMoreThanFiveYears ? 'Yes' : 'No' },
  { key: 'adsdppFiveYearPlan', label: 'ADSDPP 5-Year Plan in the Plan' },
  { key: 'adsdppFundingSourceYear', label: 'ADSDPP Funding Source and Year' },
  { key: 'adsdppRemarks', label: 'ADSDPP Remarks' },
  { key: 'foundingAgencyProjectCost', label: 'Funding Agency / Project Cost' },
  { key: 'category', label: 'Category' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'adoList', label: 'ADO list' },
  { key: 'withIndicativeMap', label: 'With Indicative Map', getValue: (r) => r.withIndicativeMap ? 'Yes' : 'No' },
];

const defaultVisible = COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: true }), {});

const BASIC_INFO_KEYS = new Set([
  'no',
  'province',
  'ancestralDomain',
  'coverage',
  'locationPerCadt',
  'areaHas',
]);
const COMMUNITY_INFO_KEYS = new Set([
  'nameIccsIps',
  'noBeneficiaries',
  'adRepresentative',
]);
const CONTACT_INFO_KEYS = new Set([
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
const PROJECT_INFO_KEYS = new Set([
  'foundingAgencyProjectCost',
  'category',
  'remarks',
  'adoList',
  'withIndicativeMap',
]);

function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeHeaderLoose(h) {
  return normalizeHeader(h).replace(/[^a-z0-9]/g, '');
}

const EXPECTED_UPLOAD_KEYS_BY_INDEX = [
  null, // No
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
  const [provinceFilter, setProvinceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState(defaultVisible);
  const [showColPicker, setShowColPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [modalRecord, setModalRecord] = useState(null);
  const [modalMode, setModalMode] = useState('view');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filteredByProvince = useMemo(() => {
    if (provinceFilter === 'all') return records;
    return records.filter((r) => r.province === provinceFilter);
  }, [records, provinceFilter]);

  const withRowNo = useMemo(() => {
    if (provinceFilter === 'all') return filteredByProvince.map((r, i) => ({ ...r, _rowNo: i + 1 }));
    return filteredByProvince.map((r, i) => ({ ...r, _rowNo: i + 1 }));
  }, [filteredByProvince, provinceFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return withRowNo;
    const q = search.toLowerCase();
    return withRowNo.filter((r) =>
      COLUMNS.some((col) => {
        const val = col.getValue ? col.getValue(r, r._rowNo - 1) : r[col.key];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [withRowNo, search]);

  const toggleCol = (key) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const visibleColumns = COLUMNS.filter((c) => visibleCols[c.key]);
  const basicCount = visibleColumns.filter((c) => BASIC_INFO_KEYS.has(c.key)).length;
  const communityCount = visibleColumns.filter((c) => COMMUNITY_INFO_KEYS.has(c.key)).length;
  const contactCount = visibleColumns.filter((c) => CONTACT_INFO_KEYS.has(c.key)).length;
  const applicationCount = visibleColumns.filter((c) => APPLICATION_INFO_KEYS.has(c.key)).length;
  const approvalCount = visibleColumns.filter((c) => CADT_APPROVAL_KEYS.has(c.key)).length;
  const adsdppCount = visibleColumns.filter((c) => ADSDPP_INFO_KEYS.has(c.key)).length;
  const projectCount = visibleColumns.filter((c) => PROJECT_INFO_KEYS.has(c.key)).length;
  const otherCount = Math.max(
    0,
    visibleColumns.length -
      (basicCount +
        communityCount +
        contactCount +
        applicationCount +
        approvalCount +
        adsdppCount +
        projectCount)
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
    if (selectedCount === 0) return;
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
        if (col.key === 'no') return;
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
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      if (rows.length < 2) {
        setUploadResult({ ok: false, message: 'File has no data rows.' });
        return;
      }
      const headerRowIndex = detectHeaderRowIndex(rows);
      const uploadKeys = getUploadKeysForRow(rows[headerRowIndex]);
      const recordsToAdd = [];
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const record = {};
        uploadKeys.forEach((key, j) => {
          if (!key) return;
          let val = row[j];
          if (val === undefined || val === null) val = '';
          const existing = record[key];
          const hasExisting = existing !== undefined && existing !== null && String(existing).trim() !== '';
          if (key === 'withIndicativeMap') {
            record[key] = parseBooleanCell(val);
          } else if (key === 'withAdsdpp' || key === 'adsdppMoreThanFiveYears') {
            record[key] = parseBooleanCell(val);
          } else if (key === 'areaHas') {
            const parsed = parseNumericCell(val);
            record[key] = typeof parsed === 'number' ? toTwoDecimals(parsed) : parsed;
          } else if (key === 'noBeneficiaries') {
            record[key] = parseNumericCell(val);
          } else if (
            key === 'dateReceiptApplication' ||
            key === 'dateApprovedCeb' ||
            key === 'dateCommunityValidation' ||
            key === 'dateAdoptedLgu'
          ) {
            record[key] = parseDateCell(val);
          } else if (key === 'petitionDocketNo') {
            const text = parseTextCell(val);
            if (!text) return;
            if (hasExisting && existing !== text) {
              record[key] = `${existing} | ${text}`;
            } else if (!hasExisting) {
              record[key] = text;
            }
          } else {
            record[key] = parseTextCell(val);
          }
        });
        if (Object.keys(record).length > 0) recordsToAdd.push(record);
      }
      if (recordsToAdd.length === 0) {
        setUploadResult({ ok: false, message: 'No valid rows found in the uploaded file.' });
        return;
      }
      await addRecords(recordsToAdd);
      setUploadResult({ ok: true, count: recordsToAdd.length });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadResult({ ok: false, message: err?.message ?? 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <div className="data-sheet-page">
      <header className="data-sheet-header">
        <h1>Ancestral Domains Data</h1>
        <p>View and filter records. No. column is per selected province.</p>
      </header>

      {dataError && (
        <div className="data-sheet-error">{dataError}</div>
      )}
      {dataLoading && records.length === 0 && (
        <p className="data-sheet-loading">Loading records…</p>
      )}

      <div className="excel-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        <button type="button" className="btn btn-excel" onClick={triggerFileInput} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload from Excel'}
        </button>
        <button type="button" className="btn btn-excel" onClick={handleExport} disabled={filtered.length === 0}>
          Export to Excel
        </button>
        {selectedCount > 0 && (
          <button
            type="button"
            className="btn btn-delete"
            onClick={handleBulkDeleteClick}
          >
            Delete selected ({selectedCount})
          </button>
        )}
      </div>
      {uploadResult && (
        <div className={uploadResult.ok ? 'upload-success' : 'data-sheet-error'}>
          {uploadResult.ok ? `Uploaded ${uploadResult.count} record(s).` : uploadResult.message}
        </div>
      )}

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
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-group search-group">
          <label>Search</label>
          <input
            type="text"
            placeholder="Search across all columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sheet-search"
          />
        </div>
        <div className="toolbar-group col-picker-wrap">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowColPicker(!showColPicker)}
          >
            {showColPicker ? 'Hide columns ✓' : 'Show/Hide columns'}
          </button>
          {showColPicker && (
            <div className="column-picker">
              {COLUMNS.map((c) => (
                <label key={c.key} className="col-picker-item">
                  <input
                    type="checkbox"
                    checked={!!visibleCols[c.key]}
                    onChange={() => toggleCol(c.key)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th className="col-group-spacer" colSpan={2} aria-hidden="true"></th>
              {basicCount > 0 && (
                <th className="col-group-header" colSpan={basicCount}>1. Basic Information</th>
              )}
              {communityCount > 0 && (
                <th className="col-group-header" colSpan={communityCount}>2. Community Information</th>
              )}
              {contactCount > 0 && (
                <th className="col-group-header" colSpan={contactCount}>3. Contact Information</th>
              )}
              {applicationCount > 0 && (
                <th className="col-group-header" colSpan={applicationCount}>4. Application Information</th>
              )}
              {approvalCount > 0 && (
                <th className="col-group-header" colSpan={approvalCount}>5. CADT Approval Information</th>
              )}
              {adsdppCount > 0 && (
                <th className="col-group-header" colSpan={adsdppCount}>6. ADSDPP Information</th>
              )}
              {projectCount > 0 && (
                <th className="col-group-header" colSpan={projectCount}>7. Project / Administrative Information</th>
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
                <th key={col.key} style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                  {col.label}
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
                        : row[col.key] ?? '—'}
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
                {deleting ? 'Deleting…' : 'Delete'}
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
