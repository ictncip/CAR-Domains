import React, { useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { CAR_PROVINCES, CATEGORIES } from '../constants';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import './Summaries.css';
import 'leaflet/dist/leaflet.css';

const CHART_COLORS = ['#2d4a2d', '#4a7c4a', '#6b9e6b', '#8fc08f', '#b8d9b8', '#d4e8d4', '#3d6b3d'];

function toCategory(v) {
  return String(v ?? '').trim().toLowerCase();
}

function hasValue(v) {
  return String(v ?? '').trim() !== '';
}

function asNumber(v) {
  const cleaned = String(v ?? '').replace(/,/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function asAreaNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let text = String(v ?? '').trim();
  if (!text) return 0;
  text = text.replace(/[^\d.,-]/g, '');
  if (!text) return 0;
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    text = text.replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
    if (decimalSep === ',') text = text.replace(',', '.');
  } else if (lastComma !== -1 && lastDot === -1) {
    text = text.replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function fmtArea(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Summaries() {
  const { records } = useData();
  const [coverageGeoJson, setCoverageGeoJson] = useState(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetch(`${process.env.PUBLIC_URL || ''}/province-outlines.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        setCoverageGeoJson(json);
        setMapError('');
      })
      .catch(() => {
        if (!isMounted) return;
        setCoverageGeoJson(null);
        setMapError('Could not load coverage map data.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const data = useMemo(() => {
    const byProvinceCount = CAR_PROVINCES.reduce((acc, p) => ({ ...acc, [p]: 0 }), {});
    const byCategory = CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {});

    const byProvince = CAR_PROVINCES.reduce((acc, p) => ({
      ...acc,
      [p]: {
        province: p,
        numberAds: 0,
        totalArea: 0,
        rightHolders: 0,
        approvedRegistered: 0,
        approvedUnregistered: 0,
        approvedTotal: 0,
        onProcess: 0,
        withApplication: 0,
        withoutApplication: 0,
        forProcessingTotal: 0,
        indicativeMaps: 0,
      },
    }), {});

    const totals = {
      numberAds: 0,
      totalArea: 0,
      rightHolders: 0,
      approvedRegistered: 0,
      approvedUnregistered: 0,
      approvedTotal: 0,
      onProcess: 0,
      withApplication: 0,
      withoutApplication: 0,
      forProcessingTotal: 0,
      indicativeMaps: 0,
    };

    let withMap = 0;
    let withCadt = 0;
    let ongoing = 0;
    let forProcessing = 0;

    records.forEach((r) => {
      const province = CAR_PROVINCES.includes(r.province) ? r.province : null;
      const c = toCategory(r.category);
      const isRegistered = c === 'registered';
      const isUnregistered = c === 'unregistered';
      const isOngoing = c === 'ongoing';
      const isWithApplication = c === 'with application';
      const isWithoutApplication = c === 'without application';
      const hasMap = !!r.withIndicativeMap;
      const hasCadt = hasValue(r.cadtNo);
      const area = asAreaNumber(r.areaHas);
      const rightHolders = asNumber(r.noBeneficiaries);

      if (province) byProvinceCount[province] = (byProvinceCount[province] || 0) + 1;
      if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;

      if (hasCadt) withCadt += 1;
      if (isOngoing) ongoing += 1;
      if (isWithApplication || isWithoutApplication) forProcessing += 1;
      if (hasMap) withMap += 1;

      totals.numberAds += 1;
      totals.totalArea += area;
      totals.rightHolders += rightHolders;
      if (isRegistered) totals.approvedRegistered += 1;
      if (isUnregistered) totals.approvedUnregistered += 1;
      if (isOngoing) totals.onProcess += 1;
      if (isWithApplication) totals.withApplication += 1;
      if (isWithoutApplication) totals.withoutApplication += 1;
      if (hasMap) totals.indicativeMaps += 1;

      if (province) {
        const p = byProvince[province];
        p.numberAds += 1;
        p.totalArea += area;
        p.rightHolders += rightHolders;
        if (isRegistered) p.approvedRegistered += 1;
        if (isUnregistered) p.approvedUnregistered += 1;
        if (isOngoing) p.onProcess += 1;
        if (isWithApplication) p.withApplication += 1;
        if (isWithoutApplication) p.withoutApplication += 1;
        if (hasMap) p.indicativeMaps += 1;
      }
    });

    totals.approvedTotal = totals.approvedRegistered + totals.approvedUnregistered;
    totals.forProcessingTotal = totals.withApplication + totals.withoutApplication;

    CAR_PROVINCES.forEach((pName) => {
      const p = byProvince[pName];
      p.approvedTotal = p.approvedRegistered + p.approvedUnregistered;
      p.forProcessingTotal = p.withApplication + p.withoutApplication;
    });

    const noStatus = Math.max(0, totals.numberAds - (withCadt + ongoing + forProcessing));

    return {
      stats: {
        total: records.length,
        byProvince: byProvinceCount,
        byCategory,
        totalArea: totals.totalArea,
        totalBeneficiaries: totals.rightHolders,
        withMap,
      },
      chartDataProvince: CAR_PROVINCES.map((p) => ({ name: p, count: byProvinceCount[p] || 0 })),
      chartDataCategory: CATEGORIES.filter((c) => (byCategory[c] || 0) > 0).map((c) => ({ name: c, value: byCategory[c] || 0 })),
      matrixRows: CAR_PROVINCES.map((p) => byProvince[p]),
      totals,
      summary: {
        withCadt,
        ongoing,
        forProcessing,
        total: totals.numberAds,
        noStatus,
      },
    };
  }, [records]);

  return (
    <div className="summaries-page">
      <header className="summaries-header">
        <h1>Dashboard</h1>
        <p>Overview of Cordillera Ancestral Domains data</p>
      </header>

      <section className="summary-cards">
        <div className="summary-card">
          <span className="summary-number">{data.stats.total}</span>
          <span className="summary-label">Total records</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{data.stats.totalArea.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="summary-label">Total area (Has)</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{data.stats.totalBeneficiaries.toLocaleString()}</span>
          <span className="summary-label">Total beneficiaries</span>
        </div>
        <div className="summary-card">
          <span className="summary-number">{data.stats.withMap}</span>
          <span className="summary-label">With indicative map</span>
        </div>
      </section>

      <section className="summary-section">
        <h2>By Province</h2>
        <div className="summary-table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {CAR_PROVINCES.map((p) => (
                <tr key={p}>
                  <td>{p}</td>
                  <td>{data.stats.byProvince[p] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.chartDataProvince} margin={{ top: 10, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e8e0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2d4a2d" name="Records" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="summary-section">
        <h2>By Category</h2>
        <div className="summary-table-wrap">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  <td>{data.stats.byCategory[c] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.chartDataCategory.length > 0 && (
          <div className="chart-wrap pie-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.chartDataCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {data.chartDataCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="summary-section">
        <h2>Masterlist Summary</h2>
        <div className="summary-strip">
          <div className="summary-box">
            <h2>Summary</h2>
            <div className="summary-line"><span>With CADT</span><strong>{fmtInt(data.summary.withCadt)}</strong></div>
            <div className="summary-line"><span>Ongoing</span><strong>{fmtInt(data.summary.ongoing)}</strong></div>
            <div className="summary-line"><span>For Processing</span><strong>{fmtInt(data.summary.forProcessing)}</strong></div>
            <div className="summary-line total"><span>Total</span><strong>{fmtInt(data.summary.total)}</strong></div>
            <div className="summary-line danger"><span>No Status</span><strong>{fmtInt(data.summary.noStatus)}</strong></div>
          </div>
        </div>

        <div className="summary-table-wrap full">
          <table className="summary-table matrix">
            <thead>
              <tr>
                <th rowSpan={2}>Province</th>
                <th rowSpan={2}>Number of ADs</th>
                <th rowSpan={2}>Total Area (hectares)</th>
                <th rowSpan={2}>Right Holders</th>
                <th colSpan={3}>Approved CADTs</th>
                <th rowSpan={2}>On Process</th>
                <th colSpan={3}>For Processing</th>
                <th rowSpan={2}>Indicative Maps</th>
              </tr>
              <tr>
                <th>Registered</th>
                <th>Unregistered</th>
                <th>Total</th>
                <th>With Application</th>
                <th>Without Application</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.matrixRows.map((row) => (
                <tr key={row.province}>
                  <td>{row.province}</td>
                  <td>{fmtInt(row.numberAds)}</td>
                  <td>{fmtArea(row.totalArea)}</td>
                  <td>{fmtInt(row.rightHolders)}</td>
                  <td>{fmtInt(row.approvedRegistered)}</td>
                  <td>{fmtInt(row.approvedUnregistered)}</td>
                  <td className="accent">{fmtInt(row.approvedTotal)}</td>
                  <td>{fmtInt(row.onProcess)}</td>
                  <td>{fmtInt(row.withApplication)}</td>
                  <td>{fmtInt(row.withoutApplication)}</td>
                  <td className="accent">{fmtInt(row.forProcessingTotal)}</td>
                  <td>{fmtInt(row.indicativeMaps)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Total</td>
                <td>{fmtInt(data.totals.numberAds)}</td>
                <td>{fmtArea(data.totals.totalArea)}</td>
                <td>{fmtInt(data.totals.rightHolders)}</td>
                <td>{fmtInt(data.totals.approvedRegistered)}</td>
                <td>{fmtInt(data.totals.approvedUnregistered)}</td>
                <td className="accent">{fmtInt(data.totals.approvedTotal)}</td>
                <td>{fmtInt(data.totals.onProcess)}</td>
                <td>{fmtInt(data.totals.withApplication)}</td>
                <td>{fmtInt(data.totals.withoutApplication)}</td>
                <td className="accent">{fmtInt(data.totals.forProcessingTotal)}</td>
                <td>{fmtInt(data.totals.indicativeMaps)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="summary-section">
        <h2>Figure Map</h2>
        <div className="map-wrap">
          <MapContainer center={[17.95, 121.1]} zoom={9} className="summary-map" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {coverageGeoJson && (
              <GeoJSON
                data={coverageGeoJson}
                style={() => ({
                  color: '#1c9a3a',
                  weight: 2,
                  fillColor: '#4fd06b',
                  fillOpacity: 0.28,
                })}
                onEachFeature={(feature, layer) => {
                  const props = feature.properties || {};
                  const popupHtml = `
                    <strong>${props.province || 'Coverage'}</strong><br/>
                    Municipality: ${props.municipality || 'N/A'}<br/>
                    Coverage: ${props.coverage || 'N/A'}
                  `;
                  layer.bindPopup(popupHtml);
                }}
              />
            )}
          </MapContainer>
        </div>
        {mapError && <p className="figure-error">{mapError}</p>}
      </section>
    </div>
  );
}
