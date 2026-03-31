import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES, CATEGORIES } from '../constants';
import './FormPage.css';

const initialValues = {
  number: '',
  province: '',
  ancestralDomain: '',
  coverage: '',
  locationPerCadt: '',
  areaHas: '',
  nameIccsIps: '',
  noBeneficiaries: '',
  adRepresentative: '',
  contactPerson: '',
  contactNumber: '',
  dateReceiptApplication: '',
  petitionDocketNo: '',
  cadcCalcNo: '',
  cadtNo: '',
  dateApprovedCeb: '',
  yearIssued: '',
  cebResolutionNo: '',
  withAdsdpp: false,
  adsdppEdition: '',
  adsdppYearFormulated: '',
  dateCommunityValidation: '',
  dateAdoptedLgu: '',
  adsdppMoreThanFiveYears: false,
  adsdppFiveYearPlan: '',
  adsdppFundingSourceYear: '',
  adsdppRemarks: '',
  foundingAgencyProjectCost: '',
  category: '',
  remarks: '',
  adoList: '',
  withIndicativeMap: false,
  location: '',
};

function toTwoDecimals(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '';
  return Math.round(num * 100) / 100;
}

export default function FormPage() {
  const { addRecord } = useData();
  const [form, setForm] = useState(initialValues);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.areaHas !== '' && payload.areaHas !== null && payload.areaHas !== undefined) {
        const rounded = toTwoDecimals(payload.areaHas);
        payload.areaHas = rounded === '' ? '' : rounded;
      }
      await addRecord(payload);
      setForm(initialValues);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      setSubmitError(err?.message ?? 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialValues);
    setSubmitted(false);
  };

  return (
    <div className="form-page">
      <header className="form-page-header">
        <h1>Ancestral Domain Application / Record</h1>
        <p>Add or register a record using the same headers shown in the data sheet</p>
      </header>

      {submitted && (
        <div className="form-success">Record saved successfully.</div>
      )}
      {submitError && (
        <div className="form-error">{submitError}</div>
      )}

      <form onSubmit={handleSubmit} className="cad-form">
        <section className="form-section">
          <h2>1. Core Identification</h2>
          <div className="form-grid">
            <label>
              No
              <input
                type="text"
                name="number"
                value={form.number}
                onChange={handleChange}
                placeholder="Pre-determined number"
              />
            </label>
            <label>
              Ancestral Domain
              <input
                type="text"
                name="ancestralDomain"
                value={form.ancestralDomain}
                onChange={handleChange}
                placeholder="Ancestral Domain"
              />
            </label>
            <label>
              Province
              <select
                name="province"
                value={form.province}
                onChange={handleChange}
                required
              >
                <option value="">Select province</option>
                {CAR_PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Coverage
              <input
                type="text"
                name="coverage"
                value={form.coverage}
                onChange={handleChange}
                placeholder="Coverage"
              />
            </label>
            <label>
              Location Per CADT
              <input
                type="text"
                name="locationPerCadt"
                value={form.locationPerCadt}
                onChange={handleChange}
                placeholder="Location Per CADT"
              />
            </label>
            <label>
              Area (in Has)
              <input
                type="number"
                name="areaHas"
                value={form.areaHas}
                onChange={handleChange}
                placeholder="Area (in Has)"
                min="0"
                step="0.01"
              />
            </label>
            <label>
              Name of ICCs/IPs
              <input
                type="text"
                name="nameIccsIps"
                value={form.nameIccsIps}
                onChange={handleChange}
                placeholder="Name of ICCs/IPs"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>2. Application Details</h2>
          <div className="form-grid">
            <label>
              Date of Receipt of Application
              <input
                type="date"
                name="dateReceiptApplication"
                value={form.dateReceiptApplication}
                onChange={handleChange}
              />
            </label>
            <label>
              Petition No / Docket No
              <input
                type="text"
                name="petitionDocketNo"
                value={form.petitionDocketNo}
                onChange={handleChange}
                placeholder="Petition No / Docket No"
              />
            </label>
            <label>
              CADC/CALC No (if any)
              <input
                type="text"
                name="cadcCalcNo"
                value={form.cadcCalcNo}
                onChange={handleChange}
                placeholder="CADC/CALC No (if any)"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>3. Beneficiaries</h2>
          <div className="form-grid">
            <label>
              No of Beneficiaries / Rights Holders
              <input
                type="number"
                name="noBeneficiaries"
                value={form.noBeneficiaries}
                onChange={handleChange}
                placeholder="Number"
                min="0"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>4. CADT Approval / Status</h2>
          <div className="form-grid">
            <label>
              CADT No. (if approved)
              <input
                type="text"
                name="cadtNo"
                value={form.cadtNo}
                onChange={handleChange}
                placeholder="CADT number"
              />
            </label>
            <label>
              Date Approved by CEB
              <input
                type="date"
                name="dateApprovedCeb"
                value={form.dateApprovedCeb}
                onChange={handleChange}
              />
            </label>
            <label>
              Year Issued
              <input
                type="text"
                name="yearIssued"
                value={form.yearIssued}
                onChange={handleChange}
                placeholder="Year"
              />
            </label>
            <label>
              CEB Resolution No.
              <input
                type="text"
                name="cebResolutionNo"
                value={form.cebResolutionNo}
                onChange={handleChange}
                placeholder="CEB resolution no"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>5. Contacts</h2>
          <div className="form-grid">
            <label>
              AD Representative
              <input
                type="text"
                name="adRepresentative"
                value={form.adRepresentative}
                onChange={handleChange}
                placeholder="AD Representative"
              />
            </label>
            <label>
              Contact Person
              <input
                type="text"
                name="contactPerson"
                value={form.contactPerson}
                onChange={handleChange}
                placeholder="Contact Person"
              />
            </label>
            <label>
              Contact Number
              <input
                type="text"
                name="contactNumber"
                value={form.contactNumber}
                onChange={handleChange}
                placeholder="Contact Number"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>6. Funding &amp; Classification</h2>
          <div className="form-grid">
            <label>
              Funding Agency | Project Cost
              <input
                type="text"
                name="foundingAgencyProjectCost"
                value={form.foundingAgencyProjectCost}
                onChange={handleChange}
                placeholder="Funding Agency | Project Cost"
              />
            </label>
            <label>
              Category
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>7. Mapping</h2>
          <div className="form-grid">
            <label className="form-check">
              <input
                type="checkbox"
                name="withIndicativeMap"
                checked={form.withIndicativeMap}
                onChange={handleChange}
              />
              With Indicative Map
            </label>
            <label>
              Shapefile ID
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Shapefile ID"
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>8. General Remarks</h2>
          <div className="form-grid form-grid-full">
            <label>
              Remarks
              <textarea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                placeholder="Remarks"
                rows={2}
              />
            </label>
          </div>
        </section>

        <section className="form-section">
          <h2>9. ADSDPP</h2>
          <div className="form-grid">
            <label className="form-check">
              <input
                type="checkbox"
                name="withAdsdpp"
                checked={form.withAdsdpp}
                onChange={handleChange}
              />
              WITH ADSDPP
            </label>
            <label>
              Edition
              <input
                type="text"
                name="adsdppEdition"
                value={form.adsdppEdition}
                onChange={handleChange}
                placeholder="Edition"
              />
            </label>
            <label>
              ADSDPP Year Formulated
              <input
                type="text"
                name="adsdppYearFormulated"
                value={form.adsdppYearFormulated}
                onChange={handleChange}
                placeholder="Year"
              />
            </label>
            <label>
              Date of Community Validation
              <input
                type="date"
                name="dateCommunityValidation"
                value={form.dateCommunityValidation}
                onChange={handleChange}
              />
            </label>
            <label>
              Date Adopted by LGU
              <input
                type="date"
                name="dateAdoptedLgu"
                value={form.dateAdoptedLgu}
                onChange={handleChange}
              />
            </label>
            <label className="form-check">
              <input
                type="checkbox"
                name="adsdppMoreThanFiveYears"
                checked={form.adsdppMoreThanFiveYears}
                onChange={handleChange}
              />
              More than 5 Years
            </label>
            <label>
              ADSDPP 5-Year Plan in the Plan
              <input
                type="text"
                name="adsdppFiveYearPlan"
                value={form.adsdppFiveYearPlan}
                onChange={handleChange}
                placeholder="5-Year plan"
              />
            </label>
            <label>
              ADSDPP Funding Source and Year
              <input
                type="text"
                name="adsdppFundingSourceYear"
                value={form.adsdppFundingSourceYear}
                onChange={handleChange}
                placeholder="Source and year"
              />
            </label>
            <label>
              ADSDPP Remarks
              <input
                type="text"
                name="adsdppRemarks"
                value={form.adsdppRemarks}
                onChange={handleChange}
                placeholder="Remarks"
              />
            </label>
          </div>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save Record'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetForm}>
            Reset Form
          </button>
        </div>
      </form>
    </div>
  );
}
