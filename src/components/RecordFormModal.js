import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES, CATEGORIES } from '../constants';
import './RecordFormModal.css';

const FIELDS = [
  { key: 'province', label: 'Province', type: 'select', options: CAR_PROVINCES },
  { key: 'ancestralDomain', label: 'Ancestral Domain', type: 'text' },
  { key: 'coverage', label: 'Coverage', type: 'text' },
  { key: 'locationPerCadt', label: 'Location per CADT', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'areaHas', label: 'Area (in Hectares)', type: 'number' },
  { key: 'withIndicativeMap', label: 'With Indicative Map', type: 'checkbox' },
  { key: 'dateReceiptApplication', label: 'Date of Receipt of Application', type: 'date' },
  { key: 'petitionDocketNo', label: 'Petition No. / Docket No. of Application', type: 'text' },
  { key: 'cadcCalcNo', label: 'CADC/CALC No. (if any)', type: 'text' },
  { key: 'nameIccsIps', label: 'Name of ICCs/IPs', type: 'text' },
  { key: 'noBeneficiaries', label: 'Number of Beneficiaries / Rights Holders', type: 'number' },
  { key: 'adRepresentative', label: 'AD Representative', type: 'text' },
  { key: 'contactPerson', label: 'Contact Person', type: 'text' },
  { key: 'contactNumber', label: 'Contact Number', type: 'text' },
  { key: 'cadtNo', label: 'CADT No. (if approved)', type: 'text' },
  { key: 'dateApprovedCeb', label: 'Date Approved by CEB', type: 'date' },
  { key: 'yearIssued', label: 'Year Issued', type: 'text' },
  { key: 'cebResolutionNo', label: 'CEB Resolution No.', type: 'text' },
  { key: 'withAdsdpp', label: 'With ADSDPP', type: 'checkbox' },
  { key: 'adsdppEdition', label: 'ADSDPP Edition', type: 'text' },
  { key: 'adsdppYearFormulated', label: 'ADSDPP Year Formulated', type: 'text' },
  { key: 'dateCommunityValidation', label: 'Date of Community Validation', type: 'date' },
  { key: 'dateAdoptedLgu', label: 'Date Adopted by LGU', type: 'date' },
  { key: 'adsdppMoreThanFiveYears', label: 'More than 5 Years', type: 'checkbox' },
  { key: 'adsdppFiveYearPlan', label: 'ADSDPP 5-Year Plan in the Plan', type: 'text' },
  { key: 'adsdppFundingSourceYear', label: 'ADSDPP Funding Source and Year', type: 'text' },
  { key: 'adsdppRemarks', label: 'ADSDPP Remarks', type: 'textarea' },
  { key: 'foundingAgencyProjectCost', label: 'Funding Agency / Project Cost', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
  { key: 'remarks', label: 'Remarks', type: 'textarea' },
  { key: 'adoList', label: 'ADO list', type: 'textarea' },
];

function toTwoDecimals(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return Math.round(num * 100) / 100;
}

export default function RecordFormModal({ record, mode, onClose, onSaved }) {
  const { updateRecord } = useData();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (record) {
      const init = {};
      FIELDS.forEach((f) => {
        let v = record[f.key];
        if (f.type === 'checkbox') v = !!v;
        else if (v === undefined || v === null) v = '';
        init[f.key] = v;
      });
      setForm(init);
    }
  }, [record]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.areaHas !== '' && payload.areaHas !== null && payload.areaHas !== undefined) {
        const rounded = toTwoDecimals(payload.areaHas);
        payload.areaHas = rounded === '' ? '' : rounded;
      }
      await updateRecord(record.id, payload);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (!record) return null;

  const readOnly = mode === 'view';

  return (
    <div className="record-modal-overlay" onClick={onClose}>
      <div className="record-modal" onClick={(e) => e.stopPropagation()}>
        <div className="record-modal-header">
          <h2>{readOnly ? 'View Record' : 'Edit Record'}</h2>
          <button type="button" className="record-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {error && <div className="record-modal-error">{error}</div>}
        <form onSubmit={handleSubmit} className="record-modal-form">
          <div className="record-modal-fields">
            {FIELDS.map((f) => (
              <label key={f.key} className="record-modal-field">
                <span className="record-modal-label">{f.label}</span>
                {f.type === 'select' ? (
                  <select
                    name={f.key}
                    value={form[f.key] ?? ''}
                    onChange={handleChange}
                    disabled={readOnly}
                  >
                    <option value="">—</option>
                    {(f.options || []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    name={f.key}
                    checked={!!form[f.key]}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                ) : f.type === 'textarea' ? (
                  <textarea
                    name={f.key}
                    value={form[f.key] ?? ''}
                    onChange={handleChange}
                    readOnly={readOnly}
                    rows={2}
                  />
                ) : (
                  <input
                    type={f.type}
                    name={f.key}
                    value={form[f.key] ?? ''}
                    onChange={handleChange}
                    readOnly={readOnly}
                    step={f.type === 'number' ? 'any' : undefined}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="record-modal-actions">
            {readOnly ? (
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            ) : (
              <>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
